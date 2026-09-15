#!/usr/bin/env node

// Jarvis Cyber — Entry Point
// Autonomous AI Cybersecurity Agent with Telegram Bot, Auto-Learning & 50+ Security Tools

import { startRepl } from './src/repl.js';
import config from './src/config.js';

// Parse CLI arguments
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
  🐉 Jarvis Cyber — Autonomous AI Cybersecurity Agent
  Powered by NVIDIA NIM API │ 50+ Security Tools │ Auto-Learning │ Telegram Bot

  Usage:
    node cli.js [options]
    jarvis [options]

  Modes:
    (default)               Interactive CLI REPL
    --ui, -ui               Launch Web UI (alias for --web)
    --telegram              Launch Telegram bot mode
    --daemon                Run as background daemon with heartbeat, auto-learning & Telegram
    --learn                 Run a single auto-learning cycle and exit
    --update-bron           Download & load BRON knowledge graph into ArangoDB
    --update-bron --fresh   Rebuild BRON graph from scratch

  Options:
    --help, -h              Show this help message
    --model <name>          Override the model to use
    --url <url>             Override API URL
    --auto-approve          Auto-approve all tool calls
    --verbose, -v           Enable verbose logging

  Environment Variables:
    NVIDIA_API_KEY          Your NVIDIA API key (REQUIRED)
    TELEGRAM_BOT_TOKEN      Telegram bot token (for --telegram/--daemon)
    TELEGRAM_ALLOWED_IDS    Comma-separated allowed Telegram user IDs
    SHODAN_API_KEY          Shodan API key
    TAVILY_API_KEY          Tavily Search Pro API key
    VIRUSTOTAL_API_KEY      VirusTotal API key
    FOFA_EMAIL              FOFA email
    FOFA_API_KEY            FOFA API key
    LEARNING_CRON           Cron schedule for auto-learning (default: every 6h)

  Examples:
    node cli.js                      # Interactive CLI
    node cli.js --telegram           # Telegram bot only
    node cli.js --daemon             # Daemon + Auto-Learning + Telegram
    node cli.js --learn              # Run auto-learning once
    node cli.js --model "z-ai/glm5"  # Use specific model

  Tools (50+):
    Recon:    shodan, nmap, dns_recon, subdomain_enum, port_scanner, fofa_search
    OSINT:    whois, email_harvester, ip_geolocation, wayback_machine
    WebApp:   header_analysis, ssl_scan, waf_detector, tech_detect, fuzz_engine
    Attack:   payload_generate, exploit_search, metasploit_rpc
    Crypto:   hash_crack, hash_generate, encode_decode
    Cloud:    cloud_enum (S3, Azure, GCP, Firebase)
    Advanced: stealth_browser, network_sniffer, firewall_analyzer
    PD:       nuclei_scan, subfinder_enum, httpx_probe, naabu_scan, katana_crawl, dnsx_resolve, uncover_search
    Search:   web_search, tavily_search, read_url
    Memory:   memory_store, save_artifact

  Auto-Learning:
    Fetches CVEs, exploits, IOCs, threat feeds, and tool knowledge
    automatically in the background when running as a daemon.
`);
  process.exit(0);
}

// Parse --model
const modelIdx = args.indexOf('--model');
if (modelIdx !== -1 && args[modelIdx + 1]) {
  config.model = args[modelIdx + 1];
}

// Parse --url
const urlIdx = args.indexOf('--url');
if (urlIdx !== -1 && args[urlIdx + 1]) {
  config.baseUrl = args[urlIdx + 1];
}

// Parse --auto-approve
if (args.includes('--auto-approve')) {
  config.autoApproveReadTools = true;
  config.autoApproveWriteTools = true;
  config.autoApproveCommands = true;
}

// Parse --verbose
if (args.includes('--verbose') || args.includes('-v')) {
  config.verbose = true;
}

// ═══ MODE: SINGLE LEARN CYCLE ═══
if (args.includes('--learn')) {
  import('./src/auto-learner.js').then(async ({ autoLearner }) => {
    const { memory } = await import('./src/memory.js');
    try {
      memory.init();
      await autoLearner.run();
      memory.close();
      process.exit(0);
    } catch (err) {
      console.error(`Fatal: ${err.message}`);
      process.exit(1);
    }
  });
}

// ═══ MODE: BRON KNOWLEDGE GRAPH UPDATE ═══
else if (args.includes('--update-bron')) {
  import('./src/bron-bootstrap.js').then(async ({ bootstrapBRON }) => {
    try {
      const fresh = args.includes('--fresh');
      const fullHistory = args.includes('--full-history');
      const result = await bootstrapBRON({ fresh, fullHistory });
      process.exit(result ? 0 : 1);
    } catch (err) {
      console.error(`Fatal: ${err.message}`);
      process.exit(1);
    }
  });
}

// ═══ MODE: TELEGRAM BOT ═══
else if (args.includes('--telegram')) {
  import('./src/telegram-bot.js').then(async ({ TelegramInterface }) => {
    try {
      const bot = new TelegramInterface();
      await bot.start();
      console.log('\n🐉 Jarvis Cyber — Telegram Bot Mode');
      console.log('   Press Ctrl+C to stop.\n');
    } catch (err) {
      console.error(`Fatal: ${err.message}`);
      process.exit(1);
    }
  });
}

// ═══ MODE: DAEMON ═══
else if (args.includes('--daemon')) {
  import('./src/daemon.js').then(async ({ Daemon }) => {
    try {
      const daemon = new Daemon();
      await daemon.start();
    } catch (err) {
      console.error(`Fatal: ${err.message}`);
      process.exit(1);
    }
  });
}

// ═══ MODE: MCP SERVER (v4.0) ═══
else if (args.includes('--mcp')) {
  import('./src/mcp-server.js').then(async ({ startMcpServer }) => {
    try {
      const portIdx = args.indexOf('--port');
      const port = portIdx !== -1 && args[portIdx + 1] ? parseInt(args[portIdx + 1]) : undefined;
      const transport = port ? 'sse' : 'stdio';
      await startMcpServer({ transport, port });
    } catch (err) {
      console.error(`Fatal: ${err.message}`);
      process.exit(1);
    }
  });
}

// ═══ MODE: WEB UI (v4.0) ═══
else if (args.includes('--web') || args.includes('--ui') || args.includes('-ui')) {
  import('./src/web-server.js').then(async ({ startWebServer }) => {
    try {
      const portIdx = args.indexOf('--port');
      const port = portIdx !== -1 && args[portIdx + 1] ? parseInt(args[portIdx + 1]) : 3000;
      await startWebServer({ port });
    } catch (err) {
      console.error(`Fatal: ${err.message}`);
      process.exit(1);
    }
  });
}

// ═══ MODE: INTERACTIVE CLI ═══
else {
  const cwd = process.cwd();
  startRepl(cwd).catch((err) => {
    console.error(`Fatal error: ${err.message}`);
    process.exit(1);
  });
}
