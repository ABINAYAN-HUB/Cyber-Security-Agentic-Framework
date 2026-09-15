// Jarvis Cyber v4.0 — Web UI Server
// Express.js + Socket.io backend serving the web dashboard
// Bridges browser clients to the Agent, Memory, Tool Bridge, and Report Engine
import express from 'express';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { randomUUID } from 'crypto';

import { Agent } from './agent.js';
import config from './config.js';
import { memory } from './memory.js';
import { toolBridge } from './tool-bridge.js';
import { reportEngine } from './report-engine.js';
import { dynamicSkills } from './dynamic-skills.js';
import { toolDefinitions } from './tools/index.js';
import { detectInstalledTools, getAllTools, getCategories } from './kali-tools-registry.js';
import { checkServer, getActiveModel, getActiveProviderName, VERIFIED_NVIDIA_MODELS } from './api.js';
import { MITRE_ATTACK, CYBER_KILL_CHAIN } from './frameworks.js';
import { autoLearner } from './auto-learner.js';
import { toolInstaller } from './tool-installer.js';
import { bronGraph } from './bron-graph.js';
import { bootstrapBRON } from './bron-bootstrap.js';
import { exec as _exec } from 'child_process';
import { promisify } from 'util';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const execAsync = promisify(_exec);

// ═══════════════════════════════════════════════════════════
// BRON AUTO-START — Ensures ArangoDB + Data are ready
// ═══════════════════════════════════════════════════════════

async function _autostartBRON() {
  console.log('\n  🔗 [BRON] Initializing knowledge graph...');

  // Step 1: Check if ArangoDB is already reachable
  let connected = await bronGraph.init();

  if (!connected) {
    // Step 2: Try to start ArangoDB via Docker
    console.log('  📦 [BRON] ArangoDB not running — starting Docker container...');
    try {
      // Check if container already exists (stopped)
      const { stdout: existing } = await execAsync('docker ps -a --filter name=jarvis-brondb --format "{{.Status}}" 2>&1').catch(() => ({ stdout: '' }));

      if (existing.trim()) {
        // Container exists — just start it
        await execAsync('docker start jarvis-brondb 2>&1');
      } else {
        // Create new container with docker run
        const password = config.bronDbPassword || 'jarvis_bron_2024';
        const port = config.bronDbUrl?.match(/:(\d+)/)?.[1] || '8529';
        await execAsync(
          `docker run -d --name jarvis-brondb --restart unless-stopped ` +
          `-e ARANGO_ROOT_PASSWORD=${password} ` +
          `-p ${port}:8529 ` +
          `--memory=512m ` +
          `arangodb:3.12 2>&1`
        );
      }
      console.log('  ⏳ [BRON] Waiting for ArangoDB to become healthy...');

      // Wait for ArangoDB to become ready (up to 30s)
      for (let i = 0; i < 15; i++) {
        await new Promise(r => setTimeout(r, 2000));
        connected = await bronGraph.init().catch(() => false);
        if (connected) break;
      }

      if (connected) {
        console.log('  ✅ [BRON] ArangoDB is running');
      } else {
        console.error('  ⚠️ [BRON] ArangoDB failed to start. BRON features will be unavailable.');
        console.error('  💡 Fix: Install Docker and run: docker-compose -f docker-compose.bron.yml up -d');
        return;
      }
    } catch (err) {
      console.error(`  ⚠️ [BRON] Docker start failed: ${err.message}`);
      console.error('  💡 Fix: Install Docker and run: docker-compose -f docker-compose.bron.yml up -d');
      return;
    }
  } else {
    console.log('  ✅ [BRON] ArangoDB connected');
  }

  // Step 3: Check if data is loaded, bootstrap if empty
  const hasData = await bronGraph.hasData();
  if (!hasData) {
    console.log('  📥 [BRON] No data found — running initial bootstrap (this takes ~1-2 min)...');
    try {
      await bootstrapBRON();
    } catch (err) {
      console.error(`  ⚠️ [BRON] Bootstrap error: ${err.message}`);
    }
  } else {
    const stats = await bronGraph.getStats();
    console.log(`  ✅ [BRON] Graph loaded: ${stats.totalNodes} nodes, ${stats.totalEdges} edges`);
  }
}

/**
 * Start the web UI server
 * @param {Object} options - { port: number }
 */
