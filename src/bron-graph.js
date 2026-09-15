// Jarvis Cyber — BRON Knowledge Graph Engine (ArangoDB)
// Provides graph traversal API over the BRON cybersecurity knowledge graph
// Links: ATT&CK Tactics ↔ Techniques ↔ CAPEC ↔ CWE ↔ CVE ↔ CPE + D3FEND + Engage
import { Database, aql } from 'arangojs';
import config from './config.js';

// ═══════════════════════════════════════════════════════════
// BRON Node Types & Edge Types
// ═══════════════════════════════════════════════════════════
const NODE_COLLECTIONS = [
  'tactic',       // ATT&CK Tactics (TA0001-TA0043)
  'technique',    // ATT&CK Techniques (T1001-T1598)
  'capec',        // CAPEC Attack Patterns
  'cwe',          // CWE Weaknesses
  'cve',          // CVE Vulnerabilities
  'cpe',          // CPE Affected Products
  'd3fend',       // D3FEND Defensive Techniques
  'engage',       // MITRE Engage Deception Techniques
];

const EDGE_COLLECTIONS = [
  'tactic_technique',     // tactic → technique
  'technique_capec',      // technique → capec
  'capec_cwe',            // capec → cwe
  'cwe_cve',              // cwe → cve
  'cve_cpe',              // cve → cpe
  'technique_d3fend',     // technique → d3fend (defensive mapping)
  'technique_engage',     // technique → engage (deception mapping)
];

const GRAPH_NAME = 'bron_graph';

class BronGraph {
  constructor() {
    this.db = null;
    this.graph = null;
    this.connected = false;
    this._initPromise = null;
  }

  // ═══════════════════════════════════════════════════════════
  // CONNECTION & INITIALIZATION
  // ═══════════════════════════════════════════════════════════

  /**
   * Initialize connection to ArangoDB and ensure schema exists
   * @returns {Promise<boolean>} true if connected successfully
   */
  async init() {
    if (this.connected) return true;
    if (this._initPromise) return this._initPromise;

    this._initPromise = this._doInit();
    return this._initPromise;
  }

  async _doInit() {
    try {
      const url = config.bronDbUrl || 'http://127.0.0.1:8529';
      const password = config.bronDbPassword || 'jarvis_bron_2024';
      const dbName = config.bronDbName || 'bron';

      this.db = new Database({
        url,
        auth: { username: 'root', password },
      });

      // Create database if it doesn't exist
      const systemDb = this.db.database('_system');
      const databases = await systemDb.listDatabases();
      if (!databases.includes(dbName)) {
        await systemDb.createDatabase(dbName);
        console.log(`  🗄️ [BRON] Created database: ${dbName}`);
      }

      this.db = this.db.database(dbName);

      // Ensure collections exist
      await this._ensureCollections();

      // Ensure graph definition exists
      await this._ensureGraph();

      this.connected = true;
      console.log(`  ✅ [BRON] Connected to ArangoDB at ${url} (db: ${dbName})`);
      return true;
    } catch (err) {
      console.error(`  ⚠️ [BRON] ArangoDB connection failed: ${err.message}`);
      console.error(`  💡 Start ArangoDB: docker-compose -f docker-compose.bron.yml up -d`);
      this.connected = false;
      this._initPromise = null;
      return false;
    }
  }

  async _ensureCollections() {
    // Document collections
    for (const name of NODE_COLLECTIONS) {
      const col = this.db.collection(name);
      if (!await col.exists()) {
        await col.create();
        // Create index on original_id for fast lookups
        await col.ensureIndex({ type: 'persistent', fields: ['original_id'], unique: false });
        await col.ensureIndex({ type: 'persistent', fields: ['name'], unique: false });
      }
    }
    // Edge collections
    for (const name of EDGE_COLLECTIONS) {
      const col = this.db.collection(name);
      if (!await col.exists()) {
        await col.create({ type: 3 }); // type 3 = edge collection
      }
    }
  }

  async _ensureGraph() {
    const graph = this.db.graph(GRAPH_NAME);
    if (!await graph.exists()) {
      await graph.create([
        { collection: 'tactic_technique', from: ['tactic'], to: ['technique'] },
        { collection: 'technique_capec', from: ['technique'], to: ['capec'] },
        { collection: 'capec_cwe', from: ['capec'], to: ['cwe'] },
        { collection: 'cwe_cve', from: ['cwe'], to: ['cve'] },
        { collection: 'cve_cpe', from: ['cve'], to: ['cpe'] },
        { collection: 'technique_d3fend', from: ['technique'], to: ['d3fend'] },
        { collection: 'technique_engage', from: ['technique'], to: ['engage'] },
      ]);
      console.log(`  📊 [BRON] Created graph: ${GRAPH_NAME}`);
    }
    this.graph = graph;
  }

