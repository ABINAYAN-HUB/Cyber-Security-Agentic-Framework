// Jarvis Cyber v4.0 — Dynamic Tool Bridge
// Runtime service discovery, proxy routing, and tool orchestration
// Detects running tools (Burp, ZAP, Metasploit, MCP servers) dynamically
import { execSync } from 'child_process';
import config from './config.js';

// ═══════════════════════════════════════════════════════════
// Service definitions — all proxy-capable tools auto-detected
// ═══════════════════════════════════════════════════════════
const KNOWN_SERVICES = [
  { name: 'burpsuite', displayName: 'Burp Suite Proxy', port: parseInt(process.env.BURP_PROXY?.split(':')[1]) || 8080, host: process.env.BURP_PROXY?.split(':')[0] || '127.0.0.1', type: 'http_proxy', protocol: 'http' },
  { name: 'zaproxy', displayName: 'OWASP ZAP Proxy', port: parseInt(process.env.ZAP_PROXY?.split(':')[1]) || 8090, host: process.env.ZAP_PROXY?.split(':')[0] || '127.0.0.1', type: 'http_proxy', protocol: 'http' },
  { name: 'mitmproxy', displayName: 'mitmproxy', port: 8081, host: '127.0.0.1', type: 'http_proxy', protocol: 'http' },
  { name: 'metasploit', displayName: 'Metasploit RPC', port: 55553, host: '127.0.0.1', type: 'rpc', protocol: 'http' },
  { name: 'burp_mcp', displayName: 'Burp Suite MCP Server', port: 9876, host: '127.0.0.1', type: 'mcp', protocol: 'http' },
  { name: 'collaborator', displayName: 'Burp Collaborator', port: 9090, host: '127.0.0.1', type: 'oob', protocol: 'http' },
  { name: 'interactsh', displayName: 'Interactsh Server', port: 8553, host: '127.0.0.1', type: 'oob', protocol: 'http' },
];

class ToolBridge {
  constructor() {
    this.activeServices = new Map();
    this.lastScan = 0;
    this.scanInterval = 30000; // Re-scan every 30 seconds
    this.toolUsageLog = []; // Telemetry
  }

  // ═══ SERVICE DISCOVERY ═══