export async function startWebServer(options = {}) {
  const { port = 3000 } = options;

  // Initialize memory
  try {
    memory.init();
  } catch (err) {
    console.error(`[Web] Memory init warning: ${err.message}`);
  }

  // ═══ AUTO-START BRON (ArangoDB + Bootstrap) ═══
  if (config.bronEnabled) {
    await _autostartBRON();
  }

  // Create the shared agent instance
  const agent = new Agent(process.cwd());

  // Express + HTTP + Socket.io
  const app = express();
  const httpServer = createServer(app);
  const io = new SocketServer(httpServer, {
    cors: { origin: '*' },
    maxHttpBufferSize: 5e6, // 5MB
  });

  app.use(express.json());

  // ═══ STATIC FILES ═══
  const publicDir = join(__dirname, '..', 'public');
  app.use(express.static(publicDir));

  // ═══════════════════════════════════════════
  // REST API ROUTES
  // ═══════════════════════════════════════════

  // Health check
  app.get('/api/health', async (req, res) => {
    const serverCheck = await checkServer();
    const services = toolBridge.scan();
    res.json({
      status: 'ok',
      version: '4.0.0',
      model: config.model,
      apiConnected: serverCheck.ok,
      availableModels: serverCheck.models || [],
      activeServices: Object.fromEntries(
        [...services].map(([k, v]) => [k, { displayName: v.displayName, host: v.host, port: v.port, type: v.type }])
      ),
      proxy: toolBridge.getActiveProxy(),
      uptime: process.uptime(),
    });
  });

  // Database stats
  app.get('/api/stats', (req, res) => {
    try {
      res.json(memory.getStats());
    } catch (err) {
      res.json({ error: err.message });
    }
  });

  // Tool definitions (API tools)
  app.get('/api/tools', (req, res) => {
    res.json(toolDefinitions.map(t => ({
      name: t.function.name,
      description: t.function.description,
      parameters: t.function.parameters,
    })));
  });

  // Kali tools registry
  app.get('/api/kali-tools', (req, res) => {
    const allTools = getAllTools();
    const installed = detectInstalledTools();
    const categories = getCategories();
    res.json({
      total: allTools.length,
      installed: installed.size,
      categories: categories,
      tools: allTools.map(t => ({
        name: t.name,
        bin: t.bin,
        description: t.desc,
        category: t.cat,
        mitre: t.mitre || [],
        usage: t.usage || [],
        installed: installed.has(t.name),
      })),
    });
  });

  // MITRE ATT&CK + Cyber Kill Chain frameworks
  app.get('/api/frameworks', (req, res) => {
    res.json({
      mitre: MITRE_ATTACK,
      killChain: CYBER_KILL_CHAIN,
    });
  });

  // Threat intel
  app.get('/api/threat-intel', (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 30;
      const cves = memory.getLatestCVEs(limit);
      const totalIntel = memory.getThreatIntelCount();
      const totalExploits = memory.getExploitCount();
      const totalToolKnowledge = memory.getToolKnowledgeCount();
      res.json({ cves, totalIntel, totalExploits, totalToolKnowledge });
    } catch (err) {
      res.json({ cves: [], totalIntel: 0, totalExploits: 0, totalToolKnowledge: 0, error: err.message });
    }
  });

  // Search threat intel
  app.get('/api/threat-intel/search', (req, res) => {
    try {
      const { q, type } = req.query;
      if (!q) return res.json({ results: [] });
      const results = memory.searchThreatIntel(q, type || null);
      res.json({ results });
    } catch (err) {
      res.json({ results: [], error: err.message });
    }
  });

  // Search exploits
  app.get('/api/exploits/search', (req, res) => {
    try {
      const { q } = req.query;
      if (!q) return res.json({ results: [] });
      const results = memory.searchExploits(q);
      res.json({ results });
    } catch (err) {
      res.json({ results: [], error: err.message });
    }
  });

  // Scan results
  app.get('/api/scan-results', (req, res) => {
    try {
      const { target, type } = req.query;
      const results = memory.getScanResults(target || null, type || null);
      res.json({ results });
    } catch (err) {
      res.json({ results: [], error: err.message });
    }
  });

  // Operations log
  app.get('/api/operations', (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 50;
      const results = memory.getOperations(limit);
      res.json({ results });
    } catch (err) {
      res.json({ results: [], error: err.message });
    }
  });

  // Knowledge search
  app.get('/api/knowledge', (req, res) => {
    try {
      const { q, category } = req.query;
      if (!q) return res.json({ results: [] });
      const results = memory.searchKnowledge(q, category || null);
      res.json({ results });
    } catch (err) {
      res.json({ results: [], error: err.message });
    }
  });

  // Targets
  app.get('/api/targets', (req, res) => {
    try {
      const { id } = req.query;
      if (id) {
        const results = memory.getTarget(id);
        res.json({ results });
      } else {
        const results = memory.db.prepare('SELECT * FROM targets ORDER BY created_at DESC').all();
        res.json({
          results: results.map(r => {
            try { r.data = JSON.parse(r.data); } catch { }
            return r;
          })
        });
      }
    } catch (err) {
      res.json({ results: [], error: err.message });
    }
  });

  // Loot
  app.get('/api/loot', (req, res) => {
    try {
      const { target } = req.query;
      const results = memory.getLoot(target || null).map(r => {
        try { r.data = JSON.parse(r.data); } catch { }
        return r;
      });
      res.json({ results });
    } catch (err) {
      res.json({ results: [], error: err.message });
    }
  });

  // Session usage stats
  app.get('/api/usage-stats', (req, res) => {
    res.json(toolBridge.getUsageStats());
  });

  // Execution log
  app.get('/api/execution-log', (req, res) => {
    res.json(toolBridge.getExecutionLog());
  });

  // Active services
  app.get('/api/services', (req, res) => {
    const services = toolBridge.scan();
    const result = {};
    for (const [name, service] of services) {
      result[name] = {
        displayName: service.displayName,
        host: service.host,
        port: service.port,
        type: service.type,
        status: service.status,
        detectedAt: service.detectedAt,
      };
    }
    res.json({
      services: result,
      proxy: toolBridge.getActiveProxy(),
      curlFlag: toolBridge.getCurlProxyFlag(),
    });
  });

  // ═══════════════════════════════════════════
  // NVD API HELPERS (Live fallback when BRON has no data)
  // ═══════════════════════════════════════════

  /**
   * Search NVD API by keyword — returns CVEs matching the search term
   * Used as fallback when BRON graph + local DB have no results
   */
  async function _searchNVDByKeyword(keyword) {
    try {
      const url = `https://services.nvd.nist.gov/rest/json/cves/2.0?keywordSearch=${encodeURIComponent(keyword)}&resultsPerPage=25`;
      const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!response.ok) return [];
      const data = await response.json();
      if (!data?.vulnerabilities) return [];

      return data.vulnerabilities.map(item => {
        const cve = item.cve;
        if (!cve?.id) return null;

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

        // Extract CWE IDs
        const cweIds = [];
        for (const w of cve.weaknesses || []) {
          for (const d of w.description || []) {
            if (d.value?.startsWith('CWE-')) cweIds.push(d.value);
          }
        }

        // Extract affected products
        const products = [];
        for (const cfg of cve.configurations || []) {
          for (const node of cfg.nodes || []) {
            for (const match of node.cpeMatch || []) {
              if (match.criteria) {
                const parts = match.criteria.split(':');
                if (parts.length >= 5) {
                  products.push({
                    vendor: parts[3] || '',
                    product: parts[4] || '',
                    version: parts[5] || '*',
                  });
                }
              }
            }
          }
        }

        return {
          cve_id: cve.id,
          name: cve.id,
          description: desc,
          severity,
          cvss: cvssScore,
          published: cve.published,
          source: 'nvd_live',
          cwes: cweIds,
          products: products.slice(0, 10),
        };
      }).filter(Boolean);
    } catch (err) {
      console.error(`  ⚠️ [NVD] Live keyword search failed: ${err.message}`);
      return [];
    }
  }

  /**
   * Fetch a single CVE by ID from NVD API
   * Used as fallback when BRON + local DB don't have the CVE
   */
  async function _fetchCVEFromNVD(cveId) {
    try {
      const url = `https://services.nvd.nist.gov/rest/json/cves/2.0?cveId=${encodeURIComponent(cveId)}`;
      const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!response.ok) return null;
      const data = await response.json();
      if (!data?.vulnerabilities?.[0]) return null;

      const cve = data.vulnerabilities[0].cve;
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

      // Extract CWEs
      const cwes = [];
      for (const w of cve.weaknesses || []) {
        for (const d of w.description || []) {
          if (d.value?.startsWith('CWE-')) {
            cwes.push({ id: d.value, name: d.value, description: '' });
          }
        }
      }

      // Extract affected products
      const cpes = [];
      for (const cfg of cve.configurations || []) {
        for (const node of cfg.nodes || []) {
          for (const match of node.cpeMatch || []) {
            if (match.criteria) {
              const parts = match.criteria.split(':');
              if (parts.length >= 5) {
                cpes.push({
                  id: match.criteria,
                  name: match.criteria,
                  vendor: parts[3] || '',
                  product: parts[4] || '',
                  version: parts[5] || '*',
                });
              }
            }
          }
        }
      }

      return {
        cve: {
          id: cve.id,
          name: cve.id,
          description: desc,
          severity,
          cvss: cvssScore,
          published: cve.published,
        },
        cwes,
        cpes: cpes.slice(0, 20),
        capecs: [],
        techniques: [],
        tactics: [],
        defenses: [],
        source: 'nvd_live',
      };
    } catch (err) {
      console.error(`  ⚠️ [NVD] Live CVE fetch failed for ${cveId}: ${err.message}`);
      return null;
    }
  }

  // ═══════════════════════════════════════════
  // SUPPLY CHAIN ATTACK API
  // ═══════════════════════════════════════════

  app.post('/api/supply-chain/scan', async (req, res) => {
    try {
      const { execute } = await import('./tools/supply-chain-scanner.js');
      const result = await execute(req.body);
      res.json(result);
    } catch (err) {
      res.json({ success: false, error: err.message });
    }
  });

  app.post('/api/supply-chain/lookup', async (req, res) => {
    try {
      const { executeLookup } = await import('./tools/supply-chain-scanner.js');
      const result = await executeLookup(req.body);
      res.json(result);
    } catch (err) {
      res.json({ success: false, error: err.message });
    }
  });

  app.post('/api/supply-chain/attack', async (req, res) => {
    try {
      const { executeAttack } = await import('./tools/supply-chain-scanner.js');
      const result = await executeAttack(req.body);
      res.json(result);
    } catch (err) {
      res.json({ success: false, error: err.message });
    }
  });

  // ═══════════════════════════════════════════
  // BRON KNOWLEDGE GRAPH API
  // ═══════════════════════════════════════════

  // BRON graph stats
  app.get('/api/bron/stats', async (req, res) => {
    try {
      if (!bronGraph.connected) {
        await bronGraph.init();
      }
      const stats = await bronGraph.getStats();
      res.json(stats);
    } catch (err) {
      res.json({ connected: false, error: err.message });
    }
  });

  // BRON node lookup
  app.get('/api/bron/node/:id', async (req, res) => {
    try {
      if (!bronGraph.connected) await bronGraph.init();
      const node = await bronGraph.getNode(req.params.id);
      res.json(node || { error: 'Node not found' });
    } catch (err) {
      res.json({ error: err.message });
    }
  });

  // BRON attack chain (CVE traversal)
  app.get('/api/bron/chain/:cveId', async (req, res) => {
    try {
      if (!bronGraph.connected) await bronGraph.init();
      const chain = await bronGraph.traverseFromCVE(req.params.cveId);
      res.json(chain || { error: 'CVE not found' });
    } catch (err) {
      res.json({ error: err.message });
    }
  });

  // BRON defenses for ATT&CK technique
  app.get('/api/bron/defenses/:techniqueId', async (req, res) => {
    try {
      if (!bronGraph.connected) await bronGraph.init();
      const defenses = await bronGraph.getDefensesForTechnique(req.params.techniqueId);
      res.json({ technique: req.params.techniqueId, defenses });
    } catch (err) {
      res.json({ error: err.message });
    }
  });

  // BRON product risks
  app.get('/api/bron/product-risks', async (req, res) => {
    try {
      if (!bronGraph.connected) await bronGraph.init();
      const { q } = req.query;
      if (!q) return res.json({ error: 'Missing query parameter ?q=' });
      const paths = await bronGraph.findAttackPaths(q);
      res.json({ product: q, attack_paths: paths });
    } catch (err) {
      res.json({ error: err.message });
    }
  });

  // BRON search
  app.get('/api/bron/search', async (req, res) => {
    try {
      if (!bronGraph.connected) await bronGraph.init();
      const { q, type } = req.query;
      if (!q) return res.json({ results: [] });
      const results = await bronGraph.search(q, type || null);
      res.json({ query: q, results });
    } catch (err) {
      res.json({ results: [], error: err.message });
    }
  });

  // BRON detailed CVE lookup — full description, attack chain, defenses, exploit info
  app.get('/api/bron/cve/:cveId', async (req, res) => {
    try {
      if (!bronGraph.connected) await bronGraph.init();
      const detail = await bronGraph.getDetailedCVE(req.params.cveId);
      if (!detail) {
        // Fallback 1: try to find CVE in local threat_intel DB
        try {
          const localCVE = memory.searchThreatIntel(req.params.cveId, 'cve');
          if (localCVE && localCVE.length > 0) {
            const c = localCVE[0];
            return res.json({
              cve: {
                id: c.identifier,
                name: c.title || c.identifier,
                description: c.description || 'No description available.',
                severity: c.severity || 'UNKNOWN',
                cvss: c.cvss_score || null,
                published: c.published_at || null,
              },
              cwes: [],
              cpes: [],
              capecs: [],
              techniques: [],
              tactics: [],
              defenses: [],
              source: 'local_db',
            });
          }
        } catch { /* ignore local DB errors */ }

        // Fallback 2: fetch directly from NVD API
        try {
          const nvdResult = await _fetchCVEFromNVD(req.params.cveId);
          if (nvdResult) return res.json(nvdResult);
        } catch { /* ignore NVD errors */ }

        return res.json({ error: 'CVE not found in BRON graph, local database, or NVD' });
      }
      res.json(detail);
    } catch (err) {
      res.json({ error: err.message });
    }
  });

  // BRON exploit/attack name search — search by "DDoS", "SQL injection", "firebase", etc.
  app.get('/api/bron/exploit-search', async (req, res) => {
    try {
      if (!bronGraph.connected) await bronGraph.init();
      const { q } = req.query;
      if (!q) return res.json({ error: 'Missing query parameter ?q=' });

      // Search BRON graph by exploit/attack name
      const bronResults = await bronGraph.searchByExploitName(q);

      // Also search local exploit DB for matching exploits
      let localExploits = [];
      try {
        localExploits = memory.searchExploits(q).slice(0, 20);
      } catch { /* ignore */ }

      // Also search local threat intel for matching CVEs
      let localCVEs = [];
      try {
        localCVEs = memory.searchThreatIntel(q, null).slice(0, 20).map(c => ({
          cve_id: c.identifier,
          name: c.title || c.identifier,
          description: c.description,
          severity: c.severity,
          cvss: c.cvss_score,
          published: c.published_at,
          source: 'local_db',
        }));
      } catch { /* ignore */ }

      // Merge local CVEs with BRON CVEs (deduplicate)
      const seenIds = new Set(bronResults.cves.map(c => c.cve_id));
      for (const lc of localCVEs) {
        if (lc.cve_id && !seenIds.has(lc.cve_id)) {
          seenIds.add(lc.cve_id);
          bronResults.cves.push(lc);
        }
      }

      // ═══ LIVE NVD FALLBACK ═══
      // If we have few/no CVE results, query NVD API directly
      const totalLocalResults = bronResults.cves.length + bronResults.capecs.length +
        bronResults.techniques.length + bronResults.cwes.length + localExploits.length;

      let nvdCVEs = [];
      if (totalLocalResults < 5) {
        try {
          nvdCVEs = await _searchNVDByKeyword(q);
          // Add NVD results that aren't already present
          for (const nc of nvdCVEs) {
            if (!seenIds.has(nc.cve_id)) {
              seenIds.add(nc.cve_id);
              bronResults.cves.push(nc);
            }
          }
        } catch { /* NVD API may be down or rate-limited */ }
      }

      // Re-sort all CVEs by CVSS
      bronResults.cves.sort((a, b) => (b.cvss || 0) - (a.cvss || 0));
      bronResults.totalCVEs = bronResults.cves.length;

      res.json({
        ...bronResults,
        localExploits,
        nvdFetched: nvdCVEs.length > 0,
      });
    } catch (err) {
      res.json({ error: err.message, capecs: [], techniques: [], cves: [], cwes: [] });
    }
  });

  // Generate report
  app.post('/api/report', (req, res) => {
    const { target, objective, format } = req.body;
    const result = reportEngine.generateReport({ target, objective, format });
    res.json(result);
  });

  // Config (non-sensitive)
  app.get('/api/config', (req, res) => {
    res.json({
      model: config.model,
      baseUrl: config.baseUrl,
      activeProvider: config.activeProvider || 'nvidia',
      localAiBackend: config.localAiBackend || 'lmstudio',
      localAiBaseUrl: config.localAiBaseUrl || 'http://localhost:1234/v1',
      localAiModel: config.localAiModel || '',
      temperature: config.temperature,
      topP: config.topP,
      maxTokens: config.maxTokens,
      outputDir: config.outputDir,
      dataDir: config.dataDir,
      learningEnabled: config.learningEnabled,
      maxHistoryMessages: config.maxHistoryMessages,
    });
  });

  // ── Model Status: probe both NVIDIA NIM and Local AI (LM Studio, Ollama) ──
  app.get('/api/model-status', async (req, res) => {
    const [nvidiaStatus, localStatus] = await Promise.all([
      checkServer('nvidia'),
      checkServer('local'),
    ]);
    res.json({
      activeProvider: config.activeProvider || 'nvidia',
      nvidia: {
        model: config.model,
        baseUrl: config.baseUrl,
        verifiedModels: VERIFIED_NVIDIA_MODELS,
        ...nvidiaStatus,
      },
      local: {
        model: config.localAiModel,
        baseUrl: config.localAiBaseUrl,
        backend: config.localAiBackend,
        ...localStatus,
      },
    });
  });

  // ── Model Switch: update the active provider and model at runtime ──
  app.post('/api/switch-model', express.json(), (req, res) => {
    const { provider, model } = req.body || {};
    if (provider) config.activeProvider = provider;
    if (provider === 'local') {
      if (model) config.localAiModel = model;
    } else if (provider === 'nvidia') {
      if (model) config.model = model;
    }
    const currentModel = getActiveModel();
    const providerName = getActiveProviderName();
    console.log(`  🔄 [Model] Switched to ${providerName} — ${currentModel}`);
    io.emit('model-switched', { provider: config.activeProvider, model: currentModel });
    res.json({ ok: true, provider: config.activeProvider, model: currentModel });
  });

  // ── Test Provider Connection: test live connection to NVIDIA NIM or Local AI ──
  app.post('/api/test-provider', express.json(), async (req, res) => {
    const { provider, baseUrl, apiKey } = req.body || {};
    const targetProvider = provider || config.activeProvider || 'nvidia';
    const isLocal = targetProvider === 'local';
    const testBase = (baseUrl || (isLocal ? config.localAiBaseUrl : config.baseUrl)).replace(/\/+$/, '');
    const testKey = apiKey !== undefined ? apiKey : (isLocal ? config.localAiApiKey : config.apiKey);
    const startTime = Date.now();
    try {
      const headers = {};
      if (testKey && testKey !== 'none' && testKey.trim() !== '') {
        headers['Authorization'] = `Bearer ${testKey}`;
      }
      const response = await fetch(`${testBase}/models`, {
        headers,
        signal: AbortSignal.timeout(6000),
      });
      const latencyMs = Date.now() - startTime;
      if (response.ok) {
        const data = await response.json();
        const modelsList = (data.data || []).map(m => m.id || m.name || m);
        return res.json({
          ok: true,
          latencyMs,
          models: modelsList,
          provider: targetProvider,
          baseUrl: testBase,
          message: `Connected successfully in ${latencyMs}ms (${modelsList.length} model${modelsList.length === 1 ? '' : 's'} found)`,
        });
      } else {
        return res.json({
          ok: false,
          latencyMs,
          provider: targetProvider,
          error: `HTTP ${response.status} ${response.statusText}`,
          message: `Server returned HTTP ${response.status}`,
        });
      }
    } catch (err) {
      const latencyMs = Date.now() - startTime;
      const isTimeout = err.name === 'TimeoutError' || err.code === 'ETIMEDOUT';
      return res.json({
        ok: false,
        latencyMs,
        provider: targetProvider,
        error: err.message,
        message: isTimeout
          ? `Connection timed out after 6s. Check if ${isLocal ? 'LM Studio / Ollama is running and accessible' : 'NVIDIA API is reachable'}`
          : `Failed to connect to ${testBase}: ${err.message}`,
      });
    }
  });

  // Update config
  app.post('/api/config', (req, res) => {
    const {
      model, temperature, topP, maxTokens,
      activeProvider, localAiBackend, localAiBaseUrl, localAiModel, localAiApiKey,
    } = req.body;
    if (model) config.model = model;
    if (temperature !== undefined) config.temperature = parseFloat(temperature);
    if (topP !== undefined) config.topP = parseFloat(topP);
    if (maxTokens !== undefined) config.maxTokens = parseInt(maxTokens);
    if (activeProvider) config.activeProvider = activeProvider;
    if (localAiBackend) config.localAiBackend = localAiBackend;
    if (localAiBaseUrl) config.localAiBaseUrl = localAiBaseUrl;
    if (localAiModel !== undefined) config.localAiModel = localAiModel;
    if (localAiApiKey !== undefined) config.localAiApiKey = localAiApiKey;

    res.json({
      success: true,
      activeProvider: config.activeProvider,
      model: config.model,
      localAiBackend: config.localAiBackend,
      localAiBaseUrl: config.localAiBaseUrl,
      localAiModel: config.localAiModel,
      temperature: config.temperature,
      topP: config.topP,
      maxTokens: config.maxTokens,
    });
  });

  // ═══ AUTO-LEARNING TRIGGER (v4.0) ═══
  let learningInProgress = false;
  let learningResult = null;

  app.post('/api/learn', async (req, res) => {
    if (learningInProgress) {
      return res.json({ success: false, error: 'Auto-learning is already running. Please wait.' });
    }
    learningInProgress = true;
    learningResult = null;
    res.json({ success: true, message: 'Auto-learning started. This will take 30-60 seconds.' });

    try {
      await autoLearner.run();
      learningResult = { success: true, stats: autoLearner.getStats() };
    } catch (err) {
      learningResult = { success: false, error: err.message };
    } finally {
      learningInProgress = false;
    }
  });

  app.get('/api/learning-status', (req, res) => {
    res.json({
      inProgress: learningInProgress,
      result: learningResult,
      stats: autoLearner.getStats(),
    });
  });

  // ═══ TOOL INSTALLATION (v4.0) ═══

  // Install a single tool
  app.post('/api/tools/install', async (req, res) => {
    const { tool } = req.body;
    if (!tool) return res.status(400).json({ success: false, error: 'Tool name required' });
    try {
      const result = toolInstaller.installTool(tool);
      res.json(result);
    } catch (err) {
      res.json({ success: false, error: err.message });
    }
  });

  // Install all missing Kali tools (NON-BLOCKING — runs in background)
  let installInProgress = false;
  let installResult = null;

  app.post('/api/tools/install-all', async (req, res) => {
    if (installInProgress) {
      return res.json({ success: false, error: 'Tool installation is already running. Check /api/tools/install-status.' });
    }

    const allTools = getAllTools();
    const installed = detectInstalledTools();
    const missing = allTools.filter(t => !installed.has(t.name));

    if (missing.length === 0) {
      return res.json({ success: true, message: 'All tools are already installed!', results: [] });
    }

    // Return immediately — run installs in the background
    installInProgress = true;
    installResult = { total: missing.length, completed: 0, installed: 0, failed: 0, results: [], done: false };
    res.json({ success: true, message: `Installing ${missing.length} tools in background. Poll /api/tools/install-status for progress.`, total: missing.length });

    // Background install loop (does NOT block the event loop between tools)
    (async () => {
      for (const tool of missing) {
        try {
          // Yield to event loop between installs so Socket.io stays alive
          await new Promise(r => setTimeout(r, 100));
          const result = toolInstaller.installTool(tool.name);
          installResult.results.push({ tool: tool.name, ...result });
          if (result.success) installResult.installed++;
          else installResult.failed++;
        } catch (err) {
          installResult.results.push({ tool: tool.name, success: false, error: err.message });
          installResult.failed++;
        }
        installResult.completed++;
      }
      installResult.done = true;
      installResult.message = `Installed ${installResult.installed}/${installResult.total} tools`;
      installInProgress = false;
    })();
  });

  // Poll install progress
  app.get('/api/tools/install-status', (req, res) => {
    res.json({
      inProgress: installInProgress,
      result: installResult,
    });
  });

  // Learning stats
  app.get('/api/learning-stats', (req, res) => {
    try {
      res.json(memory.getLearningStats());
    } catch (err) {
      res.json([]);
    }
  });

  // Attack memory stats — data learned from own operations
  app.get('/api/attack-memory-stats', (req, res) => {
    try {
      res.json(memory.getAttackMemoryStats());
    } catch (err) {
      res.json({ operations: 0, scans: 0, successful_attacks: 0, loot: 0, learned_insights: 0 });
    }
  });

  // API: Memory & Files
  app.get('/api/memory', (req, res) => {
    res.json(memory.search(''));
  });

  // API: File Reader (Used for editing artifacts)
  app.get('/api/file', (req, res) => {
    const filepath = req.query.path;
    if (!filepath) return res.status(400).json({ error: 'Path required' });
    try {
      if (!existsSync(filepath)) return res.status(404).json({ error: 'File not found' });
      const content = readFileSync(filepath, 'utf8');
      res.json({ content });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // API: File Writer
  app.post('/api/file', express.json(), (req, res) => {
    const { path: filepath, content } = req.body;
    if (!filepath || content === undefined) return res.status(400).json({ error: 'Path and content required' });
    try {
      writeFileSync(filepath, content, 'utf8');
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Agent usage
  app.get('/api/agent-usage', (req, res) => {
    res.json(agent.getUsage());
  });

  // Reports list (filesystem)
  app.get('/api/reports-list', (req, res) => {
    try {
      const reportsDir = join(config.outputDir, 'reports');
      if (!existsSync(reportsDir)) return res.json({ reports: [] });
      const files = readdirSync(reportsDir)
        .filter(f => f.endsWith('.md'))
        .sort()
        .reverse()
        .slice(0, 50);
      res.json({ reports: files });
    } catch (err) {
      res.json({ reports: [], error: err.message });
    }
  });

  // Download report
  app.get('/api/reports/download/:filename', (req, res) => {
    try {
      const filename = req.params.filename;
      if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        return res.status(400).json({ error: 'Invalid filename' });
      }
      const reportsDir = join(config.outputDir, 'reports');
      const filePath = join(reportsDir, filename);
      if (!existsSync(filePath)) {
        return res.status(404).json({ error: 'Report not found' });
      }
      res.download(filePath);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ═══════════════════════════════════════════
  // CHAT SESSION API
  // ═══════════════════════════════════════════

  // List sessions
  app.get('/api/chat/sessions', (req, res) => {
    try {
      const sessions = memory.getChatSessions();
      res.json({ sessions });
    } catch (err) {
      res.json({ sessions: [], error: err.message });
    }
  });

  // Get session with messages
  app.get('/api/chat/sessions/:id', (req, res) => {
    try {
      const session = memory.getChatSession(req.params.id);
      if (!session) return res.status(404).json({ error: 'Session not found' });
      const messages = memory.getSessionMessages(req.params.id);
      res.json({ session, messages });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Create session
  app.post('/api/chat/sessions', (req, res) => {
    try {
      const id = randomUUID();
      const title = req.body.title || 'New Chat';
      const session = memory.createChatSession(id, title);
      res.json({ session });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Rename session
  app.put('/api/chat/sessions/:id', (req, res) => {
    try {
      const { title } = req.body;
      if (!title) return res.status(400).json({ error: 'Title required' });
      memory.updateSessionTitle(req.params.id, title);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Delete session
  app.delete('/api/chat/sessions/:id', (req, res) => {
    try {
      memory.deleteChatSession(req.params.id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Search sessions
  app.get('/api/chat/search', (req, res) => {
    try {
      const { q } = req.query;
      if (!q) return res.json({ sessions: [] });
      const sessions = memory.searchChatSessions(q);
      res.json({ sessions });
    } catch (err) {
      res.json({ sessions: [], error: err.message });
    }
  });

  // ═══════════════════════════════════════════
  // WEBSOCKET — Real-time Agent Chat
  // ═══════════════════════════════════════════

  io.on('connection', (socket) => {
    console.log(`[Web] Client connected: ${socket.id}`);
    let currentAbortController = null;
    let activeSessionId = null;

    // Send initial state
    socket.emit('chat:ready', {
      provider: config.activeProvider || 'nvidia',
      model: getActiveModel(),
      messageCount: agent.messages.length,
      usage: agent.getUsage(),
    });

    // Handle chat messages
    socket.on('chat:message', async (data) => {
      const { message, sessionId } = data;
      if (!message || !message.trim()) return;

      // Use the client's provided sessionId if valid (fixes reconnection split bug)
      if (sessionId && sessionId !== activeSessionId) {
        const existingSession = memory.getChatSession(sessionId);
        if (existingSession) {
          activeSessionId = sessionId;
        }
      }

      // Auto-create session if none active
      if (!activeSessionId) {
        const id = randomUUID();
        const title = message.slice(0, 60) + (message.length > 60 ? '...' : '');
        memory.createChatSession(id, title);
        activeSessionId = id;
        socket.emit('chat:session_created', { id, title });
      }

      // Auto-title: if this is the first message in the session, set the title
      const session = memory.getChatSession(activeSessionId);
      if (session && session.title === 'New Chat') {
        const title = message.slice(0, 60) + (message.length > 60 ? '...' : '');
        memory.updateSessionTitle(activeSessionId, title);
      }

      // Persist user message
      memory.storeSessionMessage(activeSessionId, 'user', message);

      // Create an abort controller for this message
      currentAbortController = new AbortController();
      const signal = currentAbortController.signal;
      let assistantContent = '';

      try {
        await agent.processMessage(
          message,
          // onUpdate — stream text/thinking to client
          async (update) => {
            if (signal.aborted) return;
            if (update.type === 'text') {
              assistantContent += update.content;
              socket.emit('chat:text', { content: update.content });
            } else if (update.type === 'thinking') {
              socket.emit('chat:thinking', { content: update.content });
            }
          },
          // onTool — stream tool events to client
          async (toolEvent) => {
            if (signal.aborted) return;
            if (toolEvent.type === 'start') {
              socket.emit('chat:tool_start', { name: toolEvent.name, args: toolEvent.args });
            } else if (toolEvent.type === 'done') {
              socket.emit('chat:tool_done', {
                name: toolEvent.name,
                args: toolEvent.args,
                result: toolEvent.result,
              });
            }
          },
          signal
        );

        // Persist assistant response
        if (assistantContent && activeSessionId) {
          memory.storeSessionMessage(activeSessionId, 'assistant', assistantContent);
        }

        // Turn complete
        if (!signal.aborted) {
          socket.emit('chat:done', { usage: agent.getUsage() });
        }
      } catch (error) {
        if (!signal.aborted) {
          socket.emit('chat:error', { error: error.message });
        }
      } finally {
        currentAbortController = null;
      }
    });

    // Switch to a different session
    socket.on('chat:switch_session', (data) => {
      const { sessionId } = data;
      const session = memory.getChatSession(sessionId);
      if (!session) {
        socket.emit('chat:error', { error: 'Session not found' });
        return;
      }
      activeSessionId = sessionId;
      // Load messages from this session into the agent
      const messages = memory.getSessionMessages(sessionId);
      agent.clearHistory();
      messages.forEach(msg => {
        if (msg.role === 'user' || msg.role === 'assistant') {
          agent.messages.push({ role: msg.role, content: msg.content });
        }
      });
      socket.emit('chat:session_loaded', {
        sessionId,
        messages: messages.map(m => ({ role: m.role, content: m.content, timestamp: m.created_at })),
        usage: agent.getUsage(),
      });
    });

    // Create new session
    socket.on('chat:new_session', () => {
      const id = randomUUID();
      memory.createChatSession(id, 'New Chat');
      activeSessionId = id;
      agent.clearHistory();
      socket.emit('chat:session_created', { id, title: 'New Chat' });
      socket.emit('chat:cleared', {});
    });

    // Abort current generation
    socket.on('chat:abort', () => {
      if (currentAbortController) {
        currentAbortController.abort();
        currentAbortController = null;
        socket.emit('chat:done', { usage: agent.getUsage(), aborted: true });
      }
    });

    // Clear history
    socket.on('chat:clear', () => {
      agent.clearHistory();
      // If we have an active session, delete its messages and reset the agent
      if (activeSessionId) {
        try {
          memory.deleteChatSession(activeSessionId);
        } catch (e) { /* ignore if already deleted */ }
        const id = randomUUID();
        memory.createChatSession(id, 'New Chat');
        activeSessionId = id;
        socket.emit('chat:session_created', { id, title: 'New Chat' });
      }
      socket.emit('chat:cleared', {});
    });

    // Compact history
    socket.on('chat:compact', async () => {
      await agent.compactHistory();
      socket.emit('chat:compacted', { usage: agent.getUsage() });
    });

    socket.on('disconnect', () => {
      // CRITICAL FIX: Do NOT abort the running agent task on disconnect.
      // A browser tab refresh, network hiccup, or sleep shouldn't kill a multi-hour pentest.
      // The agent continues running in the background. Only explicit 'chat:abort' cancels it.
      console.log(`[Web] Client disconnected: ${socket.id} (agent task continues in background)`);
    });
  });

  // ═══ SPA FALLBACK ═══
  app.get('*all', (req, res) => {
    res.sendFile(join(publicDir, 'index.html'));
  });

  // ═══ START SERVER ═══
  httpServer.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n  ❌ Port ${port} is already in use.`);
      console.error(`  💡 Fix: Run "fuser -k ${port}/tcp" to free it, or use a different port:`);
      console.error(`     node cli.js --web --port 3001\n`);
      process.exit(1);
    } else {
      throw err;
    }
  });

  httpServer.listen(port, () => {
    const bronStatus = bronGraph.connected ? '✅ Connected' : '⚠️ Offline';
    console.log(`\n  🐉 Jarvis Cyber — Web Command Center`);
    console.log(`  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`  🌐 Dashboard:  http://localhost:${port}`);
    console.log(`  📡 API:        http://localhost:${port}/api/health`);
    console.log(`  🔌 WebSocket:  ws://localhost:${port}`);
    console.log(`  🧠 Model:      ${getActiveModel()} (${getActiveProviderName()})`);
    console.log(`  🔗 BRON:       ${bronStatus}`);
    console.log(`  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  });
}