  // ═══════════════════════════════════════════════════════════
  // GRAPH TRAVERSAL QUERIES
  // ═══════════════════════════════════════════════════════════

  /**
   * Traverse from a CVE to get full attack chain:
   * CVE → CWE → CAPEC → ATT&CK Technique → Tactic
   * @param {string} cveId - e.g., "CVE-2021-44228"
   * @returns {Object} Full attack chain with all linked nodes
   */
  async traverseFromCVE(cveId) {
    if (!this.connected) await this.init();
    if (!this.connected) return null;

    try {
      const cursor = await this.db.query(aql`
        LET cve_node = FIRST(
          FOR doc IN cve
            FILTER doc.original_id == ${cveId} OR doc.name == ${cveId}
            RETURN doc
        )
        
        FILTER cve_node != null
        
        // CVE → CWE (reverse edge lookup)
        LET cwes = (
          FOR v, e IN 1..1 INBOUND cve_node cwe_cve
            RETURN { id: v.original_id, name: v.name, description: v.description }
        )
        
        // CVE → CPE (outbound)
        LET cpes = (
          FOR v, e IN 1..1 OUTBOUND cve_node cve_cpe
            RETURN { id: v.original_id, name: v.name, vendor: v.vendor, product: v.product, version: v.version }
        )
        
        // CWE → CAPEC (reverse)
        LET capecs = (
          FOR cwe_node IN cwe
            FILTER cwe_node.original_id IN cwes[*].id
            FOR v, e IN 1..1 INBOUND cwe_node capec_cwe
              RETURN DISTINCT { id: v.original_id, name: v.name, description: v.description }
        )
        
        // CAPEC → Technique (reverse)
        LET techniques = (
          FOR capec_node IN capec
            FILTER capec_node.original_id IN capecs[*].id
            FOR v, e IN 1..1 INBOUND capec_node technique_capec
              RETURN DISTINCT { id: v.original_id, name: v.name, description: v.description }
        )
        
        // Technique → Tactic (reverse)
        LET tactics = (
          FOR tech_node IN technique
            FILTER tech_node.original_id IN techniques[*].id
            FOR v, e IN 1..1 INBOUND tech_node tactic_technique
              RETURN DISTINCT { id: v.original_id, name: v.name }
        )
        
        // Technique → D3FEND defenses
        LET defenses = (
          FOR tech_node IN technique
            FILTER tech_node.original_id IN techniques[*].id
            FOR v, e IN 1..1 OUTBOUND tech_node technique_d3fend
              RETURN DISTINCT { id: v.original_id, name: v.name, description: v.description }
        )
        
        RETURN {
          cve: { id: cve_node.original_id, name: cve_node.name, description: cve_node.description,
                 severity: cve_node.severity, cvss: cve_node.cvss_score },
          cwes: cwes,
          cpes: cpes,
          capecs: capecs,
          techniques: techniques,
          tactics: tactics,
          defenses: defenses
        }
      `);

      const results = await cursor.all();
      return results[0] || null;
    } catch (err) {
      console.error(`  ⚠️ [BRON] Traversal error for ${cveId}: ${err.message}`);
      return null;
    }
  }

  /**
   * Get all D3FEND defensive techniques for an ATT&CK technique
   * @param {string} techniqueId - e.g., "T1190"
   * @returns {Array} D3FEND countermeasures
   */
  async getDefensesForTechnique(techniqueId) {
    if (!this.connected) await this.init();
    if (!this.connected) return [];

    try {
      const cursor = await this.db.query(aql`
        FOR tech IN technique
          FILTER tech.original_id == ${techniqueId}
          FOR defense, edge IN 1..1 OUTBOUND tech technique_d3fend
            RETURN {
              id: defense.original_id,
              name: defense.name,
              description: defense.description,
              category: defense.category
            }
      `);
      return await cursor.all();
    } catch (err) {
      console.error(`  ⚠️ [BRON] Defense lookup error: ${err.message}`);
      return [];
    }
  }

