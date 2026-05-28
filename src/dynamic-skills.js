// Jarvis Cyber — Dynamic Skills Engine
// AI-driven strategy generation — replaces all hardcoded SKILL.md files
// Uses MITRE ATT&CK and Cyber Kill Chain for intelligent strategy planning
import { MITRE_ATTACK, CYBER_KILL_CHAIN, mapFindingsToTechniques, getCurrentKillChainPhase } from './frameworks.js';
import { detectInstalledTools, getToolsForTechnique, searchTools } from './kali-tools-registry.js';
import { memory } from './memory.js';

class DynamicSkillEngine {
  constructor() {
    this.activeStrategies = new Map();
  }

  /**
   * Generate a dynamic attack strategy based on target, objective, and environment
   * Called by the AI when it needs a plan — no hardcoded playbooks
   * @param {string} target - Target identifier (domain, IP, network)
   * @param {string} objective - What the user wants to achieve
   * @param {Object} context - Current findings, environment info
   * @returns {Object} Dynamic strategy with phases, tools, and techniques
   */
  generateStrategy(target, objective, context = {}) {
    const installed = detectInstalledTools();
    const { findings = {}, completedActions = [] } = context;

    // Determine current Kill Chain phase
    const killChainState = getCurrentKillChainPhase(completedActions);

    // Map findings to ATT&CK techniques
    const applicableTechniques = mapFindingsToTechniques(findings);

    // Build dynamic phase plan
    const phases = this._buildPhasePlan(target, objective, killChainState, applicableTechniques, installed);

    // Create strategy object
    const strategy = {
      id: `strategy-${Date.now()}`,
      target,
      objective,
      framework: 'mitre_attack+cyber_kill_chain',
      currentPhase: killChainState.current?.name || 'Reconnaissance',
      nextPhase: killChainState.next?.name || null,
      phases,
      applicableTechniques: applicableTechniques.map(t => ({
        tactic: t.tactic,
        techniques: t.techniques,
        suggestedTools: t.suggestedTools.filter(tool => installed.has(tool)),
      })),
      installedToolCount: installed.size,
      timestamp: new Date().toISOString(),
    };

    // Store strategy in memory
    this._storeStrategy(strategy);
    this.activeStrategies.set(target, strategy);

    return strategy;
  }

  /**
   * Analyze an objective and decompose it into tactical steps
   * @param {string} objective - User's request
   * @returns {Object} Decomposed objective with recommended approach
   */
  decomposeObjective(objective) {
    const lower = objective.toLowerCase();
    const decomposition = {
      objective,
      type: 'unknown',
      phases: [],
      requiredCapabilities: [],
      suggestedTools: [],
    };

    // Detect objective type (ordered: specific patterns first, generic last)
    if (/active.?dir|ad\s|ldap|kerberos|domain.?controller|ntlm|pass.the.hash|bloodhound/i.test(lower)) {
      decomposition.type = 'active_directory';
      decomposition.phases = ['ad_enumeration', 'user_hunting', 'credential_access', 'lateral_movement', 'domain_admin'];
      decomposition.requiredCapabilities = ['ldap_query', 'kerberos_attacks', 'smb_relay', 'credential_dumping'];
    } else if (/webapp|web.?app|website|http|api|sql.?inj|xss|csrf|ssrf/i.test(lower)) {
      decomposition.type = 'web_application';
      decomposition.phases = ['web_recon', 'tech_detection', 'crawling', 'parameter_fuzzing', 'vuln_testing', 'exploitation'];
      decomposition.requiredCapabilities = ['web_crawling', 'fuzzing', 'injection_testing', 'authentication_testing'];
    } else if (/wifi|wireless|wpa|wep|aircrack|handshake|deauth/i.test(lower)) {
      decomposition.type = 'wireless';
      decomposition.phases = ['interface_setup', 'network_discovery', 'target_selection', 'capture', 'cracking'];
      decomposition.requiredCapabilities = ['monitor_mode', 'packet_capture', 'deauthentication', 'hash_cracking'];
    } else if (/privilege|privesc|root|admin|escalat/i.test(lower)) {
      decomposition.type = 'privilege_escalation';
      decomposition.phases = ['system_enumeration', 'vuln_identification', 'exploit_selection', 'escalation'];
      decomposition.requiredCapabilities = ['system_audit', 'kernel_exploit', 'suid_abuse', 'cron_abuse'];
    } else if (/cloud|aws|azure|gcp|s3|lambda|ec2|kubernetes|k8s|docker/i.test(lower)) {
      decomposition.type = 'cloud';
      decomposition.phases = ['cloud_recon', 'bucket_enum', 'iam_analysis', 'metadata_access', 'exploitation'];
      decomposition.requiredCapabilities = ['cloud_enumeration', 'api_testing', 'ssrf', 'credential_harvesting'];
    } else if (/social|phish|spear|vish|pretex/i.test(lower)) {
      decomposition.type = 'social_engineering';
      decomposition.phases = ['target_profiling', 'pretext_development', 'campaign_setup', 'execution', 'credential_harvest'];
      decomposition.requiredCapabilities = ['osint', 'phishing_framework', 'email_spoofing'];
    } else if (/malware|reverse|binary|firmware|disassembl|debug/i.test(lower)) {
      decomposition.type = 'reverse_engineering';
      decomposition.phases = ['static_analysis', 'dynamic_analysis', 'behavioral_analysis', 'deobfuscation', 'reporting'];
      decomposition.requiredCapabilities = ['disassembly', 'debugging', 'sandbox_analysis'];
    } else if (/network|internal|pivot|lateral|subnet|vlan/i.test(lower)) {
      decomposition.type = 'network_pentest';
      decomposition.phases = ['network_mapping', 'host_discovery', 'service_enum', 'vuln_scan', 'exploitation', 'pivoting'];
      decomposition.requiredCapabilities = ['network_scanning', 'service_detection', 'exploit_execution', 'tunneling'];
    } else if (/recon|scan|discover|enumerate|map|fingerprint|osint/i.test(lower)) {
      decomposition.type = 'reconnaissance';
      decomposition.phases = ['passive_recon', 'active_recon', 'enumeration', 'analysis'];
      decomposition.requiredCapabilities = ['dns_resolution', 'port_scanning', 'service_detection', 'web_crawling'];
    } else if (/exploit|hack|pwn|compromise|attack|penetrat|breach/i.test(lower)) {
      decomposition.type = 'full_pentest';
      decomposition.phases = ['reconnaissance', 'vulnerability_analysis', 'exploitation', 'post_exploitation', 'reporting'];
      decomposition.requiredCapabilities = ['scanning', 'vuln_assessment', 'exploit_execution', 'credential_access', 'pivoting'];
    }

    // Map to tools
    const installed = detectInstalledTools();
    for (const cap of decomposition.requiredCapabilities) {
      const found = searchTools(cap);
      decomposition.suggestedTools.push(...found.filter(t => installed.has(t.name)).map(t => t.name));
    }
    decomposition.suggestedTools = [...new Set(decomposition.suggestedTools)];

    return decomposition;
  }

