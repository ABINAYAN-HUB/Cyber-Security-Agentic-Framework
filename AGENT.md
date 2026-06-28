# Jarvis Cyber — Project Context

## Identity
This is **Jarvis Cyber v4.0**, an autonomous AI cybersecurity agent framework with a full Web UI Command Center.

## Architecture
- **Core**: Node.js ES Module agent with NVIDIA NIM API backend (GLM 5.1, chain-of-thought reasoning)
- **Interfaces**: CLI REPL, Web UI (Express + Socket.io), Telegram Bot, Background Daemon, MCP Server
- **Memory**: SQLite persistent memory (jarvis-memory.db) with 15+ tables
- **Tools**: 35 built-in API tools + 150+ Kali tool registry with auto-install
- **Skills**: Dynamic AI-driven strategy engine (MITRE ATT&CK + Cyber Kill Chain)
- **Multi-Agent**: Subagent spawning for parallel operations
- **Frameworks**: MITRE ATT&CK Enterprise Matrix + Lockheed Martin Cyber Kill Chain
- **Web UI**: Real-time dashboard with chat sessions, tool browser, threat intel, reports, and settings
- **MCP Server**: Expose all 150+ tools via stdio or SSE transport for Claude Desktop, Cursor, VS Code

## Key Files
- `cli.js` — Entry point (--ui, --web, --telegram, --daemon, --mcp, --learn flags)
- `src/agent.js` — Core agentic loop with OODA architecture, anti-loop intelligence, self-healing
- `src/api.js` — NVIDIA NIM API streaming with retry logic, rate-limit backoff, chain-of-thought
- `src/web-server.js` — Express + Socket.io web server with 25+ REST API endpoints + WebSocket chat
- `src/memory.js` — SQLite persistent memory (15+ tables: knowledge, targets, loot, chat_sessions, conversations, operations, scan_results, threat_intel, exploit_db, strategies, etc.)
- `src/mcp-server.js` — MCP Server — stdio & SSE transports, dynamic Kali tool registration
- `src/frameworks.js` — MITRE ATT&CK + Cyber Kill Chain integration
- `src/dynamic-skills.js` — AI-driven dynamic strategy generation engine
- `src/kali-tools-registry.js` — 150+ Kali Linux tools with MITRE mapping & usage examples
- `src/tool-installer.js` — Auto-download/install tools from apt/pip/go/npm/gem/cargo/GitHub
- `src/tool-bridge.js` — Runtime service discovery (Burp Suite, ZAP, mitmproxy, Metasploit RPC)
- `src/report-engine.js` — Dynamic pentest report generator from execution telemetry
- `src/subagent-manager.js` — Background subagent orchestration for parallel tasks
- `src/telegram-bot.js` — Telegram bot with per-user sessions & auto-authorization
- `src/daemon.js` — Background heartbeat daemon with cron-scheduled auto-learning
- `src/auto-learner.js` — 24/7 cyber threat intelligence engine (NVD, CISA, Exploit-DB, abuse.ch)
- `src/skills-manager.js` — Dynamic skill loader from skills/ directory
- `src/system-prompt.js` — System prompt with framework-guided decision making
- `src/tools/` — 32 tool implementation files (35 tools total)
- `public/` — Web UI frontend (HTML, CSS, JS with SPA routing, chat, dashboard, tool browser)

## Web UI Views
- **Dashboard** — System health, API status, active services, database stats
- **Agent Chat** — Real-time AI agent conversation with session management, thinking steps, tool execution cards
- **Tools** — Browse 150+ Kali tools + 35 API tools with install status
- **Threat Intel** — CVE browser, exploit search, threat intelligence feed
- **Reports** — Generated pentest reports with download capability
- **Settings** — Model configuration, API parameters, system info

## Web UI API Endpoints
- `GET /api/health` — System health check with model, API, and service status
- `GET /api/stats` — Database table counts
- `GET /api/tools` — API tool definitions
- `GET /api/kali-tools` — Full Kali tool registry with install status
- `GET /api/frameworks` — MITRE ATT&CK + Cyber Kill Chain data
- `GET /api/threat-intel` — Latest CVEs and intel counts
- `GET /api/chat/sessions` — Chat session management (CRUD)
- `POST /api/report` — Generate pentest report
- `GET /api/config` / `POST /api/config` — Runtime config management
- WebSocket events: `chat:message`, `chat:text`, `chat:thinking`, `chat:tool_start`, `chat:tool_done`, `chat:abort`

## Dynamic Capabilities
- AI generates attack strategies on-the-fly using MITRE ATT&CK techniques
- Auto-installs missing tools when needed (apt, pip, go, npm, gem, cargo, GitHub, URL)
- Self-heals from script errors (reads error → fixes → retries)
- Maps every action to ATT&CK technique IDs
- Follows Cyber Kill Chain phases sequentially
- Web UI streams AI responses in real-time with thinking visualization
- Chat sessions persist across browser refreshes
- Auto-detects running proxies (Burp Suite, ZAP) and routes traffic through them

## Running
```bash
jarvis                    # Interactive CLI (default)
jarvis -ui                # Web UI Command Center (http://localhost:3000)
jarvis --web --port 3001  # Web UI on custom port
jarvis --telegram         # Telegram bot
jarvis --daemon           # Daemon + Telegram + Auto-Learning + Heartbeat
jarvis --mcp              # MCP Server (stdio, for Claude Desktop/Cursor)
jarvis --mcp --port 8888  # MCP Server (SSE, remote clients)
jarvis --learn            # Single auto-learning cycle
```
