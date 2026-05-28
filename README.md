<h1 align="center">🐉 Jarvis Cyber</h1>

<p align="center">
  <strong>Autonomous AI Cybersecurity Agent — Framework-Driven Offensive Security</strong><br>
  150+ Kali Tools • MITRE ATT&CK • Dynamic Strategy Engine • Auto-Installer • Telegram Bot
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-3.5.0-red?style=for-the-badge" alt="Version">
  <img src="https://img.shields.io/badge/kali_tools-150+-brightgreen?style=for-the-badge" alt="Tools">
  <img src="https://img.shields.io/badge/node-%3E%3D18-blue?style=for-the-badge" alt="Node">
  <img src="https://img.shields.io/badge/platform-Kali%20Linux-black?style=for-the-badge" alt="Platform">
  <img src="https://img.shields.io/badge/MITRE_ATT%26CK-Mapped-purple?style=for-the-badge" alt="MITRE">
  <img src="https://img.shields.io/badge/license-MIT-yellow?style=for-the-badge" alt="License">
</p>

---

## 🔥 What is Jarvis Cyber?

Jarvis Cyber is a **fully autonomous AI cybersecurity agent** powered by NVIDIA NIM API. Unlike traditional tools with static playbooks, Jarvis uses **MITRE ATT&CK** and the **Cyber Kill Chain** to dynamically generate attack strategies tailored to each target — no hardcoded scripts, no rigid workflows.

### Key Capabilities

