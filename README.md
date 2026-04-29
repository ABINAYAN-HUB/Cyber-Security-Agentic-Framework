<h1 align="center">🐉 Jarvis Cyber</h1>

<p align="center">
  <strong>Autonomous AI Cybersecurity Agent</strong><br>
  50+ Security Tools • Auto-Learning Intelligence • Telegram Bot • SystemD Daemon
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-3.0.0-red?style=for-the-badge" alt="Version">
  <img src="https://img.shields.io/badge/tools-50+-brightgreen?style=for-the-badge" alt="Tools">
  <img src="https://img.shields.io/badge/node-%3E%3D18-blue?style=for-the-badge" alt="Node">
  <img src="https://img.shields.io/badge/platform-Kali%20Linux-black?style=for-the-badge" alt="Platform">
  <img src="https://img.shields.io/badge/license-MIT-yellow?style=for-the-badge" alt="License">
</p>

---

## 🔥 What is jarvis Cyber?

jarvis Cyber is a **fully autonomous AI cybersecurity agent** powered by NVIDIA NIM API. It combines 50+ built-in security tools, a persistent SQLite database, 24/7 auto-learning from global threat feeds, and a Telegram bot interface — all running as a background service on your Kali Linux machine.

**It learns while you sleep.** Every 30 minutes, jarvis automatically fetches CVEs, exploits, IOCs, malware hashes, and security news from the internet and stores them in its local database.

---

## ⚡ Quick Start

### Prerequisites
- **Node.js** 18+ (`sudo apt install nodejs npm`)
- **Go** 1.21+ (for ProjectDiscovery tools)
- **Kali Linux** (recommended) or any Debian-based Linux

### Installation

```bash
# 1. Clone the repo
git clone https://github.com/ABINAYAN-HUB/jarvis-Cyber.git
cd jarvis-Cyber

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
jarvis
```

---

## 🚀 Usage Modes

### Interactive CLI (Default)
```bash
jarvis                    # or: node cli.js
```
Type naturally: *"Scan example.com for vulnerabilities"*, *"Find subdomains of target.com"*, *"Search FOFA for exposed databases"*

### Telegram Bot
```bash
jarvis --telegram         # or: node cli.js --telegram
```
Control jarvis remotely from your phone via Telegram.

### Background Daemon (24/7)
```bash
jarvis --daemon           # or: node cli.js --daemon
```
Runs as a persistent background process with:
- Auto-learning every 30 minutes
- Telegram bot
- Heartbeat task queue

### Single Learning Cycle
```bash
jarvis --learn            # or: node cli.js --learn
```
Run one auto-learning cycle and exit.

### Auto-Start on Boot (Systemd)
```bash
npm run install-service
# or
chmod +x install-service.sh && ./install-service.sh
```
This creates a systemd user service that:
- Starts automatically when you boot Kali
- Runs even when you're not logged in
- Restarts on crashes
- Logs to `~/.jarvis/daemon.log`

```bash
# Service management
systemctl --user status jarvis      # Check status
systemctl --user stop jarvis        # Stop
systemctl --user restart jarvis     # Restart
systemctl --user disable jarvis     # Disable auto-start
journalctl --user -u jarvis -f     # Live logs
```

---

## 🛠️ 50+ Built-in Security Tools

### Reconnaissance
| Tool | Command | Description |
|------|---------|-------------|
| Shodan Search | `shodan_search` | Internet-wide device search |
| FOFA Search | `fofa_search` | FOFA cyberspace search engine |
| Port Scanner | `port_scanner` | TCP port scanning |
| DNS Recon | `dns_recon` | DNS enumeration |
| Subdomain Enum | `subdomain_enum` | Subdomain discovery |
| WHOIS Lookup | `whois_lookup` | Domain registration info |
| IP Geolocation | `ip_geolocation` | IP location mapping |
| Tech Detect | `tech_detect` | Technology fingerprinting |
| WAF Detector | `waf_detector` | Web Application Firewall detection |
| SSL Scan | `ssl_scan` | SSL/TLS analysis |
| Header Analysis | `header_analysis` | HTTP security headers |
| Email Harvester | `email_harvester` | Email address discovery |
| Wayback Machine | `wayback_machine` | Historical URL data |
| Cloud Enum | `cloud_enum` | S3, Azure, GCP bucket discovery |

### ProjectDiscovery Suite
| Tool | Command | Description |
|------|---------|-------------|
| Nuclei | `nuclei_scan` | 8000+ vulnerability templates |
| Subfinder | `subfinder_enum` | Passive subdomain enumeration |
| Httpx | `httpx_probe` | HTTP probing & tech detection |
| Naabu | `naabu_scan` | Fast port scanning |
| Katana | `katana_crawl` | Web crawler & spider |
| Dnsx | `dnsx_resolve` | DNS resolution toolkit |
| Uncover | `uncover_search` | Multi-engine search aggregator |

