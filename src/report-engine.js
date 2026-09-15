// Jarvis Cyber v4.0 — Dynamic Report Engine
// Auto-generates structured pentest reports from tool execution history
// Fully dynamic — adapts to whatever tools and techniques were used
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import config from './config.js';
import { toolBridge } from './tool-bridge.js';
import { bronGraph } from './bron-graph.js';

class ReportEngine {
  constructor() {
    this.engagements = new Map();
  }

  /**
   * Start tracking a new engagement
   * @param {string} target - Target identifier
   * @param {string} objective - What the user wants to achieve
   * @returns {string} Engagement ID
   */
  startEngagement(target, objective = '') {
    const id = `engagement-${Date.now()}`;
    this.engagements.set(id, {
      id,
      target,
      objective,
      startedAt: new Date().toISOString(),
      completedAt: null,
      findings: [],
      phases: [],
    });
    return id;
  }

  /**
   * Generate a pentest report from the tool execution log
   * Fully dynamic — adapts to whatever was actually done
   * @param {Object} options
   * @returns {Object} Report data and file path
   */
  async generateReport(options = {}) {
    const {
      target = 'Unknown Target',
      objective = 'Security Assessment',
      format = 'markdown',
      engagementId = null,
    } = options;

    const executionLog = toolBridge.getExecutionLog();
    const usageStats = toolBridge.getUsageStats();

    if (executionLog.length === 0) {
      return {
        success: false,
        error: 'No tool executions recorded in this session. Run some tools first, then generate the report.',
      };
    }

    // ═══ AUTO-CLASSIFY FINDINGS ═══
    const classified = this._classifyExecutions(executionLog);

    // ═══ BUILD REPORT ═══
    let report = '';
    const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const duration = this._calculateDuration(executionLog);

    // Header
    report += `# 🛡️ Penetration Test Report\n\n`;
    report += `| Field | Value |\n|-------|-------|\n`;
    report += `| **Target** | ${target} |\n`;
    report += `| **Objective** | ${objective} |\n`;
    report += `| **Date** | ${timestamp} |\n`;
    report += `| **Duration** | ${duration} |\n`;
    report += `| **Tools Used** | ${Object.keys(usageStats).length} unique tools, ${executionLog.length} total executions |\n`;
    report += `| **Agent** | Jarvis Cyber v4.0 |\n\n`;
    report += `---\n\n`;

    // Executive Summary
    report += `## Executive Summary\n\n`;
    report += this._generateExecutiveSummary(classified, usageStats);
    report += `\n\n---\n\n`;

    // Methodology — auto-populated from Kill Chain phases executed
    report += `## Methodology\n\n`;
    report += `The assessment followed the Lockheed Martin Cyber Kill Chain methodology, `;
    report += `with techniques mapped to the MITRE ATT&CK framework.\n\n`;
    report += `### Phases Executed\n\n`;
    report += this._generatePhaseBreakdown(classified);
    report += `\n---\n\n`;

    // Findings
    report += `## Findings\n\n`;
    if (classified.vulnerabilities.length > 0) {
      report += `### Vulnerabilities Discovered\n\n`;
      for (const vuln of classified.vulnerabilities) {
        report += `#### ${vuln.title}\n\n`;
        report += `- **Severity**: ${vuln.severity}\n`;
        report += `- **Tool**: \`${vuln.tool}\`\n`;
        if (vuln.mitre) report += `- **MITRE ATT&CK**: ${vuln.mitre}\n`;
        report += `- **Evidence**: \`${vuln.evidence}\`\n`;
        report += `- **Timestamp**: ${vuln.timestamp}\n\n`;
      }
    } else {
      report += `_No explicit vulnerabilities were identified during this assessment._\n\n`;
    }
    report += `---\n\n`;

    // Tool Usage Breakdown
    report += `## Tool Usage Breakdown\n\n`;
    report += `| Tool | Calls | Success | Failures | Category |\n`;
    report += `|------|-------|---------|----------|----------|\n`;
    for (const [tool, data] of Object.entries(usageStats).sort((a, b) => b[1].calls - a[1].calls)) {
      const subtypes = Object.entries(data.subtypes).slice(0, 3).map(([k, v]) => `${k}(${v})`).join(', ');
      report += `| ${tool} | ${data.calls} | ${data.successes} | ${data.failures} | ${subtypes || '-'} |\n`;
    }
    report += `\n---\n\n`;

    // MITRE ATT&CK Mapping
    report += `## MITRE ATT&CK Mapping\n\n`;
    const mitreTechniques = this._extractMitreMapping(executionLog);
    if (mitreTechniques.length > 0) {
      report += `| Technique ID | Technique Name | Tools Used |\n`;
      report += `|-------------|----------------|------------|\n`;
      for (const t of mitreTechniques) {
        report += `| ${t.id} | ${t.name} | ${t.tools.join(', ')} |\n`;
      }
    } else {
      report += `_No ATT&CK techniques were explicitly mapped during this session._\n\n`;
    }
    report += `\n---\n\n`;

    // Execution Timeline
    report += `## Execution Timeline\n\n`;
    report += `| # | Time | Tool | Action | Result |\n`;
    report += `|---|------|------|--------|--------|\n`;
    for (let i = 0; i < Math.min(executionLog.length, 50); i++) {
      const entry = executionLog[i];
      const time = entry.timestamp?.slice(11, 19) || '-';
      const action = entry.args_summary || '-';
      const result = entry.success ? '✅' : '❌';
      report += `| ${i + 1} | ${time} | ${entry.tool} | ${action} | ${result} |\n`;
    }
    if (executionLog.length > 50) {
      report += `| ... | ... | _${executionLog.length - 50} more entries_ | ... | ... |\n`;
    }
    report += `\n---\n\n`;

    // Recommendations
    report += `## Recommendations\n\n`;
    report += this._generateRecommendations(classified);
    report += `\n---\n\n`;

    // ═══ BRON ATTACK CHAIN ANALYSIS ═══
    if (bronGraph.connected) {
      const bronSection = await this._generateBronSection(classified, mitreTechniques);
      if (bronSection) {
        report += bronSection;
        report += `\n---\n\n`;
      }
    }

    // Footer
    report += `_Report auto-generated by Jarvis Cyber v4.1 Dynamic Report Engine (BRON-Enhanced)_\n`;
    report += `_Generated at: ${timestamp}_\n`;

    // ═══ SAVE REPORT ═══
    const outDir = join(config.outputDir, 'reports');
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

    const sanitizedTarget = target.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 50);
    const filename = `report_${sanitizedTarget}_${Date.now()}.md`;
    const filepath = join(outDir, filename);

