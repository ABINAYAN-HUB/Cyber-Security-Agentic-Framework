# Jarvis Cyber — Project Context

## Identity
This is **Jarvis Cyber v4.0**, an autonomous AI cybersecurity agent framework with a full Web UI Command Center.

## Architecture
- **Core**: Node.js ES Module agent with NVIDIA NIM API backend (`nvidia/nemotron-3-super-120b-a12b` default, chain-of-thought reasoning) or Local AI servers (LM Studio / Ollama)
- **Interfaces**: CLI REPL, Web UI (Express + Socket.io), Telegram Bot, Background Daemon, MCP Server
- **Memory**: SQLite persistent memory (jarvis-memory.db) with 15+ tables
- **Tools**: 35 built-in API tools + 150+ Kali tool registry with auto-install from Web UI
- **Skills**: Dynamic AI-driven strategy engine (MITRE ATT&CK + Cyber Kill Chain)
- **Multi-Agent**: Subagent spawning for parallel operations
- **Frameworks**: MITRE ATT&CK Enterprise Matrix + Lockheed Martin Cyber Kill Chain
- **Web UI**: Real-time dashboard with chat sessions, tool browser, threat intel (20+ sources), reports, tool install, and settings
- **MCP Server**: Expose all 150+ tools via stdio or SSE transport for Claude Desktop, Cursor, VS Code
- **Auto-Learning**: 20+ global threat feed sources, 5,000+ items per run

## Key Files
- `cli.js` — Entry point (--ui, --web, --telegram, --daemon, --mcp, --learn flags)
- `src/agent.js` — Core agentic loop with OODA architecture, anti-loop intelligence, self-healing
- `src/api.js` — NVIDIA NIM API streaming with retry logic, rate-limit backoff, chain-of-thought
- `src/web-server.js` — Express + Socket.io web server with 30+ REST API endpoints + WebSocket chat
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
- `src/auto-learner.js` — 20+ source cyber threat intelligence engine (NVD, CISA, EPSS, Exploit-DB, PacketStorm, Vulners, abuse.ch, Feodo, SSL BL, OpenPhish, PhishTank, URLScan, MITRE CAPEC, GitHub, Nuclei, HackerNews, CISA Alerts, RansomWatch)
- `src/skills-manager.js` — Dynamic skill loader from skills/ directory
- `src/system-prompt.js` — System prompt with framework-guided decision making
- `src/tools/` — 32 tool implementation files (35 tools total)
- `public/` — Web UI frontend (HTML, CSS, JS with SPA routing, chat, dashboard, tool browser)

## Web UI Views
- **Dashboard** — System health, API status, active services, database stats
- **Agent Chat** — Real-time AI agent conversation with session management, thinking steps, tool execution cards
- **Tools** — Browse 150+ Kali tools + 35 API tools with install status. **One-click install** for individual tools + **"Install All Missing"** batch button
- **Threat Intel** — CVE browser, exploit search, threat intelligence feed. **"Run Auto-Learning" button** fetches from 20+ sources with live progress bar
- **Reports** — Generated pentest reports with download capability
- **Settings** — Model configuration, API parameters, system info

## Web UI API Endpoints (30+)
- `GET /api/health` — System health check with model, API, and service status
- `GET /api/stats` — Database table counts
- `GET /api/tools` — API tool definitions
- `GET /api/kali-tools` — Full Kali tool registry with install status
- `POST /api/tools/install` — Install a single tool by name
- `POST /api/tools/install-all` — Batch-install all missing Kali tools
- `GET /api/frameworks` — MITRE ATT&CK + Cyber Kill Chain data
- `GET /api/threat-intel` — Latest CVEs and intel counts
- `GET /api/threat-intel/search?q=...` — Search threat intelligence
- `GET /api/exploits/search?q=...` — Search exploit database
- `POST /api/learn` — Trigger auto-learning from 20+ sources
- `GET /api/learning-status` — Check auto-learning progress/result
- `GET /api/learning-stats` — Learning source statistics
- `GET /api/chat/sessions` — Chat session management (CRUD)
- `POST /api/report` — Generate pentest report
- `GET /api/config` / `POST /api/config` — Runtime config management
- WebSocket events: `chat:message`, `chat:text`, `chat:thinking`, `chat:tool_start`, `chat:tool_done`, `chat:abort`

## Auto-Learning Sources (20+)
1. NVD API — 2,000 CVEs per fetch (7-day window)
2. CISA KEV — ALL known exploited vulnerabilities (~1,100+)
3. GitHub Security Advisories — 100 per fetch
4. FIRST.org EPSS — 200 exploit prediction scores
5. Exploit-DB — 200 exploits (GitLab API + RSS fallback)
6. InTheWild.io — 500 actively exploited CVEs
7. PacketStorm Security — Latest exploits via RSS
8. Vulners.com — 200 vulnerability bulletins
9. abuse.ch Malware Bazaar — 1,000 malware samples
10. abuse.ch URLhaus — 500 malicious URLs
11. abuse.ch ThreatFox — 1,000 IOC indicators
12. Feodo Tracker — Botnet C2 server IPs
13. SSL Blacklist — Malicious SSL certificates
14. OpenPhish — ~300 active phishing URLs
15. PhishTank — 500 community-verified phishing sites
16. URLScan.io — 100 recent phishing scans
17. MITRE CAPEC — 615 attack patterns (full catalog)
18. Nuclei Templates — 100 recent CVE template commits
19. HackerNews — 50 security news stories
20. CISA Alerts — 100 official advisories
21. RansomWatch — 500 ransomware group posts

## Dynamic Capabilities
- AI generates attack strategies on-the-fly using MITRE ATT&CK techniques
- Auto-installs missing tools when needed (apt, pip, go, npm, gem, cargo, GitHub, URL)
- One-click tool install from Web UI (individual + batch "Install All Missing")
- Self-heals from script errors (reads error → fixes → retries)
- Maps every action to ATT&CK technique IDs
- Follows Cyber Kill Chain phases sequentially
- Web UI streams AI responses in real-time with thinking visualization
- Chat sessions persist across browser refreshes
- Auto-detects running proxies (Burp Suite, ZAP) and routes traffic through them
- Auto-learning populates 5,000+ threat intel items from 20+ sources per run

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
