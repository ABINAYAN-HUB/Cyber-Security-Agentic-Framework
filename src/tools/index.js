// Jarvis Cyber — Tool Registry
// Only API-based, native Node.js, and essential tools
// ALL Kali tools are used via execute_command — the AI constructs commands dynamically
import * as readFile from './read-file.js';
import * as writeFile from './write-file.js';
import * as editFile from './edit-file.js';
import * as executeCommand from './execute-command.js';
import * as listDirectory from './list-directory.js';
import * as searchFiles from './search-files.js';
import * as searchGlob from './search-glob.js';
import * as bgInteract from './bg-interact.js';
import * as webSearch from './web-search.js';
import * as readUrl from './read-url.js';
import * as startListener from './start-listener.js';
import * as checkPort from './check-port.js';
import * as subagentTools from './subagent-tools.js';

// ═══ API-BASED TOOLS (need API keys / HTTP logic) ═══
import * as shodanSearch from './shodan-search.js';
import * as whoisLookup from './whois-lookup.js';
import * as dnsRecon from './dns-recon.js';
import * as cveLookup from './cve-lookup.js';
import * as tavilySearch from './tavily-search.js';
import * as githubSearch from './github-search.js';
import * as stealthBrowser from './stealth-browser.js';
import * as waybackMachine from './wayback-machine.js';
import * as metasploitRpc from './metasploit-rpc.js';

// ═══ NATIVE NODE.JS TOOLS (no CLI binary needed) ═══
import * as hashGenerate from './hash-generate.js';
import * as encodeDecode from './encode-decode.js';
import * as saveArtifact from './save-artifact.js';
import * as memoryStore from './memory-store.js';

// ═══ FOFA ═══
import * as fofaSearch from './fofa-search.js';

// ═══ DYNAMIC TOOL INSTALLER ═══
import * as installTool from './install-tool.js';

// ═══ PROJECTDISCOVERY TOOLS ═══
import {
  nucleiDefinition, executeNuclei,
  subfinderDefinition, executeSubfinder,
  httpxDefinition, executeHttpx,
  naabuDefinition, executeNaabu,
  katanaDefinition, executeKatana,
  dnsxDefinition, executeDnsx,
  uncoverDefinition, executeUncover,
} from './projectdiscovery.js';

// Flatten subagent tools
const { spawnSubagent, checkSubagentStatus, listSubagents } = subagentTools;

// Wrap PD tools into standard format
const pdTools = [
  { definition: nucleiDefinition, execute: executeNuclei },
  { definition: subfinderDefinition, execute: executeSubfinder },
  { definition: httpxDefinition, execute: executeHttpx },
  { definition: naabuDefinition, execute: executeNaabu },
  { definition: katanaDefinition, execute: executeKatana },
  { definition: dnsxDefinition, execute: executeDnsx },
  { definition: uncoverDefinition, execute: executeUncover },
];

// All available tools
const tools = [
  // ═══ Core System Tools ═══
  readFile, writeFile, editFile, executeCommand,
  listDirectory, searchFiles, searchGlob, bgInteract,
  startListener, checkPort,
  
  // ═══ Search & Intelligence (API-based) ═══
  webSearch, tavilySearch, githubSearch, readUrl, stealthBrowser,
  
  // ═══ OSINT & Reconnaissance (API-based) ═══
  shodanSearch, dnsRecon, whoisLookup, waybackMachine,
  
  // ═══ FOFA ═══
  fofaSearch,

  // ═══ Vulnerability Research (API-based) ═══
  cveLookup, metasploitRpc,
  
  // ═══ Native Node.js Tools ═══
  encodeDecode, hashGenerate,
  
  // ═══ Data Management ═══
  saveArtifact, memoryStore,
  
  // ═══ Dynamic Tool Installer ═══
  installTool,
  
  // ═══ Subagent Management ═══
  spawnSubagent, checkSubagentStatus, listSubagents,
  
  // ═══ ProjectDiscovery Suite ═══
  ...pdTools,
];

// Tool definitions for the API (OpenAI function calling format)
export const toolDefinitions = tools.map(t => t.definition);

// Executor map: name → execute function
export const toolExecutors = {};
for (const tool of tools) {
  toolExecutors[tool.definition.function.name] = tool.execute;
}

// Tool safety classification
export const safeTools = new Set([
  'read_file', 'list_directory', 'search_files', 'search_glob',
  'web_search', 'tavily_search', 'github_search', 'read_url', 'check_port',
  'shodan_search', 'dns_recon', 'cve_lookup',
  'whois_lookup', 'wayback_machine',
  'hash_generate', 'encode_decode', 'memory_store', 'metasploit_rpc',
  'fofa_search', 'subfinder_enum', 'httpx_probe', 'dnsx_resolve',
  'uncover_search', 'katana_crawl',
]);

export const writeTools = new Set([
  'write_file', 'edit_file', 'bg_interact', 'start_listener',
  'spawn_subagent', 'check_subagent_status', 'list_subagents',
  'save_artifact', 'stealth_browser',
  'nuclei_scan', 'naabu_scan',
]);

export const dangerousTools = new Set([
  'execute_command', 'install_tool',
]);
