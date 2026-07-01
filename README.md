<h1 align="center">🐉 Jarvis Cyber</h1>

<p align="center">
  <strong>Autonomous AI Cybersecurity Agent — Framework-Driven Offensive Security</strong><br>
  150+ Kali Tools • 28+ Threat Intel Sources • Web UI Command Center • MCP Server • MITRE ATT&CK • Auto-Installer • Report Engine • Telegram Bot • Attack Memory Feedback Loop
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-4.1.0-red?style=for-the-badge" alt="Version">
  <img src="https://img.shields.io/badge/kali_tools-150+-brightgreen?style=for-the-badge" alt="Tools">
  <img src="https://img.shields.io/badge/node-%3E%3D18-blue?style=for-the-badge" alt="Node">
  <img src="https://img.shields.io/badge/platform-Kali%20Linux-black?style=for-the-badge" alt="Platform">
  <img src="https://img.shields.io/badge/Web_UI-Dashboard-orange?style=for-the-badge" alt="Web UI">
  <img src="https://img.shields.io/badge/MCP_Server-Supported-cyan?style=for-the-badge" alt="MCP">
  <img src="https://img.shields.io/badge/MITRE_ATT%26CK-Mapped-purple?style=for-the-badge" alt="MITRE">
  <img src="https://img.shields.io/badge/license-MIT-yellow?style=for-the-badge" alt="License">
</p>

---

## 🔥 What is Jarvis Cyber?

Jarvis Cyber is a **fully autonomous AI cybersecurity agent** powered by NVIDIA NIM API. Unlike traditional tools with static playbooks, Jarvis uses **MITRE ATT&CK** and the **Cyber Kill Chain** to dynamically generate attack strategies tailored to each target — no hardcoded scripts, no rigid workflows.

> **📖 For deep-dive architecture, data-flow diagrams, and component-level documentation, see [`ARCHITECTURE.md`](ARCHITECTURE.md).**

---

## ✨ What's New in v4.1 — Reliability & Performance

| Feature | Description |
|---------|-------------|
| 🧠 **Tiered Auto-Learning Scheduler** | Sources are now classified into **FAST** (4h), **DAILY** (24h), and **STATIC** (one-time) tiers. Exponential backoff on failures, concurrent fetching (3 at a time), and smart skip logic — no more redundant API calls every 30 minutes. |
| 🔁 **Hardened API Retry Engine** | Per-attempt 2-minute timeouts via `AbortSignal.timeout`, `Retry-After` header support, rate-limit cap (6 attempts max), and abort-safe signal handling. Dead caller signals no longer kill retries. |
| 🌐 **Persistent Agent on Disconnect** | Browser tab refreshes, network hiccups, or laptop sleep no longer kill running pentests. Only explicit `chat:abort` cancels the agent — long-running tasks survive WebSocket disconnects. |
| ⏳ **Deferred Daemon Startup** | Auto-learning waits 2 minutes after daemon start to avoid burning API quota during rapid restarts or deploys. |
| 🕐 **Relaxed Cron Intervals** | Heartbeat moved from every 30 min → every 1 hour. Learning cron from every 30 min → every 2 hours. Tiered scheduling handles actual source frequency internally. |
| 🛡️ **Abort-Resilient Agent Loop** | Agent now catches `AbortError` and `operation was aborted` as network errors, triggering graceful retry instead of crashing the task. |

<details>
<summary><strong>v4.0 Features</strong></summary>

| Feature | Description |
|---------|-------------|
| 🌐 **Web UI Command Center** | Full-featured browser dashboard with real-time AI chat, session history, tool browser, threat intel viewer, report manager, and settings. Launch with `jarvis -ui` and open `http://localhost:3000`. |
| 🔌 **MCP Server** | Expose all 150+ Kali tools as Model Context Protocol tools via **stdio** or **SSE** transport. Any MCP-compatible client (Claude Desktop, Cursor, VS Code) can use Jarvis as a cybersecurity backend. |
| 📊 **Dynamic Report Engine** | Auto-generates structured pentest reports from tool execution history — executive summary, Kill Chain methodology, findings, MITRE mapping, timeline, and recommendations. |
| 🌉 **Tool Bridge** | Runtime service discovery that auto-detects running proxies (Burp Suite, ZAP, mitmproxy) and tool services (Metasploit RPC, Interactsh). Routes traffic through active proxies automatically. |
| 🤖 **Subagent System** | Spawn background AI agents for parallelizable tasks. Delegate time-consuming work (recon, brute-force, scraping) and check results later. |
| 💬 **Chat Sessions** | Persistent conversation history stored in SQLite. Switch between sessions, search past conversations, and resume where you left off — both in CLI and Web UI. |
| 📝 **Skills Manager** | Load custom user-created skills from a `skills/` directory with YAML frontmatter and bundled scripts. |
| 🎯 **Listener Manager** | Persistent TCP listener for catching reverse shells, with dynamic port conflict detection and interactive shell command execution. |

