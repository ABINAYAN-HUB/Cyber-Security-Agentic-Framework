// Jarvis Cyber — Terminal UI
import { EventEmitter } from 'events';
import chalk from 'chalk';
import ora from 'ora';
import { Marked } from 'marked';
import { markedTerminal } from 'marked-terminal';
import config from './config.js';

const marked = new Marked(markedTerminal({
  reflowText: true,
  width: Math.min(process.stdout.columns || 100, 120),
  tab: 2,
}));

export const uiEvents = new EventEmitter();

// ═══════════════════════════════════════════════════
// Color Palette — Cyber Red/Green Terminal Aesthetic
// ═══════════════════════════════════════════════════
const colors = {
  primary:    chalk.hex('#FF0040'),       // Cyber Red
  secondary:  chalk.hex('#00FF88'),       // Matrix Green
  success:    chalk.hex('#00FF88'),       // Green
  warning:    chalk.hex('#FFB800'),       // Amber
  danger:     chalk.hex('#FF0040'),       // Red
  muted:      chalk.hex('#6B7280'),       // Gray
  text:       chalk.hex('#E5E7EB'),       // Light gray
  bright:     chalk.hex('#F9FAFB'),       // White
  tool:       chalk.hex('#00BFFF'),       // Deep Sky Blue
  input:      chalk.hex('#00FF88'),       // Matrix Green
  cyber:      chalk.hex('#FF00FF'),       // Magenta
  gold:       chalk.hex('#FFD700'),       // Gold
};

// ═══════════════════════════════════════════════════
// Icons
// ═══════════════════════════════════════════════════
const icons = {
  agent:     '🐉',
  user:      '❯',
  tool:      '🔧',
  success:   '✅',
  error:     '❌',
  warning:   '⚠️ ',
  file:      '📄',
  folder:    '📁',
  search:    '🔍',
  command:   '⚡',
  edit:      '✏️ ',
  write:     '💾',
  thinking:  '🧠',
  cost:      '📊',
  key:       '🔑',
  shield:    '🛡️ ',
  skull:     '💀',
  target:    '🎯',
  scan:      '📡',
  exploit:   '💣',
  lock:      '🔒',
  unlock:    '🔓',
  network:   '🌐',
  cloud:     '☁️ ',
  memory:    '🧠',
};

// ═══════════════════════════════════════════════════
// Welcome Banner — Jarvis Cyber
// ═══════════════════════════════════════════════════
export function printBanner() {
  const banner = `
${colors.primary('╔══════════════════════════════════════════════════════════════════════╗')}
${colors.primary('║')}                                                                      ${colors.primary('║')}
${colors.primary('║')}      ${colors.danger.bold('██╗ █████╗ ██████╗ ██╗   ██╗██╗███████╗')}                ${colors.primary('║')}
${colors.primary('║')}      ${colors.danger.bold('██║██╔══██╗██╔══██╗██║   ██║██║██╔════╝')}                ${colors.primary('║')}
${colors.primary('║')}      ${colors.danger.bold('██║███████║██████╔╝██║   ██║██║███████╗')}                ${colors.primary('║')}
${colors.primary('║')} ${colors.danger.bold('██   ██║██╔══██║██╔══██╗╚██╗ ██╔╝██║╚════██║')}                ${colors.primary('║')}
${colors.primary('║')} ${colors.danger.bold('╚█████╔╝██║  ██║██║  ██║ ╚████╔╝ ██║███████║')}                ${colors.primary('║')}
${colors.primary('║')}  ${colors.danger.bold('╚════╝ ╚═╝  ╚═╝╚═╝  ╚═╝  ╚═══╝  ╚═╝╚══════╝')}                ${colors.primary('║')}
${colors.primary('║')}                                                                      ${colors.primary('║')}
${colors.primary('║')}   ${colors.secondary.bold('C Y B E R')} ${colors.muted('— Autonomous AI Cybersecurity Agent v4.0')}               ${colors.primary('║')}
${colors.primary('║')}   ${colors.muted(`NVIDIA NIM │ ${(config.model || 'auto').padEnd(15)} │ 150+ Tools │ MCP │ Auto-Learn`)}  ${colors.primary('║')}
${colors.primary('║')}                                                                      ${colors.primary('║')}
${colors.primary('╚══════════════════════════════════════════════════════════════════════╝')}
`;
  console.log(banner);
}

