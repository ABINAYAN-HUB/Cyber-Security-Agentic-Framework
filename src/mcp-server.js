// Jarvis Cyber v4.0 — MCP Server
// Dynamically exposes ALL 150+ Kali tools as MCP tools
// Uses kali-tools-registry for auto-discovery — add a tool, it appears in MCP
// Supports stdio (local) and SSE (remote) transports
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { z } from 'zod';
import { execSync } from 'child_process';
import { detectInstalledTools, getAllTools, getCategories } from './kali-tools-registry.js';
import { toolBridge } from './tool-bridge.js';
import { reportEngine } from './report-engine.js';
import { toolInstaller } from './tool-installer.js';

/**
 * Start the MCP server with dynamic tool registration
 * @param {Object} options - { transport: 'stdio'|'sse', port: number }
 */
export async function startMcpServer(options = {}) {
  const { transport = 'stdio', port = 8888 } = options;

  const server = new McpServer({
    name: 'jarvis-cyber',
    version: '4.0.0',
    description: 'Jarvis Cyber — Autonomous AI Cybersecurity Agent with 150+ Kali Linux tools',
  });

  // ═══ REGISTER CORE TOOLS ═══
  registerCoreMcpTools(server);

  // ═══ DYNAMICALLY REGISTER ALL KALI TOOLS ═══
  registerKaliTools(server);

  // ═══ CONNECT TRANSPORT ═══
  if (transport === 'stdio') {
    const stdioTransport = new StdioServerTransport();
    await server.connect(stdioTransport);
    console.error('🐉 Jarvis Cyber MCP Server (stdio) — Ready');
    console.error(`   Tools registered: ${getAllTools().length}+`);
  } else if (transport === 'sse') {
    const express = (await import('express')).default;
    const app = express();
    app.use(express.json());

    // Track SSE transports per session
    const transports = {};

    app.get('/sse', async (req, res) => {
      const sseTransport = new SSEServerTransport('/messages', res);
      transports[sseTransport.sessionId] = sseTransport;
      res.on('close', () => { delete transports[sseTransport.sessionId]; });
      await server.connect(sseTransport);
    });

    app.post('/messages', async (req, res) => {
      const sessionId = req.query.sessionId;
      const sseTransport = transports[sessionId];
      if (sseTransport) {
        await sseTransport.handlePostMessage(req, res);
      } else {
        res.status(400).json({ error: 'Unknown session' });
      }
    });

    // Health check
    app.get('/health', (req, res) => {
      const installed = detectInstalledTools();
      res.json({
        status: 'ok',
        server: 'jarvis-cyber',
        version: '4.0.0',
        tools_installed: installed.size,
        tools_total: getAllTools().length,
        active_services: Object.fromEntries(toolBridge.scan()),
      });
    });

    app.listen(port, () => {
      console.error(`🐉 Jarvis Cyber MCP Server (SSE) — http://0.0.0.0:${port}`);
      console.error(`   SSE endpoint: http://0.0.0.0:${port}/sse`);
      console.error(`   Health check: http://0.0.0.0:${port}/health`);
      console.error(`   Tools registered: ${getAllTools().length}+`);
    });
  }
}

// ═══════════════════════════════════════════════════════════
// CORE MCP TOOLS — High-level tools that use the framework
// ═══════════════════════════════════════════════════════════

