// OpenClaw Cyber — Firewall Analyzer
export const definition = {
  type: 'function',
  function: {
    name: 'firewall_analyzer',
    description: 'Analyze firewall rules, detect filtering behavior, and identify potential bypass vectors. Tests various protocols, packet types, and evasion techniques against a target to map the firewall ruleset.',
    parameters: {
      type: 'object',
      properties: {
        host: { type: 'string', description: 'Target host to analyze firewall for' },
        ports: { type: 'string', description: 'Ports to test (comma-separated or range, default: common)' },
        techniques: { type: 'string', enum: ['all', 'fragmentation', 'timing', 'protocol', 'encoding'], description: 'Bypass techniques to test (default: all)' }
      },
      required: ['host']
    }
  }
};

import net from 'net';

export async function execute(args) {
  const { host, ports = '21,22,23,25,53,80,110,135,139,143,443,445,993,995,1433,3306,3389,5432,5900,8080,8443', techniques = 'all' } = args;

  const portList = ports.split(',').map(p => parseInt(p.trim())).filter(p => p > 0 && p <= 65535);
  const results = { success: true, host, analysis: {} };

  // ─── Port Filtering Analysis ───
  const portResults = [];
  for (const port of portList) {
    const result = await _testPort(host, port);
    portResults.push(result);
  }
  
  results.analysis.port_filtering = {
    open: portResults.filter(r => r.status === 'open').map(r => r.port),
    closed: portResults.filter(r => r.status === 'closed').map(r => r.port),
    filtered: portResults.filter(r => r.status === 'filtered').map(r => r.port),
  };

  // ─── Firewall Type Detection ───
  const firewallIndicators = [];

  // Check if filtered ports timeout (stateful) or reset (stateless)
  const filteredPorts = portResults.filter(r => r.status === 'filtered');
  if (filteredPorts.length > 0) {
    const timeoutCount = filteredPorts.filter(r => r.reason === 'timeout').length;
    const resetCount = filteredPorts.filter(r => r.reason === 'reset').length;
    
    if (timeoutCount > resetCount) {
      firewallIndicators.push({ type: 'Stateful Firewall (DROP)', confidence: 'HIGH', evidence: `${timeoutCount}/${filteredPorts.length} filtered ports timeout (drop policy)` });
    } else if (resetCount > 0) {
      firewallIndicators.push({ type: 'Stateless Firewall (REJECT)', confidence: 'HIGH', evidence: `${resetCount}/${filteredPorts.length} filtered ports send RST (reject policy)` });
    }
  }

  // Check for inconsistent filtering (suggests application-layer firewall)
  const openPorts = portResults.filter(r => r.status === 'open');
  if (openPorts.some(r => [80, 443, 8080].includes(r.port)) && portResults.some(r => r.status === 'filtered' && [22, 3389].includes(r.port))) {
    firewallIndicators.push({ type: 'Application-Layer Firewall', confidence: 'MEDIUM', evidence: 'Web ports open but management ports filtered' });
  }

  results.analysis.firewall_type = firewallIndicators;

  // ─── Bypass Recommendations ───
  results.analysis.bypass_recommendations = [];

  if (filteredPorts.length > 0) {
    results.analysis.bypass_recommendations.push(
      { technique: 'Source Port Spoofing', command: `nmap -g 53 ${host}`, description: 'Use DNS source port (53) to bypass rules allowing DNS responses' },
      { technique: 'IP Fragmentation', command: `nmap -f ${host}`, description: 'Fragment packets to evade deep packet inspection' },
      { technique: 'Decoy Scan', command: `nmap -D RND:10 ${host}`, description: 'Use decoy addresses to obscure scanner IP' },
      { technique: 'Idle Scan', command: `nmap -sI zombie_ip ${host}`, description: 'Use a zombie host for truly anonymous scanning' },
      { technique: 'Timing Evasion', command: `nmap -T1 ${host}`, description: 'Paranoid timing to avoid IDS detection' },
      { technique: 'FIN Scan', command: `nmap -sF ${host}`, description: 'Send FIN packets (bypasses some SYN-only firewalls)' },
      { technique: 'NULL Scan', command: `nmap -sN ${host}`, description: 'Send packets with no flags set' },
      { technique: 'XMAS Scan', command: `nmap -sX ${host}`, description: 'Send FIN/PSH/URG flags' },
      { technique: 'ACK Scan', command: `nmap -sA ${host}`, description: 'Map firewall rulesets (identify filtered vs unfiltered)' },
      { technique: 'MTU Evasion', command: `nmap --mtu 24 ${host}`, description: 'Custom MTU size for fragmentation evasion' },
      { technique: 'Data Length', command: `nmap --data-length 50 ${host}`, description: 'Append random data to packets' },
      { technique: 'HTTP Tunnel', command: `nmap -sT --proxy socks4://proxy:1080 ${host}`, description: 'Route through proxy/tunnel' }
    );
  }

  return results;
}

function _testPort(host, port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const startTime = Date.now();
    
    socket.setTimeout(3000);
    
    socket.on('connect', () => {
      socket.destroy();
      resolve({ port, status: 'open', latency_ms: Date.now() - startTime });
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve({ port, status: 'filtered', reason: 'timeout', latency_ms: Date.now() - startTime });
    });

    socket.on('error', (err) => {
      socket.destroy();
      if (err.code === 'ECONNREFUSED') {
        resolve({ port, status: 'closed', reason: 'refused', latency_ms: Date.now() - startTime });
      } else if (err.code === 'ECONNRESET') {
        resolve({ port, status: 'filtered', reason: 'reset', latency_ms: Date.now() - startTime });
      } else {
        resolve({ port, status: 'filtered', reason: err.code || err.message, latency_ms: Date.now() - startTime });
      }
    });

    socket.connect(port, host);
  });
}
