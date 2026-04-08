// OpenClaw Cyber — Network Sniffer/Analyzer
import { spawn } from 'child_process';

export const definition = {
  type: 'function',
  function: {
    name: 'network_sniffer',
    description: 'Capture and analyze network traffic using tcpdump or tshark. Supports packet capture, protocol analysis, traffic filtering, and credential sniffing. Requires root/sudo privileges.',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['capture', 'analyze', 'arp_scan', 'connections'], description: 'Action: capture packets, analyze pcap, scan ARP table, or list active connections' },
        interface: { type: 'string', description: 'Network interface (e.g., "eth0", "wlan0"). Use "any" for all.' },
        filter: { type: 'string', description: 'BPF packet filter (e.g., "port 80", "host 192.168.1.1", "tcp")' },
        count: { type: 'integer', description: 'Number of packets to capture (default: 50)' },
        duration_sec: { type: 'integer', description: 'Capture duration in seconds (default: 10)' },
        output_file: { type: 'string', description: 'Save capture to file (pcap format)' }
      },
      required: ['action']
    }
  }
};

export async function execute(args) {
  const { action, interface: iface = 'any', filter, count = 50, duration_sec = 10, output_file } = args;

  switch (action) {
    case 'capture':
      return _capture(iface, filter, count, duration_sec, output_file);
    case 'analyze':
      return _analyzeCapture(filter);
    case 'arp_scan':
      return _arpScan(iface);
    case 'connections':
      return _listConnections();
    default:
      return { success: false, error: `Unknown action: ${action}` };
  }
}

async function _capture(iface, filter, count, duration, outputFile) {
  return new Promise((resolve) => {
    const args = ['-i', iface, '-c', String(count), '-nn', '-l'];
    if (filter) args.push(...filter.split(' '));
    if (outputFile) args.push('-w', outputFile);

    const proc = spawn('tcpdump', args, { timeout: (duration + 5) * 1000 });
    let output = '';
    let errOutput = '';

    const maxAccumulation = 1000000;
    proc.stdout.on('data', (d) => { 
      if (output.length < maxAccumulation) output += d.toString(); 
    });
    proc.stderr.on('data', (d) => { 
      if (errOutput.length < maxAccumulation) errOutput += d.toString(); 
    });

    const timer = setTimeout(() => {
      proc.kill();
    }, duration * 1000);

    proc.on('close', (code) => {
      clearTimeout(timer);
      if (output.length === 0 && errOutput.includes('Operation not permitted')) {
        resolve({ success: false, error: 'tcpdump requires root/sudo privileges. Run: sudo node cli.js' });
        return;
      }
      
      const packets = output.split('\n').filter(l => l.trim()).slice(0, 100);
      resolve({
        success: true,
        packets_captured: packets.length,
        interface: iface,
        filter: filter || 'none',
        output: packets.join('\n'),
        saved_to: outputFile || null
      });
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      resolve({ success: false, error: `tcpdump not found or error: ${err.message}. Install: sudo apt install tcpdump` });
    });
  });
}

async function _arpScan(iface) {
  return new Promise((resolve) => {
    const proc = spawn('arp', ['-a']);
    let output = '';
    proc.stdout.on('data', (d) => { output += d.toString(); });
    proc.on('close', () => {
      const entries = output.split('\n').filter(l => l.trim()).map(l => {
        const match = l.match(/\((\d+\.\d+\.\d+\.\d+)\)\s+at\s+([^\s]+)/);
        return match ? { ip: match[1], mac: match[2] } : null;
      }).filter(Boolean);
      resolve({ success: true, entries, count: entries.length });
    });
    proc.on('error', () => resolve({ success: false, error: 'arp command not found' }));
  });
}

async function _listConnections() {
  return new Promise((resolve) => {
    const proc = spawn('ss', ['-tunap']);
    let output = '';
    proc.stdout.on('data', (d) => { output += d.toString(); });
    proc.on('close', () => {
      resolve({ success: true, connections: output, note: 'Active network connections' });
    });
    proc.on('error', () => {
      // Fallback to netstat
      const proc2 = spawn('netstat', ['-tunap']);
      let out2 = '';
      proc2.stdout.on('data', (d) => { out2 += d.toString(); });
      proc2.on('close', () => resolve({ success: true, connections: out2 }));
      proc2.on('error', () => resolve({ success: false, error: 'Neither ss nor netstat found.' }));
    });
  });
}

async function _analyzeCapture(filter) {
  return {
    success: true,
    message: 'Use execute_command with tshark for pcap analysis. Example: tshark -r capture.pcap -Y "http.request"',
    example_filters: [
      'tshark -r file.pcap -Y "http.request" — HTTP requests',
      'tshark -r file.pcap -Y "dns" — DNS queries',
      'tshark -r file.pcap -Y "ftp.request.command" — FTP commands',
      'tshark -r file.pcap -Y "tcp.flags.syn==1" — SYN packets',
      'tshark -r file.pcap -z credentials — Extract credentials',
    ]
  };
}