- **🧠 Dynamic Strategy Engine** — Generates custom attack plans using MITRE ATT&CK technique mapping and Cyber Kill Chain phase progression. Every strategy is unique to the target.
- **🔧 150+ Kali Tool Registry** — Auto-detects installed tools across 12 categories (recon, exploitation, wireless, post-exploitation, etc.) with full usage examples the AI uses to construct commands dynamically.
- **📦 Self-Healing Tool Installer** — Missing a tool? Jarvis auto-installs it from `apt`, `pip`, `go`, `npm`, `gem`, `cargo`, GitHub, or direct URL. Crashes from missing dependencies trigger automatic self-repair.
- **🤖 Telegram Bot** — Full remote control from your phone. Run pentests, execute commands, and receive results — all through Telegram.
- **📡 24/7 Auto-Learning** — Continuously fetches CVEs, exploits, IOCs, malware hashes, and security news from global threat feeds.
- **💾 Persistent Memory** — SQLite database stores knowledge, scan results, strategies, attack logs, and learned intelligence across sessions.
- **🔄 Anti-Loop Intelligence** — Detects repeated failures, prevents infinite tool-call loops, and adapts strategy when attacks are blocked.
- **⚡ Semantic Execution Cache** — Caches recon results to avoid redundant scans, with configurable TTL per tool type.

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
jarvis
```

### Optional: Passwordless Sudo (for Telegram Bot / Daemon Mode)

Commands like `arp-scan` and `netdiscover` require root. In headless mode (Telegram bot, daemon), Jarvis automatically uses `sudo -n` (non-interactive) to prevent hanging. Configure passwordless sudo for seamless operation:

```bash
echo "$USER ALL=(ALL) NOPASSWD: ALL" | sudo tee /etc/sudoers.d/jarvis-nopasswd
sudo chmod 440 /etc/sudoers.d/jarvis-nopasswd
```

---

## 🚀 Usage Modes

### Interactive CLI (Default)
```bash
jarvis                    # or: node cli.js
```
Type naturally: *"Scan example.com for vulnerabilities"*, *"Find subdomains of target.com"*, *"Exploit the vsftpd service on 192.168.1.5"*

### Telegram Bot
```bash
jarvis --telegram         # or: node cli.js --telegram
```
Control Jarvis remotely from your phone via Telegram.

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

## 🧠 MITRE ATT&CK & Cyber Kill Chain Integration

Jarvis maps **every action** to the MITRE ATT&CK Enterprise Matrix and follows the Cyber Kill Chain methodology for structured offensive operations.

### Kill Chain Phases

| Phase | Name | MITRE Tactic | Description |
|-------|------|-------------|-------------|
| 1 | Reconnaissance | TA0043 | Target research, OSINT, network mapping |
| 2 | Weaponization | TA0042 | Payload generation, C2 setup, exploit preparation |
| 3 | Delivery | TA0001 | Exploit delivery via web, phishing, social engineering |
| 4 | Exploitation | TA0002 | Code execution, vulnerability exploitation |
| 5 | Installation | TA0003, TA0004 | Persistence, privilege escalation, backdoors |
| 6 | Command & Control | TA0011 | Encrypted C2 channels, tunneling, pivoting |
| 7 | Actions on Objectives | TA0007-TA0010 | Lateral movement, data exfiltration, credential harvesting |

### Dynamic Strategy Generation

Instead of hardcoded playbooks, Jarvis generates strategies **on the fly** based on:
- Discovered target environment (ports, services, OS, tech stack)
- MITRE ATT&CK technique applicability
- Currently installed tools on your system
- Previous findings stored in memory
- WAF/firewall detection and evasion requirements

**Supported Objective Types:**
- Full Penetration Test
- Web Application Security Assessment
- Network/Infrastructure Pentest
- Active Directory Attack
- Wireless Network Assessment
- Cloud Security Audit (AWS/Azure/GCP)
- Social Engineering Campaign
- Privilege Escalation
- Reverse Engineering / Malware Analysis

---

## 🔧 150+ Kali Tool Registry

Jarvis auto-detects installed tools and constructs commands dynamically with full usage examples. All tools are executed via `execute_command` — the AI builds the exact command syntax from its built-in knowledge base.

### Information Gathering (20+)
| Tool | Description | MITRE |
|------|-------------|-------|
| nmap | Network scanning, service/OS detection, NSE scripting | T1595, T1046 |
| masscan | Ultra-fast Internet-scale port scanner (10M pps) | T1595 |
| amass | Attack surface mapping and asset discovery | T1590, T1593 |
| subfinder | Passive subdomain enumeration from 30+ sources | T1590 |
| theHarvester | Email, subdomain, IP harvesting | T1589, T1593 |
| enum4linux | Windows and Samba enumeration | T1087, T1135 |
| whatweb | Web technology identification (1800+ plugins) | T1592 |
| wafw00f | WAF fingerprinting (150+ signatures) | T1590 |
| arp-scan | Local network ARP discovery | T1018 |
| netdiscover | Active/passive ARP network discovery | T1018 |

### Web Application (15+)
| Tool | Description | MITRE |
|------|-------------|-------|
| sqlmap | Automatic SQL injection and database takeover | T1190 |
| nuclei | Template-based vulnerability scanner (8000+ templates) | T1190, T1595 |
| nikto | Web server vulnerability scanner (6700+ checks) | T1190 |
| gobuster | Directory/file/DNS/vhost brute-forcing | T1595 |
| ffuf | Fast web fuzzer — content/parameter discovery | T1595 |
| wpscan | WordPress security scanner | T1190 |
| burpsuite | Web app security testing platform | T1190 |
| commix | Automated command injection exploitation | T1190 |
| dalfox | Parameter analysis and XSS scanner | T1190 |

### Password Attacks (10+)
| Tool | Description | MITRE |
|------|-------------|-------|
| hydra | Fast network logon cracker (50+ protocols) | T1110 |
| john | John the Ripper password cracker | T1110 |
| hashcat | GPU-accelerated hash cracking (300+ types) | T1110 |
| medusa | Parallel network login auditor | T1110 |
| cewl | Custom wordlist generator from web pages | T1110 |

### Exploitation (10+)
| Tool | Description | MITRE |
|------|-------------|-------|
| metasploit | World's most used penetration testing framework | T1190, T1203 |
| msfvenom | Payload generator and encoder | T1587 |
| searchsploit | Offline exploit-db search (45000+ exploits) | T1588 |
| crackmapexec | Swiss army knife for AD/Windows pentesting | T1021 |
| evil-winrm | WinRM shell for pentesting | T1021 |
| impacket | Python AD attack toolkit (psexec, secretsdump, etc.) | T1021, T1003 |

### Wireless Attacks (8+)
| Tool | Description | MITRE |
|------|-------------|-------|
| aircrack-ng | WiFi security audit suite — WPA/WPA2 cracking | T1595 |
| wifite | Automated WiFi auditing | T1595 |
| bettercap | Network MITM framework (WiFi, BLE, HID) | T1557 |
| reaver | WPS PIN brute force attack | T1110 |

### Post-Exploitation & Tunneling
| Tool | Description | MITRE |
|------|-------------|-------|
| linpeas | Linux privilege escalation audit | T1068 |
| bloodhound | AD attack path visualization | T1087, T1482 |
| chisel | Fast TCP/UDP tunnel over HTTP | T1572 |
| proxychains | TCP connection proxy chaining | T1090 |
| socat | Multipurpose bidirectional data relay | T1572 |

### Plus More...
Sniffing & Spoofing (responder, ettercap, tshark), Reverse Engineering (ghidra, radare2, binwalk), Forensics (volatility3, steghide, exiftool), Social Engineering (setoolkit, gophish), Evasion (veil, shellter, tor), and General Utilities.

> **Missing a tool?** Jarvis will auto-install it via `install_tool` from apt, pip, go, GitHub, or direct URL.

---

## 📦 Dynamic Tool Installer & Self-Healing

Jarvis can install any missing security tool on the fly:

```
You: "Use gobuster to brute-force directories on http://target.com"
Jarvis: ⚡ [SELF-HEAL] gobuster not found → auto-installing via apt...
        ✅ Installed successfully. Retrying command...
