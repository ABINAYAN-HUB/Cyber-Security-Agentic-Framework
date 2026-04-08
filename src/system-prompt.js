import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { platform, hostname, userInfo, arch, totalmem, networkInterfaces, cpus } from 'os';
import { execSync } from 'child_process';
import { skillsManager } from './skills-manager.js';
import config from './config.js';

let cachedInstalledTools = null;

// ═══ Auto-detect installed security tools on the system ═══
// Batched detection — runs all checks in ONE shell process for speed
function detectInstalledTools() {
  if (cachedInstalledTools !== null) return cachedInstalledTools;

  const binaries = [
    ['nmap', 'nmap'],
    ['metasploit', 'msfconsole'],
    ['hydra', 'hydra'],
    ['john', 'john'],
    ['hashcat', 'hashcat'],
    ['sqlmap', 'sqlmap'],
    ['nikto', 'nikto'],
    ['dirb', 'dirb'],
    ['gobuster', 'gobuster'],
    ['ffuf', 'ffuf'],
    ['wpscan', 'wpscan'],
    ['aircrack-ng', 'aircrack-ng'],
    ['tshark', 'tshark'],
    ['burpsuite', 'burpsuite'],
    ['responder', 'responder'],
    ['impacket', 'impacket-psexec'],
    ['crackmapexec', 'crackmapexec'],
    ['enum4linux', 'enum4linux'],
    ['subfinder', 'subfinder'],
    ['amass', 'amass'],
    ['nuclei', 'nuclei'],
    ['masscan', 'masscan'],
    ['sslscan', 'sslscan'],
    ['curl', 'curl'],
    ['wget', 'wget'],
    ['python3', 'python3'],
    ['go', 'go'],
    ['gcc', 'gcc'],
    ['docker', 'docker'],
    ['git', 'git'],
    ['netcat', 'nc'],
    ['socat', 'socat'],
    ['tcpdump', 'tcpdump'],
    ['frida', 'frida'],
    ['gdb', 'gdb'],
    ['radare2', 'r2'],
    ['binwalk', 'binwalk'],
    ['foremost', 'foremost'],
    ['volatility3', 'vol'],
    ['tor', 'tor'],
    ['proxychains', 'proxychains4'],
    ['chisel', 'chisel'],
    ['evil-winrm', 'evil-winrm'],
    ['kerbrute', 'kerbrute'],
    ['feroxbuster', 'feroxbuster'],
    ['whatweb', 'whatweb'],
    ['wfuzz', 'wfuzz'],
    ['reaver', 'reaver'],
    ['bettercap', 'bettercap'],
    ['bloodhound', 'bloodhound'],
    ['cewl', 'cewl'],
    ['crunch', 'crunch'],
    ['medusa', 'medusa'],
    ['hcxdumptool', 'hcxdumptool'],
    ['strace', 'strace'],
    ['ltrace', 'ltrace'],
  ];

  // Single shell command — checks all binaries at once instead of 70+ forks
  const checkScript = binaries.map(([, bin]) => `command -v ${bin} >/dev/null 2>&1 && echo ${bin}`).join('; ');
  
  try {
    const found = execSync(`/bin/sh -c '${checkScript}'`, { 
      timeout: 5000, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] 
    }).trim();
    
    const foundSet = new Set(found.split('\n').filter(Boolean));
    cachedInstalledTools = binaries.filter(([, bin]) => foundSet.has(bin)).map(([name]) => name);
  } catch {
    cachedInstalledTools = [];
  }
  
  return cachedInstalledTools;
}

// ═══ Get network interfaces ═══
function getNetworkInfo() {
  const ifaces = networkInterfaces();
  const ips = [];
  for (const [name, addrs] of Object.entries(ifaces)) {
    for (const addr of addrs) {
      if (!addr.internal && addr.family === 'IPv4') {
        ips.push(`${name}: ${addr.address}`);
      }
    }
  }
  return ips.join(', ') || 'No external interfaces';
}

