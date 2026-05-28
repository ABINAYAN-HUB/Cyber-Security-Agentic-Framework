# Jarvis Cyber — Project Context

## Identity
This is **Jarvis Cyber v3.1**, an autonomous AI cybersecurity agent framework.

## Architecture
- **Core**: Node.js ES Module agent with NVIDIA NIM API backend (GLM 5.1)
- **Interface**: CLI REPL, Telegram Bot, Background Daemon
- **Memory**: SQLite persistent memory (jarvis-memory.db)
- **Tools**: 50+ built-in security tools + 150+ Kali tool registry with auto-install
- **Skills**: Dynamic AI-driven strategy engine (MITRE ATT&CK + Cyber Kill Chain)
- **Multi-Agent**: Subagent spawning for parallel operations
- **Frameworks**: MITRE ATT&CK Enterprise Matrix + Lockheed Martin Cyber Kill Chain

## Key Files
- `cli.js` — Entry point (--telegram, --daemon flags)
- `src/agent.js` — Core agentic loop with OODA-PDCA architecture + self-healing
- `src/api.js` — NVIDIA NIM API streaming with retry logic
- `src/frameworks.js` — MITRE ATT&CK + Cyber Kill Chain integration
- `src/dynamic-skills.js` — AI-driven dynamic strategy engine
- `src/kali-tools-registry.js` — 150+ Kali Linux tools with MITRE mapping
- `src/tool-installer.js` — Auto-download/install tools from apt/pip/go/GitHub
- `src/telegram-bot.js` — Telegram bot with auto-authorization
- `src/daemon.js` — Background heartbeat daemon
- `src/memory.js` — SQLite persistent memory (knowledge, targets, loot, strategies)
- `src/skills-manager.js` — Dynamic skill loader
- `src/system-prompt.js` — System prompt with framework-guided decision making
- `src/tools/` — 50+ tool implementations + install_tool

## Dynamic Capabilities
- AI generates attack strategies on-the-fly using MITRE ATT&CK techniques
- Auto-installs missing tools when needed (apt, pip, go, GitHub, URL)
- Self-heals from script errors (reads error → fixes → retries)
- Maps every action to ATT&CK technique IDs
- Follows Cyber Kill Chain phases sequentially

## Running
```bash
jarvis              # Global CLI (npm install -g)
node cli.js           # Interactive CLI
node cli.js --telegram   # Telegram bot
node cli.js --daemon     # Daemon + Telegram + Heartbeat
```
