// Jarvis Cyber — BRON Knowledge Graph Bootstrap
// Downloads threat/defense data from public sources and loads into ArangoDB
// Sources: MITRE ATT&CK, CAPEC, CWE, NVD CVE, D3FEND, Engage
// Run: node -e "import('./src/bron-bootstrap.js').then(m => m.bootstrapBRON())"
// Or: jarvis --update-bron
import { bronGraph } from './bron-graph.js';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function safeFetch(url, opts = {}) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(120000), ...opts });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

async function safeFetchText(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(120000) });
    if (!res.ok) return null;
    return await res.text();
  } catch { return null; }
}

// ═══════════════════════════════════════════════════════════
// MAIN BOOTSTRAP
// ═══════════════════════════════════════════════════════════

export async function bootstrapBRON(options = {}) {
  const { fresh = false, fullHistory = false } = options;

  console.log('\n🔗 [BRON Bootstrap] Starting knowledge graph build...');
  console.log('   Linking ATT&CK ↔ CAPEC ↔ CWE ↔ CVE ↔ CPE ↔ D3FEND\n');

  const ok = await bronGraph.init();
  if (!ok) {
    console.error('❌ Cannot connect to ArangoDB. Start it first:');
    console.error('   docker-compose -f docker-compose.bron.yml up -d');
    return false;
  }

  if (fresh) {
    console.log('  🗑️ Clearing existing data (--fresh flag)...');
    await bronGraph.clearAll();
  }

  // Check if already populated
  const hasData = await bronGraph.hasData();
  if (hasData && !fresh && !fullHistory) {
    console.log('  ✅ BRON graph already populated. Use --fresh to rebuild.');
    const stats = await bronGraph.getStats();
    console.log(`     Nodes: ${stats.totalNodes}, Edges: ${stats.totalEdges}`);
    return true;
  }

  const startTime = Date.now();
  const counts = { nodes: 0, edges: 0 };

  // ═══ Phase 1: ATT&CK Enterprise Tactics & Techniques ═══
  console.log('  📥 [1/7] Loading MITRE ATT&CK Enterprise...');
  const attackCounts = await loadATTACK();
  counts.nodes += attackCounts.nodes;
  counts.edges += attackCounts.edges;
  await sleep(1000);

  // ═══ Phase 2: CAPEC Attack Patterns ═══
  console.log('  📥 [2/7] Loading MITRE CAPEC...');
  const capecCounts = await loadCAPEC();
  counts.nodes += capecCounts.nodes;
  counts.edges += capecCounts.edges;
  await sleep(1000);

  // ═══ Phase 3: CWE Weaknesses ═══
  console.log('  📥 [3/7] Loading MITRE CWE...');
  const cweCounts = await loadCWE();
  counts.nodes += cweCounts.nodes;
  counts.edges += cweCounts.edges;
  await sleep(1000);

  // ═══ Phase 4: CVE Vulnerabilities (recent + major) ═══
  console.log('  📥 [4/7] Loading CVE data from NVD...');
  const cveCounts = await loadCVEs(fullHistory);
  counts.nodes += cveCounts.nodes;
  counts.edges += cveCounts.edges;
  await sleep(1000);

  // ═══ Phase 5: D3FEND Defensive Techniques ═══
  console.log('  📥 [5/7] Loading MITRE D3FEND...');
  const d3fendCounts = await loadD3FEND();
  counts.nodes += d3fendCounts.nodes;
  counts.edges += d3fendCounts.edges;
  await sleep(1000);

  // ═══ Phase 6: Link CAPEC ↔ CWE ═══
  console.log('  📥 [6/7] Linking CAPEC → CWE edges...');
  const capecCweCounts = await linkCAPEC_CWE();
  counts.edges += capecCweCounts;
  await sleep(500);

  // ═══ Phase 7: Link CWE ↔ CVE ═══
  console.log('  📥 [7/7] Linking CWE → CVE edges...');
  const cweCveCounts = await linkCWE_CVE();
  counts.edges += cweCveCounts;

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n✅ [BRON Bootstrap] Complete in ${elapsed}s`);
  console.log(`   Nodes: ${counts.nodes}, Edges: ${counts.edges}`);

  const stats = await bronGraph.getStats();
  console.log('   Breakdown:', JSON.stringify(stats.nodes));

  return true;
}

// ═══════════════════════════════════════════════════════════
// MITRE ATT&CK ENTERPRISE
// ═══════════════════════════════════════════════════════════

async function loadATTACK() {
  const counts = { nodes: 0, edges: 0 };

  // Fetch ATT&CK Enterprise STIX bundle
  const data = await safeFetch('https://raw.githubusercontent.com/mitre/cti/master/enterprise-attack/enterprise-attack.json');
  if (!data?.objects) {
    console.log('    ⚠️ ATT&CK data unavailable, using embedded fallback...');
    return await loadATTACKFallback();
  }

  const tactics = [];
  const techniques = [];
  const tacticTechEdges = [];

  // Parse STIX objects
  const stixIdMap = new Map(); // stix id → our node key

  for (const obj of data.objects) {
    if (obj.revoked || obj.x_mitre_deprecated) continue;

    if (obj.type === 'x-mitre-tactic') {
      const externalId = obj.external_references?.find(r => r.source_name === 'mitre-attack')?.external_id;
      if (!externalId) continue;

      const key = externalId.replace(/\./g, '_');
      tactics.push({
        _key: key,
        original_id: externalId,
        name: obj.name,
        description: (obj.description || '').slice(0, 500),
        stix_id: obj.id,
      });
      stixIdMap.set(obj.id, `tactic/${key}`);
    }

    if (obj.type === 'attack-pattern') {
      const externalId = obj.external_references?.find(r => r.source_name === 'mitre-attack')?.external_id;
      if (!externalId) continue;

      const key = externalId.replace(/\./g, '_');
      const capecRefs = obj.external_references?.filter(r => r.source_name === 'capec')?.map(r => r.external_id) || [];

      techniques.push({
        _key: key,
        original_id: externalId,
        name: obj.name,
        description: (obj.description || '').slice(0, 1000),
        stix_id: obj.id,
        kill_chain_phases: obj.kill_chain_phases?.map(p => p.phase_name) || [],
        platforms: obj.x_mitre_platforms || [],
        capec_ids: capecRefs,
      });
      stixIdMap.set(obj.id, `technique/${key}`);
    }
  }

  // Process relationships (tactic ↔ technique via kill_chain_phases)
  for (const tech of techniques) {
    for (const phase of tech.kill_chain_phases) {
      const tactic = tactics.find(t => t.name.toLowerCase().replace(/[\s-]/g, '') === phase.replace(/-/g, ''));
      if (tactic) {
        tacticTechEdges.push({
          _from: `tactic/${tactic._key}`,
          _to: `technique/${tech._key}`,
        });
      }
    }
  }

  // Also process explicit STIX relationships
  for (const obj of data.objects) {
    if (obj.type === 'relationship' && !obj.revoked) {
      const from = stixIdMap.get(obj.source_ref);
      const to = stixIdMap.get(obj.target_ref);
      if (from && to && from.startsWith('tactic/') && to.startsWith('technique/')) {
        tacticTechEdges.push({ _from: from, _to: to });
      }
    }
  }

  // Insert
  counts.nodes += await bronGraph.bulkInsertNodes('tactic', tactics);
  console.log(`    ✓ Tactics: ${tactics.length}`);

  counts.nodes += await bronGraph.bulkInsertNodes('technique', techniques);
  console.log(`    ✓ Techniques: ${techniques.length}`);

  // Deduplicate edges
  const uniqueEdges = [...new Map(tacticTechEdges.map(e => [`${e._from}→${e._to}`, e])).values()];
  counts.edges += await bronGraph.bulkInsertEdges('tactic_technique', uniqueEdges);
  console.log(`    ✓ Tactic↔Technique edges: ${uniqueEdges.length}`);

  // Link techniques to CAPEC
  const techCapecEdges = [];
  for (const tech of techniques) {
    for (const capecId of tech.capec_ids || []) {
      const capecNum = capecId.replace('CAPEC-', '');
      techCapecEdges.push({
        _from: `technique/${tech._key}`,
        _to: `capec/CAPEC_${capecNum}`,
      });
    }
  }
  if (techCapecEdges.length > 0) {
    counts.edges += await bronGraph.bulkInsertEdges('technique_capec', techCapecEdges);
    console.log(`    ✓ Technique→CAPEC edges: ${techCapecEdges.length}`);
  }

  return counts;
}

async function loadATTACKFallback() {
  // Embedded minimal ATT&CK data for offline operation
  const { MITRE_ATTACK } = await import('./frameworks.js');
  const counts = { nodes: 0, edges: 0 };
  const tactics = [];
  const techniques = [];
  const edges = [];

  for (const tactic of MITRE_ATTACK.tactics) {
    const tKey = tactic.id.replace(/\./g, '_');
    tactics.push({
      _key: tKey,
      original_id: tactic.id,
      name: tactic.name,
      description: tactic.description || '',
    });

    for (const tech of tactic.techniques || []) {
      const techKey = tech.id.replace(/\./g, '_');
      techniques.push({
        _key: techKey,
        original_id: tech.id,
        name: tech.name,
        description: '',
        sub_techniques: tech.sub || [],
      });
      edges.push({ _from: `tactic/${tKey}`, _to: `technique/${techKey}` });
    }
  }

  counts.nodes += await bronGraph.bulkInsertNodes('tactic', tactics);
  const uniqueTechs = [...new Map(techniques.map(t => [t._key, t])).values()];
  counts.nodes += await bronGraph.bulkInsertNodes('technique', uniqueTechs);
  const uniqueEdges = [...new Map(edges.map(e => [`${e._from}→${e._to}`, e])).values()];
  counts.edges += await bronGraph.bulkInsertEdges('tactic_technique', uniqueEdges);
  console.log(`    ✓ Fallback: ${tactics.length} tactics, ${uniqueTechs.length} techniques, ${uniqueEdges.length} edges`);
  return counts;
}

// ═══════════════════════════════════════════════════════════
// MITRE CAPEC
// ═══════════════════════════════════════════════════════════

async function loadCAPEC() {
  const counts = { nodes: 0, edges: 0 };

  const data = await safeFetch('https://raw.githubusercontent.com/mitre/cti/master/capec/2.1/stix-capec.json');
  if (!data?.objects) {
    console.log('    ⚠️ CAPEC STIX data unavailable, trying XML...');
    return await loadCAPECFromXML();
  }

  const capecs = [];

  for (const obj of data.objects) {
    if (obj.type !== 'attack-pattern' || obj.revoked) continue;

    const externalId = obj.external_references?.find(r => r.source_name === 'capec')?.external_id;
    if (!externalId) continue;

    const capecNum = externalId.replace('CAPEC-', '');
    const cweRefs = obj.external_references?.filter(r => r.source_name === 'cwe')?.map(r => r.external_id) || [];

    capecs.push({
      _key: `CAPEC_${capecNum}`,
      original_id: externalId,
      name: obj.name,
      description: (obj.description || '').slice(0, 1000),
      severity: obj.x_capec_typical_severity || 'Unknown',
      likelihood: obj.x_capec_likelihood_of_attack || 'Unknown',
      cwe_ids: cweRefs,
    });
  }

  counts.nodes += await bronGraph.bulkInsertNodes('capec', capecs);
  console.log(`    ✓ CAPEC patterns: ${capecs.length}`);

  return counts;
}

async function loadCAPECFromXML() {
  // Minimal fallback — load CAPEC data from MITRE website
  const counts = { nodes: 0, edges: 0 };
  console.log('    ⚠️ CAPEC XML fallback not implemented, skipping...');
  return counts;
}

// ═══════════════════════════════════════════════════════════
// MITRE CWE
// ═══════════════════════════════════════════════════════════

async function loadCWE() {
  const counts = { nodes: 0, edges: 0 };

  // CWE doesn't have a STIX format — we use the BRON-style JSON or build from NVD
  // For now, fetch the most common CWEs from a curated list
  const cwes = [];

  // Top 100+ most common CWEs (from OWASP, NVD statistics)
  const commonCWEs = [
    { id: 'CWE-79', name: 'Improper Neutralization of Input During Web Page Generation (XSS)' },
    { id: 'CWE-89', name: 'SQL Injection' },
    { id: 'CWE-20', name: 'Improper Input Validation' },
    { id: 'CWE-22', name: 'Improper Limitation of a Pathname to a Restricted Directory (Path Traversal)' },
    { id: 'CWE-78', name: 'OS Command Injection' },
    { id: 'CWE-119', name: 'Improper Restriction of Operations within the Bounds of a Memory Buffer' },
    { id: 'CWE-125', name: 'Out-of-bounds Read' },
    { id: 'CWE-200', name: 'Exposure of Sensitive Information' },
    { id: 'CWE-264', name: 'Permissions, Privileges, and Access Controls' },
    { id: 'CWE-269', name: 'Improper Privilege Management' },
    { id: 'CWE-276', name: 'Incorrect Default Permissions' },
    { id: 'CWE-284', name: 'Improper Access Control' },
    { id: 'CWE-287', name: 'Improper Authentication' },
    { id: 'CWE-306', name: 'Missing Authentication for Critical Function' },
    { id: 'CWE-310', name: 'Cryptographic Issues' },
    { id: 'CWE-311', name: 'Missing Encryption of Sensitive Data' },
    { id: 'CWE-326', name: 'Inadequate Encryption Strength' },
    { id: 'CWE-327', name: 'Use of a Broken or Risky Cryptographic Algorithm' },
    { id: 'CWE-352', name: 'Cross-Site Request Forgery (CSRF)' },
    { id: 'CWE-362', name: 'Concurrent Execution Using Shared Resource with Improper Synchronization (Race Condition)' },
    { id: 'CWE-369', name: 'Divide By Zero' },
    { id: 'CWE-399', name: 'Resource Management Errors' },
    { id: 'CWE-400', name: 'Uncontrolled Resource Consumption' },
    { id: 'CWE-401', name: 'Missing Release of Memory after Effective Lifetime' },
    { id: 'CWE-415', name: 'Double Free' },
    { id: 'CWE-416', name: 'Use After Free' },
    { id: 'CWE-417', name: 'Communication Channel Errors' },
    { id: 'CWE-426', name: 'Untrusted Search Path' },
    { id: 'CWE-434', name: 'Unrestricted Upload of File with Dangerous Type' },
    { id: 'CWE-436', name: 'Interpretation Conflict' },
    { id: 'CWE-459', name: 'Incomplete Cleanup' },
    { id: 'CWE-476', name: 'NULL Pointer Dereference' },
    { id: 'CWE-494', name: 'Download of Code Without Integrity Check' },
    { id: 'CWE-502', name: 'Deserialization of Untrusted Data' },
    { id: 'CWE-506', name: 'Embedded Malicious Code' },
    { id: 'CWE-522', name: 'Insufficiently Protected Credentials' },
    { id: 'CWE-532', name: 'Insertion of Sensitive Information into Log File' },
    { id: 'CWE-601', name: 'URL Redirection to Untrusted Site (Open Redirect)' },
    { id: 'CWE-611', name: 'Improper Restriction of XML External Entity Reference (XXE)' },
    { id: 'CWE-613', name: 'Insufficient Session Expiration' },
    { id: 'CWE-617', name: 'Reachable Assertion' },
    { id: 'CWE-668', name: 'Exposure of Resource to Wrong Sphere' },
    { id: 'CWE-672', name: 'Operation on a Resource after Expiration or Release' },
    { id: 'CWE-674', name: 'Uncontrolled Recursion' },
    { id: 'CWE-704', name: 'Incorrect Type Conversion or Cast' },
    { id: 'CWE-732', name: 'Incorrect Permission Assignment for Critical Resource' },
    { id: 'CWE-754', name: 'Improper Check for Unusual or Exceptional Conditions' },
    { id: 'CWE-755', name: 'Improper Handling of Exceptional Conditions' },
    { id: 'CWE-770', name: 'Allocation of Resources Without Limits or Throttling' },
    { id: 'CWE-776', name: 'Improper Restriction of Recursive Entity References in DTDs (XML Entity Expansion)' },
    { id: 'CWE-787', name: 'Out-of-bounds Write' },
    { id: 'CWE-798', name: 'Use of Hard-coded Credentials' },
    { id: 'CWE-835', name: 'Loop with Unreachable Exit Condition (Infinite Loop)' },
    { id: 'CWE-862', name: 'Missing Authorization' },
    { id: 'CWE-863', name: 'Incorrect Authorization' },
    { id: 'CWE-908', name: 'Use of Uninitialized Resource' },
    { id: 'CWE-909', name: 'Missing Initialization of Resource' },
    { id: 'CWE-913', name: 'Improper Control of Dynamically-Managed Code Resources' },
    { id: 'CWE-917', name: 'Improper Neutralization of Special Elements used in an Expression Language Statement (Expression Language Injection)' },
    { id: 'CWE-918', name: 'Server-Side Request Forgery (SSRF)' },
    { id: 'CWE-922', name: 'Insecure Storage of Sensitive Information' },
    { id: 'CWE-94', name: 'Improper Control of Generation of Code (Code Injection)' },
    { id: 'CWE-943', name: 'Improper Neutralization of Special Elements in Data Query Logic' },
    { id: 'CWE-1021', name: 'Improper Restriction of Rendered UI Layers or Frames (Clickjacking)' },
    { id: 'CWE-1035', name: 'OWASP Top Ten 2017 Category A1 - Injection' },
    { id: 'CWE-1321', name: 'Improperly Controlled Modification of Object Prototype Attributes (Prototype Pollution)' },
    { id: 'CWE-1333', name: 'Inefficient Regular Expression Complexity (ReDoS)' },
  ];

  for (const cwe of commonCWEs) {
    const num = cwe.id.replace('CWE-', '');
    cwes.push({
      _key: `CWE_${num}`,
      original_id: cwe.id,
      name: cwe.name,
      description: cwe.name,
    });
  }

  counts.nodes += await bronGraph.bulkInsertNodes('cwe', cwes);
  console.log(`    ✓ CWE weaknesses: ${cwes.length}`);

  return counts;
}

// ═══════════════════════════════════════════════════════════
// CVE VULNERABILITIES (from NVD)
// ═══════════════════════════════════════════════════════════

async function loadCVEs(fullHistory = false) {
  const counts = { nodes: 0, edges: 0 };

  const allCVEs = [];
  const allCweCveEdges = [];
  const allCveCpeEdges = [];

  // ═══ Helper to process NVD API response ═══
  const processCVEResponse = async (data, label) => {
    if (!data?.vulnerabilities) return;

    for (const item of data.vulnerabilities) {
      const cve = item.cve;
      if (!cve?.id) continue;

      const key = cve.id.replace(/-/g, '_');
      const desc = cve.descriptions?.find(d => d.lang === 'en')?.value || '';

      let cvssScore = null;
      let severity = 'UNKNOWN';
      const metrics = cve.metrics;
      if (metrics?.cvssMetricV31?.[0]) {
        cvssScore = metrics.cvssMetricV31[0].cvssData?.baseScore;
        severity = metrics.cvssMetricV31[0].cvssData?.baseSeverity || 'UNKNOWN';
      } else if (metrics?.cvssMetricV2?.[0]) {
        cvssScore = metrics.cvssMetricV2[0].cvssData?.baseScore;
        severity = cvssScore >= 9 ? 'CRITICAL' : cvssScore >= 7 ? 'HIGH' : cvssScore >= 4 ? 'MEDIUM' : 'LOW';
      }

      allCVEs.push({
        _key: key,
        original_id: cve.id,
        name: cve.id,
        description: desc.slice(0, 1000),
        severity,
        cvss_score: cvssScore,
        published: cve.published,
      });

      // CWE links
      for (const w of cve.weaknesses || []) {
        for (const d of w.description || []) {
          if (d.value?.startsWith('CWE-')) {
            allCweCveEdges.push({
              _from: `cwe/CWE_${d.value.replace('CWE-', '')}`,
              _to: `cve/${key}`,
            });
          }
        }
      }

      // CPE links
      for (const config of cve.configurations || []) {
        for (const node of config.nodes || []) {
          for (const match of node.cpeMatch || []) {
            if (match.criteria) {
              const cpeKey = match.criteria.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 200);
              const parts = match.criteria.split(':');
              if (parts.length >= 5) {
                const cpeNode = {
                  _key: cpeKey,
                  original_id: match.criteria,
                  name: match.criteria,
                  vendor: parts[3] || '',
                  product: parts[4] || '',
                  version: parts[5] || '*',
                };
                await bronGraph.bulkInsertNodes('cpe', [cpeNode]).catch(() => {});
                allCveCpeEdges.push({
                  _from: `cve/${key}`,
                  _to: `cpe/${cpeKey}`,
                });
              }
            }
          }
        }
      }
    }
    console.log(`    ✓ ${label}: ${data.vulnerabilities.length} CVEs`);
  };

  if (fullHistory) {
    console.log('    📥 Loading FULL CVE history (1999-present). This will take ~15-30 minutes...');
    const currentYear = new Date().getFullYear();
    
    for (let year = 1999; year <= currentYear; year++) {
      console.log(`    📥 Fetching ALL CVEs for ${year}...`);
      
      // NVD 2.0 API limits date ranges to 120 days maximum.
      // We will split the year into 3 chunks of roughly 120 days each to stay within limits
      const chunks = [
        { start: `${year}-01-01T00:00:00`, end: `${year}-04-30T23:59:59` }, // Jan - Apr
        { start: `${year}-05-01T00:00:00`, end: `${year}-08-31T23:59:59` }, // May - Aug
        { start: `${year}-09-01T00:00:00`, end: `${year}-12-31T23:59:59` }  // Sep - Dec
      ];

      for (const [idx, chunk] of chunks.entries()) {
        let startIndex = 0;
        let totalResults = 1;
        
        while (startIndex < totalResults) {
          const url = `https://services.nvd.nist.gov/rest/json/cves/2.0?pubStartDate=${chunk.start}&pubEndDate=${chunk.end}&resultsPerPage=2000&startIndex=${startIndex}`;
          const data = await safeFetch(url);
          
          if (!data) break; // Error or timeout, skip to next chunk
          
          totalResults = data.totalResults || 0;
          if (data.vulnerabilities && data.vulnerabilities.length > 0) {
            await processCVEResponse(data, `${year} Q${idx + 1} (Offset ${startIndex})`);
          }
          
          startIndex += 2000;
          await sleep(6500); // Strict NVD rate limit (max 5 per 30s)
        }
      }
    }
  } else {
    // ═══ 1. Recent CVEs — last 120 days ═══
    console.log('    📥 Loading recent CVEs (last 120 days)...');
    const now = new Date();
    const recentStart = new Date(now.getTime() - 120 * 24 * 60 * 60 * 1000);
    const recentUrl = `https://services.nvd.nist.gov/rest/json/cves/2.0?pubStartDate=${recentStart.toISOString().replace(/\.\d{3}Z/, '')}&pubEndDate=${now.toISOString().replace(/\.\d{3}Z/, '')}&resultsPerPage=2000`;
    const recentData = await safeFetch(recentUrl);
    await processCVEResponse(recentData, 'Recent (120d)');
    await sleep(6500); // NVD rate limit: 5 requests per 30 seconds (no API key)

    // ═══ 2. Historical high-severity CVEs by year (critical/high only) ═══
    const years = [2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017];
    for (const year of years) {
      console.log(`    📥 Loading critical/high CVEs from ${year}...`);

      // First half of year
      const h1Start = `${year}-01-01T00:00:00`;
      const h1End = `${year}-06-30T23:59:59`;
      const h1Url = `https://services.nvd.nist.gov/rest/json/cves/2.0?pubStartDate=${h1Start}&pubEndDate=${h1End}&cvssV3Severity=CRITICAL&resultsPerPage=2000`;
      const h1Data = await safeFetch(h1Url);
      await processCVEResponse(h1Data, `${year} H1 Critical`);
      await sleep(6500);

      const h1HighUrl = `https://services.nvd.nist.gov/rest/json/cves/2.0?pubStartDate=${h1Start}&pubEndDate=${h1End}&cvssV3Severity=HIGH&resultsPerPage=2000`;
      const h1HighData = await safeFetch(h1HighUrl);
      await processCVEResponse(h1HighData, `${year} H1 High`);
      await sleep(6500);

      // Second half of year
      const h2Start = `${year}-07-01T00:00:00`;
      const h2End = `${year}-12-31T23:59:59`;
      const h2Url = `https://services.nvd.nist.gov/rest/json/cves/2.0?pubStartDate=${h2Start}&pubEndDate=${h2End}&cvssV3Severity=CRITICAL&resultsPerPage=2000`;
      const h2Data = await safeFetch(h2Url);
      await processCVEResponse(h2Data, `${year} H2 Critical`);
      await sleep(6500);

      const h2HighUrl = `https://services.nvd.nist.gov/rest/json/cves/2.0?pubStartDate=${h2Start}&pubEndDate=${h2End}&cvssV3Severity=HIGH&resultsPerPage=2000`;
      const h2HighData = await safeFetch(h2HighUrl);
      await processCVEResponse(h2HighData, `${year} H2 High`);
      await sleep(6500);
    }
  }

  // ═══ 3. CISA Known Exploited Vulnerabilities (KEV) ═══
  // These are actively exploited vulns — the most important ones to have
  console.log('    📥 Loading CISA Known Exploited Vulnerabilities...');
  const kevData = await safeFetch('https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json');
  if (kevData?.vulnerabilities) {
    let kevCount = 0;
    for (const kev of kevData.vulnerabilities) {
      if (!kev.cveID) continue;
      const key = kev.cveID.replace(/-/g, '_');
      // Only add if not already present
      if (!allCVEs.find(c => c._key === key)) {
        allCVEs.push({
          _key: key,
          original_id: kev.cveID,
          name: kev.cveID,
          description: `${kev.vulnerabilityName || ''}: ${kev.shortDescription || ''}`.trim(),
          severity: 'HIGH', // KEV entries are actively exploited, at least HIGH
          cvss_score: null,
          published: kev.dateAdded,
        });
        kevCount++;
      }
    }
    console.log(`    ✓ CISA KEV: ${kevCount} actively exploited vulnerabilities`);
  }
  await sleep(2000);

  // ═══ 4. Product-specific CVEs for common search terms ═══
  const commonProducts = ['firebase', 'apache', 'nginx', 'wordpress', 'docker', 'kubernetes',
    'openssh', 'openssl', 'mysql', 'postgresql', 'redis', 'mongodb', 'jenkins',
    'elasticsearch', 'grafana', 'tomcat', 'exchange', 'log4j', 'spring'];

  console.log(`    📥 Loading CVEs for ${commonProducts.length} popular products...`);
  for (const product of commonProducts) {
    const prodUrl = `https://services.nvd.nist.gov/rest/json/cves/2.0?keywordSearch=${encodeURIComponent(product)}&resultsPerPage=100`;
    const prodData = await safeFetch(prodUrl);
    await processCVEResponse(prodData, product);
    await sleep(6500);
  }

  // ═══ Deduplicate and bulk insert ═══
  const seenKeys = new Set();
  const uniqueCVEs = [];
  for (const cve of allCVEs) {
    if (!seenKeys.has(cve._key)) {
      seenKeys.add(cve._key);
      uniqueCVEs.push(cve);
    }
  }

  // Insert in batches of 1000
  console.log(`    💾 Inserting ${uniqueCVEs.length} unique CVEs...`);
  for (let i = 0; i < uniqueCVEs.length; i += 1000) {
    const batch = uniqueCVEs.slice(i, i + 1000);
    counts.nodes += await bronGraph.bulkInsertNodes('cve', batch);
  }
  console.log(`    ✓ CVEs total: ${uniqueCVEs.length}`);

  if (allCweCveEdges.length > 0) {
    // Deduplicate edges
    const edgeSet = new Set();
    const uniqueEdges = allCweCveEdges.filter(e => {
      const k = `${e._from}|${e._to}`;
      if (edgeSet.has(k)) return false;
      edgeSet.add(k);
      return true;
    });
    for (let i = 0; i < uniqueEdges.length; i += 1000) {
      counts.edges += await bronGraph.bulkInsertEdges('cwe_cve', uniqueEdges.slice(i, i + 1000));
    }
    console.log(`    ✓ CWE→CVE edges: ${uniqueEdges.length}`);
  }

  if (allCveCpeEdges.length > 0) {
    const edgeSet = new Set();
    const uniqueEdges = allCveCpeEdges.filter(e => {
      const k = `${e._from}|${e._to}`;
      if (edgeSet.has(k)) return false;
      edgeSet.add(k);
      return true;
    });
    for (let i = 0; i < uniqueEdges.length; i += 1000) {
      counts.edges += await bronGraph.bulkInsertEdges('cve_cpe', uniqueEdges.slice(i, i + 1000));
    }
    console.log(`    ✓ CVE→CPE edges: ${uniqueEdges.length}`);
  }

  return counts;
}