```

### Self-Healing Error Recovery
When a command fails due to a missing dependency, Jarvis:
1. **Detects** the error pattern (`command not found`, `ModuleNotFoundError`, `Cannot find module`)
2. **Auto-installs** the missing package via the appropriate package manager
3. **Clears** the anti-loop failure memory so the command can be retried
4. **Retries** the exact same command — this time it works

### Supported Install Methods
| Method | Source | Example |
|--------|--------|---------|
| `apt` | Kali/Debian packages | `nmap`, `sqlmap`, `hydra` |
| `pip` | Python packages | `pwntools`, `impacket`, `volatility3` |
| `go` | Go modules | `nuclei`, `ffuf`, `gobuster` |
| `npm` | Node.js packages | Custom Node.js tools |
| `gem` | Ruby gems | `evil-winrm` |
| `cargo` | Rust packages | Rust-based tools |
| `github` | Clone + auto-build | Any GitHub repo |
| `url` | Direct download | Binaries, scripts, archives |

---

## 🛠️ Built-in API Tools (31 Tools)

These are native tools with dedicated implementations (not CLI wrappers):

### Core System
| Tool | Command | Description |
|------|---------|-------------|
| Read File | `read_file` | Read file contents |
| Write File | `write_file` | Create/overwrite files |
| Edit File | `edit_file` | Search-and-replace in files |
| Execute Command | `execute_command` | Run shell commands with streaming output |
| List Directory | `list_directory` | Directory listing with metadata |
| Search Files | `search_files` | Regex search across files |
| Search Glob | `search_glob` | Glob pattern file search |
| BG Interact | `bg_interact` | Interact with background processes |
| Start Listener | `start_listener` | Launch reverse shell listeners |
| Check Port | `check_port` | TCP port connectivity check |
| Install Tool | `install_tool` | Dynamic tool installation |

### Search & Intelligence
| Tool | Command | Description |
|------|---------|-------------|
| Web Search | `web_search` | DuckDuckGo search |
| Tavily Search | `tavily_search` | AI-powered deep search |
| GitHub Search | `github_search` | GitHub code/repo search |
| Read URL | `read_url` | Web page content extraction |
| Stealth Browser | `stealth_browser` | Headless browser automation |

### Reconnaissance (API-Based)
| Tool | Command | Description |
|------|---------|-------------|
| Shodan Search | `shodan_search` | Internet-wide device search |
| FOFA Search | `fofa_search` | FOFA cyberspace search engine |
| DNS Recon | `dns_recon` | DNS enumeration |
| WHOIS Lookup | `whois_lookup` | Domain registration info |
| CVE Lookup | `cve_lookup` | CVE details from NVD |
| Wayback Machine | `wayback_machine` | Historical URL data |

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

### Utilities
| Tool | Command | Description |
|------|---------|-------------|
| Encode/Decode | `encode_decode` | Encoding utilities (base64, hex, URL, etc.) |
| Hash Generate | `hash_generate` | Hash generation (MD5, SHA, etc.) |
| Save Artifact | `save_artifact` | Save scan results/reports to disk |
| Memory Store | `memory_store` | Store/retrieve data from persistent memory |
| Metasploit RPC | `metasploit_rpc` | Metasploit Framework integration |

---

## 🧠 24/7 Auto-Learning

Jarvis continuously learns from the internet while running as a daemon:

| Source | Data | Frequency |
|--------|------|-----------|
| NVD API | Latest CVEs | Every hour |
| CISA KEV | Known Exploited Vulnerabilities | Daily |
| Exploit-DB | New exploits | Every hour |
| abuse.ch | Malware samples, IOCs, malicious URLs | Every hour |
| GitHub Advisories | Security advisories | Every hour |
| Nuclei Templates | New CVE detection templates | Daily |
| HackerNews | Security news | Every hour |

All data is stored in a local **SQLite database** with persistent tables for knowledge, targets, conversations, cache, strategies, scan results, threat intel, and more.

---

## 📂 Project Structure

```
Cyber-Security-Agentic-Framework/
├── cli.js                          # Entry point — CLI, Telegram, daemon modes
├── package.json                    # Dependencies & npm scripts
├── install-service.sh              # Systemd auto-start installer
├── .env.example                    # Environment template
├── src/
│   ├── agent.js                    # OODA agentic loop with anti-loop intelligence
│   ├── api.js                      # NVIDIA NIM API client (streaming)
│   ├── auto-learner.js             # 24/7 cyber threat intelligence engine
│   ├── config.js                   # Configuration management
│   ├── daemon.js                   # Background daemon + cron scheduler
│   ├── memory.js                   # SQLite database (persistent memory)
│   ├── repl.js                     # Interactive CLI REPL
│   ├── system-prompt.js            # AI agent system prompt builder
│   ├── telegram-bot.js             # Telegram bot interface
│   ├── ui.js                       # Terminal UI with banners & streaming
│   ├── frameworks.js               # MITRE ATT&CK + Cyber Kill Chain definitions
│   ├── kali-tools-registry.js      # 150+ Kali tools with usage examples
│   ├── tool-installer.js           # Dynamic tool installer & self-healing
│   ├── dynamic-skills.js           # AI-driven strategy generation engine
│   └── tools/                      # 31 built-in tool implementations
│       ├── index.js                # Tool registry & permission classification
│       ├── execute-command.js      # Shell execution with sudo fix & streaming
│       ├── install-tool.js         # AI-callable dynamic tool installer
│       ├── projectdiscovery.js     # Nuclei, Subfinder, Httpx, etc.
│       ├── fofa-search.js          # FOFA integration
│       ├── shodan-search.js        # Shodan integration
│       ├── github-search.js        # GitHub code search
│       ├── metasploit-rpc.js       # Metasploit RPC integration
│       ├── stealth-browser.js      # Headless browser automation
│       └── ... (20+ more)
└── tests/
    └── test-all.js                 # Test suite
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