// ═══════════════════════════════════════════════════
// Help Text
// ═══════════════════════════════════════════════════
export function printHelp() {
  console.log(`
${colors.bright.bold('Slash Commands:')}
  ${colors.secondary('/help')}       ${colors.muted('Show this help message')}
  ${colors.secondary('/clear')}      ${colors.muted('Clear conversation history')}
  ${colors.secondary('/compact')}    ${colors.muted('Compact history (reduce tokens)')}
  ${colors.secondary('/model')}      ${colors.muted('Show or change the active model')}
  ${colors.secondary('/cost')}       ${colors.muted('Show token usage statistics')}
  ${colors.secondary('/tools')}      ${colors.muted('List all 150+ security tools')}
  ${colors.secondary('/learn')}      ${colors.muted('Show auto-learning stats')}
  ${colors.secondary('/skills')}     ${colors.muted('List loaded skill modules')}
  ${colors.secondary('/memory')}     ${colors.muted('Show memory stats')}
  ${colors.secondary('/usage')}      ${colors.muted('Show tool usage stats this session')}
  ${colors.secondary('/services')}   ${colors.muted('Show active proxy/tool services')}
  ${colors.secondary('/exit')}       ${colors.muted('Exit the agent')}

${colors.bright.bold('Tips:')}
  ${colors.muted('•')} Type naturally: "Scan example.com for vulnerabilities"
  ${colors.muted('•')} The agent has 150+ built-in security tools (Burp, ZAP, Nuclei, FOFA, PD suite)
  ${colors.muted('•')} It remembers data across sessions via persistent memory
  ${colors.muted('•')} Start with --telegram for Telegram bot mode
  ${colors.muted('•')} Start with --mcp for MCP server mode (AI tool integration)
  ${colors.muted('•')} Start with --daemon for background heartbeat mode
`);
}

// ═══════════════════════════════════════════════════
// Message Rendering
// ═══════════════════════════════════════════════════
export function renderMarkdown(text) {
  try { return marked.parse(text); } catch { return text; }
}

export function printAssistantMessage(text) {
  if (!text || !text.trim()) return;
  process.stdout.write(renderMarkdown(text));
}

let isThinking = false;

export function printThinkingChunk(chunk) {
  uiEvents.emit('think_chunk', chunk);
  if (!isThinking) {
    process.stdout.write(colors.muted('\n┌─ 🧠 Thinking ─\n│ '));
    isThinking = true;
  }
  process.stdout.write(colors.muted(chunk.replace(/\n/g, '\n│ ')));
}

export function finalizeThinking() {
  if (isThinking) {
    process.stdout.write(colors.muted('\n└────────────────\n\n'));
    isThinking = false;
  }
}

export function printStreamChunk(text) {
  uiEvents.emit('text_chunk', text);
  finalizeThinking();
  process.stdout.write(text);
}

export function endStream() {
  finalizeThinking();
  // Don't print extra newline if thinking was just finalized (it already adds newlines)
}

// ═══════════════════════════════════════════════════
// Tool Call Display
// ═══════════════════════════════════════════════════
const toolIcons = {
  read_file:        icons.file,
  write_file:       icons.write,
  edit_file:        icons.edit,
  execute_command:  icons.command,
  list_directory:   icons.folder,
  search_files:     icons.search,
  search_glob:      icons.search,
  web_search:       icons.network,
  tavily_search:    icons.network,
  read_url:         icons.network,
  shodan_search:    icons.scan,
  port_scanner:     icons.scan,
  dns_recon:        icons.scan,
  subdomain_enum:   icons.scan,
  cve_lookup:       icons.shield,
  exploit_search:   icons.exploit,
  metasploit_rpc:   icons.exploit,
  payload_generate: icons.exploit,
  stealth_browser:  icons.lock,
  hash_crack:       icons.key,
  hash_generate:    icons.key,
  encode_decode:    icons.key,
  waf_detector:     icons.shield,
  firewall_analyzer: icons.shield,
  fuzz_engine:      icons.target,
  cloud_enum:       icons.cloud,
  memory_store:     icons.memory,
  save_artifact:    icons.write,
  header_analysis:  icons.shield,
  ssl_scan:         icons.lock,
  whois_lookup:     icons.search,
  ip_geolocation:   icons.network,
  wayback_machine:  icons.search,
  tech_detect:      icons.search,
  email_harvester:  icons.search,
  network_sniffer:  icons.network,
  fofa_search:      icons.scan,
  nuclei_scan:      icons.target,
  subfinder_enum:   icons.scan,
  httpx_probe:      icons.network,
  naabu_scan:       icons.scan,
  katana_crawl:     icons.search,
  dnsx_resolve:     icons.scan,
  uncover_search:   icons.search,
  generate_report:  icons.file,
  install_tool:     icons.tool,
};