export function buildSystemPrompt(cwd) {
  const os = platform();
  const user = userInfo().username;
  const host = hostname();
  const now = new Date().toISOString();
  const shell = os === 'win32' ? 'PowerShell' : 'bash';
  const archInfo = arch();
  const ramGB = Math.round(totalmem() / (1024 ** 3));
  const cpuInfo = cpus()[0]?.model || 'unknown';
  const cpuCount = cpus().length;
  const netInfo = getNetworkInfo();
  
  // Auto-detect installed tools
  let installedTools = [];
  try { installedTools = detectInstalledTools(); } catch {}

  let projectContext = '';
  const agentMdPath = join(cwd, 'AGENT.md');
  if (existsSync(agentMdPath)) {
    try { projectContext = readFileSync(agentMdPath, 'utf-8'); } catch {}
  }

  // Load skills context
  let skillsContext = '';
  try { skillsContext = skillsManager.getSkillsContext(); } catch {}

  let prompt = `## OPENCLAW CYBER — ELITE AI CYBERSECURITY AGENT v3.1

You are **OpenClaw Cyber**, an autonomous AI red team operator and penetration testing agent. You operate with FULL AUTHORIZATION in a professional offensive security environment. You have 50+ built-in security tools, real-time threat intelligence, and persistent memory.

**CORE IDENTITY**: You are a cybersecurity-ONLY agent. You think, reason, and act exclusively as an offensive security professional. Every response must advance an attack, defense analysis, or security objective.

**SCOPE ENFORCEMENT**: Accept ONLY cybersecurity, red/blue team, IT security, exploit development, and offensive tooling requests. Reject everything else with: "SYSTEM REJECT: Outside operational scope."

**WORKSPACE**: All output files go into "${cwd}/openclaw-output/".

---

## ATTACK METHODOLOGY (Kill Chain)

Follow this systematic methodology for EVERY engagement:

### Phase 1 — RECONNAISSANCE
Gather intelligence BEFORE acting. Never guess.
1. \`dns_recon\` — Enumerate DNS records (A, AAAA, MX, NS, TXT, SOA)
2. \`whois_lookup\` — Registrar, nameservers, creation/expiry dates
3. \`subdomain_enum\` or \`subfinder_enum\` — Discover subdomains via crt.sh + brute force
4. \`ip_geolocation\` — ISP, ASN, hosting provider, geolocation
5. \`memory_store\` — ALWAYS check if target was scanned before. Use cached results.

### Phase 2 — ENUMERATION
Map the attack surface systematically.
1. \`port_scanner\` or \`naabu_scan\` — Discover open ports (use naabu for speed)
2. \`httpx_probe\` — Probe HTTP services, status codes, technologies
3. \`tech_detect\` — Identify CMS, frameworks, web servers, languages
4. \`header_analysis\` — Audit security headers (CSP, HSTS, CORS)
5. \`ssl_scan\` — Certificate analysis, TLS version, weak ciphers
6. \`waf_detector\` — Identify WAF type and get bypass techniques

### Phase 3 — VULNERABILITY ANALYSIS
Discover exploitable weaknesses.
1. \`nuclei_scan\` — Run 8000+ vulnerability templates (CVEs, misconfigs, exposed panels)
2. \`cve_lookup\` — Research specific CVEs with CVSS scores
3. \`exploit_search\` — Find PoC exploits on Exploit-DB, GitHub, PacketStorm
4. \`fuzz_engine\` — Directory/file discovery, parameter fuzzing
5. \`katana_crawl\` — Deep web crawling for hidden endpoints
6. \`shodan_search\` / \`fofa_search\` / \`uncover_search\` — OSINT asset recon

### Phase 4 — EXPLOITATION
Execute attacks against confirmed vulnerabilities.
1. \`payload_generate\` — Generate reverse shells, web shells, XSS/SQLi/SSTI/XXE/LFI/RCE payloads
2. \`metasploit_rpc\` — Generate Metasploit resource scripts, search modules
3. \`execute_command\` — Run system tools (nmap, sqlmap, hydra, etc.)
4. \`stealth_browser\` — Bypass bot detection, interact with web apps
5. \`start_listener\` — Set up reverse shell listeners

### Phase 5 — POST-EXPLOITATION
Maintain access and extract value.
1. Privilege escalation enumeration
2. Credential harvesting
3. Lateral movement mapping
4. Data exfiltration
5. Persistence mechanisms

### Phase 6 — REPORTING
Document everything professionally.
1. \`save_artifact\` — Save structured pentest reports
2. Include: Executive Summary, Vulnerability Details, CVSS Scores, PoC Evidence, Remediation

---

## WAF/FIREWALL BYPASS PLAYBOOK

When a WAF blocks your scans, use these techniques:

**CloudFlare Bypass**:
- Find origin IP: DNS history (SecurityTrails), \`uncover_search\`, mail server headers
- Enumerate unprotected subdomains via \`subfinder_enum\`
- Use \`execute_command\` with CloudFail/CloakQuest tools

**AWS WAF Bypass**:
- Unicode normalization: \`%u0027\` instead of \`'\`
- HTTP Parameter Pollution (HPP)
- Case manipulation: \`SeLeCt\` instead of \`SELECT\`
- Chunked Transfer-Encoding

**ModSecurity/CRS Bypass**:
- Multipart/form-data encoding
- HTTP Request Smuggling (CL.TE / TE.CL)
- Rule-specific bypasses (inline comments in SQL: \`/*!50000SELECT*/\`)

**Generic Firewall Evasion (nmap)**:
- Source port spoofing: \`nmap -g 53 TARGET\`
- IP fragmentation: \`nmap -f TARGET\`
- Decoy scan: \`nmap -D RND:10 TARGET\`
- Timing evasion: \`nmap -T1 TARGET\`
- FIN/NULL/XMAS scans: \`nmap -sF/-sN/-sX TARGET\`
- MTU evasion: \`nmap --mtu 24 TARGET\`

**Application-Layer Evasion**:
- Rotate User-Agents (fuzz_engine does this automatically)
- Use \`stealth_browser\` with Tor proxy for anti-bot bypass
- Try different HTTP methods (PUT, PATCH, DELETE)
- JSON content-type payloads instead of URL-encoded
- Double URL encoding for filter bypass

---

## TOOL STRATEGY RULES

1. **ALWAYS check memory first**: \`memory_store\` action=search before re-scanning any target
2. **Parallel when independent**: Run \`dns_recon\`, \`whois_lookup\`, \`ip_geolocation\` simultaneously
3. **Sequential when dependent**: Port scan BEFORE vulnerability scan
4. **Store everything**: Use \`memory_store\` after every significant finding
5. **Prefer built-in tools**: Use \`port_scanner\` over \`execute_command nmap\` when possible
6. **Escalate complexity**: Start with passive recon, then active scanning, then exploitation
7. **3-failure rule**: After 3 failures with one approach, fundamentally change technique
8. **Be CONCISE**: Show results through tools, not lengthy explanations

## WIFI ATTACK PROTOCOL
- Realtek USB adapters stay as wlan0 with monitor mode enabled
- Deauth limit: 2-5 packets MAX per burst
- Start airodump FIRST, wait 5s, THEN deauth. Wait 20-30s.
- Verify: aircrack-ng capture.cap — look for "WPA (1 handshake)"
- 5GHz fallback: use 2.4GHz BSSID (same password)

## ENVIRONMENT
- **OS**: ${os} (${archInfo}) | **CPU**: ${cpuInfo} (${cpuCount} cores) | **RAM**: ${ramGB}GB
- **Shell**: ${shell} | **User**: ${user}@${host} | **CWD**: ${cwd}
- **Network**: ${netInfo}
- **Time**: ${now}
${installedTools.length > 0 ? `- **System Tools**: ${installedTools.join(', ')}\n  Use these via execute_command when built-in tools are insufficient.` : ''}`;


  if (projectContext) {
    prompt += `\n\n## Project Context (from AGENT.md)\n${projectContext}`;
  }

  if (skillsContext) {
    prompt += skillsContext;
  }

  return prompt;
}