  /**
   * Find all attack paths for a product/CPE
   * CPE → CVEs → CWEs → CAPECs → Techniques → Tactics
   * @param {string} query - product name or CPE string
   * @returns {Array} Attack paths
   */
  async findAttackPaths(query) {
    if (!this.connected) await this.init();
    if (!this.connected) return [];

    try {
      const cursor = await this.db.query(aql`
        FOR cpe_node IN cpe
          FILTER CONTAINS(LOWER(cpe_node.name), LOWER(${query}))
              OR CONTAINS(LOWER(cpe_node.product), LOWER(${query}))
              OR CONTAINS(LOWER(cpe_node.vendor), LOWER(${query}))
          LIMIT 10
          
          LET cves = (
            FOR cve_node, e IN 1..1 INBOUND cpe_node cve_cpe
              LET chain = FIRST(
                LET cwes = (FOR w IN 1..1 INBOUND cve_node cwe_cve RETURN { id: w.original_id, name: w.name })
                LET capecs = (
                  FOR cwe_n IN cwe FILTER cwe_n.original_id IN cwes[*].id
                    FOR c IN 1..1 INBOUND cwe_n capec_cwe RETURN DISTINCT { id: c.original_id, name: c.name }
                )
                LET techs = (
                  FOR capec_n IN capec FILTER capec_n.original_id IN capecs[*].id
                    FOR t IN 1..1 INBOUND capec_n technique_capec RETURN DISTINCT { id: t.original_id, name: t.name }
                )
                RETURN { cwes, capecs, techniques: techs }
              )
              RETURN {
                cve_id: cve_node.original_id,
                severity: cve_node.severity,
                cvss: cve_node.cvss_score,
                description: LEFT(cve_node.description, 200),
                chain: chain
              }
          )
          
          RETURN {
            cpe: cpe_node.original_id,
            product: cpe_node.product,
            vendor: cpe_node.vendor,
            version: cpe_node.version,
            attack_paths: cves
          }
      `);
      return await cursor.all();
    } catch (err) {
      console.error(`  ⚠️ [BRON] Attack paths error: ${err.message}`);
      return [];
    }
  }

  /**
   * Reverse lookup: ATT&CK technique → real CVEs that enable it
   * @param {string} techniqueId - e.g., "T1190"
   * @returns {Array} CVEs linked to this technique
   */
  async getCVEsForTechnique(techniqueId) {
    if (!this.connected) await this.init();
    if (!this.connected) return [];

    try {
      const cursor = await this.db.query(aql`
        FOR tech IN technique
          FILTER tech.original_id == ${techniqueId}
          
          // technique → CAPEC
          FOR capec_node IN 1..1 OUTBOUND tech technique_capec
            // CAPEC → CWE
            FOR cwe_node IN 1..1 OUTBOUND capec_node capec_cwe
              // CWE → CVE
              FOR cve_node IN 1..1 OUTBOUND cwe_node cwe_cve
                RETURN DISTINCT {
                  cve_id: cve_node.original_id,
                  name: cve_node.name,
                  severity: cve_node.severity,
                  cvss: cve_node.cvss_score,
                  description: LEFT(cve_node.description, 200),
                  chain: {
                    technique: tech.original_id,
                    capec: capec_node.original_id,
                    cwe: cwe_node.original_id
                  }
                }
      `);
      return await cursor.all();
    } catch (err) {
      console.error(`  ⚠️ [BRON] CVE lookup error: ${err.message}`);
      return [];
    }
  }

  /**
   * Enrich scan findings with full BRON graph context
   * @param {Array} findings - Array of {cve_id, ...} objects
   * @returns {Array} Enriched findings with attack chains
   */
  async enrichFindings(findings) {
    if (!this.connected) await this.init();
    if (!this.connected) return findings;

    const enriched = [];
    for (const finding of findings) {
      const cveId = finding.cve_id || finding.identifier;
      if (!cveId || !cveId.startsWith('CVE-')) {
        enriched.push(finding);
        continue;
      }

      const chain = await this.traverseFromCVE(cveId);
      if (chain) {
        enriched.push({
          ...finding,
          bron: {
            cwes: chain.cwes || [],
            capecs: chain.capecs || [],
            techniques: chain.techniques || [],
            tactics: chain.tactics || [],
            defenses: chain.defenses || [],
            cpes: chain.cpes || [],
          },
        });
      } else {
        enriched.push(finding);
      }
    }
    return enriched;
  }

  /**
   * Search across all BRON node types
   * @param {string} query - Search term
   * @param {string} nodeType - Optional: restrict to specific node type
   * @returns {Array} Matching nodes
   */
  async search(query, nodeType = null) {
    if (!this.connected) await this.init();
    if (!this.connected) return [];

    const collections = nodeType ? [nodeType] : NODE_COLLECTIONS;
    const allResults = [];

    for (const colName of collections) {
      try {
        const cursor = await this.db.query(aql`
          FOR doc IN ${this.db.collection(colName)}
            FILTER CONTAINS(LOWER(doc.original_id), LOWER(${query}))
                OR CONTAINS(LOWER(doc.name), LOWER(${query}))
                OR CONTAINS(LOWER(doc.description || ''), LOWER(${query}))
            LIMIT 20
            RETURN {
              _id: doc._id,
              type: ${colName},
              id: doc.original_id,
              name: doc.name,
              description: LEFT(doc.description || '', 200)
            }
        `);
        const results = await cursor.all();
        allResults.push(...results);
      } catch { /* skip inaccessible collections */ }
    }

    return allResults.slice(0, 50);
  }

