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
import { checkServer } from './api.js';
import { MITRE_ATTACK, CYBER_KILL_CHAIN } from './frameworks.js';
import { autoLearner } from './auto-learner.js';
import { toolInstaller } from './tool-installer.js';

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
      model: config.model,
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
      if (currentAbortController) {
        currentAbortController.abort();
        currentAbortController = null;
      }
      console.log(`[Web] Client disconnected: ${socket.id}`);
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
    console.log(`\n  🐉 Jarvis Cyber — Web Command Center`);
    console.log(`  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`  🌐 Dashboard:  http://localhost:${port}`);
    console.log(`  📡 API:        http://localhost:${port}/api/health`);
    console.log(`  🔌 WebSocket:  ws://localhost:${port}`);
    console.log(`  🧠 Model:      ${config.model}`);
    console.log(`  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  });
}