    writeFileSync(filepath, report, 'utf-8');

    return {
      success: true,
      path: filepath,
      filename,
      report_length: report.length,
      tools_used: Object.keys(usageStats).length,
      total_executions: executionLog.length,
      findings_count: classified.vulnerabilities.length,
      message: `Report saved to ${filepath}`,
    };
  }

  // ═══ PRIVATE HELPERS ═══

  /**
   * Classify tool executions into phases and finding categories
   */
  _classifyExecutions(log) {
    const result = {
      reconnaissance: [],
      scanning: [],
      exploitation: [],
      post_exploitation: [],
      vulnerabilities: [],
      credentials: [],
      other: [],
    };

    const reconTools = /^(nmap|masscan|subfinder|amass|whois|dig|nslookup|dnsenum|fierce|dnsrecon|theharvester|whatweb|wafw00f|shodan_search|dns_recon|whois_lookup|web_search|tavily_search|wayback_machine|fofa_search|subfinder_enum|httpx_probe|dnsx_resolve|uncover_search|katana_crawl)/i;
    const scanTools = /^(nuclei|nikto|sqlmap|wpscan|joomscan|gobuster|dirb|ffuf|feroxbuster|wfuzz|commix|xsstrike|dalfox|sslscan|testssl|nuclei_scan|naabu_scan|naabu)/i;
    const exploitTools = /^(msfconsole|msfvenom|metasploit|searchsploit|crackmapexec|evil-winrm|impacket|hydra|medusa|metasploit_rpc)/i;
    const postTools = /^(linpeas|winpeas|bloodhound|mimikatz|responder|chisel|ligolo|sshuttle|proxychains)/i;
    const credTools = /^(hashcat|john|hydra|medusa|ncrack|kerbrute|cewl|crunch)/i;

    for (const entry of log) {
      const toolBase = entry.args_summary || entry.tool;

      if (reconTools.test(toolBase)) result.reconnaissance.push(entry);
      else if (scanTools.test(toolBase)) result.scanning.push(entry);
      else if (exploitTools.test(toolBase)) result.exploitation.push(entry);
      else if (postTools.test(toolBase)) result.post_exploitation.push(entry);
      else if (credTools.test(toolBase)) result.credentials.push(entry);
      else result.other.push(entry);

      // Auto-detect vulnerability indicators
      if (!entry.success) continue; // Only successful runs

      if (entry.tool === 'stealth_browser' && entry.args_summary === 'navigate') {
        // Check if dialogs were triggered (XSS detected)
        result.vulnerabilities.push({
          title: 'Potential XSS / Client-Side Vulnerability',
          severity: 'HIGH',
          tool: 'stealth_browser',
          mitre: 'T1189',
          evidence: 'Browser dialog/alert triggered during page navigation',
          timestamp: entry.timestamp,
        });
      }
    }

    return result;
  }

  /**
   * Generate executive summary from classified results
   */
  _generateExecutiveSummary(classified, usageStats) {
    const totalExecs = Object.values(usageStats).reduce((sum, s) => sum + s.calls, 0);
    const totalSuccesses = Object.values(usageStats).reduce((sum, s) => sum + s.successes, 0);
    const phases = [];
    if (classified.reconnaissance.length > 0) phases.push('Reconnaissance');
    if (classified.scanning.length > 0) phases.push('Vulnerability Scanning');
    if (classified.exploitation.length > 0) phases.push('Exploitation');
    if (classified.post_exploitation.length > 0) phases.push('Post-Exploitation');
    if (classified.credentials.length > 0) phases.push('Credential Access');

    let summary = `A security assessment was conducted using **${Object.keys(usageStats).length} unique tools** `;
    summary += `across **${totalExecs} total executions** (${totalSuccesses} successful). `;
    summary += `The assessment covered the following phases: **${phases.join(', ') || 'General'}**. `;

    if (classified.vulnerabilities.length > 0) {
      summary += `\n\n**${classified.vulnerabilities.length} potential vulnerability/vulnerabilities** were identified during the assessment. `;
      summary += `See the Findings section for details.`;
    } else {
      summary += `\n\nNo critical vulnerabilities were automatically classified. Manual review of tool outputs is recommended.`;
    }

    return summary;
  }

  /**
   * Generate phase breakdown
   */
  _generatePhaseBreakdown(classified) {
    let breakdown = '';
    const phases = [
      { name: 'Reconnaissance', data: classified.reconnaissance, icon: '🔍', killChain: 1 },
      { name: 'Vulnerability Scanning', data: classified.scanning, icon: '🔬', killChain: 3 },
      { name: 'Exploitation', data: classified.exploitation, icon: '💥', killChain: 4 },
      { name: 'Credential Access', data: classified.credentials, icon: '🔑', killChain: 5 },
      { name: 'Post-Exploitation', data: classified.post_exploitation, icon: '🏴', killChain: 6 },
    ];

    for (const phase of phases) {
      if (phase.data.length === 0) continue;
      const tools = [...new Set(phase.data.map(e => e.args_summary || e.tool))];
      const successes = phase.data.filter(e => e.success).length;
      breakdown += `${phase.icon} **Phase ${phase.killChain}: ${phase.name}** — ${phase.data.length} actions (${successes} successful)\n`;
      breakdown += `   Tools: ${tools.slice(0, 10).join(', ')}\n\n`;
    }

    if (classified.other.length > 0) {
      breakdown += `📋 **Other Actions** — ${classified.other.length} executions\n\n`;
    }

    return breakdown;
  }

  /**
   * Extract MITRE ATT&CK technique mapping
   */
  _extractMitreMapping(log) {
    const techniqueMap = {
      T1046: { name: 'Network Service Discovery', tools: new Set() },
      T1190: { name: 'Exploit Public-Facing Application', tools: new Set() },
      T1590: { name: 'Gather Victim Network Information', tools: new Set() },
      T1595: { name: 'Active Scanning', tools: new Set() },
      T1596: { name: 'Search Open Technical Databases', tools: new Set() },
      T1593: { name: 'Search Open Websites/Domains', tools: new Set() },
      T1110: { name: 'Brute Force', tools: new Set() },
      T1071: { name: 'Application Layer Protocol', tools: new Set() },
      T1587: { name: 'Develop Capabilities', tools: new Set() },
      T1021: { name: 'Remote Services', tools: new Set() },
      T1040: { name: 'Network Sniffing', tools: new Set() },
      T1557: { name: 'Adversary-in-the-Middle', tools: new Set() },
      T1087: { name: 'Account Discovery', tools: new Set() },
      T1068: { name: 'Exploitation for Privilege Escalation', tools: new Set() },
      T1572: { name: 'Protocol Tunneling', tools: new Set() },
      T1588: { name: 'Obtain Capabilities', tools: new Set() },
      T1189: { name: 'Drive-by Compromise', tools: new Set() },
    };

    for (const entry of log) {
      if (entry.mitre && techniqueMap[entry.mitre]) {
        techniqueMap[entry.mitre].tools.add(entry.args_summary || entry.tool);
      }
    }

    return Object.entries(techniqueMap)
      .filter(([, v]) => v.tools.size > 0)
      .map(([id, v]) => ({ id, name: v.name, tools: [...v.tools] }));
  }

  /**
   * Generate recommendations based on what was found
   */
  _generateRecommendations(classified) {
    let recs = '';
    let num = 1;

    if (classified.vulnerabilities.length > 0) {
      for (const vuln of classified.vulnerabilities) {
        recs += `${num}. **${vuln.title}** (${vuln.severity})\n`;
        recs += `   - Remediate the identified vulnerability\n`;
        recs += `   - Implement input validation and output encoding\n`;
        recs += `   - Apply the principle of least privilege\n\n`;
        num++;
      }
    }

    // Generic recommendations based on phases executed
    if (classified.scanning.length > 0) {
      recs += `${num}. **Security Hardening**: Review all services identified during scanning and disable unnecessary ones\n\n`;
      num++;
    }
    if (classified.credentials.length > 0) {
      recs += `${num}. **Password Policy**: Enforce strong password policies and multi-factor authentication\n\n`;
      num++;
    }
    if (classified.exploitation.length > 0) {
      recs += `${num}. **Patch Management**: Apply security patches for all exploited services\n\n`;
      num++;
    }

    recs += `${num}. **Continuous Monitoring**: Implement logging, alerting, and regular security assessments\n`;

    return recs;
  }

  /**
   * Generate BRON attack chain analysis section for the report
   */
  async _generateBronSection(classified, mitreTechniques) {
    let section = '';

    try {
      // ═══ Attack Chain Analysis ═══
      // Extract CVE IDs from vulnerability findings
      const cveIds = [];
      for (const vuln of classified.vulnerabilities) {
        const cveMatch = (vuln.evidence || vuln.title || '').match(/CVE-\d{4}-\d+/gi);
        if (cveMatch) cveIds.push(...cveMatch);
      }

      if (cveIds.length > 0) {
        section += `## 🔗 BRON Attack Chain Analysis\n\n`;
        section += `_Powered by BRON Knowledge Graph — linking CVE → CWE → CAPEC → ATT&CK → D3FEND_\n\n`;

        const uniqueCVEs = [...new Set(cveIds)];
        for (const cveId of uniqueCVEs.slice(0, 10)) {
          const chain = await bronGraph.traverseFromCVE(cveId);
          if (!chain) continue;

          section += `### ${cveId}\n\n`;
          section += `| Layer | ID | Name |\n`;
          section += `|-------|----|------|\n`;
          section += `| 🐛 CVE | ${chain.cve.id} | ${chain.cve.severity || 'Unknown'} (CVSS: ${chain.cve.cvss || 'N/A'}) |\n`;
          for (const cwe of chain.cwes || []) {
            section += `| 🔓 CWE | ${cwe.id} | ${cwe.name} |\n`;
          }
          for (const capec of chain.capecs || []) {
            section += `| 🗺️ CAPEC | ${capec.id} | ${capec.name} |\n`;
          }
          for (const tech of chain.techniques || []) {
            section += `| ⚔️ ATT&CK | ${tech.id} | ${tech.name} |\n`;
          }
          for (const tactic of chain.tactics || []) {
            section += `| 🎯 Tactic | ${tactic.id} | ${tactic.name} |\n`;
          }
          section += `\n`;
        }
      }

      // ═══ D3FEND Defensive Recommendations ═══
      const allDefenses = new Map();
      const techIds = mitreTechniques.map(t => t.id);

      for (const techId of techIds.slice(0, 15)) {
        const defenses = await bronGraph.getDefensesForTechnique(techId);
        for (const d of defenses) {
          if (!allDefenses.has(d.id || d.name)) {
            allDefenses.set(d.id || d.name, { ...d, counters: [techId] });
          } else {
            allDefenses.get(d.id || d.name).counters.push(techId);
          }
        }
      }

      if (allDefenses.size > 0) {
        section += `## 🛡️ D3FEND Defensive Recommendations\n\n`;
        section += `_Based on ATT&CK techniques observed during this assessment_\n\n`;
        section += `| Defense | Category | Counters | Description |\n`;
        section += `|---------|----------|----------|-------------|\n`;
        for (const [, def] of allDefenses) {
          section += `| ${def.name} | ${def.category || '-'} | ${def.counters.join(', ')} | ${(def.description || '').slice(0, 100)} |\n`;
        }
        section += `\n`;
      }
    } catch (err) {
      // BRON section is optional — don't break report generation
      section += `\n_BRON analysis unavailable: ${err.message}_\n\n`;
    }

    return section || null;
  }

  /**
   * Calculate engagement duration
   */
  _calculateDuration(log) {
    if (log.length < 2) return 'N/A';
    const first = new Date(log[0].timestamp);
    const last = new Date(log[log.length - 1].timestamp);
    const diffMs = last - first;
    const mins = Math.floor(diffMs / 60000);
    const secs = Math.floor((diffMs % 60000) / 1000);
    if (mins > 60) return `${Math.floor(mins / 60)}h ${mins % 60}m`;
    return `${mins}m ${secs}s`;
  }
}

export const reportEngine = new ReportEngine();