function registerCoreMcpTools(server) {

  // ── Execute any shell command ──
  server.tool(
    'execute_command',
    'Execute any shell command on the Kali Linux system. Use this for running security tools, scripts, and system commands.',
    { command: z.string().describe('Shell command to execute'), timeout_ms: z.number().optional().describe('Timeout in ms (default: 600000)') },
    async ({ command, timeout_ms }) => {
      const timeout = timeout_ms || 600000;
      try {
        const safeCmd = command.replace(/\bsudo\b(?!\s+-[nSAkKp])/g, 'sudo -n');
        const output = execSync(safeCmd, {
          encoding: 'utf8',
          timeout,
          stdio: ['ignore', 'pipe', 'pipe'],
          env: { ...process.env, TERM: 'dumb', DEBIAN_FRONTEND: 'noninteractive', PAGER: 'cat' },
          cwd: process.cwd(),
        });
        toolBridge.logToolUsage('execute_command', { command }, { success: true }, 0);
        return { content: [{ type: 'text', text: output || '(no output)' }] };
      } catch (err) {
        toolBridge.logToolUsage('execute_command', { command }, { success: false }, 0);
        return { content: [{ type: 'text', text: `Error (exit ${err.status}): ${err.stderr || err.message}` }], isError: true };
      }
    }
  );

  // ── Generate pentest report ──
  server.tool(
    'generate_report',
    'Auto-generate a structured pentest report from the current session. Adapts dynamically to whatever tools were used.',
    { target: z.string().describe('Target identifier'), objective: z.string().optional().describe('Assessment objective') },
    async ({ target, objective }) => {
      const result = reportEngine.generateReport({ target, objective });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  // ── Install a tool ──
  server.tool(
    'install_tool',
    'Dynamically install a security tool from apt, pip, go, GitHub, or URL.',
    { tool_name: z.string().describe('Tool name to install'), install_method: z.enum(['auto', 'apt', 'pip', 'go', 'github', 'url']).optional() },
    async ({ tool_name, install_method }) => {
      const result = toolInstaller.installTool(tool_name);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  // ── List installed tools ──
  server.tool(
    'list_tools',
    'List all installed security tools on this system, grouped by category.',
    {},
    async () => {
      const installed = detectInstalledTools();
      const categories = getCategories();
      let output = `# Installed Tools (${installed.size})\n\n`;
      for (const cat of categories) {
        const catTools = [...installed.values()].filter(t => t.cat === cat);
        if (catTools.length > 0) {
          output += `## ${cat.toUpperCase().replace(/-/g, ' ')} (${catTools.length})\n`;
          for (const tool of catTools) {
            output += `- **${tool.name}** — ${tool.desc}\n`;
          }
          output += '\n';
        }
      }
      return { content: [{ type: 'text', text: output }] };
    }
  );

  // ── Scan for active services ──
  server.tool(
    'scan_services',
    'Scan for running security tool services (Burp Suite, ZAP, Metasploit, etc). Returns active proxies and tool endpoints.',
    {},
    async () => {
      const services = toolBridge.scan();
      const result = {};
      for (const [name, service] of services) {
        result[name] = { displayName: service.displayName, host: service.host, port: service.port, type: service.type };
      }
      const proxy = toolBridge.getActiveProxy();
      return { content: [{ type: 'text', text: JSON.stringify({ active_services: result, active_proxy: proxy, proxy_flag: toolBridge.getCurlProxyFlag() }, null, 2) }] };
    }
  );

  // ── Get session usage stats ──
  server.tool(
    'usage_stats',
    'Get tool usage statistics for the current session. Shows which tools were used, how many times, and success rates.',
    {},
    async () => {
      const stats = toolBridge.getUsageStats();
      return { content: [{ type: 'text', text: JSON.stringify(stats, null, 2) }] };
    }
  );
}

// ═══════════════════════════════════════════════════════════
// DYNAMIC KALI TOOL REGISTRATION
// Reads from kali-tools-registry and auto-registers each tool
// ═══════════════════════════════════════════════════════════

function registerKaliTools(server) {
  const allTools = getAllTools();
  const installed = detectInstalledTools();

  for (const tool of allTools) {
    // Only register installed tools as direct MCP tools
    if (!installed.has(tool.name)) continue;
    // Skip tools already registered as core MCP tools
    if (['execute_command', 'install_tool'].includes(tool.name)) continue;

    const toolName = `kali_${tool.name.replace(/[^a-zA-Z0-9_]/g, '_')}`;
    const description = `[${tool.cat}] ${tool.desc}. Binary: ${tool.bin}. MITRE: ${(tool.mitre || []).join(', ') || 'N/A'}.`;

    // Build dynamic parameter schema
    const paramSchema = {
      args: z.string().optional().describe(`Command-line arguments to pass to ${tool.bin}. Example: ${tool.usage?.[0]?.replace(tool.bin + ' ', '') || '--help'}`),
      target: z.string().optional().describe('Target IP, domain, or URL'),
      timeout_ms: z.number().optional().describe('Timeout in ms (default: 300000)'),
    };

    // If tool has proxy_port, add proxy detection
    if (tool.proxy_port) {
      paramSchema.use_proxy = z.boolean().optional().describe('Route through this tool\'s proxy if running');
    }

    server.tool(
      toolName,
      description,
      paramSchema,
      async (params) => {
        const { args: toolArgs, target, timeout_ms } = params;
        const timeout = timeout_ms || 300000;

        // Build command dynamically
        let command = tool.bin;
        if (toolArgs) command += ` ${toolArgs}`;
        else if (target) command += ` ${target}`;

        // Auto-install if needed
        if (!toolInstaller.isInstalled(tool.name)) {
          const installResult = toolInstaller.installTool(tool.name);
          if (!installResult.success) {
            return { content: [{ type: 'text', text: `Tool ${tool.name} not installed and auto-install failed: ${installResult.error}` }], isError: true };
          }
        }

        try {
          const safeCmd = command.replace(/\bsudo\b(?!\s+-[nSAkKp])/g, 'sudo -n');
          const output = execSync(safeCmd, {
            encoding: 'utf8',
            timeout,
            stdio: ['ignore', 'pipe', 'pipe'],
            env: { ...process.env, TERM: 'dumb', DEBIAN_FRONTEND: 'noninteractive', PAGER: 'cat' },
            cwd: process.cwd(),
          });
          toolBridge.logToolUsage('execute_command', { command }, { success: true }, 0);
          return { content: [{ type: 'text', text: output || '(no output)' }] };
        } catch (err) {
          toolBridge.logToolUsage('execute_command', { command }, { success: false }, 0);
          const output = (err.stdout || '') + '\n' + (err.stderr || err.message || '');
          return { content: [{ type: 'text', text: `Exit ${err.status || -1}:\n${output.trim()}` }], isError: err.status !== 1 };
        }
      }
    );
  }
}