export function printToolCall(name, args) {
  uiEvents.emit('tool_call', { name, args });
  finalizeThinking();
  const icon = toolIcons[name] || icons.tool;
  console.log();
  console.log(colors.tool(`  ${icon} ${name}`));
  
  if (args.path) console.log(colors.muted(`     path: ${args.path}`));
  if (args.pattern) console.log(colors.muted(`     pattern: ${args.pattern}`));
  if (args.command) console.log(colors.muted(`     $ ${args.command}`));
  if (args.query) console.log(colors.muted(`     query: ${args.query}`));
  if (args.url) console.log(colors.muted(`     url: ${args.url}`));
  if (args.host) console.log(colors.muted(`     host: ${args.host}`));
  if (args.domain) console.log(colors.muted(`     domain: ${args.domain}`));
  if (args.target) console.log(colors.muted(`     target: ${args.target}`));
  if (args.ip) console.log(colors.muted(`     ip: ${args.ip}`));
  if (args.cve_id) console.log(colors.muted(`     cve: ${args.cve_id}`));
  if (args.hash) console.log(colors.muted(`     hash: ${args.hash}`));
  if (args.type) console.log(colors.muted(`     type: ${args.type}`));
  if (args.action) console.log(colors.muted(`     action: ${args.action}`));
  if (args.old_text) console.log(colors.muted(`     replacing: "${args.old_text.slice(0, 60)}${args.old_text.length > 60 ? '...' : ''}"`));
}

export function printToolResult(name, result) {
  uiEvents.emit('tool_result', { name, result });
  if (result.success === false) {
    console.log(colors.danger(`     ${icons.error} Error: ${result.error}`));
    if (name === 'execute_command' && result.stderr) {
      console.log(colors.muted(`     stderr: ${result.stderr.trim().slice(0, 200)}`));
    }
    return;
  }
  
  console.log(colors.success(`     ${icons.success} Done`));

  // Show approval prompt for strategy/plan artifacts in CLI
  if (name === 'save_artifact' && result.requestedFeedback) {
    console.log();
    console.log(colors.primary('  ╔══════════════════════════════════════════════════════════╗'));
    console.log(colors.primary('  ║') + colors.bright.bold('  🛡️  STRATEGY APPROVAL REQUIRED                           ') + colors.primary('║'));
    console.log(colors.primary('  ╠══════════════════════════════════════════════════════════╣'));
    if (result.summary) {
      const summaryLines = result.summary.match(/.{1,54}/g) || [result.summary];
      for (const line of summaryLines) {
        console.log(colors.primary('  ║') + `  ${colors.text(line.padEnd(56))}` + colors.primary('║'));
      }
    }
    if (result.path) {
      console.log(colors.primary('  ║') + `  ${colors.muted('📄 ' + result.path.split('/').pop())}`.padEnd(67) + colors.primary('║'));
    }
    console.log(colors.primary('  ║') + '                                                          ' + colors.primary('║'));
    console.log(colors.primary('  ║') + `  ${colors.secondary('Type "approve" to proceed')}                               ` + colors.primary('║'));
    console.log(colors.primary('  ║') + `  ${colors.danger('Type "reject" to reject')}                                 ` + colors.primary('║'));
    console.log(colors.primary('  ║') + `  ${colors.warning('Or type feedback to modify the plan')}                     ` + colors.primary('║'));
    console.log(colors.primary('  ╚══════════════════════════════════════════════════════════╝'));
    console.log();
  }

  
  // Show informational note for soft-failures (e.g., grep with no match)
  if (result.note) {
    console.log(colors.muted(`     ℹ️  ${result.note}`));
  }
  // Brief output for specific tools
  if (name === 'list_directory' && result.listing) {
    const lines = result.listing.split('\n').slice(0, 10);
    lines.forEach(l => console.log(colors.muted(`     ${l}`)));
    const total = result.listing.split('\n').length;
    if (total > 10) console.log(colors.muted(`     ... (${total - 10} more entries)`));
  }
  
  if (name === 'search_files' && result.results && typeof result.results === 'string') {
    const lines = result.results.split('\n').slice(0, 5);
    lines.forEach(l => console.log(colors.muted(`     ${l}`)));
  }
  
  if (name === 'edit_file' && result.diff) {
    const diffLines = result.diff.split('\n').slice(0, 15);
    diffLines.forEach(l => {
      if (l.startsWith('+') && !l.startsWith('+++')) console.log(colors.success(`     ${l}`));
      else if (l.startsWith('-') && !l.startsWith('---')) console.log(colors.danger(`     ${l}`));
      else console.log(colors.muted(`     ${l}`));
    });
  }

  if (name === 'bg_interact' && result.output) {
    console.log(colors.muted(`     ┌─ background output ─`));
    const lines = result.output.split('\n');
    lines.forEach(l => console.log(colors.muted(`     │ ${l}`)));
    console.log(colors.muted(`     └─────────────────────`));
  }

  if (name === 'check_port') {
    if (result.open) console.log(colors.success(`     Port ${result.port} is OPEN on ${result.host}`));
    else console.log(colors.warning(`     Port ${result.port} is CLOSED on ${result.host}`));
  }

  if (name === 'web_search' && result.results) {
    console.log(colors.muted(`     Found ${result.results.length} results.`));
    result.results.slice(0, 3).forEach(r => {
      console.log(colors.secondary(`     • ${r.title}`));
      console.log(colors.muted(`       ${r.url}`));
    });
  }

  if (name === 'tavily_search' && result.results) {
    console.log(colors.muted(`     Found ${result.results.length} results.`));
    if (result.answer) console.log(colors.secondary(`     AI Answer: ${result.answer.slice(0, 150)}...`));
  }

  if (name === 'read_file' && result.content) {
    const lines = result.content.split('\n');
    console.log(colors.muted(`     Read ${lines.length} lines.`));
  }

  if (name === 'read_url' && result.content) {
    console.log(colors.muted(`     Extracted ${result.content.length} chars.`));
  }

  if (name === 'port_scanner' && result.results) {
    console.log(colors.secondary(`     ${result.open_ports} open ports found (${result.ports_scanned} scanned in ${result.scan_time_ms}ms)`));
    result.results.slice(0, 5).forEach(r => {
      console.log(colors.success(`     ${r.port}/tcp  ${r.service}  ${r.banner ? r.banner.slice(0, 60) : ''}`));
    });
  }

  if (name === 'subdomain_enum' && result.subdomains) {
    console.log(colors.secondary(`     Found ${result.total} subdomains`));
    result.subdomains.slice(0, 5).forEach(s => console.log(colors.muted(`     • ${s}`)));
  }

  if (name === 'shodan_search' && result.results) {
    console.log(colors.secondary(`     ${result.total} results found`));
  }

  if (name === 'cve_lookup' && result.cve_id) {
    console.log(colors.secondary(`     ${result.cve_id}: CVSS ${result.cvss?.score || 'N/A'} (${result.cvss?.severity || 'N/A'})`));
  }

  if (name === 'waf_detector' && result.wafs) {
    if (result.waf_detected) {
      result.wafs.forEach(w => console.log(colors.warning(`     🛡️  WAF: ${w.waf}`)));
    } else {
      console.log(colors.success(`     No WAF detected`));
    }
  }

  if (name === 'fuzz_engine' && result.results) {
    console.log(colors.secondary(`     ${result.results_found} results from ${result.words_tested} words (${result.scan_time_ms}ms)`));
  }

  if (name === 'header_analysis') {
    if (result.grade) console.log(colors.secondary(`     Security Grade: ${result.grade} (${result.score})`));
  }
}