</details>

---

## 🧠 Key Capabilities

- **🧠 Dynamic Strategy Engine** — Generates custom attack plans using MITRE ATT&CK technique mapping and Cyber Kill Chain phase progression. Every strategy is unique to the target.
- **🔧 150+ Kali Tool Registry** — Auto-detects installed tools across 12 categories (recon, exploitation, wireless, post-exploitation, etc.) with full usage examples the AI uses to construct commands dynamically.
- **📦 Self-Healing Tool Installer** — Missing a tool? Jarvis auto-installs it from `apt`, `pip`, `go`, `npm`, `gem`, `cargo`, GitHub, or direct URL. Crashes from missing dependencies trigger automatic self-repair.
- **🌐 Web UI Dashboard** — Real-time browser-based command center with AI chat, tool browser, threat intel viewer, report management, and system settings.
- **🤖 Telegram Bot** — Full remote control from your phone. Run pentests, execute commands, and receive results — all through Telegram.
- **📡 24/7 Auto-Learning (28+ Sources)** — Continuously fetches CVEs, exploits, IOCs, malware hashes, phishing URLs, ransomware data, breach catalogs, C2 infrastructure IPs, TOR exit nodes, attack techniques, and security news from **28+ global threat feeds** (NVD, CISA KEV, CISA Alerts, Exploit-DB, PacketStorm, Vulners, abuse.ch Malware/URLs/IOCs, Feodo Tracker, SSL Blacklist, OpenPhish, PhishTank, URLScan.io, GitHub Advisories, FIRST.org EPSS, MITRE CAPEC, Nuclei Templates, HackerNews, RansomWatch, **VirusTotal**, **Shodan**, **AlienVault OTX**, **MITRE ATT&CK Enterprise**, **Have I Been Pwned**, **C2 Tracker** (Cobalt Strike/Metasploit/Havoc/Sliver), **TOR Exit Nodes**). Fetches **10,000+ items per run**.
- **🧠 Attack Memory Feedback Loop** — Jarvis learns from its own operations. Every completed scan, successful attack chain, and captured loot is automatically processed and stored as knowledge — so it gets smarter with every engagement.
- **💾 Persistent Memory** — SQLite database with 15+ tables stores knowledge, scan results, strategies, attack logs, chat sessions, threat intel, and learned intelligence across sessions.
- **📦 One-Click Tool Install from Web UI** — Install missing Kali tools individually or batch-install all 21+ missing tools directly from the Tools page with progress feedback.
- **🔄 Anti-Loop Intelligence** — Detects repeated failures, prevents infinite tool-call loops, and adapts strategy when attacks are blocked (3-level protection system).
- **⚡ Semantic Execution Cache** — Caches recon results to avoid redundant scans, with configurable TTL per tool type (2h for ports, 24h for DNS/WHOIS).
- **🔌 MCP Server** — Full Model Context Protocol support for integration with Claude Desktop, Cursor IDE, VS Code, and custom MCP clients.

---

## ⚡ Quick Start

### Prerequisites
- **Node.js** 18+ (`sudo apt install nodejs npm`)
- **Go** 1.21+ (for ProjectDiscovery tools)
- **Kali Linux** (recommended) or any Debian-based Linux

### Installation

```bash
# 1. Clone the repo
git clone https://github.com/ABINAYAN-HUB/Cyber-Security-Agentic-Framework.git
cd Cyber-Security-Agentic-Framework

# 2. Install dependencies
npm install

# 3. Set up environment
cp .env.example .env
nano .env  # Fill in your API keys (NVIDIA_API_KEY is REQUIRED)

# 4. Install ProjectDiscovery tools (nuclei, subfinder, httpx, etc.)
go install -v github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest
go install -v github.com/projectdiscovery/subfinder/v2/cmd/subfinder@latest
go install -v github.com/projectdiscovery/httpx/cmd/httpx@latest
go install -v github.com/projectdiscovery/naabu/v2/cmd/naabu@latest
go install -v github.com/projectdiscovery/katana/cmd/katana@latest
go install -v github.com/projectdiscovery/dnsx/cmd/dnsx@latest
go install -v github.com/projectdiscovery/uncover/cmd/uncover@latest

# 5. Add Go binaries to PATH (add to ~/.zshrc or ~/.bashrc)
export PATH="$HOME/go/bin:$PATH"

# 6. Make it globally accessible
npm link

# 7. Run!
jarvis         # Interactive CLI
jarvis -ui     # Web UI Dashboard (http://localhost:3000)
```