// ═══════════════════════════════════════════════════════════
// MITRE D3FEND
// ═══════════════════════════════════════════════════════════

async function loadD3FEND() {
  const counts = { nodes: 0, edges: 0 };

  // D3FEND data from MITRE's public ontology
  const data = await safeFetch('https://d3fend.mitre.org/api/offensive-technique/all.json');

  if (data) {
    // Process D3FEND data if available
    const defenses = [];
    const techD3fendEdges = [];

    // D3FEND API returns bindings linking ATT&CK techniques to defensive techniques
    const bindings = data?.results?.bindings || [];
    const seenDefenses = new Set();

    for (const binding of bindings) {
      const defId = binding.def_tech_label?.value;
      const defUri = binding.def_tech?.value;
      const attTech = binding.off_tech_id?.value;

      if (!defId || !defUri) continue;

      const d3Key = defId.replace(/[^a-zA-Z0-9_-]/g, '_');

      if (!seenDefenses.has(d3Key)) {
        seenDefenses.add(d3Key);
        defenses.push({
          _key: d3Key,
          original_id: d3Key,
          name: defId,
          description: binding.def_tech_def?.value || '',
          category: binding.def_tactic_label?.value || 'Unknown',
          uri: defUri,
        });
      }

      if (attTech) {
        const techKey = attTech.replace(/\./g, '_');
        techD3fendEdges.push({
          _from: `technique/${techKey}`,
          _to: `d3fend/${d3Key}`,
        });
      }
    }

    if (defenses.length > 0) {
      counts.nodes += await bronGraph.bulkInsertNodes('d3fend', defenses);
      console.log(`    ✓ D3FEND techniques: ${defenses.length}`);
    }

    if (techD3fendEdges.length > 0) {
      const uniqueEdges = [...new Map(techD3fendEdges.map(e => [`${e._from}→${e._to}`, e])).values()];
      counts.edges += await bronGraph.bulkInsertEdges('technique_d3fend', uniqueEdges);
      console.log(`    ✓ Technique→D3FEND edges: ${uniqueEdges.length}`);
    }
  } else {
    console.log('    ⚠️ D3FEND API unavailable, loading curated defensive mappings...');
    await loadD3FENDFallback();
  }

  return counts;
}

