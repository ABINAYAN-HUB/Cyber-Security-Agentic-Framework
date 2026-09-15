// Jarvis Cyber — Supply Chain Attack View
// Dedicated tab for supply chain security: scan projects, detect typosquatting,
// CI/CD exploits, dependency confusion, Docker supply chain, SBOM generation
import { Chart } from '../components/chart.js';

export class SupplyChainView {
  constructor(app) {
    this.app = app;
    this.scanResults = null;
    this.scanInProgress = false;
  }

  async render(container) {
    container.innerHTML = this.buildHTML();
    this.setupHandlers(container);
  }

  teardown() { /* nothing to clean */ }

  buildHTML() {
    return `
      <!-- Supply Chain Hero -->
      <div class="glass-panel mb-6 sc-hero">
        <div class="flex items-center gap-4" style="flex-wrap:wrap;">
          <div style="flex:1; min-width:240px;">
            <div class="sc-hero-title">
              <span class="sc-hero-icon">🔗</span>
              <span>Supply Chain Attack Center</span>
            </div>
            <div class="text-sm text-muted" style="margin-top:6px; max-width:600px;">
              Master-level supply chain security analysis. Detect typosquatting, dependency confusion,
              CI/CD pipeline exploits, Docker supply chain poisoning, hardcoded secrets, and generate SBOM.
              Supports npm, PyPI, Maven, Go, Cargo, Composer, and RubyGems ecosystems.
            </div>
          </div>
          <div class="sc-hero-badges">
            <span class="sc-badge sc-badge-npm">npm</span>
            <span class="sc-badge sc-badge-pypi">PyPI</span>
            <span class="sc-badge sc-badge-maven">Maven</span>
            <span class="sc-badge sc-badge-go">Go</span>
            <span class="sc-badge sc-badge-cargo">Cargo</span>
            <span class="sc-badge sc-badge-ruby">Ruby</span>
          </div>
        </div>
      </div>

      <!-- Scan Controls -->
      <div class="glass-panel mb-6 sc-scan-panel">
        <div class="panel-header">
          <span class="panel-title">🎯 Supply Chain Scanner</span>
          <span class="panel-subtitle">Scan any project or repository</span>
        </div>
        <div style="padding: var(--sp-4);">
          <div class="flex gap-3" style="flex-wrap:wrap;">
            <input type="text" class="input" id="sc-target" placeholder="Path to project directory or Git repo URL..." style="flex:1; min-width:250px;">
            <select class="input" id="sc-scan-type" style="width:180px;">
              <option value="full">🔍 Full Scan</option>
              <option value="dependencies">📦 Dependencies</option>
              <option value="typosquatting">🎭 Typosquatting</option>
              <option value="dependency_confusion">💥 Dep Confusion</option>
              <option value="cicd">⚙️ CI/CD Pipeline</option>
              <option value="docker">🐳 Docker</option>
              <option value="secrets">🔐 Secrets</option>
              <option value="sbom">📋 SBOM Only</option>
            </select>
            <button class="btn btn-primary btn-lg" id="sc-scan-btn" style="white-space:nowrap;">
              ⚡ Scan Now
            </button>
          </div>
          <div class="sc-quick-actions">
            <button class="sc-quick-btn" data-target="." data-type="full">📁 Scan This Project</button>
            <button class="sc-quick-btn" data-target="." data-type="cicd">⚙️ Audit CI/CD</button>
            <button class="sc-quick-btn" data-target="." data-type="docker">🐳 Docker Check</button>
            <button class="sc-quick-btn" data-target="." data-type="secrets">🔐 Find Secrets</button>
            <button class="sc-quick-btn" data-target="." data-type="sbom">📋 Generate SBOM</button>
          </div>
        </div>
        <div id="sc-progress" style="display:none; padding: 0 var(--sp-4) var(--sp-4);">
          <div style="height:4px; background:rgba(255,255,255,0.06); border-radius:4px; overflow:hidden;">
            <div id="sc-progress-bar" class="sc-progress-bar"></div>
          </div>
          <div class="text-xs text-muted" style="margin-top:4px;" id="sc-progress-text">Scanning...</div>
        </div>
      </div>

      <!-- Package Lookup -->
      <div class="glass-panel mb-6">
        <div class="panel-header">
          <span class="panel-title">🔎 Package Vulnerability Lookup</span>
          <span class="panel-subtitle">Check any package for known supply chain threats</span>
        </div>
        <div style="padding: var(--sp-4);">
          <div class="flex gap-3" style="flex-wrap:wrap;">
            <input type="text" class="input" id="sc-pkg-name" placeholder="Package name (e.g., lodash, requests, log4j)..." style="flex:1; min-width:200px;">
            <select class="input" id="sc-pkg-eco" style="width:140px;">
              <option value="npm">npm</option>
              <option value="PyPI">PyPI</option>
              <option value="Maven">Maven</option>
              <option value="Go">Go</option>
              <option value="crates.io">Cargo</option>
              <option value="RubyGems">Ruby</option>
              <option value="Packagist">PHP</option>
              <option value="NuGet">NuGet</option>
            </select>
            <button class="btn btn-primary" id="sc-pkg-btn">🔍 Lookup</button>
          </div>
          <div id="sc-pkg-results" style="margin-top: var(--sp-3);"></div>
        </div>
      </div>

      <!-- Attack Vectors Reference -->
      <div class="glass-panel mb-6">
        <div class="panel-header">
          <span class="panel-title">⚔️ Supply Chain Attack Vectors</span>
          <span class="panel-subtitle">Attack patterns this scanner detects</span>
        </div>
        <div class="sc-attack-grid">
          ${this._renderAttackVectorCards()}
        </div>
      </div>

      <!-- Scan Results Area -->
      <div id="sc-results-area"></div>
    `;
  }