### Vulnerability Research
| Tool | Command | Description |
|------|---------|-------------|
| CVE Lookup | `cve_lookup` | CVE details from NVD |
| Exploit Search | `exploit_search` | Find exploits |
| Metasploit RPC | `metasploit_rpc` | Metasploit integration |

### Attack Tools
| Tool | Command | Description |
|------|---------|-------------|
| Payload Generate | `payload_generate` | Payload generation |
| Fuzz Engine | `fuzz_engine` | Web fuzzing |
| Hash Crack | `hash_crack` | Hash cracking |
| Hash Generate | `hash_generate` | Hash generation |
| Encode/Decode | `encode_decode` | Encoding utilities |
| Stealth Browser | `stealth_browser` | Headless browser automation |
| Network Sniffer | `network_sniffer` | Packet capture |

### Search & Intelligence
| Tool | Command | Description |
|------|---------|-------------|
| Web Search | `web_search` | DuckDuckGo search |
| Tavily Search | `tavily_search` | AI-powered deep search |
| GitHub Search | `github_search` | GitHub code search |
| Read URL | `read_url` | Web page content extraction |

---

## 🧠 24/7 Auto-Learning

jarvis continuously learns from the internet while running as a daemon:

| Source | Data | Frequency |
|--------|------|-----------|
| NVD API | Latest CVEs | Every hour |
| CISA KEV | Known Exploited Vulnerabilities | Daily |
| Exploit-DB | New exploits | Every hour |
| abuse.ch | Malware samples, IOCs, malicious URLs | Every hour |
| GitHub Advisories | Security advisories | Every hour |
| Nuclei Templates | New CVE detection templates | Daily |
| HackerNews | Security news | Every hour |
| Built-in | 25 cybersecurity tool knowledge | One-time |

All data is stored in a local **SQLite database** with 14 tables:
`knowledge`, `targets`, `conversations`, `cache`, `skills`, `loot`, `tasks`, `operations`, `scan_results`, `threat_intel`, `fofa_results`, `exploit_db`, `attack_logs`, `learning_history`, `nuclei_results`, `tool_knowledge`

---

## 📂 Project Structure

```
jarvis-Cyber/
├── cli.js                          # Entry point
├── package.json                    # Dependencies
├── install-service.sh              # Systemd auto-start installer
├── .env.example                    # Environment template
├── src/
│   ├── agent.js                    # OODA-PDCA agentic loop
│   ├── api.js                      # NVIDIA NIM API client
│   ├── auto-learner.js             # 24/7 cyber intelligence engine
│   ├── config.js                   # Configuration management
│   ├── daemon.js                   # Background daemon + cron
│   ├── memory.js                   # SQLite database (14 tables)
│   ├── repl.js                     # Interactive CLI REPL
│   ├── system-prompt.js            # AI agent system prompt
│   ├── telegram-bot.js             # Telegram bot interface
│   ├── ui.js                       # Terminal UI with banners
│   └── tools/                      # 50+ security tools
│       ├── index.js                # Tool registry
│       ├── fofa-search.js          # FOFA integration
│       ├── projectdiscovery.js     # Nuclei, Subfinder, etc.
│       ├── shodan-search.js        # Shodan integration
│       └── ... (30+ more)
├── skills/                         # 25 skill modules
│   ├── full-recon/
│   ├── exploit-development/
│   ├── threat-intelligence/
│   ├── fofa-recon/
│   ├── zero-day-research/
│   └── ... (20 more)
└── tests/
    └── test-all.js                 # Test suite (67 tests)
```

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

## 📋 REPL Commands

| Command | Description |
|---------|-------------|
| `/help` | Show help |
| `/tools` | List all 50+ tools |
| `/memory` | Database statistics |
| `/learn` | Auto-learning stats |
| `/skills` | Loaded skill modules |
| `/model` | Show/change AI model |
| `/cost` | Token usage stats |
| `/clear` | Clear conversation |
| `/compact` | Compact history |
| `/exit` | Exit |

---

## 🧪 Testing

```bash
npm test
# or
node tests/test-all.js
```

Expected output: `📊 Results: 67/67 passed, 0 failed`

---

## ⚠️ Disclaimer

This tool is designed for **authorized penetration testing and security research only**. Always obtain proper authorization before testing any systems you don't own. The developers are not responsible for any misuse.

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

<p align="center">
  <strong>🐉 jarvis Cyber v3.0</strong><br>
  <em>Built by <a href="https://github.com/ABINAYAN-HUB">ABINAYAN</a></em>
</p>