  /**
   * Get a specific node and its immediate neighbors
   * @param {string} nodeId - e.g., "T1190", "CVE-2021-44228", "CWE-79"
   * @returns {Object} Node data + connected nodes
   */
  async getNode(nodeId) {
    if (!this.connected) await this.init();
    if (!this.connected) return null;

    // Detect node type from ID prefix
    const type = this._detectNodeType(nodeId);
    if (!type) return null;

    try {
      const col = this.db.collection(type);
      const cursor = await this.db.query(aql`
        FOR doc IN ${col}
          FILTER doc.original_id == ${nodeId}
          LIMIT 1
          RETURN doc
      `);
      const nodes = await cursor.all();
      if (nodes.length === 0) return null;

      const node = nodes[0];

      // Get all neighbors (both inbound and outbound edges)
      const neighbors = await this._getNeighbors(node._id);

      return {
        ...node,
        type,
        neighbors,
      };
    } catch (err) {
      console.error(`  ⚠️ [BRON] Node lookup error: ${err.message}`);
      return null;
    }
  }

  async _getNeighbors(nodeDocId) {
    const neighbors = { inbound: [], outbound: [] };

    for (const edgeCol of EDGE_COLLECTIONS) {
      try {
        // Outbound
        const outCursor = await this.db.query(aql`
          FOR v, e IN 1..1 OUTBOUND ${nodeDocId} ${this.db.collection(edgeCol)}
            RETURN { type: ${edgeCol}, id: v.original_id, name: v.name, direction: "outbound" }
        `);
        const outResults = await outCursor.all();
        neighbors.outbound.push(...outResults);

        // Inbound
        const inCursor = await this.db.query(aql`
          FOR v, e IN 1..1 INBOUND ${nodeDocId} ${this.db.collection(edgeCol)}
            RETURN { type: ${edgeCol}, id: v.original_id, name: v.name, direction: "inbound" }
        `);
        const inResults = await inCursor.all();
        neighbors.inbound.push(...inResults);
      } catch { /* edge collection may not connect to this node type */ }
    }

    return neighbors;
  }

  /**
   * Get graph statistics
   * @returns {Object} Node and edge counts
   */
  async getStats() {
    if (!this.connected) await this.init();
    if (!this.connected) return { connected: false };

    const stats = { connected: true, nodes: {}, edges: {}, totalNodes: 0, totalEdges: 0 };

    for (const colName of NODE_COLLECTIONS) {
      try {
        const col = this.db.collection(colName);
        const count = await col.count();
        stats.nodes[colName] = count.count;
        stats.totalNodes += count.count;
      } catch { stats.nodes[colName] = 0; }
    }

    for (const colName of EDGE_COLLECTIONS) {
      try {
        const col = this.db.collection(colName);
        const count = await col.count();
        stats.edges[colName] = count.count;
        stats.totalEdges += count.count;
      } catch { stats.edges[colName] = 0; }
    }

    return stats;
  }

  // ═══════════════════════════════════════════════════════════
  // DATA INGESTION (used by bron-bootstrap.js)
  // ═══════════════════════════════════════════════════════════

  /**
   * Bulk insert nodes into a collection
   * @param {string} collectionName
   * @param {Array} documents - Array of node documents
   * @returns {number} Number of inserted documents
   */
  async bulkInsertNodes(collectionName, documents) {
    if (!this.connected) return 0;
    try {
      const col = this.db.collection(collectionName);
      // Use overwriteMode 'ignore' to skip duplicates
      const result = await col.import(documents, { overwriteMode: 'ignore', onDuplicate: 'ignore' });
      return result.created || 0;
    } catch (err) {
      console.error(`  ⚠️ [BRON] Bulk insert error (${collectionName}): ${err.message}`);
      return 0;
    }
  }

  /**
   * Bulk insert edges
   * @param {string} edgeCollection
   * @param {Array} edges - Array of { _from, _to, ... }
   * @returns {number} Number of inserted edges
   */
  async bulkInsertEdges(edgeCollection, edges) {
    if (!this.connected) return 0;
    try {
      const col = this.db.collection(edgeCollection);
      const result = await col.import(edges, { overwriteMode: 'ignore', onDuplicate: 'ignore' });
      return result.created || 0;
    } catch (err) {
      console.error(`  ⚠️ [BRON] Edge insert error (${edgeCollection}): ${err.message}`);
      return 0;
    }
  }

