// Jarvis Cyber — BRON Knowledge Graph AI Tools
// Enables the AI agent to query the BRON graph during operations
// Tools: bron_lookup, bron_attack_chain, bron_find_defenses, bron_product_risks
import { bronGraph } from '../bron-graph.js';

// ═══════════════════════════════════════════════════════════
// TOOL 1: bron_lookup — Search/lookup any BRON node
// ═══════════════════════════════════════════════════════════

export const bronLookupDefinition = {
  type: 'function',
  function: {
    name: 'bron_lookup',
    description: 'Look up any node in the BRON cybersecurity knowledge graph. Supports ATT&CK techniques (T1190), tactics (TA0001), CAPEC patterns (CAPEC-79), CWE weaknesses (CWE-89), CVE vulnerabilities (CVE-2021-44228), CPE products, and D3FEND defenses. Returns the node details and all connected nodes.',
    parameters: {
      type: 'object',
      properties: {
        node_id: {
          type: 'string',
          description: 'The ID of the node to look up (e.g., "T1190", "CVE-2021-44228", "CWE-79", "CAPEC-86"). Or a search query if you don\'t know the exact ID.',
        },
        search_mode: {
          type: 'boolean',
          description: 'If true, treats node_id as a search query and returns matching nodes across all types. Default: false (exact lookup).',
        },
      },
      required: ['node_id'],
    },
  },
};