  /**
   * Scan for running tool services — called automatically on each agent turn
   * @returns {Map<string, Object>} Active services
   */
  scan() {
    const now = Date.now();
    if (now - this.lastScan < this.scanInterval && this.activeServices.size > 0) {
      return this.activeServices; // Use cached result
    }
    this.lastScan = now;
    this.activeServices.clear();

    // Batch check all ports in a single shell command for speed
    const portChecks = KNOWN_SERVICES.map(s =>
      `(echo >/dev/tcp/${s.host}/${s.port}) 2>/dev/null && echo "${s.name}:${s.port}" || true`
    ).join('; ');

    try {
      const result = execSync(`/bin/bash -c '${portChecks}'`, {
        encoding: 'utf8',
        timeout: 5000,
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim();

      for (const line of result.split('\n').filter(Boolean)) {
        const [name, port] = line.split(':');
        const service = KNOWN_SERVICES.find(s => s.name === name);
        if (service) {
          this.activeServices.set(name, {
            ...service,
            status: 'active',
            detectedAt: new Date().toISOString(),
          });
        }
      }
    } catch {
      // Port scan failed — try individual net checks as fallback
      for (const service of KNOWN_SERVICES) {
        try {
          execSync(`/bin/bash -c '(echo >/dev/tcp/${service.host}/${service.port}) 2>/dev/null'`, {
            timeout: 2000,
            stdio: 'ignore',
          });
          this.activeServices.set(service.name, {
            ...service,
            status: 'active',
            detectedAt: new Date().toISOString(),
          });
        } catch { /* port closed */ }
      }
    }

    return this.activeServices;
  }

  // ═══ PROXY ROUTING ═══

  /**
   * Get the first active HTTP proxy (Burp > ZAP > mitmproxy)
   * @returns {string|null} Proxy URL like "http://127.0.0.1:8080"
   */
  getActiveProxy() {
    this.scan();
    const proxyPriority = ['burpsuite', 'zaproxy', 'mitmproxy'];
    for (const name of proxyPriority) {
      const service = this.activeServices.get(name);
      if (service && service.type === 'http_proxy') {
        return `${service.protocol}://${service.host}:${service.port}`;
      }
    }
    return null;
  }

  /**
   * Get proxy flags for curl commands
   * @returns {string} Curl proxy flag or empty string
   */
  getCurlProxyFlag() {
    const proxy = this.getActiveProxy();
    return proxy ? `-x ${proxy} -sk` : '-sk';
  }

  /**
   * Check if a specific service is active
   * @param {string} name Service name (e.g., 'burpsuite', 'metasploit')
   * @returns {boolean}
   */
  isServiceActive(name) {
    this.scan();
    return this.activeServices.has(name);
  }

  // ═══ TOOL TELEMETRY ═══

  /**
   * Log a tool execution for telemetry
   * @param {string} toolName
   * @param {Object} args
   * @param {Object} result
   * @param {number} durationMs
   */
  logToolUsage(toolName, args, result, durationMs) {
    this.toolUsageLog.push({
      tool: toolName,
      args_summary: this._summarizeArgs(toolName, args),
      success: result?.success !== false,
      duration_ms: durationMs,
      timestamp: new Date().toISOString(),
      mitre: this._mapToMitre(toolName, args),
    });
  }

  /**
   * Get tool usage stats for the current session
   * @returns {Object} Usage breakdown
   */
  getUsageStats() {
    const stats = {};
    for (const entry of this.toolUsageLog) {
      if (!stats[entry.tool]) {
        stats[entry.tool] = { calls: 0, successes: 0, failures: 0, total_duration_ms: 0, subtypes: {} };
      }
      stats[entry.tool].calls++;
      if (entry.success) stats[entry.tool].successes++;
      else stats[entry.tool].failures++;
      stats[entry.tool].total_duration_ms += entry.duration_ms || 0;

      // Track command subtypes for execute_command
      if (entry.args_summary) {
        const subtype = entry.args_summary;
        stats[entry.tool].subtypes[subtype] = (stats[entry.tool].subtypes[subtype] || 0) + 1;
      }
    }
    return stats;
  }

  /**
   * Get the full execution log for report generation
   * @returns {Array}
   */
  getExecutionLog() {
    return [...this.toolUsageLog];
  }

  /**
   * Clear telemetry for a new engagement
   */
  resetTelemetry() {
    this.toolUsageLog = [];
  }

  // ═══ DYNAMIC CONTEXT ═══

  /**
   * Generate dynamic context string for the system prompt
   * Injects active services, proxy info, and tool stats
   * @returns {string}
   */
  getContext() {
    this.scan();

    if (this.activeServices.size === 0 && this.toolUsageLog.length === 0) {
      return ''; // No context to inject
    }

    let ctx = '\n\n## ACTIVE TOOL SERVICES (Auto-Detected)\n\n';

    if (this.activeServices.size > 0) {
      for (const [, service] of this.activeServices) {
        ctx += `✅ **${service.displayName}** — active on \`${service.host}:${service.port}\``;
        if (service.type === 'http_proxy') {
          ctx += ` — HTTP traffic will be routed through this proxy automatically`;
        }
        ctx += '\n';
      }

      const proxy = this.getActiveProxy();
      if (proxy) {
        ctx += `\n**Active Proxy**: \`${proxy}\` — stealth_browser and curl requests auto-routed.\n`;
        ctx += `For manual curl: \`curl -x ${proxy} -sk "https://target/"\`\n`;
      }
    } else {
      ctx += '_No active proxy or tool services detected. Tools will operate directly._\n';
    }

    // Session tool usage summary
    if (this.toolUsageLog.length > 0) {
      const stats = this.getUsageStats();
      ctx += `\n### Session Tool Usage (${this.toolUsageLog.length} total calls)\n`;
      for (const [tool, data] of Object.entries(stats)) {
        ctx += `- **${tool}**: ${data.calls} calls (${data.successes}✅ ${data.failures}❌)`;
        const subtypes = Object.entries(data.subtypes).slice(0, 5);
        if (subtypes.length > 0) {
          ctx += ` — ${subtypes.map(([k, v]) => `${k}:${v}`).join(', ')}`;
        }
        ctx += '\n';
      }
    }

    return ctx;
  }

  // ═══ PRIVATE HELPERS ═══

  /**
   * Extract a summary of tool args for telemetry
   */
  _summarizeArgs(toolName, args) {
    if (toolName === 'execute_command' && args?.command) {
      // Extract the base command name
      const cmd = args.command.trim().replace(/^sudo\s+(-\w+\s+)*/, '');
      const base = cmd.split(/\s+/)[0]?.split('/').pop() || 'unknown';
      return base;
    }
    if (toolName === 'stealth_browser') return args?.action || 'navigate';
    if (toolName === 'web_search' || toolName === 'tavily_search') return 'search';
    return null;
  }

  /**
   * Map a tool execution to MITRE ATT&CK technique IDs
   */
  _mapToMitre(toolName, args) {
    const cmdMitre = {
      nmap: 'T1046', masscan: 'T1046', subfinder: 'T1590', amass: 'T1590',
      sqlmap: 'T1190', nuclei: 'T1190', nikto: 'T1190', ffuf: 'T1595',
      gobuster: 'T1595', hydra: 'T1110', hashcat: 'T1110', john: 'T1110',
      curl: 'T1071', wget: 'T1071', msfconsole: 'T1190', msfvenom: 'T1587',
      burpsuite: 'T1190', zaproxy: 'T1190', aircrack: 'T1040',
      responder: 'T1557', bloodhound: 'T1087', crackmapexec: 'T1021',
      linpeas: 'T1068', winpeas: 'T1068', chisel: 'T1572',
    };

    if (toolName === 'execute_command' && args?.command) {
      const base = args.command.trim().replace(/^sudo\s+(-\w+\s+)*/, '').split(/\s+/)[0]?.split('/').pop();
      return cmdMitre[base] || null;
    }

    const toolMitre = {
      stealth_browser: 'T1190', shodan_search: 'T1596', dns_recon: 'T1590',
      cve_lookup: 'T1588', whois_lookup: 'T1596', web_search: 'T1593',
      nuclei_scan: 'T1190', subfinder_enum: 'T1590', metasploit_rpc: 'T1190',
    };
    return toolMitre[toolName] || null;
  }
}

export const toolBridge = new ToolBridge();