  /**
   * Clear all BRON data (for fresh re-import)
   */
  async clearAll() {
    if (!this.connected) return;
    for (const col of [...EDGE_COLLECTIONS, ...NODE_COLLECTIONS]) {
      try {
        await this.db.collection(col).truncate();
      } catch { /* ignore */ }
    }
    console.log('  🗑️ [BRON] All collections cleared');
  }

  // ═══════════════════════════════════════════════════════════
  // DETAILED CVE LOOKUP
  // ═══════════════════════════════════════════════════════════

  /**
   * Get comprehensive CVE details with full attack chain, exploit info, and defenses
   * @param {string} cveId - e.g., "CVE-2021-44228"
   * @returns {Object|null} Full CVE details
   */
  async getDetailedCVE(cveId) {
    if (!this.connected) await this.init();
    if (!this.connected) return null;

    try {
      const cursor = await this.db.query(aql`
        LET cve_node = FIRST(
          FOR doc IN cve
            FILTER doc.original_id == ${cveId} OR doc.name == ${cveId}
            RETURN doc
        )
        
        FILTER cve_node != null
        
        // CVE → CWE (reverse edge lookup)
        LET cwes = (
          FOR v, e IN 1..1 INBOUND cve_node cwe_cve
            RETURN { id: v.original_id, name: v.name, description: v.description || v.name }
        )
        
        // CVE → CPE (outbound)
        LET cpes = (
          FOR v, e IN 1..1 OUTBOUND cve_node cve_cpe
            RETURN { id: v.original_id, name: v.name, vendor: v.vendor, product: v.product, version: v.version }
        )
        
        // CWE → CAPEC (reverse) — includes full descriptions for exploit info
        LET capecs = (
          FOR cwe_node IN cwe
            FILTER cwe_node.original_id IN cwes[*].id
            FOR v, e IN 1..1 INBOUND cwe_node capec_cwe
              RETURN DISTINCT {
                id: v.original_id,
                name: v.name,
                description: v.description,
                severity: v.severity,
                likelihood: v.likelihood
              }
        )
        
        // CAPEC → Technique (reverse) — includes full descriptions
        LET techniques = (
          FOR capec_node IN capec
            FILTER capec_node.original_id IN capecs[*].id
            FOR v, e IN 1..1 INBOUND capec_node technique_capec
              RETURN DISTINCT {
                id: v.original_id,
                name: v.name,
                description: v.description,
                platforms: v.platforms
              }
        )
        
        // Technique → Tactic (reverse)
        LET tactics = (
          FOR tech_node IN technique
            FILTER tech_node.original_id IN techniques[*].id
            FOR v, e IN 1..1 INBOUND tech_node tactic_technique
              RETURN DISTINCT { id: v.original_id, name: v.name, description: v.description }
        )
        
        // Technique → D3FEND defenses
        LET defenses = (
          FOR tech_node IN technique
            FILTER tech_node.original_id IN techniques[*].id
            FOR v, e IN 1..1 OUTBOUND tech_node technique_d3fend
              RETURN DISTINCT {
                id: v.original_id,
                name: v.name,
                description: v.description,
                category: v.category
              }
        )
        
        RETURN {
          cve: {
            id: cve_node.original_id,
            name: cve_node.name,
            description: cve_node.description,
            severity: cve_node.severity,
            cvss: cve_node.cvss_score,
            published: cve_node.published
          },
          cwes: cwes,
          cpes: cpes,
          capecs: capecs,
          techniques: techniques,
          tactics: tactics,
          defenses: defenses
        }
      `);

      const results = await cursor.all();
      return results[0] || null;
    } catch (err) {
      console.error(`  ⚠️ [BRON] Detailed CVE lookup error for ${cveId}: ${err.message}`);
      return null;
    }
  }

  // ═══════════════════════════════════════════════════════════
  // EXPLOIT / ATTACK NAME SEARCH
  // ═══════════════════════════════════════════════════════════