## 🧪 Testing

```bash
npm test
# or
node tests/test-all.js
```

---

## 🏗️ Architecture Highlights

### Agent Loop (`src/agent.js`)
- **OODA Loop** — Observe → Orient → Decide → Act
- **Sequential tool execution** — Prevents race conditions from parallel tool calls
- **Network auto-retry** — 10 retries with 30s backoff on API disconnection
- **Auto-compaction** — Compresses history when it exceeds token limits
- **Chain-of-thought reasoning** — Supports streaming `<think>` token output

### Anti-Loop Intelligence
- **Signature tracking** — Blocks exact-duplicate failed commands after 2 attempts
- **Consecutive failure cap** — Stops after 15 consecutive failures across all tools
- **Dynamic retry reset** — File modifications clear failure memory (enables fix → retry cycles)
- **Soft failure exclusion** — Network timeouts and recon exit codes aren't counted as failures

### Sudo Non-Interactive Fix (`src/tools/execute-command.js`)
- All `sudo` commands are automatically rewritten to `sudo -n` (non-interactive)
- Prevents Telegram bot and daemon from hanging on password prompts
- If sudo fails, the AI receives a clear error with instructions to configure passwordless sudo

### Semantic Execution Cache
- Caches recon tool results (nmap, nuclei, WHOIS, DNS, etc.) to avoid duplicate scans
- Configurable TTL: 24h for DNS/WHOIS, 2h for port scans
- Cache key is `tool:arguments` — same exact query returns instantly

---

## ⚠️ Disclaimer

This tool is designed for **authorized penetration testing and security research only**. Always obtain proper authorization before testing any systems you don't own. The developers are not responsible for any misuse.

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

<p align="center">
  <strong>🐉 Jarvis Cyber v3.5</strong><br>
  <em>Built by <a href="https://github.com/ABINAYAN-HUB">ABINAYAN</a></em>
</p>