// ═══════════════════════════════════════════════════
// Permission Prompt
// ═══════════════════════════════════════════════════
export function printPermissionRequest(toolName, args) {
  console.log();
  console.log(colors.warning(`  ${icons.warning} Permission required for ${colors.bright.bold(toolName)}`));
  if (args.command) console.log(colors.warning(`     Command: ${colors.bright(args.command)}`));
  if (args.path) console.log(colors.warning(`     Path: ${colors.bright(args.path)}`));
}

// ═══════════════════════════════════════════════════
// Token / Cost Display
// ═══════════════════════════════════════════════════
export function printTokenUsage(inputTokens, outputTokens) {
  console.log(`
${colors.bright.bold(`${icons.cost} Token Usage`)}
  ${colors.muted('Input tokens:')}  ${colors.secondary(inputTokens.toLocaleString())}
  ${colors.muted('Output tokens:')} ${colors.secondary(outputTokens.toLocaleString())}
  ${colors.muted('Total:')}         ${colors.secondary((inputTokens + outputTokens).toLocaleString())}
`);
}

// ═══════════════════════════════════════════════════
// Error/Info Display
// ═══════════════════════════════════════════════════
export function printError(message) {
  console.log(colors.danger(`\n  ${icons.error} ${message}\n`));
}

export function printWarning(message) {
  console.log(colors.warning(`\n  ${icons.warning} ${message}\n`));
}

export function printInfo(message) {
  console.log(colors.muted(`  ${message}`));
}

// ═══════════════════════════════════════════════════
// Spinner
// ═══════════════════════════════════════════════════
export function createSpinner(text) {
  return ora({
    text: colors.muted(text),
    spinner: 'dots',
    color: 'red',
    discardStdin: false,
  });
}

// ═══════════════════════════════════════════════════
// Prompt
// ═══════════════════════════════════════════════════
export function getPromptString() {
  return `${colors.danger.bold('🐉')} ${colors.input.bold(icons.user)} `;
}

export { colors, icons };