  /**
   * Search by exploit/attack name (e.g., "DDoS", "SQL injection", "firebase exploit")
   * Searches across CAPEC, Technique, CWE names/descriptions → traverses to find CVEs
   * @param {string} query - Attack/exploit name
   * @returns {Object} { capecs, techniques, cves, cwes }
   */
  async searchByExploitName(query) {
    if (!this.connected) await this.init();
    if (!this.connected) return { capecs: [], techniques: [], cves: [], cwes: [] };

    try {
      // Step 1: Find matching CAPEC attack patterns
      const capecCursor = await this.db.query(aql`
        FOR doc IN capec
          FILTER CONTAINS(LOWER(doc.name), LOWER(${query}))
              OR CONTAINS(LOWER(doc.description || ''), LOWER(${query}))
          LIMIT 15
          RETURN {
            id: doc.original_id,
            name: doc.name,
            description: doc.description,
            severity: doc.severity,
            likelihood: doc.likelihood
          }
      `);
      const matchedCapecs = await capecCursor.all();

      // Step 2: Find matching ATT&CK techniques
      const techCursor = await this.db.query(aql`
        FOR doc IN technique
          FILTER CONTAINS(LOWER(doc.name), LOWER(${query}))
              OR CONTAINS(LOWER(doc.description || ''), LOWER(${query}))
          LIMIT 15
          RETURN {
            id: doc.original_id,
            name: doc.name,
            description: doc.description,
            platforms: doc.platforms
          }
      `);
      const matchedTechniques = await techCursor.all();

      // Step 3: Find matching CWE weaknesses
      const cweCursor = await this.db.query(aql`
        FOR doc IN cwe
          FILTER CONTAINS(LOWER(doc.name), LOWER(${query}))
              OR CONTAINS(LOWER(doc.description || ''), LOWER(${query}))
          LIMIT 15
          RETURN {
            id: doc.original_id,
            name: doc.name,
            description: doc.description
          }
      `);
      const matchedCWEs = await cweCursor.all();

      // Step 4: Find matching CVEs directly by description
      const directCveCursor = await this.db.query(aql`
        FOR doc IN cve
          FILTER CONTAINS(LOWER(doc.description || ''), LOWER(${query}))
              OR CONTAINS(LOWER(doc.name || ''), LOWER(${query}))
          LIMIT 20
          RETURN {
            cve_id: doc.original_id,
            name: doc.name,
            description: doc.description,
            severity: doc.severity,
            cvss: doc.cvss_score,
            published: doc.published,
            source: "direct_match"
          }
      `);
      const directCVEs = await directCveCursor.all();

      // Step 5: Traverse from matched CWEs → CVEs
      const cweIds = matchedCWEs.map(c => c.id);
      let cweCVEs = [];
      if (cweIds.length > 0) {
        const cweCveCursor = await this.db.query(aql`
          FOR cwe_node IN cwe
            FILTER cwe_node.original_id IN ${cweIds}
            FOR cve_node, e IN 1..1 OUTBOUND cwe_node cwe_cve
              RETURN DISTINCT {
                cve_id: cve_node.original_id,
                name: cve_node.name,
                description: cve_node.description,
                severity: cve_node.severity,
                cvss: cve_node.cvss_score,
                published: cve_node.published,
                source: "cwe_linked",
                linked_cwe: cwe_node.original_id
              }
        `);
        cweCVEs = await cweCveCursor.all();
      }

      // Step 6: Traverse from matched CAPECs → CWEs → CVEs
      const capecIds = matchedCapecs.map(c => c.id);
      let capecCVEs = [];
      if (capecIds.length > 0) {
        const capecCveCursor = await this.db.query(aql`
          FOR capec_node IN capec
            FILTER capec_node.original_id IN ${capecIds}
            FOR cwe_node IN 1..1 OUTBOUND capec_node capec_cwe
              FOR cve_node IN 1..1 OUTBOUND cwe_node cwe_cve
                LIMIT 30
                RETURN DISTINCT {
                  cve_id: cve_node.original_id,
                  name: cve_node.name,
                  description: cve_node.description,
                  severity: cve_node.severity,
                  cvss: cve_node.cvss_score,
                  published: cve_node.published,
                  source: "capec_linked",
                  linked_capec: capec_node.original_id,
                  linked_cwe: cwe_node.original_id
                }
        `);
        capecCVEs = await capecCveCursor.all();
      }

      // Step 7: Traverse from matched Techniques → CAPECs → CWEs → CVEs
      const techIds = matchedTechniques.map(t => t.id);
      let techCVEs = [];
      if (techIds.length > 0) {
        const techCveCursor = await this.db.query(aql`
          FOR tech_node IN technique
            FILTER tech_node.original_id IN ${techIds}
            FOR capec_node IN 1..1 OUTBOUND tech_node technique_capec
              FOR cwe_node IN 1..1 OUTBOUND capec_node capec_cwe
                FOR cve_node IN 1..1 OUTBOUND cwe_node cwe_cve
                  LIMIT 30
                  RETURN DISTINCT {
                    cve_id: cve_node.original_id,
                    name: cve_node.name,
                    description: cve_node.description,
                    severity: cve_node.severity,
                    cvss: cve_node.cvss_score,
                    published: cve_node.published,
                    source: "technique_linked",
                    linked_technique: tech_node.original_id,
                    linked_capec: capec_node.original_id,
                    linked_cwe: cwe_node.original_id
                  }
        `);
        techCVEs = await techCveCursor.all();
      }

      // Step 8: Search CPE products for matching vendor/product names
      let productCVEs = [];
      const cpeCursor = await this.db.query(aql`
        FOR cpe_node IN cpe
          FILTER CONTAINS(LOWER(cpe_node.product || ''), LOWER(${query}))
              OR CONTAINS(LOWER(cpe_node.vendor || ''), LOWER(${query}))
              OR CONTAINS(LOWER(cpe_node.name || ''), LOWER(${query}))
          LIMIT 10
          FOR cve_node, e IN 1..1 INBOUND cpe_node cve_cpe
            LIMIT 20
            RETURN DISTINCT {
              cve_id: cve_node.original_id,
              name: cve_node.name,
              description: cve_node.description,
              severity: cve_node.severity,
              cvss: cve_node.cvss_score,
              published: cve_node.published,
              source: "product_linked",
              linked_product: cpe_node.product,
              linked_vendor: cpe_node.vendor
            }
      `);
      productCVEs = await cpeCursor.all();

      // Deduplicate CVEs by ID
      const allCVEs = [...directCVEs, ...cweCVEs, ...capecCVEs, ...techCVEs, ...productCVEs];
      const seenIds = new Set();
      const uniqueCVEs = [];
      for (const cve of allCVEs) {
        if (!seenIds.has(cve.cve_id)) {
          seenIds.add(cve.cve_id);
          uniqueCVEs.push(cve);
        }
      }

      // Sort by CVSS score descending (most critical first)
      uniqueCVEs.sort((a, b) => (b.cvss || 0) - (a.cvss || 0));

      return {
        query,
        capecs: matchedCapecs,
        techniques: matchedTechniques,
        cwes: matchedCWEs,
        cves: uniqueCVEs.slice(0, 50),
        totalCVEs: uniqueCVEs.length,
      };
    } catch (err) {
      console.error(`  ⚠️ [BRON] Exploit name search error: ${err.message}`);
      return { query, capecs: [], techniques: [], cves: [], cwes: [], totalCVEs: 0 };
    }
  }

