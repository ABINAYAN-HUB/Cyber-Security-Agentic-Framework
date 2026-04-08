// OpenClaw Cyber — ProjectDiscovery Tools Integration
// nuclei, subfinder, httpx, naabu, katana, dnsx, uncover
import { execSync } from 'child_process';
import config from '../config.js';
import { memory } from '../memory.js';
import { join } from 'path';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';

function ensureOutputDir() {
  if (!existsSync(config.outputDir)) mkdirSync(config.outputDir, { recursive: true });
}

function checkTool(name) {
  try { execSync(`command -v ${name}`, { stdio: 'ignore', env: getPDEnv() }); return true; } catch {
    return false;
  }
}

// Build environment with PDCP API key for all PD tools
function getPDEnv() {
  const env = { ...process.env };
  const home = process.env.HOME || '/home/blackhat';
  if (env.PATH && !env.PATH.includes(`${home}/go/bin`)) {
    env.PATH = `${home}/go/bin:${env.PATH}`;
  } else if (!env.PATH) {
    env.PATH = `${home}/go/bin`;
  }
  
  if (config.pdcpApiKey) {
    env.PDCP_API_KEY = config.pdcpApiKey;
    env.NUCLEI_CLOUD_API = config.pdcpApiKey; // nuclei cloud auth
  }
  if (config.shodanApiKey) env.SHODAN_API_KEY = config.shodanApiKey;
  return env;
}

// ═══ NUCLEI ═══
export const nucleiDefinition = {
  type: 'function',
  function: {
    name: 'nuclei_scan',
    description: 'Run Nuclei vulnerability scanner with 8000+ templates. Scans for CVEs, misconfigs, exposed panels, default logins, XSS, SQLi, RCE. Auto-stores results in DB.',
    parameters: {
      type: 'object',
      properties: {
        target: { type: 'string', description: 'Target URL, IP, or CIDR' },
        templates: { type: 'string', description: 'Template IDs or paths (comma-separated)' },
        severity: { type: 'string', enum: ['info', 'low', 'medium', 'high', 'critical', 'all'], description: 'Severity filter (default: all)' },
        tags: { type: 'string', description: 'Filter by tags (e.g., "cve,rce,sqli,xss")' },
        rate_limit: { type: 'integer', description: 'Max req/sec (default: 150)' },
        timeout: { type: 'integer', description: 'Timeout seconds (default: 120)' }
      },
      required: ['target']
    }
  }
};