### Optional: Passwordless Sudo (for Telegram Bot / Daemon Mode)

Commands like `arp-scan` and `netdiscover` require root. In headless mode (Telegram bot, daemon), Jarvis automatically uses `sudo -n` (non-interactive) to prevent hanging:

```bash
echo "$USER ALL=(ALL) NOPASSWD: ALL" | sudo tee /etc/sudoers.d/jarvis-nopasswd
sudo chmod 440 /etc/sudoers.d/jarvis-nopasswd
```

---

## 🚀 Usage Modes

| Mode | Command | Description |
|------|---------|-------------|
| **Interactive CLI** | `jarvis` | Default mode. Chat naturally with Jarvis. |
| **Web UI** | `jarvis -ui` or `jarvis --web` | Browser-based command center at `http://localhost:3000`. |
| **Web UI (custom port)** | `jarvis --web --port 3001` | Web UI on a custom port. |
| **MCP Server (stdio)** | `jarvis --mcp` | Expose tools for local MCP clients (Claude Desktop, Cursor). |
| **MCP Server (SSE)** | `jarvis --mcp --port 8888` | Remote MCP server via SSE transport. |
| **Telegram Bot** | `jarvis --telegram` | Control Jarvis remotely from your phone. |
| **Background Daemon** | `jarvis --daemon` | 24/7 mode with auto-learning, Telegram bot, heartbeat. |
| **Single Learn Cycle** | `jarvis --learn` | Run one auto-learning cycle and exit. |

### Web UI Command Center

Launch the Web UI and access it at `http://localhost:3000`:

```bash
jarvis -ui
```

The Web UI includes:
- **📊 Dashboard** — System health, API status, active proxy services, database statistics
- **💬 Agent Chat** — Real-time AI conversation with thinking steps visualization, tool execution cards, session history sidebar, and smart auto-scroll
- **🔧 Tools** — Browse and search 150+ Kali tools + 35 API tools with install status. **One-click install** for individual tools or batch "Install All Missing" button
- **🛡️ Threat Intel** — Latest CVEs, exploit search, threat intelligence feed, attack memory insights. **"Run Auto-Learning" button** fetches from 28+ sources (including VirusTotal, Shodan, MITRE ATT&CK, HIBP, C2 Tracker, TOR nodes) with live progress bar and source badges
- **📝 Reports** — Generated pentest reports with download/view capability
- **⚙️ Settings** — Model configuration, API parameters, temperature/top-p tuning

### MCP Client Configuration (Claude Desktop)

```json
{
  "mcpServers": {
    "jarvis-cyber": {
      "command": "node",
      "args": ["/path/to/Cyber-Security-Agentic-Framework/cli.js", "--mcp"]
    }
  }
}
```

### Auto-Start on Boot (Systemd)

```bash
npm run install-service
# Manage: systemctl --user {status|stop|restart|disable} jarvis
# Logs:   journalctl --user -u jarvis -f
```

---

## 🔧 150+ Kali Tool Registry

Jarvis auto-detects installed tools and constructs commands dynamically. Full registry covers **12 categories**:

| Category | Examples | Count |
|----------|----------|-------|
| Information Gathering | nmap, masscan, amass, subfinder, theHarvester | 20+ |
| Web Application | sqlmap, nuclei, nikto, gobuster, ffuf, wpscan | 15+ |
| Password Attacks | hydra, john, hashcat, medusa, cewl | 10+ |
| Exploitation | metasploit, msfvenom, searchsploit, crackmapexec | 10+ |
| Wireless Attacks | aircrack-ng, wifite, bettercap, reaver | 8+ |
| Post-Exploitation | linpeas, bloodhound, chisel, proxychains | 8+ |
| Sniffing & Spoofing | responder, ettercap, tshark | 5+ |
| Reverse Engineering | ghidra, radare2, binwalk | 5+ |
| Forensics | volatility3, steghide, exiftool | 5+ |
| Social Engineering | setoolkit, gophish | 3+ |
| Evasion | veil, shellter, tor | 3+ |
| General Utilities | curl, wget, python3, socat | 10+ |