  _renderAttackVectorCards() {
    const vectors = [
      { icon: '🎭', name: 'Typosquatting', desc: 'Malicious packages with names similar to popular ones (e.g., "lodahs" instead of "lodash")', severity: 'HIGH', mitre: 'T1195.001' },
      { icon: '💥', name: 'Dependency Confusion', desc: 'Exploiting private/public package name collisions to inject malicious code', severity: 'CRITICAL', mitre: 'T1195.002' },
      { icon: '🐛', name: 'Vulnerable Dependencies', desc: 'Known CVEs in project dependencies (transitive and direct)', severity: 'VARIES', mitre: 'T1195' },
      { icon: '⚙️', name: 'CI/CD Pipeline Injection', desc: 'Exploiting GitHub Actions, GitLab CI, Jenkins for code execution with secrets', severity: 'CRITICAL', mitre: 'T1195.002' },
      { icon: '🐳', name: 'Container Poisoning', desc: 'Compromised base images, unpinned tags, secrets in layers', severity: 'HIGH', mitre: 'T1195.003' },
      { icon: '🔐', name: 'Secret Leakage', desc: 'API keys, tokens, and credentials exposed in source code', severity: 'CRITICAL', mitre: 'T1552' },
      { icon: '👤', name: 'Maintainer Takeover', desc: 'Legitimate package hijacked by attacker via social engineering', severity: 'CRITICAL', mitre: 'T1195.001' },
      { icon: '📦', name: 'Malicious Update', desc: 'Clean package pushes compromised version (event-stream attack)', severity: 'CRITICAL', mitre: 'T1195.002' },
    ];

    return vectors.map(v => `
      <div class="sc-vector-card">
        <div class="sc-vector-icon">${v.icon}</div>
        <div class="sc-vector-info">
          <div class="sc-vector-name">${v.name}</div>
          <div class="sc-vector-desc">${v.desc}</div>
          <div class="sc-vector-meta">
            <span class="badge ${v.severity === 'CRITICAL' ? 'critical' : v.severity === 'HIGH' ? 'high' : 'medium'}" style="font-size:0.6rem;">${v.severity}</span>
            <span class="sc-vector-mitre">MITRE: ${v.mitre}</span>
          </div>
        </div>
      </div>
    `).join('');
  }