export async function executeNuclei(args) {
  const { target, templates, severity = 'all', tags, rate_limit = 150, timeout = 120 } = args;
  if (!checkTool('nuclei')) return { success: false, error: 'nuclei not installed. Install: go install -v github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest' };

  ensureOutputDir();
  const outDir = join(config.outputDir, 'nuclei-results');
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  const outFile = join(outDir, `nuclei-${Date.now()}.json`);

  let cmd = `nuclei -u "${target}" -jsonl -o "${outFile}" -rate-limit ${rate_limit} -timeout ${Math.min(timeout, 300)} -silent -nc`;
  if (severity !== 'all') cmd += ` -severity ${severity}`;
  if (templates) cmd += ` -t ${templates}`;
  if (tags) cmd += ` -tags ${tags}`;

  try { execSync(cmd, { timeout: (timeout + 30) * 1000, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'], env: getPDEnv() }); } catch {}

  const results = [];
  if (existsSync(outFile)) {
    for (const line of readFileSync(outFile, 'utf-8').trim().split('\n').filter(Boolean)) {
      try {
        const f = JSON.parse(line);
        results.push({
          template_id: f['template-id'] || f.templateID,
          name: f.info?.name, severity: f.info?.severity || 'info',
          matched_at: f['matched-at'] || target, type: f.type || 'http',
          description: f.info?.description?.slice(0, 300),
          tags: f.info?.tags, curl: f['curl-command'],
        });
        try { memory.init(); memory.storeNucleiResult(target, { template_id: f['template-id'], template_name: f.info?.name, severity: f.info?.severity, matched_at: f['matched-at'], raw: f }); } catch {}
      } catch {}
    }
  }
  const s = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const r of results) if (s[r.severity] !== undefined) s[r.severity]++;

  return { success: true, target, total: results.length, severity_summary: s, findings: results.slice(0, 50), output_file: outFile };
}

// ═══ SUBFINDER ═══
export const subfinderDefinition = {
  type: 'function',
  function: {
    name: 'subfinder_enum',
    description: 'Subfinder passive subdomain enumeration. Uses 30+ sources (Shodan, SecurityTrails, VirusTotal, etc.).',
    parameters: {
      type: 'object',
      properties: {
        domain: { type: 'string', description: 'Target domain' },
        recursive: { type: 'boolean', description: 'Enable recursive enum (default: false)' },
        timeout: { type: 'integer', description: 'Timeout seconds (default: 60)' }
      },
      required: ['domain']
    }
  }
};

export async function executeSubfinder(args) {
  const { domain, recursive = false, timeout = 60 } = args;
  if (!checkTool('subfinder')) return { success: false, error: 'subfinder not installed. Install: go install -v github.com/projectdiscovery/subfinder/v2/cmd/subfinder@latest' };

  let cmd = `subfinder -d "${domain}" -silent -nc -timeout ${timeout}`;
  if (recursive) cmd += ' -recursive';

  try {
    const out = execSync(cmd, { timeout: (timeout + 30) * 1000, encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024, env: getPDEnv() });
    const subs = out.trim().split('\n').filter(Boolean);
    try { memory.init(); memory.storeScanResult('subdomain_enum', domain, 'subfinder', { services: subs, raw: out.slice(0, 10000) }); } catch {}
    return { success: true, domain, total: subs.length, subdomains: subs.slice(0, 200) };
  } catch (err) { return { success: false, error: err.stderr || err.message }; }
}

// ═══ HTTPX ═══
export const httpxDefinition = {
  type: 'function',
  function: {
    name: 'httpx_probe',
    description: 'httpx HTTP probing — discovers web servers, status codes, titles, tech stack from hosts/IPs.',
    parameters: {
      type: 'object',
      properties: {
        targets: { type: 'string', description: 'Comma-separated targets (URLs, IPs, domains)' },
        ports: { type: 'string', description: 'Custom ports (e.g., "80,443,8080")' },
        tech_detect: { type: 'boolean', description: 'Technology detection (default: true)' },
        timeout: { type: 'integer', description: 'Timeout seconds (default: 30)' }
      },
      required: ['targets']
    }
  }
};

export async function executeHttpx(args) {
  const { targets, ports, tech_detect = true, timeout = 30 } = args;
  if (!checkTool('httpx')) return { success: false, error: 'httpx not installed. Install: go install -v github.com/projectdiscovery/httpx/cmd/httpx@latest' };

  ensureOutputDir();
  const inputFile = join(config.outputDir, `httpx-in-${Date.now()}.txt`);
  writeFileSync(inputFile, targets.split(',').map(t => t.trim()).join('\n'));

  let cmd = `httpx -l "${inputFile}" -json -silent -nc -timeout ${timeout} -status-code -title -web-server -content-length`;
  if (ports) cmd += ` -ports ${ports}`;
  if (tech_detect) cmd += ' -tech-detect';
  cmd += ' -follow-redirects';

  try {
    const out = execSync(cmd, { timeout: (timeout + 60) * 1000, encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024, env: getPDEnv() });
    const results = out.trim().split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean)
      .map(r => ({ url: r.url, status: r.status_code, title: r.title, server: r.webserver, tech: r.tech || [], length: r.content_length }));
    return { success: true, total: results.length, results: results.slice(0, 100) };
  } catch (err) { return { success: false, error: err.stderr || err.message }; }
}

// ═══ NAABU ═══
export const naabuDefinition = {
  type: 'function',
  function: {
    name: 'naabu_scan',
    description: 'Naabu fast port scanner — SYN/CONNECT scan. Faster than nmap for large-scale port discovery.',
    parameters: {
      type: 'object',
      properties: {
        target: { type: 'string', description: 'Target IP, CIDR, or domain' },
        ports: { type: 'string', description: 'Ports (e.g., "80,443", "1-1000", "top-100", "full")' },
        rate: { type: 'integer', description: 'Packets/sec (default: 1000)' },
        timeout: { type: 'integer', description: 'Timeout seconds (default: 60)' }
      },
      required: ['target']
    }
  }
};

export async function executeNaabu(args) {
  const { target, ports = 'top-100', rate = 1000, timeout = 60 } = args;
  if (!checkTool('naabu')) return { success: false, error: 'naabu not installed. Install: go install -v github.com/projectdiscovery/naabu/v2/cmd/naabu@latest' };

  let cmd = `naabu -host "${target}" -json -silent -nc -rate ${rate}`;
  if (ports === 'full') cmd += ' -p -';
  else if (ports.startsWith('top-')) cmd += ` -top-ports ${ports.replace('top-', '')}`;
  else cmd += ` -p ${ports}`;

  try {
    const out = execSync(cmd, { timeout: (timeout + 30) * 1000, encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024, env: getPDEnv() });
    const results = out.trim().split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean)
      .map(r => ({ ip: r.ip || r.host, port: r.port, protocol: r.protocol || 'tcp' }));
    try { memory.init(); memory.storeScanResult('port_scan', target, 'naabu', { ports: results.map(r => r.port), raw: out.slice(0, 5000) }); } catch {}
    return { success: true, target, total: results.length, open_ports: results };
  } catch (err) { return { success: false, error: err.stderr || err.message }; }
}