  /**
   * Get a dynamic skills context for the system prompt — replaces hardcoded skill listing
   * @returns {string}
   */
  getSkillsContext() {
    return `\n\n## DYNAMIC SKILL ENGINE

**Strategy Generation**: Jarvis generates attack strategies DYNAMICALLY based on:
- Target architecture and technology stack
- MITRE ATT&CK technique mapping
- Cyber Kill Chain phase progression
- Available tools on the system
- Previous findings stored in memory

**NO HARDCODED PLAYBOOKS** — Every strategy is custom-built for the specific target and objective.

**Supported Objective Types**:
- Full Penetration Test (recon → exploit → post-exploit → report)
- Web Application Security Assessment
- Network/Infrastructure Pentest
- Active Directory Attack
- Wireless Network Assessment
- Cloud Security Audit (AWS/Azure/GCP)
- Social Engineering Campaign
- Privilege Escalation
- Reverse Engineering / Malware Analysis
- Bug Bounty Hunting
- IoT/Embedded Device Testing

**Dynamic Capabilities**:
- Auto-install missing tools via \`install_tool\`
- Auto-fix script errors and retry execution
- Adapt strategy based on WAF/firewall detection
- Pivot approach when attacks are blocked
- Cache successful strategies for future reference
`;
  }

  /**
   * Store previous successful strategies for learning
   * @param {Object} strategy
   * @param {boolean} success
   */
  recordOutcome(strategyId, success, notes = '') {
    try {
      memory.init();
      memory.db.prepare(`
        UPDATE strategies SET success = ?, notes = ? WHERE id = ?
      `).run(success ? 1 : 0, notes, strategyId);
    } catch { /* ignore */ }
  }

  // ═══ PRIVATE HELPERS ═══

  _buildPhasePlan(target, objective, killChainState, techniques, installed) {
    const phases = [];
    const startPhase = killChainState.phaseNumber || 1;

    for (const kcPhase of CYBER_KILL_CHAIN.phases) {
      if (kcPhase.id < startPhase) continue; // Skip completed phases

      const phaseTools = [];
      const phaseTechniques = [];

      // Map MITRE tactics to this phase
      for (const tacticId of kcPhase.mitre_tactics) {
        const tactic = MITRE_ATTACK.tactics.find(t => t.id === tacticId);
        if (tactic) {
          const availableTools = tactic.tools.filter(t => installed.has(t));
          phaseTools.push(...availableTools);
          phaseTechniques.push(...tactic.techniques.slice(0, 5).map(t => `${t.id}: ${t.name}`));
        }
      }

      phases.push({
        phase: kcPhase.id,
        name: kcPhase.name,
        description: kcPhase.description,
        objectives: kcPhase.objectives,
        availableTools: [...new Set(phaseTools)],
        techniques: [...new Set(phaseTechniques)],
        status: kcPhase.id === startPhase ? 'active' : 'pending',
      });
    }

    return phases;
  }

  _storeStrategy(strategy) {
    try {
      memory.init();
      memory.db.prepare(`
        INSERT INTO strategies (target, objective, attack_framework, phase, strategy, tools_used, created_at)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      `).run(
        strategy.target,
        strategy.objective,
        strategy.framework,
        strategy.currentPhase,
        JSON.stringify(strategy.phases),
        JSON.stringify(strategy.applicableTechniques?.flatMap(t => t.suggestedTools) || []),
      );
    } catch { /* DB not initialized yet — ignore */ }
  }
}

export const dynamicSkills = new DynamicSkillEngine();
