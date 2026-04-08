# OpenClaw Cyber — Project Context

## Identity
This is **OpenClaw Cyber v2.1**, an autonomous AI cybersecurity agent framework.

## Architecture
- **Core**: Node.js ES Module agent with NVIDIA NIM API backend
- **Interface**: CLI REPL, Telegram Bot, Background Daemon
- **Memory**: SQLite persistent memory (openclaw-memory.db)
- **Tools**: 42 built-in security tools + auto-detection of system tools
- **Skills**: 15 cybersecurity skill modules (dynamic loading from skills/)
- **Multi-Agent**: Subagent spawning for parallel operations

## Key Files
- `cli.js` — Entry point (--telegram, --daemon flags)
- `src/agent.js` — Core agentic loop with OODA-PDCA architecture
- `src/api.js` — NVIDIA NIM API streaming with retry logic
- `src/telegram-bot.js` — Telegram bot with auto-authorization
- `src/daemon.js` — Background heartbeat daemon
- `src/memory.js` — SQLite persistent memory (knowledge, targets, loot, tasks)
- `src/skills-manager.js` — Dynamic skill loader
- `src/system-prompt.js` — System prompt with auto-detected tools
- `src/tools/` — 42 tool implementations

## Skills (15)
- full-recon, webapp-pentest, firewall-bypass, stealth-osint, network-attack
- api-security-test, active-directory-attack, privilege-escalation
- cloud-security-audit, wireless-attack, malware-analysis
- social-engineering, container-escape, password-attack
- red-team-c2, mobile-app-pentest, incident-response
- exploit-development, lateral-movement, bug-bounty-hunter

## Running
```bash
openclaw              # Global CLI (npm install -g)
node cli.js           # Interactive CLI
node cli.js --telegram   # Telegram bot
node cli.js --daemon     # Daemon + Telegram + Heartbeat
```
