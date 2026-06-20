// Jarvis Cyber v4.0 — Web UI Server
// Express.js + Socket.io backend serving the web dashboard
// Bridges browser clients to the Agent, Memory, Tool Bridge, and Report Engine
import express from 'express';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, readdirSync } from 'fs';

import { Agent } from './agent.js';
import config from './config.js';
import { memory } from './memory.js';
import { toolBridge } from './tool-bridge.js';
import { reportEngine } from './report-engine.js';
import { dynamicSkills } from './dynamic-skills.js';
import { toolDefinitions } from './tools/index.js';
import { detectInstalledTools, getAllTools, getCategories } from './kali-tools-registry.js';
import { checkServer } from './api.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
            try { r.data = JSON.parse(r.data); } catch {}
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
        try { r.data = JSON.parse(r.data); } catch {}
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
      temperature: config.temperature,
      topP: config.topP,
      maxTokens: config.maxTokens,
      outputDir: config.outputDir,
      dataDir: config.dataDir,
      learningEnabled: config.learningEnabled,
      maxHistoryMessages: config.maxHistoryMessages,
    });
  });

  // Update config
  app.post('/api/config', (req, res) => {
    const { model, temperature, topP, maxTokens } = req.body;
    if (model) config.model = model;
    if (temperature !== undefined) config.temperature = parseFloat(temperature);
    if (topP !== undefined) config.topP = parseFloat(topP);
    if (maxTokens !== undefined) config.maxTokens = parseInt(maxTokens);
    res.json({
      success: true,
      model: config.model,
      temperature: config.temperature,
      topP: config.topP,
      maxTokens: config.maxTokens,
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
  // WEBSOCKET — Real-time Agent Chat
  // ═══════════════════════════════════════════

  io.on('connection', (socket) => {
    console.log(`[Web] Client connected: ${socket.id}`);

    // Send initial state
    socket.emit('chat:ready', {
      model: config.model,
      messageCount: agent.messages.length,
      usage: agent.getUsage(),
    });

    // Handle chat messages
    socket.on('chat:message', async (data) => {
      const { message } = data;
      if (!message || !message.trim()) return;

      try {
        await agent.processMessage(
          message,
          // onUpdate — stream text/thinking to client
          async (update) => {
            if (update.type === 'text') {
              socket.emit('chat:text', { content: update.content });
            } else if (update.type === 'thinking') {
              socket.emit('chat:thinking', { content: update.content });
            }
          },
          // onTool — stream tool events to client
          async (toolEvent) => {
            if (toolEvent.type === 'start') {
              socket.emit('chat:tool_start', { name: toolEvent.name, args: toolEvent.args });
            } else if (toolEvent.type === 'done') {
              socket.emit('chat:tool_done', {
                name: toolEvent.name,
                args: toolEvent.args,
                result: toolEvent.result,
              });
            }
          }
        );

        // Turn complete
        socket.emit('chat:done', { usage: agent.getUsage() });
      } catch (error) {
        socket.emit('chat:error', { error: error.message });
      }
    });

    // Clear history
    socket.on('chat:clear', () => {
      agent.clearHistory();
      socket.emit('chat:cleared', {});
    });

    // Compact history
    socket.on('chat:compact', async () => {
      await agent.compactHistory();
      socket.emit('chat:compacted', { usage: agent.getUsage() });
    });

    socket.on('disconnect', () => {
      console.log(`[Web] Client disconnected: ${socket.id}`);
    });
  });

  // ═══ SPA FALLBACK ═══
  app.get('*all', (req, res) => {
    res.sendFile(join(publicDir, 'index.html'));
  });

  // ═══ START SERVER ═══
  httpServer.listen(port, () => {
    console.log(`\n  🐉 Jarvis Cyber — Web Command Center`);
    console.log(`  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`  🌐 Dashboard:  http://localhost:${port}`);
    console.log(`  📡 API:        http://localhost:${port}/api/health`);
    console.log(`  🔌 WebSocket:  ws://localhost:${port}`);
    console.log(`  🧠 Model:      ${config.model}`);
    console.log(`  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  });
}