async function loadD3FENDFallback() {
  // Curated D3FEND defensive techniques mapped to common ATT&CK techniques
  const defenses = [
    { _key: 'D3_WAF', original_id: 'D3-WAF', name: 'Web Application Firewall', description: 'Filter malicious HTTP requests', category: 'Isolate' },
    { _key: 'D3_NTA', original_id: 'D3-NTA', name: 'Network Traffic Analysis', description: 'Analyze network traffic for threats', category: 'Detect' },
    { _key: 'D3_FIM', original_id: 'D3-FIM', name: 'File Integrity Monitoring', description: 'Detect unauthorized file modifications', category: 'Detect' },
    { _key: 'D3_SU', original_id: 'D3-SU', name: 'Software Update', description: 'Apply vendor patches and updates', category: 'Harden' },
    { _key: 'D3_MFA', original_id: 'D3-MFA', name: 'Multi-factor Authentication', description: 'Require multiple authentication factors', category: 'Harden' },
    { _key: 'D3_ACL', original_id: 'D3-ACL', name: 'Access Control List', description: 'Restrict access based on permissions', category: 'Isolate' },
    { _key: 'D3_SE', original_id: 'D3-SE', name: 'Sandboxed Execution', description: 'Execute code in isolated environments', category: 'Isolate' },
    { _key: 'D3_EAL', original_id: 'D3-EAL', name: 'Executable Allowlisting', description: 'Allow only approved executables', category: 'Harden' },
    { _key: 'D3_EDR', original_id: 'D3-EDR', name: 'Endpoint Detection and Response', description: 'Monitor and respond to endpoint threats', category: 'Detect' },
    { _key: 'D3_NID', original_id: 'D3-NID', name: 'Network Intrusion Detection', description: 'Detect network-based attacks', category: 'Detect' },
    { _key: 'D3_PSA', original_id: 'D3-PSA', name: 'Process Segment Analysis', description: 'Analyze process segments for anomalies', category: 'Detect' },
    { _key: 'D3_DA', original_id: 'D3-DA', name: 'Dynamic Analysis', description: 'Analyze program behavior during execution', category: 'Detect' },
    { _key: 'D3_EF', original_id: 'D3-EF', name: 'Email Filtering', description: 'Filter malicious emails', category: 'Isolate' },
    { _key: 'D3_IDA', original_id: 'D3-IDA', name: 'Input Data Authentication', description: 'Validate and authenticate input data', category: 'Harden' },
    { _key: 'D3_CP', original_id: 'D3-CP', name: 'Credential Prevention', description: 'Prevent credential theft and abuse', category: 'Harden' },
  ];

  await bronGraph.bulkInsertNodes('d3fend', defenses);

  // Map common ATT&CK techniques to D3FEND defenses
  const mappings = [
    { tech: 'T1190', def: ['D3_WAF', 'D3_SU', 'D3_NID'] },
    { tech: 'T1059', def: ['D3_EAL', 'D3_SE', 'D3_EDR'] },
    { tech: 'T1078', def: ['D3_MFA', 'D3_CP', 'D3_ACL'] },
    { tech: 'T1110', def: ['D3_MFA', 'D3_CP'] },
    { tech: 'T1046', def: ['D3_NID', 'D3_NTA'] },
    { tech: 'T1566', def: ['D3_EF', 'D3_DA', 'D3_SE'] },
    { tech: 'T1068', def: ['D3_SU', 'D3_SE', 'D3_PSA'] },
    { tech: 'T1055', def: ['D3_PSA', 'D3_EDR'] },
    { tech: 'T1021', def: ['D3_MFA', 'D3_NTA', 'D3_ACL'] },
    { tech: 'T1595', def: ['D3_NID', 'D3_NTA'] },
    { tech: 'T1189', def: ['D3_WAF', 'D3_SE'] },
    { tech: 'T1204', def: ['D3_SE', 'D3_EAL', 'D3_DA'] },
    { tech: 'T1053', def: ['D3_FIM', 'D3_EDR'] },
    { tech: 'T1543', def: ['D3_FIM', 'D3_ACL'] },
    { tech: 'T1098', def: ['D3_MFA', 'D3_ACL'] },
  ];

  const edges = [];
  for (const m of mappings) {
    for (const d of m.def) {
      edges.push({ _from: `technique/${m.tech}`, _to: `d3fend/${d}` });
    }
  }
  await bronGraph.bulkInsertEdges('technique_d3fend', edges);
  console.log(`    ✓ Fallback D3FEND: ${defenses.length} defenses, ${edges.length} mappings`);
}