  // ═══════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════

  _detectNodeType(nodeId) {
    if (!nodeId) return null;
    const id = nodeId.toUpperCase();
    if (/^TA\d+/.test(id)) return 'tactic';
    if (/^T\d+/.test(id)) return 'technique';
    if (/^CAPEC-\d+/.test(id)) return 'capec';
    if (/^CWE-\d+/.test(id)) return 'cwe';
    if (/^CVE-\d+-\d+/.test(id)) return 'cve';
    if (/^CPE:/.test(id) || /^CPE/.test(id)) return 'cpe';
    if (/^D3-/.test(id) || /^D3FEND/.test(id)) return 'd3fend';
    if (/^EAC\d+/.test(id) || /^SAC\d+/.test(id)) return 'engage';
    return null;
  }

  /**
   * Build a context summary for the AI system prompt
   * @returns {string} BRON graph summary for injection into the prompt
   */
  async getPromptContext() {
    if (!this.connected) return '';

    const stats = await this.getStats();
    if (stats.totalNodes === 0) return '';

    return `

## 🔗 BRON KNOWLEDGE GRAPH (Live — ArangoDB)

You have access to the **BRON cybersecurity knowledge graph** — a linked dataset connecting:
- **ATT&CK Tactics** (${stats.nodes.tactic || 0}) ↔ **Techniques** (${stats.nodes.technique || 0})
- **CAPEC Attack Patterns** (${stats.nodes.capec || 0})
- **CWE Weaknesses** (${stats.nodes.cwe || 0})
- **CVE Vulnerabilities** (${stats.nodes.cve || 0})
- **CPE Products** (${stats.nodes.cpe || 0})
- **D3FEND Defenses** (${stats.nodes.d3fend || 0})
- **MITRE Engage** (${stats.nodes.engage || 0})
- **Total**: ${stats.totalNodes} nodes, ${stats.totalEdges} edges

### How to use BRON:
- \`bron_lookup(node_id="CVE-2021-44228")\` — Get node details + neighbors
- \`bron_attack_chain(cve_id="CVE-2021-44228")\` — Full attack chain: CVE→CWE→CAPEC→ATT&CK→D3FEND
- \`bron_find_defenses(technique_id="T1190")\` — Get D3FEND defenses for an ATT&CK technique
- \`bron_product_risks(product="apache httpd")\` — Find all CVEs + attack chains for a product

**USE BRON to enrich your findings** — when you discover a CVE, look it up to get the full attack chain and recommend defenses.
`;
  }

