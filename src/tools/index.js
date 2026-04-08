// OpenClaw Cyber — Tool Registry
// Exports all 50+ tool definitions and executors
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

// ═══ OPENCLAW CYBER TOOLS ═══
import * as shodanSearch from './shodan-search.js';
import * as whoisLookup from './whois-lookup.js';
import * as dnsRecon from './dns-recon.js';
import * as cveLookup from './cve-lookup.js';
import * as exploitSearch from './exploit-search.js';
import * as tavilySearch from './tavily-search.js';
import * as githubSearch from './github-search.js';
import * as hashCrack from './hash-crack.js';
import * as hashGenerate from './hash-generate.js';
import * as portScanner from './port-scanner.js';
import * as subdomainEnum from './subdomain-enum.js';
import * as headerAnalysis from './header-analysis.js';
import * as sslScan from './ssl-scan.js';
import * as stealthBrowser from './stealth-browser.js';
import * as payloadGenerate from './payload-generate.js';
import * as encodeDecode from './encode-decode.js';
import * as ipGeolocation from './ip-geolocation.js';
import * as waybackMachine from './wayback-machine.js';
import * as techDetect from './tech-detect.js';
import * as emailHarvester from './email-harvester.js';
import * as wafDetector from './waf-detector.js';
import * as fuzzEngine from './fuzz-engine.js';
import * as metasploitRpc from './metasploit-rpc.js';
import * as cloudEnum from './cloud-enum.js';
import * as saveArtifact from './save-artifact.js';
import * as memoryStore from './memory-store.js';
import * as firewallAnalyzer from './firewall-analyzer.js';
import * as networkSniffer from './network-sniffer.js';

// ═══ FOFA ═══
import * as fofaSearch from './fofa-search.js';

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
  
  // ═══ Search & Intelligence ═══
  webSearch, tavilySearch, githubSearch, readUrl, stealthBrowser,
  
  // ═══ Reconnaissance ═══
  shodanSearch, portScanner, dnsRecon, subdomainEnum,
  whoisLookup, ipGeolocation, techDetect, headerAnalysis,
  sslScan, wafDetector, firewallAnalyzer, cloudEnum,
  emailHarvester, waybackMachine,
  
  // ═══ FOFA ═══
  fofaSearch,

  // ═══ Vulnerability Research ═══
  cveLookup, exploitSearch, metasploitRpc,
  
  // ═══ Attack Tools ═══
  payloadGenerate, fuzzEngine, encodeDecode,
  hashCrack, hashGenerate, networkSniffer,
  
  // ═══ Data Management ═══
  saveArtifact, memoryStore,
  
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
  'shodan_search', 'dns_recon', 'cve_lookup', 'exploit_search',
  'whois_lookup', 'ip_geolocation', 'wayback_machine', 'tech_detect',
  'header_analysis', 'ssl_scan', 'waf_detector', 'cloud_enum',
  'subdomain_enum', 'email_harvester', 'hash_crack', 'hash_generate',
  'encode_decode', 'memory_store', 'metasploit_rpc',
  'fofa_search', 'subfinder_enum', 'httpx_probe', 'dnsx_resolve',
  'uncover_search', 'katana_crawl',
]);

export const writeTools = new Set([
  'write_file', 'edit_file', 'bg_interact', 'start_listener',
  'spawn_subagent', 'check_subagent_status', 'list_subagents',
  'save_artifact', 'stealth_browser', 'payload_generate',
  'fuzz_engine', 'port_scanner', 'nuclei_scan', 'naabu_scan',
]);

export const dangerousTools = new Set([
  'execute_command', 'network_sniffer', 'firewall_analyzer',
]);