// ═══════════════════════════════════════════════════════════
// CROSS-LINKING: CAPEC ↔ CWE
// ═══════════════════════════════════════════════════════════

async function linkCAPEC_CWE() {
  let edgeCount = 0;

  try {
    // Read CAPEC nodes that have cwe_ids
    const cursor = await bronGraph.db.query({
      query: 'FOR doc IN capec FILTER doc.cwe_ids != null AND LENGTH(doc.cwe_ids) > 0 RETURN { key: doc._key, cwes: doc.cwe_ids }',
      bindVars: {},
    });
    const capecNodes = await cursor.all();

    const edges = [];
    for (const node of capecNodes) {
      for (const cweId of node.cwes || []) {
        const cweNum = cweId.replace('CWE-', '');
        edges.push({
          _from: `capec/${node.key}`,
          _to: `cwe/CWE_${cweNum}`,
        });
      }
    }

    if (edges.length > 0) {
      edgeCount = await bronGraph.bulkInsertEdges('capec_cwe', edges);
      console.log(`    ✓ CAPEC→CWE edges: ${edgeCount}`);
    }
  } catch (err) {
    console.error(`    ⚠️ CAPEC→CWE linking error: ${err.message}`);
  }

  return edgeCount;
}

// ═══════════════════════════════════════════════════════════
// CROSS-LINKING: CWE ↔ CVE (supplementary from existing CVE data)
// ═══════════════════════════════════════════════════════════