export async function executeBronLookup(args) {
  try {
    const ok = await bronGraph.init();
    if (!ok) {
      return { success: false, error: 'BRON graph not available. Start ArangoDB: docker-compose -f docker-compose.bron.yml up -d' };
    }

    if (args.search_mode) {
      const results = await bronGraph.search(args.node_id);
      return {
        success: true,
        query: args.node_id,
        results_count: results.length,
        results: results.slice(0, 20),
      };
    }

    const node = await bronGraph.getNode(args.node_id);
    if (!node) {
      // Try search as fallback
      const results = await bronGraph.search(args.node_id);
      if (results.length > 0) {
        return {
          success: true,
          note: `Exact node "${args.node_id}" not found, showing search results instead`,
          results_count: results.length,
          results: results.slice(0, 20),
        };
      }
      return { success: false, error: `Node "${args.node_id}" not found in BRON graph` };
    }

    return {
      success: true,
      node: {
        type: node.type,
        id: node.original_id,
        name: node.name,
        description: node.description,
        metadata: {
          severity: node.severity,
          cvss: node.cvss_score,
          category: node.category,
          platforms: node.platforms,
        },
      },
      connections: {
        outbound: node.neighbors?.outbound || [],
        inbound: node.neighbors?.inbound || [],
        total: (node.neighbors?.outbound?.length || 0) + (node.neighbors?.inbound?.length || 0),
      },
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ═══════════════════════════════════════════════════════════
// TOOL 2: bron_attack_chain — Full CVE attack chain traversal
// ═══════════════════════════════════════════════════════════

export const bronAttackChainDefinition = {
  type: 'function',
  function: {
    name: 'bron_attack_chain',
    description: 'Get the FULL attack chain for a CVE by traversing the BRON knowledge graph: CVE → CWE (weakness) → CAPEC (attack pattern) → ATT&CK Technique → Tactic → D3FEND (defenses). Also returns affected products (CPE). This is the most powerful BRON query — use it when you find a CVE to understand the complete threat context.',
    parameters: {
      type: 'object',
      properties: {
        cve_id: {
          type: 'string',
          description: 'CVE identifier (e.g., "CVE-2021-44228", "CVE-2024-3094")',
        },
      },
      required: ['cve_id'],
    },
  },
};

export async function executeBronAttackChain(args) {
  try {
    const ok = await bronGraph.init();
    if (!ok) {
      return { success: false, error: 'BRON graph not available. Start ArangoDB first.' };
    }

    const chain = await bronGraph.traverseFromCVE(args.cve_id);
    if (!chain) {
      return { success: false, error: `CVE "${args.cve_id}" not found in BRON graph. Try running --update-bron to load latest data.` };
    }

    // Build human-readable chain summary
    const summary = [];
    summary.push(`🐛 CVE: ${chain.cve.id} (${chain.cve.severity || 'Unknown'}, CVSS: ${chain.cve.cvss || 'N/A'})`);
    if (chain.cwes.length > 0) summary.push(`🔓 Weaknesses: ${chain.cwes.map(c => `${c.id} (${c.name})`).join(', ')}`);
    if (chain.capecs.length > 0) summary.push(`🗺️ Attack Patterns: ${chain.capecs.map(c => `${c.id} (${c.name})`).join(', ')}`);
    if (chain.techniques.length > 0) summary.push(`⚔️ ATT&CK Techniques: ${chain.techniques.map(t => `${t.id} (${t.name})`).join(', ')}`);
    if (chain.tactics.length > 0) summary.push(`🎯 Tactics: ${chain.tactics.map(t => `${t.id} (${t.name})`).join(', ')}`);
    if (chain.defenses.length > 0) summary.push(`🛡️ Defenses: ${chain.defenses.map(d => `${d.id || d.name} (${d.name})`).join(', ')}`);
    if (chain.cpes.length > 0) summary.push(`💻 Affected Products: ${chain.cpes.slice(0, 5).map(c => c.product || c.name).join(', ')}${chain.cpes.length > 5 ? ` +${chain.cpes.length - 5} more` : ''}`);

    return {
      success: true,
      cve_id: args.cve_id,
      chain_summary: summary.join('\n'),
      chain: chain,
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ═══════════════════════════════════════════════════════════
// TOOL 3: bron_find_defenses — D3FEND defenses for ATT&CK technique
// ═══════════════════════════════════════════════════════════

export const bronFindDefensesDefinition = {
  type: 'function',
  function: {
    name: 'bron_find_defenses',
    description: 'Find D3FEND defensive techniques that counter a specific ATT&CK technique. Also performs reverse lookup to find all CVEs that enable this technique. Use this to provide defensive recommendations in reports.',
    parameters: {
      type: 'object',
      properties: {
        technique_id: {
          type: 'string',
          description: 'ATT&CK technique ID (e.g., "T1190", "T1059", "T1078")',
        },
        include_cves: {
          type: 'boolean',
          description: 'If true, also returns CVEs linked to this technique via CAPEC→CWE→CVE chain. Default: false.',
        },
      },
      required: ['technique_id'],
    },
  },
};

export async function executeBronFindDefenses(args) {
  try {
    const ok = await bronGraph.init();
    if (!ok) {
      return { success: false, error: 'BRON graph not available.' };
    }

    const defenses = await bronGraph.getDefensesForTechnique(args.technique_id);
    const result = {
      success: true,
      technique_id: args.technique_id,
      defenses: defenses,
      defense_count: defenses.length,
    };

    if (args.include_cves) {
      const cves = await bronGraph.getCVEsForTechnique(args.technique_id);
      result.related_cves = cves.slice(0, 20);
      result.cve_count = cves.length;
    }

    // Build recommendation text
    if (defenses.length > 0) {
      result.recommendations = defenses.map(d =>
        `• ${d.name} (${d.id || 'D3FEND'}): ${d.description || d.category || 'Defensive technique'}`
      ).join('\n');
    } else {
      result.recommendations = 'No specific D3FEND mappings found. Consider general security hardening.';
    }

    return result;
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ═══════════════════════════════════════════════════════════
// TOOL 4: bron_product_risks — Attack paths for a product/CPE
// ═══════════════════════════════════════════════════════════

export const bronProductRisksDefinition = {
  type: 'function',
  function: {
    name: 'bron_product_risks',
    description: 'Find all known attack paths for a specific product or technology. Searches the BRON graph for CPE matches and returns all associated CVEs, CWEs, CAPEC patterns, and ATT&CK techniques. Use this when you discover a product version on a target to understand all possible attack vectors.',
    parameters: {
      type: 'object',
      properties: {
        product: {
          type: 'string',
          description: 'Product name, vendor, or CPE string (e.g., "apache httpd", "nginx", "wordpress", "cpe:2.3:a:apache:http_server:2.4.49")',
        },
      },
      required: ['product'],
    },
  },
};

export async function executeBronProductRisks(args) {
  try {
    const ok = await bronGraph.init();
    if (!ok) {
      return { success: false, error: 'BRON graph not available.' };
    }

    const attackPaths = await bronGraph.findAttackPaths(args.product);

    if (attackPaths.length === 0) {
      return {
        success: true,
        product: args.product,
        note: 'No CPE matches found in BRON graph. The product may not be in the current dataset.',
        attack_paths: [],
      };
    }

    // Build risk summary
    let totalCVEs = 0;
    let criticalCount = 0;
    let highCount = 0;

    for (const path of attackPaths) {
      for (const cve of path.attack_paths || []) {
        totalCVEs++;
        if (cve.severity === 'CRITICAL') criticalCount++;
        if (cve.severity === 'HIGH') highCount++;
      }
    }

    return {
      success: true,
      product: args.product,
      risk_summary: `Found ${totalCVEs} CVEs (${criticalCount} Critical, ${highCount} High) across ${attackPaths.length} CPE matches`,
      matches: attackPaths.slice(0, 10),
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ═══════════════════════════════════════════════════════════
// EXPORT ALL TOOLS
// ═══════════════════════════════════════════════════════════

export const bronLookup = {
  definition: bronLookupDefinition,
  execute: executeBronLookup,
};

export const bronAttackChain = {
  definition: bronAttackChainDefinition,
  execute: executeBronAttackChain,
};

export const bronFindDefenses = {
  definition: bronFindDefensesDefinition,
  execute: executeBronFindDefenses,
};

export const bronProductRisks = {
  definition: bronProductRisksDefinition,
  execute: executeBronProductRisks,
};