  setupHandlers(container) {
    // Main scan button
    const scanBtn = container.querySelector('#sc-scan-btn');
    scanBtn?.addEventListener('click', () => this._runScan(container));

    // Enter key on input
    container.querySelector('#sc-target')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this._runScan(container);
    });

    // Quick action buttons
    container.querySelectorAll('.sc-quick-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelector('#sc-target').value = btn.dataset.target;
        container.querySelector('#sc-scan-type').value = btn.dataset.type;
        this._runScan(container);
      });
    });

    // Package lookup
    const pkgBtn = container.querySelector('#sc-pkg-btn');
    pkgBtn?.addEventListener('click', () => this._lookupPackage(container));
    container.querySelector('#sc-pkg-name')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this._lookupPackage(container);
    });
  }

  async _runScan(container) {
    const target = container.querySelector('#sc-target')?.value?.trim() || '.';
    const scanType = container.querySelector('#sc-scan-type')?.value || 'full';
    const btn = container.querySelector('#sc-scan-btn');
    const progress = container.querySelector('#sc-progress');
    const progressBar = container.querySelector('#sc-progress-bar');
    const progressText = container.querySelector('#sc-progress-text');
    const resultsArea = container.querySelector('#sc-results-area');

    if (this.scanInProgress) return;
    this.scanInProgress = true;

    btn.disabled = true;
    btn.innerHTML = '<div class="spinner" style="width:16px;height:16px;display:inline-block;"></div> Scanning...';
    progress.style.display = 'block';
    progressBar.style.width = '10%';
    progressText.textContent = `🔍 Analyzing ${target}...`;

    // Animate progress
    let pct = 10;
    const interval = setInterval(() => {
      pct = Math.min(pct + Math.random() * 8, 90);
      progressBar.style.width = pct + '%';
      const phases = ['Detecting ecosystems...', 'Parsing dependencies...', 'Querying OSV.dev...', 'Checking typosquatting...', 'Scanning CI/CD pipelines...', 'Analyzing Dockerfiles...', 'Scanning for secrets...', 'Generating SBOM...'];
      progressText.textContent = `⚡ ${phases[Math.floor(Math.random() * phases.length)]}`;
    }, 800);

    try {
      const data = await this.app.apiPost('/supply-chain/scan', { target, scan_type: scanType, ecosystem: 'auto' });
      clearInterval(interval);
      progressBar.style.width = '100%';
      progressText.textContent = '✅ Scan complete!';

      this.scanResults = data;
      if (data && data.success) {
        resultsArea.innerHTML = this._renderResults(data);
      } else {
        resultsArea.innerHTML = `<div class="glass-panel"><div style="padding:var(--sp-4);"><div class="text-sm text-muted">⚠️ Scan failed: ${data?.error || 'Unknown error'}</div></div></div>`;
      }
    } catch (err) {
      clearInterval(interval);
      progressBar.style.width = '100%';
      progressText.textContent = '❌ Scan failed';
      resultsArea.innerHTML = `<div class="glass-panel"><div style="padding:var(--sp-4);"><div class="text-sm text-muted">Error: ${err.message}</div></div></div>`;
    }

    btn.disabled = false;
    btn.innerHTML = '⚡ Scan Now';
    this.scanInProgress = false;
    setTimeout(() => { progress.style.display = 'none'; }, 2000);
  }

  _renderResults(data) {
    const { findings, summary, ecosystems_detected, duration_ms, sbom } = data;
    const hasFin = findings && findings.length > 0;

    // Group findings by type
    const groups = {};
    for (const f of findings || []) {
      const t = f.type || 'unknown';
      if (!groups[t]) groups[t] = [];
      groups[t].push(f);
    }

    // Severity donut data
    const donutData = [
      { label: 'Critical', value: summary.critical, color: '#f43f5e' },
      { label: 'High', value: summary.high, color: '#f59e0b' },
      { label: 'Medium', value: summary.medium, color: '#8b5cf6' },
      { label: 'Low', value: summary.low, color: '#10b981' },
    ].filter(d => d.value > 0);

    const typeLabels = {
      vulnerable_dependency: { icon: '🐛', label: 'Vulnerable Dependencies' },
      native_audit: { icon: '📦', label: 'Native Audit Findings' },
      typosquatting_risk: { icon: '🎭', label: 'Typosquatting Risks' },
      dependency_confusion: { icon: '💥', label: 'Dependency Confusion' },
      cicd_unpinned_action: { icon: '📌', label: 'Unpinned CI/CD Actions' },
      cicd_dangerous_trigger: { icon: '⚠️', label: 'Dangerous Triggers' },
      cicd_script_injection: { icon: '💉', label: 'Script Injection' },
      cicd_checkout_exploit: { icon: '🚨', label: 'Checkout Exploit' },
      cicd_hardcoded_secret: { icon: '🔑', label: 'Hardcoded Secrets (CI/CD)' },
      cicd_excessive_permissions: { icon: '🔓', label: 'Excessive Permissions' },
      cicd_curl_pipe_sh: { icon: '💀', label: 'curl | sh Patterns' },
      cicd_remote_include: { icon: '🌐', label: 'Remote Includes' },
      cicd_jenkins_injection: { icon: '💉', label: 'Jenkins Injection' },
      cicd_untrusted_action: { icon: '❓', label: 'Untrusted Actions' },
      docker_unpinned_base: { icon: '🐳', label: 'Unpinned Base Images' },
      docker_add_url: { icon: '🔗', label: 'ADD from URL' },
      docker_curl_pipe_sh: { icon: '💀', label: 'Docker curl | sh' },
      docker_root_user: { icon: '👤', label: 'Root Container' },
      docker_no_tls_verify: { icon: '🔓', label: 'TLS Disabled' },
      docker_secret_in_env: { icon: '🔑', label: 'Secrets in ENV' },
      docker_privileged: { icon: '🚨', label: 'Privileged Container' },
      docker_host_network: { icon: '🌐', label: 'Host Network' },
      docker_multistage_leak: { icon: '📤', label: 'Multi-stage Leak' },
      hardcoded_secret: { icon: '🔐', label: 'Hardcoded Secrets' },
    };

    let html = '';

    // Summary stats
    html += `
      <div class="stats-grid mb-6" style="grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));">
        <div class="glass-panel stat-card glow-rose"><span class="stat-icon">🚨</span><div class="stat-value" style="color:#f43f5e;">${summary.critical}</div><div class="stat-label">Critical</div></div>
        <div class="glass-panel stat-card" style="border-color:rgba(245,158,11,0.2);"><span class="stat-icon">⚠️</span><div class="stat-value" style="color:#f59e0b;">${summary.high}</div><div class="stat-label">High</div></div>
        <div class="glass-panel stat-card glow-violet"><span class="stat-icon">🔶</span><div class="stat-value" style="color:#8b5cf6;">${summary.medium}</div><div class="stat-label">Medium</div></div>
        <div class="glass-panel stat-card glow-emerald"><span class="stat-icon">🟢</span><div class="stat-value" style="color:#10b981;">${summary.low}</div><div class="stat-label">Low</div></div>
        <div class="glass-panel stat-card glow-cyan"><span class="stat-icon">📊</span><div class="stat-value">${summary.total}</div><div class="stat-label">Total Issues</div></div>
        <div class="glass-panel stat-card"><span class="stat-icon">📦</span><div class="stat-value">${ecosystems_detected.length}</div><div class="stat-label">Ecosystems</div></div>
        <div class="glass-panel stat-card"><span class="stat-icon">⏱️</span><div class="stat-value">${(duration_ms / 1000).toFixed(1)}s</div><div class="stat-label">Scan Time</div></div>
      </div>
    `;

    // Donut + eco badges
    if (donutData.length > 0) {
      html += `
        <div class="grid-2 mb-6">
          <div class="glass-panel glow-rose">
            <div class="panel-header"><span class="panel-title">📊 Risk Distribution</span></div>
            <div class="flex items-center gap-6" style="justify-content:center; padding: var(--sp-4);">
              ${Chart.donut(donutData, { size: 160, centerLabel: 'Findings' })}
              <div class="flex flex-col gap-2">
                ${donutData.map(d => `<div class="flex items-center gap-2"><div style="width:10px;height:10px;border-radius:50%;background:${d.color};"></div><span class="text-sm">${d.label}</span><span class="text-mono text-sm text-muted" style="margin-left:auto;">${d.value}</span></div>`).join('')}
              </div>
            </div>
          </div>
          <div class="glass-panel">
            <div class="panel-header"><span class="panel-title">🌐 Detected Ecosystems</span></div>
            <div style="padding: var(--sp-4); display:flex; flex-wrap:wrap; gap:8px; align-items:center; justify-content:center; min-height:120px;">
              ${ecosystems_detected.map(e => `<span class="sc-badge sc-badge-${e}" style="font-size:0.85rem; padding:6px 14px;">${e}</span>`).join('')}
              ${ecosystems_detected.length === 0 ? '<span class="text-sm text-muted">No ecosystems detected</span>' : ''}
            </div>
          </div>
        </div>
      `;
    }

    // Grouped findings
    if (hasFin) {
      for (const [type, items] of Object.entries(groups)) {
        const info = typeLabels[type] || { icon: '•', label: type };
        const maxSev = items.reduce((max, f) => {
          const order = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };
          return (order[f.severity] || 0) > (order[max] || 0) ? f.severity : max;
        }, 'info');
        const borderColor = maxSev === 'critical' ? 'rgba(244,63,94,0.25)' : maxSev === 'high' ? 'rgba(245,158,11,0.2)' : 'rgba(139,92,246,0.15)';

        html += `
          <div class="glass-panel mb-4" style="border-color:${borderColor};">
            <div class="panel-header">
              <span class="panel-title">${info.icon} ${info.label}</span>
              <span class="panel-subtitle">${items.length} finding${items.length !== 1 ? 's' : ''}</span>
            </div>
            <div class="scroll-container" style="max-height:400px;">
              <table class="data-table">
                <thead><tr><th>Severity</th><th>Package</th><th>Issue</th><th>Location</th><th>Fix</th></tr></thead>
                <tbody>
                  ${items.map(f => `
                    <tr>
                      <td><span class="badge ${(f.severity || 'info').toLowerCase()}">${(f.severity || 'INFO').toUpperCase()}</span></td>
                      <td class="mono text-cyan" style="white-space:nowrap;">${this._esc(f.package || '—')}</td>
                      <td class="text-sm" style="max-width:300px;"><div class="truncate">${this._esc(f.summary || '')}</div></td>
                      <td class="mono text-muted text-sm" style="white-space:nowrap;">${this._esc(f.location || '—')}</td>
                      <td class="text-sm" style="max-width:250px;"><div class="truncate">${this._esc(f.remediation || '—')}</div></td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        `;
      }
    } else {
      html += `
        <div class="glass-panel mb-4">
          <div style="padding: var(--sp-6); text-align:center;">
            <div style="font-size:2rem; margin-bottom:8px;">✅</div>
            <div class="text-lg" style="font-weight:700; color:var(--emerald);">No Supply Chain Issues Found</div>
            <div class="text-sm text-muted" style="margin-top:4px;">The scanned project appears clean. Keep scanning regularly.</div>
          </div>
        </div>
      `;
    }

    // SBOM
    if (sbom && sbom.components && sbom.components.length > 0) {
      html += `
        <div class="glass-panel mb-4" style="border-color:rgba(6,182,212,0.2);">
          <div class="panel-header">
            <span class="panel-title">📋 Software Bill of Materials (SBOM)</span>
            <span class="panel-subtitle">${sbom.components.length} components — CycloneDX ${sbom.specVersion}</span>
          </div>
          <div class="scroll-container" style="max-height:300px;">
            <table class="data-table">
              <thead><tr><th>Package</th><th>Version</th><th>Ecosystem</th><th>PURL</th></tr></thead>
              <tbody>
                ${sbom.components.slice(0, 100).map(c => `
                  <tr>
                    <td class="mono text-cyan">${this._esc(c.name)}</td>
                    <td class="mono">${this._esc(c.version)}</td>
                    <td>${this._esc(c.purl?.split(':')[1]?.split('/')[0] || '—')}</td>
                    <td class="text-xs text-muted mono"><div class="truncate" style="max-width:250px;">${this._esc(c.purl || '')}</div></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    return html;
  }

  async _lookupPackage(container) {
    const name = container.querySelector('#sc-pkg-name')?.value?.trim();
    const eco = container.querySelector('#sc-pkg-eco')?.value;
    const resultsEl = container.querySelector('#sc-pkg-results');
    if (!name || !resultsEl) return;

    resultsEl.innerHTML = '<div class="flex items-center gap-2"><div class="spinner"></div><span class="text-sm text-muted">Querying OSV.dev...</span></div>';

    try {
      const data = await this.app.apiPost('/supply-chain/lookup', { package_name: name, ecosystem: eco });

      if (!data || !data.success) {
        resultsEl.innerHTML = `<div class="text-sm text-muted">❌ ${data?.error || 'Lookup failed'}</div>`;
        return;
      }

      const riskColor = data.risk_level === 'HIGH' ? '#f43f5e' : data.risk_level === 'MEDIUM' ? '#f59e0b' : '#10b981';
      let html = `
        <div style="padding:12px; border-radius:8px; background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.06);">
          <div class="flex items-center gap-3" style="margin-bottom:8px;">
            <span class="mono text-cyan" style="font-weight:700; font-size:1rem;">${this._esc(name)}</span>
            <span class="badge" style="background:rgba(255,255,255,0.05); font-size:0.7rem;">${this._esc(eco)}</span>
            <span class="badge" style="background:${riskColor}22; color:${riskColor}; font-size:0.7rem;">RISK: ${data.risk_level}</span>
          </div>
          <div class="text-sm text-muted" style="margin-bottom:8px;">${data.total_vulns} known vulnerabilities</div>
      `;

      if (data.typosquatting_risk?.is_risky) {
        html += `<div style="padding:8px; border-radius:6px; background:rgba(244,63,94,0.08); border:1px solid rgba(244,63,94,0.2); margin-bottom:8px;">
          <span class="text-sm" style="color:#f43f5e; font-weight:600;">⚠️ Typosquatting Risk:</span>
          <span class="text-sm text-muted"> Similar to popular package "${data.typosquatting_risk.similar_to}" (edit distance: ${data.typosquatting_risk.edit_distance})</span>
        </div>`;
      }

      if (data.vulnerabilities?.length > 0) {
        html += `<table class="data-table" style="margin-top:8px;"><thead><tr><th>ID</th><th>Summary</th><th>Severity</th><th>Fix</th></tr></thead><tbody>`;
        for (const v of data.vulnerabilities.slice(0, 15)) {
          html += `<tr><td class="mono text-cyan" style="white-space:nowrap;">${this._esc(v.id)}</td><td class="text-sm" style="max-width:300px;"><div class="truncate">${this._esc(v.summary)}</div></td><td><span class="badge ${v.severity}">${v.severity?.toUpperCase()}</span></td><td class="mono text-sm">${this._esc(v.fixed || '—')}</td></tr>`;
        }
        html += `</tbody></table>`;
      }

      html += `</div>`;
      resultsEl.innerHTML = html;
    } catch (err) {
      resultsEl.innerHTML = `<div class="text-sm text-muted">Error: ${err.message}</div>`;
    }
  }

  _esc(str) { return str ? String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') : ''; }
}