async function linkCWE_CVE() {
  // CWE→CVE edges are already created during CVE loading
  // This function handles any supplementary linking
  try {
    const cursor = await bronGraph.db.query({
      query: 'RETURN LENGTH(cwe_cve)',
      bindVars: {},
    });
    const result = await cursor.all();
    console.log(`    ✓ CWE→CVE edges (total): ${result[0] || 0}`);
    return 0; // No additional edges created
  } catch {
    return 0;
  }
}

// ═══════════════════════════════════════════════════════════
// INCREMENTAL UPDATE (for auto-learner integration)
// ═══════════════════════════════════════════════════════════

/**
 * Add a new CVE to the graph with its CWE/CPE links
 * Called by auto-learner when new CVEs are fetched
 */
export async function addCVEToGraph(cveData) {
  if (!bronGraph.connected) return;

  try {
    const { id, description, severity, cvss_score, cwes = [], cpes = [] } = cveData;
    const key = id.replace(/-/g, '_');

    // Insert CVE node
    await bronGraph.bulkInsertNodes('cve', [{
      _key: key,
      original_id: id,
      name: id,
      description: (description || '').slice(0, 1000),
      severity: severity || 'UNKNOWN',
      cvss_score: cvss_score || null,
    }]);

    // Link to CWEs
    const cweCveEdges = cwes.map(cweId => ({
      _from: `cwe/CWE_${cweId.replace('CWE-', '')}`,
      _to: `cve/${key}`,
    }));
    if (cweCveEdges.length > 0) {
      await bronGraph.bulkInsertEdges('cwe_cve', cweCveEdges);
    }

    // Link to CPEs
    for (const cpe of cpes) {
      const cpeKey = cpe.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 200);
      const parts = cpe.split(':');
      await bronGraph.bulkInsertNodes('cpe', [{
        _key: cpeKey,
        original_id: cpe,
        name: cpe,
        vendor: parts[3] || '',
        product: parts[4] || '',
        version: parts[5] || '*',
      }]);
      await bronGraph.bulkInsertEdges('cve_cpe', [{
        _from: `cve/${key}`,
        _to: `cpe/${cpeKey}`,
      }]);
    }
  } catch (err) {
    // Silent fail — don't break the auto-learner
  }
}