> **Missing a tool?** Jarvis auto-installs it via `install_tool` from apt, pip, go, npm, gem, cargo, GitHub, or direct URL.

---

## 🛠️ Built-in API Tools (35 Tools)

These are native tools with dedicated implementations (not CLI wrappers):

<details>
<summary><strong>Core System (11 tools)</strong></summary>

| Tool | Description |
|------|-------------|
| `read_file` | Read file contents |
| `write_file` | Create/overwrite files |
| `edit_file` | Search-and-replace in files |
| `execute_command` | Run shell commands with streaming output |
| `list_directory` | Directory listing with metadata |
| `search_files` | Regex search across files |
| `search_glob` | Glob pattern file search |
| `bg_interact` | Interact with background processes |
| `start_listener` | Launch reverse shell listeners |
| `check_port` | TCP port connectivity check |
| `install_tool` | Dynamic tool installation |

</details>

<details>
<summary><strong>Search & Intelligence (5 tools)</strong></summary>

| Tool | Description |
|------|-------------|
| `web_search` | DuckDuckGo search |
| `tavily_search` | AI-powered deep search |
| `github_search` | GitHub code/repo search |
| `read_url` | Web page content extraction |
| `stealth_browser` | Headless browser automation |

</details>

<details>
<summary><strong>Reconnaissance — API-Based (6 tools)</strong></summary>

| Tool | Description |
|------|-------------|
| `shodan_search` | Internet-wide device search |
| `fofa_search` | FOFA cyberspace search engine |
| `dns_recon` | DNS enumeration |
| `whois_lookup` | Domain registration info |
| `cve_lookup` | CVE details from NVD |
| `wayback_machine` | Historical URL data |

</details>

<details>
<summary><strong>ProjectDiscovery Suite (7 tools)</strong></summary>

| Tool | Description |
|------|-------------|
| `nuclei_scan` | 8000+ vulnerability templates |
| `subfinder_enum` | Passive subdomain enumeration |
| `httpx_probe` | HTTP probing & tech detection |
| `naabu_scan` | Fast port scanning |
| `katana_crawl` | Web crawler & spider |
| `dnsx_resolve` | DNS resolution toolkit |
| `uncover_search` | Multi-engine search aggregator |

</details>

<details>
<summary><strong>Reporting & Orchestration — v4.0 (4 tools)</strong></summary>

| Tool | Description |
|------|-------------|
| `generate_report` | Auto-generate structured pentest reports |
| `spawn_subagent` | Launch background AI agent for parallel tasks |
| `check_subagent_status` | Check subagent progress and results |
| `list_subagents` | View all background agents |

</details>

<details>
<summary><strong>Utilities (5 tools)</strong></summary>

| Tool | Description |
|------|-------------|
| `encode_decode` | Encoding utilities (base64, hex, URL, etc.) |
| `hash_generate` | Hash generation (MD5, SHA, etc.) |
| `save_artifact` | Save scan results/reports to disk (with approval gates) |
| `memory_store` | Store/retrieve data from persistent memory |
| `metasploit_rpc` | Metasploit Framework integration |

</details>

---

## 🔑 API Keys Setup