// ═══ KATANA ═══
export const katanaDefinition = {
  type: 'function',
  function: {
    name: 'katana_crawl',
    description: 'Katana web crawler — discovers URLs, endpoints, params, JS files, API routes, hidden paths.',
    parameters: {
      type: 'object',
      properties: {
        target: { type: 'string', description: 'Target URL' },
        depth: { type: 'integer', description: 'Crawl depth (default: 3)' },
        js_crawl: { type: 'boolean', description: 'Parse JS (default: true)' },
        headless: { type: 'boolean', description: 'Use headless browser (default: false)' },
        timeout: { type: 'integer', description: 'Timeout seconds (default: 60)' }
      },
      required: ['target']
    }
  }
};

export async function executeKatana(args) {
  const { target, depth = 3, js_crawl = true, headless = false, timeout = 60 } = args;
  if (!checkTool('katana')) return { success: false, error: 'katana not installed. Install: go install -v github.com/projectdiscovery/katana/cmd/katana@latest' };

  let cmd = `katana -u "${target}" -d ${depth} -silent -nc -timeout ${timeout}`;
  if (js_crawl) cmd += ' -js-crawl';
  if (headless) cmd += ' -headless';

  try {
    const out = execSync(cmd, { timeout: (timeout + 60) * 1000, encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024, env: getPDEnv() });
    const urls = out.trim().split('\n').filter(Boolean);
    const apis = urls.filter(u => /\/api\//i.test(u) || /\.(json|xml|graphql)/i.test(u));
    const params = urls.filter(u => /\?.*=/i.test(u));
    const js = urls.filter(u => /\.js(\?|$)/i.test(u));
    return { success: true, target, total: urls.length, summary: { apis: apis.length, params: params.length, js: js.length }, api_endpoints: apis.slice(0, 30), parameterized: params.slice(0, 30), js_files: js.slice(0, 20), all_urls: urls.slice(0, 100) };
  } catch (err) { return { success: false, error: err.stderr || err.message }; }
}

// ═══ DNSX ═══
export const dnsxDefinition = {
  type: 'function',
  function: {
    name: 'dnsx_resolve',
    description: 'dnsx fast DNS resolution — A, AAAA, CNAME, MX, NS, TXT, SOA, PTR records with wildcard filtering.',
    parameters: {
      type: 'object',
      properties: {
        targets: { type: 'string', description: 'Comma-separated domains' },
        record_types: { type: 'string', description: 'Record types: a,aaaa,cname,mx,ns,txt (default: a)' },
        timeout: { type: 'integer', description: 'Timeout seconds (default: 30)' }
      },
      required: ['targets']
    }
  }
};

export async function executeDnsx(args) {
  const { targets, record_types = 'a', timeout = 30 } = args;
  if (!checkTool('dnsx')) return { success: false, error: 'dnsx not installed. Install: go install -v github.com/projectdiscovery/dnsx/cmd/dnsx@latest' };

  ensureOutputDir();
  const inputFile = join(config.outputDir, `dnsx-in-${Date.now()}.txt`);
  writeFileSync(inputFile, targets.split(',').map(t => t.trim()).join('\n'));
  let cmd = `dnsx -l "${inputFile}" -json -silent -nc -timeout ${timeout} -resp`;
  for (const rt of record_types.split(',')) cmd += ` -${rt.trim()}`;

  try {
    const out = execSync(cmd, { timeout: (timeout + 30) * 1000, encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024, env: getPDEnv() });
    const results = out.trim().split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
    return { success: true, total: results.length, results: results.slice(0, 100) };
  } catch (err) { return { success: false, error: err.stderr || err.message }; }
}

// ═══ UNCOVER ═══
export const uncoverDefinition = {
  type: 'function',
  function: {
    name: 'uncover_search',
    description: 'Uncover — aggregates Shodan, Censys, FOFA, Hunter, Quake, ZoomEye, Netlas into one query.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        engine: { type: 'string', enum: ['shodan', 'censys', 'fofa', 'hunter', 'quake', 'zoomeye', 'netlas', 'all'], description: 'Engine (default: shodan)' },
        limit: { type: 'integer', description: 'Max results (default: 100)' },
        timeout: { type: 'integer', description: 'Timeout seconds (default: 30)' }
      },
      required: ['query']
    }
  }
};

export async function executeUncover(args) {
  const { query, engine = 'shodan', limit = 100, timeout = 30 } = args;
  if (!checkTool('uncover')) return { success: false, error: 'uncover not installed. Install: go install -v github.com/projectdiscovery/uncover/cmd/uncover@latest' };

  let cmd = `uncover -q "${query}" -json -silent -nc -limit ${limit} -timeout ${timeout}`;
  if (engine !== 'all') cmd += ` -e ${engine}`;

  try {
    const out = execSync(cmd, { timeout: (timeout + 30) * 1000, encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024, env: getPDEnv() });
    const results = out.trim().split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch { return { host: l.trim() }; } }).filter(Boolean);
    return { success: true, query, engine, total: results.length, results: results.slice(0, 100) };
  } catch (err) { return { success: false, error: err.stderr || err.message }; }
}