  /**
   * Active decision-making advisory — called by agent.js after a recon tool completes.
   * Returns an array of human-readable threat hint strings based on tool type and result.
   * @param {string} toolName  - e.g. 'port_scanner', 'cve_lookup'
   * @param {string} keywords  - target/query extracted from tool args
   * @param {object} result    - the tool's result object
   * @returns {Promise<string[]>} Array of advisory hint strings (empty if no hints)
   */
  async queryForTool(toolName, keywords, result) {
    if (!this.connected) return [];
    const hints = [];

    try {
      // ── CVE lookup: walk CVE→CWE→CAPEC→Technique chain ──
      if (toolName === 'cve_lookup' && result.cve_id) {
        const cveId = result.cve_id.toUpperCase();
        const cursor = await this.db.query(aql`
          FOR cve IN cve FILTER cve.original_id == ${cveId} LIMIT 1
            FOR cwe, e1 IN 1..1 INBOUND cve cwe_cve
              FOR capec, e2 IN 1..1 INBOUND cwe capec_cwe
                FOR tech, e3 IN 1..1 INBOUND capec technique_capec
                  FOR tac, e4 IN 1..1 INBOUND tech tactic_technique
                    RETURN { technique: tech.original_id, techniqueName: tech.name, tactic: tac.name, cwe: cwe.original_id, cweName: cwe.name }
        `);
        const rows = await cursor.all();
        for (const r of rows.slice(0, 5)) {
          hints.push(`${r.tactic} → ${r.technique} (${r.techniqueName}) — rooted in ${r.cwe} (${r.cweName})`);
        }
        // Defenses
        if (rows.length > 0) {
          const techId = rows[0].technique;
          const defCursor = await this.db.query(aql`
            FOR tech IN technique FILTER tech.original_id == ${techId} LIMIT 1
              FOR d IN 1..1 OUTBOUND tech technique_d3fend
                RETURN d.name
          `);
          const defs = await defCursor.all();
          if (defs.length > 0) hints.push(`D3FEND mitigations for ${techId}: ${defs.slice(0, 3).join(', ')}`);
        }
      }

      // ── Port scanner: suggest techniques for common open ports ──
      if (toolName === 'port_scanner' && result.ports) {
        const openPorts = (result.ports || []).filter(p => p.state === 'open').map(p => p.port);
        const portTechMap = {
          22: 'T1021.004', 23: 'T1021.004', 80: 'T1190', 443: 'T1190',
          21: 'T1021.001', 3389: 'T1021.001', 445: 'T1021.002',
          3306: 'T1078', 5432: 'T1078', 6379: 'T1078',
          27017: 'T1078', 8080: 'T1190', 8443: 'T1190',
        };
        const relevantTechs = [...new Set(openPorts.map(p => portTechMap[p]).filter(Boolean))];
        if (relevantTechs.length > 0) {
          const cursor = await this.db.query(aql`
            FOR t IN technique FILTER t.original_id IN ${relevantTechs}
              FOR tac IN 1..1 INBOUND t tactic_technique
                RETURN { id: t.original_id, name: t.name, tactic: tac.name }
          `);
          const rows = await cursor.all();
          for (const r of rows) hints.push(`Open port → ${r.tactic}: ${r.id} ${r.name}`);
        }
      }

      // ── Shodan/FOFA/WAF: technique hints for discovered services ──
      if (['shodan_search', 'fofa_search', 'waf_detector'].includes(toolName)) {
        const techIds = ['T1190', 'T1595', 'T1592'];
        const cursor = await this.db.query(aql`
          FOR t IN technique FILTER t.original_id IN ${techIds}
            FOR tac IN 1..1 INBOUND t tactic_technique
              RETURN { id: t.original_id, name: t.name, tactic: tac.name }
        `);
        const rows = await cursor.all();
        for (const r of rows) hints.push(`${r.tactic}: ${r.id} ${r.name} — relevant to internet-exposed asset discovery`);
      }

      // ── DNS/Subdomain: recon technique hints ──
      if (['dns_recon', 'subdomain_enum', 'whois_lookup'].includes(toolName)) {
        const techIds = ['T1596', 'T1590', 'T1591'];
        const cursor = await this.db.query(aql`
          FOR t IN technique FILTER t.original_id IN ${techIds}
            FOR tac IN 1..1 INBOUND t tactic_technique
              RETURN { id: t.original_id, name: t.name, tactic: tac.name }
        `);
        const rows = await cursor.all();
        for (const r of rows) hints.push(`${r.tactic}: ${r.id} ${r.name}`);
      }

    } catch (err) {
      if (this.db && this.connected) {
        // Only warn verbosely, BRON advisory errors are non-fatal
      }
    }

    return hints;
  }

  /**
   * Check if BRON has data loaded
   * @returns {Promise<boolean>}
   */
  async hasData() {
    if (!this.connected) return false;
    try {
      const stats = await this.getStats();
      return stats.totalNodes > 100; // Minimum viable data
    } catch { return false; }
  }
}

export const bronGraph = new BronGraph();