| Key | Required | Get It |
|-----|----------|--------|
| `NVIDIA_API_KEY` | ✅ **REQUIRED** | [build.nvidia.com](https://build.nvidia.com) |
| `TELEGRAM_BOT_TOKEN` | For Telegram mode | [@BotFather](https://t.me/BotFather) |
| `SHODAN_API_KEY` | Recommended | [shodan.io](https://shodan.io) |
| `TAVILY_API_KEY` | Recommended | [tavily.com](https://tavily.com) |
| `VIRUSTOTAL_API_KEY` | Optional | [virustotal.com](https://virustotal.com) |
| `FOFA_EMAIL` + `FOFA_API_KEY` | Optional | [fofa.info](https://fofa.info) |
| `PDCP_API_KEY` | Optional | [cloud.projectdiscovery.io](https://cloud.projectdiscovery.io) |

---

## 📂 Project Structure

```
Cyber-Security-Agentic-Framework/
├── cli.js                          # Entry point — CLI, Web UI, Telegram, daemon, MCP modes
├── package.json                    # Dependencies & npm scripts
├── install-service.sh              # Systemd auto-start installer
├── .env.example                    # Environment template
├── ARCHITECTURE.md                 # Deep-dive technical documentation
├── AGENT.md                        # Project context for AI agent
├── public/                         # Web UI frontend
│   ├── index.html                  # SPA shell with sidebar navigation
│   ├── css/
│   │   ├── index.css               # Global styles, design system
│   │   └── chat.css                # Chat view styles, thinking animation, tool cards
│   └── js/
│       ├── app.js                  # SPA router, Socket.io client, view management
│       ├── components/
│       │   ├── markdown.js         # Markdown renderer (marked.js + DOMPurify)
│       │   └── toast.js            # Toast notification system
│       └── views/
│           ├── chat.js             # Agent chat with sessions, thinking, tool cards
│           ├── dashboard.js        # System health, stats, services
│           ├── intel.js            # Threat intelligence browser
│           ├── reports.js          # Report viewer & downloader
│           ├── settings.js         # Model & API configuration
│           └── tools.js            # Tool browser (API + Kali)
├── src/
│   ├── agent.js                    # OODA agentic loop with anti-loop intelligence
│   ├── api.js                      # NVIDIA NIM API client (streaming, chain-of-thought)
│   ├── auto-learner.js             # 24/7 cyber threat intelligence engine
│   ├── config.js                   # Configuration management
│   ├── daemon.js                   # Background daemon + cron scheduler
│   ├── dynamic-skills.js           # AI-driven strategy generation engine
│   ├── frameworks.js               # MITRE ATT&CK + Cyber Kill Chain definitions
│   ├── kali-tools-registry.js      # 150+ Kali tools with usage examples
│   ├── listener-manager.js         # TCP listener manager for reverse shells
│   ├── mcp-server.js               # MCP Server — stdio & SSE transports (v4.0)
│   ├── memory.js                   # SQLite database (15+ tables, persistent memory)
│   ├── repl.js                     # Interactive CLI REPL
│   ├── report-engine.js            # Dynamic pentest report generator (v4.0)
│   ├── skills-manager.js           # Custom skill loader (skills/ directory)
│   ├── subagent-manager.js         # Background subagent orchestration (v4.0)
│   ├── system-prompt.js            # AI agent system prompt builder
│   ├── telegram-bot.js             # Telegram bot interface
│   ├── tool-bridge.js              # Runtime service discovery & proxy routing (v4.0)
│   ├── tool-installer.js           # Dynamic tool installer & self-healing
│   ├── ui.js                       # Terminal UI with banners & streaming
│   ├── web-server.js               # Express + Socket.io web server (v4.0)
│   └── tools/                      # 35 built-in tool implementations
│       ├── index.js                # Tool registry & permission classification
│       ├── bg-interact.js          # Background process interaction
│       ├── check-port.js           # TCP port connectivity check
│       ├── cve-lookup.js           # CVE details from NVD
│       ├── dns-recon.js            # DNS enumeration
│       ├── edit-file.js            # Search-and-replace file editing
│       ├── encode-decode.js        # Encoding/decoding utilities
│       ├── execute-command.js      # Shell execution with sudo fix & streaming
│       ├── fofa-search.js          # FOFA integration
│       ├── generate-report.js      # Report generation tool (v4.0)
│       ├── github-search.js        # GitHub code search
│       ├── hash-generate.js        # Hash generation
│       ├── install-tool.js         # AI-callable dynamic tool installer
│       ├── list-directory.js       # Directory listing
│       ├── memory-store.js         # Persistent memory store
│       ├── metasploit-rpc.js       # Metasploit RPC integration
│       ├── network-utils.js        # Shared network error diagnostics
│       ├── projectdiscovery.js     # Nuclei, Subfinder, Httpx, etc.
│       ├── read-file.js            # File reader
│       ├── read-url.js             # URL content extraction
│       ├── save-artifact.js        # Scan result saver (with approval gates)
│       ├── search-files.js         # Regex file search
│       ├── search-glob.js          # Glob pattern search
│       ├── shodan-search.js        # Shodan integration
│       ├── start-listener.js       # Reverse shell listener
│       ├── stealth-browser.js      # Headless browser automation
│       ├── subagent-tools.js       # Subagent spawn/check/list (v4.0)
│       ├── tavily-search.js        # Tavily AI search
│       ├── wayback-machine.js      # Wayback Machine integration
│       ├── web-search.js           # DuckDuckGo search
│       ├── whois-lookup.js         # WHOIS lookup
│       └── write-file.js           # File writer
├── skills/                         # Custom user skills (SKILL.md + scripts)
├── tests/
│   └── test-all.js                 # Test suite
└── jarvis-output/                  # Scan results, reports, artifacts
```

---

## 📋 REPL Commands

| Command | Description |
|---------|-------------|
| `/help` | Show help |
| `/tools` | List all available tools |
| `/memory` | Database statistics |
| `/learn` | Auto-learning stats |
| `/skills` | Dynamic skill engine status |
| `/model` | Show/change AI model |
| `/cost` | Token usage stats |
| `/clear` | Clear conversation |
| `/compact` | Compact history |
| `/exit` | Exit |

---

## 🌐 Web UI API Reference

The Web UI exposes 25+ REST API endpoints for programmatic access:

<details>
<summary><strong>REST API Endpoints</strong></summary>

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | System health, model, API status, active services |
| `GET` | `/api/stats` | Database table counts |
| `GET` | `/api/tools` | API tool definitions |
| `GET` | `/api/kali-tools` | Full Kali tool registry with install status |
| `POST` | `/api/tools/install` | Install a single tool by name |
| `POST` | `/api/tools/install-all` | Batch-install all missing Kali tools |
| `GET` | `/api/frameworks` | MITRE ATT&CK + Cyber Kill Chain data |
| `GET` | `/api/threat-intel` | Latest CVEs, intel/exploit/tool counts |
| `GET` | `/api/threat-intel/search?q=...` | Search threat intelligence |
| `GET` | `/api/exploits/search?q=...` | Search exploit database |
| `GET` | `/api/scan-results` | Scan results (filterable by target/type) |
| `GET` | `/api/operations` | Operations log |
| `GET` | `/api/knowledge?q=...` | Knowledge search |
| `GET` | `/api/targets` | Target profiles |
| `GET` | `/api/loot` | Captured credentials/loot |
| `GET` | `/api/services` | Active proxy/tool services |
| `GET` | `/api/config` | Current configuration |
| `POST` | `/api/config` | Update model/temperature/topP/maxTokens |
| `POST` | `/api/learn` | Trigger auto-learning from 28+ sources |
| `GET` | `/api/learning-status` | Check auto-learning progress |
| `GET` | `/api/learning-stats` | Auto-learning statistics |
| `GET` | `/api/attack-memory-stats` | Attack memory feedback loop stats (ops, scans, attacks, loot, insights) |
| `POST` | `/api/report` | Generate pentest report |
| `GET` | `/api/reports-list` | List generated reports |
| `GET` | `/api/reports/download/:file` | Download a report |
| `GET` | `/api/chat/sessions` | List chat sessions |
| `POST` | `/api/chat/sessions` | Create new session |
| `PUT` | `/api/chat/sessions/:id` | Rename session |
| `DELETE` | `/api/chat/sessions/:id` | Delete session |
| `GET` | `/api/chat/search?q=...` | Search chat sessions |
| `GET` | `/api/agent-usage` | Token usage stats |

</details>

<details>
<summary><strong>WebSocket Events (Socket.io)</strong></summary>

| Event | Direction | Description |
|-------|-----------|-------------|
| `chat:ready` | Server → Client | Agent initialized, sends model & usage |
| `chat:message` | Client → Server | Send user message with sessionId |
| `chat:text` | Server → Client | Streamed text response chunk |
| `chat:thinking` | Server → Client | Chain-of-thought reasoning token |
| `chat:tool_start` | Server → Client | Tool execution started (name + args) |
| `chat:tool_done` | Server → Client | Tool execution complete (name + args + result) |
| `chat:done` | Server → Client | Turn complete with usage stats |
| `chat:error` | Server → Client | Error message |
| `chat:abort` | Client → Server | Cancel current generation |
| `chat:clear` | Client → Server | Clear history & start new session |
| `chat:compact` | Client → Server | Compact conversation history |
| `chat:session_created` | Server → Client | New session ID + title |
| `chat:switch_session` | Client → Server | Load a different session |
| `chat:session_loaded` | Server → Client | Session messages loaded |
| `chat:new_session` | Client → Server | Create new session + clear |

</details>

---

## 🧪 Testing

```bash
npm test
# or
node tests/test-all.js
```

---

## ⚠️ Disclaimer

This tool is designed for **authorized penetration testing and security research only**. Always obtain proper authorization before testing any systems you don't own. The developers are not responsible for any misuse.

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

<p align="center">
  <strong>🐉 Jarvis Cyber v4.1</strong><br>
  <em>Built by <a href="https://github.com/ABINAYAN-HUB">ABINAYAN</a></em>
</p>
