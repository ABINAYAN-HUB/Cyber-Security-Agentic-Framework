// Jarvis Cyber — Threat Intelligence View
// Enhanced: full CVE details, exploit name search, clickable CVE detail panel
import { Chart } from '../components/chart.js';

export class IntelView {
  constructor(app) {
    this.app = app;
  }

  async render(container) {
    container.innerHTML = '<div class="glass-panel"><div class="skeleton skeleton-card" style="height:200px;"></div></div>';

    const [intel, learningStats, attackMemory, bronStats] = await Promise.all([
      this.app.api('/threat-intel?limit=50'),
      this.app.api('/learning-stats'),
      this.app.api('/attack-memory-stats'),
      this.app.api('/bron/stats').catch(() => ({ connected: false })),
    ]);

    container.innerHTML = this.buildHTML(intel, learningStats, attackMemory, bronStats);
    this.setupHandlers();
  }

  teardown() {
    // Remove any open detail panel
    const overlay = document.querySelector('.cve-detail-overlay');
    if (overlay) overlay.remove();
  }

  buildHTML(intel, learningStats, attackMemory, bronStats) {
    const i = intel || {};
    const cves = i.cves || [];
    const ls = learningStats || [];
    const am = attackMemory || {};
    const bron = bronStats || {};

    // Severity distribution
    const severityCounts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, UNKNOWN: 0 };
    cves.forEach(c => {
      const sev = (c.severity || 'UNKNOWN').toUpperCase();
      if (severityCounts[sev] !== undefined) severityCounts[sev]++;
      else severityCounts.UNKNOWN++;
    });

    const donutData = [
      { label: 'Critical', value: severityCounts.CRITICAL, color: '#f43f5e' },
      { label: 'High', value: severityCounts.HIGH, color: '#f59e0b' },
      { label: 'Medium', value: severityCounts.MEDIUM, color: '#8b5cf6' },
      { label: 'Low', value: severityCounts.LOW, color: '#10b981' },
    ].filter(d => d.value > 0);

    // Learning stats table
    let learningHtml = '';
    if (ls.length > 0) {
      learningHtml = `
        <table class="data-table">
          <thead><tr><th>Source</th><th>Type</th><th>Items</th><th>Last Fetch</th></tr></thead>
          <tbody>
            ${ls.map(s => `
              <tr>
                <td><span class="text-cyan">${s.source}</span>${this.getSourceBadge(s.source)}</td>
                <td>${s.resource_type}</td>
                <td class="mono">${s.total_items || s.count || 0}</td>
                <td class="mono text-muted">${s.last_fetch || 'Never'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } else {
      learningHtml = '<div class="text-sm text-muted" style="padding:var(--sp-4);">No learning data. Run <code>jarvis --learn</code> or enable daemon mode.</div>';
    }

    // CVE table — now with clickable rows and description preview
    let cveTableHtml = '';
    if (cves.length > 0) {
      cveTableHtml = `
        <table class="data-table">
          <thead>
            <tr><th>CVE ID</th><th>Title</th><th>Severity</th><th>CVSS</th><th>Published</th><th></th></tr>
          </thead>
          <tbody>
            ${cves.map(c => {
              const sev = (c.severity || 'info').toLowerCase();
              const sevClass = sev === 'critical' ? 'critical' : sev === 'high' ? 'high' : sev === 'medium' ? 'medium' : 'low';
              const cveId = c.identifier || '';
              return `
                <tr class="cve-clickable-row" data-cve-id="${this._escapeAttr(cveId)}">
                  <td><span class="text-mono text-cyan">${cveId || '—'}</span></td>
                  <td style="max-width:300px;" class="truncate">${c.title || '—'}</td>
                  <td><span class="badge ${sevClass}">${(c.severity || 'N/A').toUpperCase()}</span></td>
                  <td class="mono">${c.cvss_score ? c.cvss_score.toFixed(1) : '—'}</td>
                  <td class="mono text-muted">${c.published_at ? c.published_at.slice(0, 10) : '—'}</td>
                  <td>${cveId ? '<button class="cve-view-btn">View Details</button>' : ''}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      `;
    } else {
      cveTableHtml = '<div class="empty-state"><span class="empty-icon">🛡️</span><span class="empty-title">No CVE data</span><span class="empty-description">Run auto-learning to fetch CVEs from NVD, CISA, and other feeds.</span></div>';
    }

    // Attack Memory section
    const totalInsights = (am.operations || 0) + (am.scans || 0) + (am.successful_attacks || 0) + (am.loot || 0);
    const attackMemoryHtml = `
      <div class="glass-panel mb-6 glow-violet" style="border-color:rgba(139,92,246,0.15);">
        <div class="panel-header">
          <span class="panel-title">🧠 Attack Memory Feedback Loop</span>
          <span class="panel-subtitle">${am.learned_insights || 0} insights learned</span>
        </div>
        <div style="padding:var(--sp-4);">
          <div class="text-sm text-muted" style="margin-bottom:var(--sp-3);">
            Jarvis learns from its own operations — every scan, attack, and captured loot feeds back into the intelligence engine.
          </div>
          <div class="stats-grid" style="grid-template-columns: repeat(5, 1fr);">
            <div style="text-align:center;">
              <div class="text-lg" style="font-weight:700; color:var(--cyan);">${am.operations || 0}</div>
              <div class="text-xs text-muted">Operations</div>
            </div>
            <div style="text-align:center;">
              <div class="text-lg" style="font-weight:700; color:var(--emerald, #10b981);">${am.scans || 0}</div>
              <div class="text-xs text-muted">Scans</div>
            </div>
            <div style="text-align:center;">
              <div class="text-lg" style="font-weight:700; color:var(--rose, #f43f5e);">${am.successful_attacks || 0}</div>
              <div class="text-xs text-muted">Successful Attacks</div>
            </div>
            <div style="text-align:center;">
              <div class="text-lg" style="font-weight:700; color:var(--amber, #f59e0b);">${am.loot || 0}</div>
              <div class="text-xs text-muted">Loot Items</div>
            </div>
            <div style="text-align:center;">
              <div class="text-lg" style="font-weight:700; color:var(--violet);">${am.learned_insights || 0}</div>
              <div class="text-xs text-muted">Learned Insights</div>
            </div>
          </div>
          ${totalInsights > 0 ? `
            <div style="margin-top:var(--sp-3); height:4px; background:rgba(255,255,255,0.06); border-radius:4px; overflow:hidden;">
              <div style="height:100%; width:${Math.min((am.learned_insights || 0) / Math.max(totalInsights, 1) * 100, 100)}%; background:linear-gradient(90deg,var(--violet),var(--cyan)); border-radius:4px; transition:width 1s ease;"></div>
            </div>
            <div class="text-xs text-muted" style="margin-top:4px;">Learning coverage: ${Math.round((am.learned_insights || 0) / Math.max(totalInsights, 1) * 100)}% of available data processed</div>
          ` : ''}
        </div>
      </div>
    `;

    return `
      <!-- Auto-Learning Control -->
      <div class="glass-panel mb-6 glow-cyan" style="border-color:rgba(0,240,255,0.15);">
        <div class="flex items-center gap-4" style="flex-wrap:wrap;">
          <div style="flex:1; min-width:200px;">
            <div class="text-lg" style="font-weight:700; color:var(--text-primary); margin-bottom:4px;">🧠 Cyber Intelligence Engine</div>
            <div class="text-sm text-muted">Fetch CVEs, exploits, IOCs, malware data, breach catalogs, C2 infrastructure, TOR nodes, and more from 28+ sources including NVD, CISA, VirusTotal, Shodan, AlienVault OTX, MITRE ATT&CK, and HIBP. Learns from its own attack data.</div>
          </div>
          <div class="flex gap-3 items-center">
            <button class="btn btn-primary btn-lg" id="auto-learn-btn" style="white-space:nowrap;">
              🧠 Run Auto-Learning
            </button>
            <div id="learn-status" class="text-sm text-muted" style="min-width:120px;"></div>
          </div>
        </div>
        <div id="learn-progress" style="margin-top:var(--sp-3); display:none;">
          <div style="height:4px; background:rgba(255,255,255,0.06); border-radius:4px; overflow:hidden;">
            <div id="learn-progress-bar" style="height:100%; width:0%; background:linear-gradient(90deg,var(--cyan),var(--violet)); border-radius:4px; transition:width 2s ease;"></div>
          </div>
          <div class="text-xs text-muted" style="margin-top:4px;" id="learn-progress-text">Fetching intelligence from 28+ sources...</div>
        </div>
      </div>

      <!-- Stats -->
      <div class="stats-grid mb-6">
        <div class="glass-panel stat-card glow-cyan cyan">
          <span class="stat-icon">🛡️</span>
          <div class="stat-value">${this.formatNumber(i.totalIntel || 0)}</div>
          <div class="stat-label">Total Threat Intel</div>
        </div>
        <div class="glass-panel stat-card glow-rose rose">
          <span class="stat-icon">💀</span>
          <div class="stat-value">${this.formatNumber(i.totalExploits || 0)}</div>
          <div class="stat-label">Exploits DB</div>
        </div>
        <div class="glass-panel stat-card glow-violet violet">
          <span class="stat-icon">🔧</span>
          <div class="stat-value">${this.formatNumber(i.totalToolKnowledge || 0)}</div>
          <div class="stat-label">Tool Knowledge</div>
        </div>
        <div class="glass-panel stat-card glow-emerald emerald">
          <span class="stat-icon">📡</span>
          <div class="stat-value">${ls.length}</div>
          <div class="stat-label">Active Feeds</div>
        </div>
        <div class="glass-panel stat-card" style="border-color:rgba(139,92,246,0.2);">
          <span class="stat-icon">🧠</span>
          <div class="stat-value" style="color:var(--violet);">${this.formatNumber(am.learned_insights || 0)}</div>
          <div class="stat-label">Attack Insights</div>
        </div>
      </div>

      <!-- Attack Memory Feedback Loop -->
      ${attackMemoryHtml}

      <!-- BRON Knowledge Graph -->
      ${this.buildBronPanel(bron)}

      <div class="grid-2 mb-6">
        <!-- Severity Distribution -->
        <div class="glass-panel glow-rose">
          <div class="panel-header">
            <span class="panel-title">📊 Severity Distribution</span>
          </div>
          <div class="flex items-center gap-6" style="justify-content:center; padding: var(--sp-4);">
            ${donutData.length > 0
              ? Chart.donut(donutData, { size: 160, centerLabel: 'CVEs' })
              : '<span class="text-muted text-sm">No data</span>'
            }
            <div class="flex flex-col gap-2">
              ${donutData.map(d => `
                <div class="flex items-center gap-2">
                  <div style="width:10px;height:10px;border-radius:50%;background:${d.color};"></div>
                  <span class="text-sm">${d.label}</span>
                  <span class="text-mono text-sm text-muted" style="margin-left:auto;">${d.value}</span>
                </div>
              `).join('')}
            </div>
          </div>
        </div>

        <!-- Learning Sources -->
        <div class="glass-panel glow-cyan">
          <div class="panel-header">
            <span class="panel-title">📡 Learning Sources (28+)</span>
          </div>
          <div class="scroll-container" style="max-height:280px;">
            ${learningHtml}
          </div>
        </div>
      </div>

      <!-- Search -->
      <div class="glass-panel mb-6">
        <div class="panel-header">
          <span class="panel-title">🔍 Search Threat Intel</span>
        </div>
        <div class="flex gap-3">
          <input type="text" class="input" id="intel-search" placeholder="Search CVEs, exploits, IOCs, breaches, C2s..." style="flex:1;">
          <button class="btn btn-primary" id="intel-search-btn">Search</button>
        </div>
        <div id="intel-search-results" style="margin-top:var(--sp-4);"></div>
      </div>

      <!-- CVE Table -->
      <div class="glass-panel">
        <div class="panel-header">
          <span class="panel-title">🔒 Latest CVEs</span>
          <span class="panel-subtitle">${cves.length} records — click any CVE for full details</span>
        </div>
        <div class="scroll-container" style="max-height:500px;">
          ${cveTableHtml}
        </div>
      </div>
    `;
  }

  buildBronPanel(bron) {
    const connected = bron && bron.connected;
    const statusBadge = connected
      ? '<span class="badge success" style="font-size:10px;">CONNECTED</span>'
      : '<span class="badge" style="background:rgba(251,146,60,0.15);color:#fb923c;font-size:10px;">OFFLINE</span>';

    // Node stats cards
    const nodeTypes = [
      { key: 'technique', label: 'ATT&CK Techniques', icon: '⚔️', color: '#f43f5e' },
      { key: 'tactic', label: 'Tactics', icon: '🎯', color: '#8b5cf6' },
      { key: 'capec', label: 'CAPEC Patterns', icon: '🗺️', color: '#f59e0b' },
      { key: 'cwe', label: 'CWE Weaknesses', icon: '🔓', color: '#ef4444' },
      { key: 'cve', label: 'CVE Vulns', icon: '🐛', color: '#ec4899' },
      { key: 'cpe', label: 'CPE Products', icon: '💻', color: '#06b6d4' },
      { key: 'd3fend', label: 'D3FEND Defenses', icon: '🛡️', color: '#10b981' },
      { key: 'engage', label: 'Engage', icon: '🎣', color: '#a78bfa' },
    ];

    const statsHtml = connected ? `
      <div class="stats-grid" style="grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: var(--sp-3);">
        ${nodeTypes.map(nt => {
          const count = bron.nodes?.[nt.key] || 0;
          return `
            <div style="text-align:center; padding: 8px; border-radius: 8px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.04);">
              <div style="font-size: 16px;">${nt.icon}</div>
              <div class="text-lg" style="font-weight:700; color:${nt.color};">${this.formatNumber(count)}</div>
              <div class="text-xs text-muted">${nt.label}</div>
            </div>
          `;
        }).join('')}
      </div>
      <div class="text-xs text-muted" style="margin-top: var(--sp-2); text-align: center;">
        Total: ${this.formatNumber(bron.totalNodes || 0)} nodes, ${this.formatNumber(bron.totalEdges || 0)} edges
      </div>
    ` : `
      <div class="text-sm text-muted" style="padding: var(--sp-4); text-align: center;">
        <p>BRON Knowledge Graph is not connected.</p>
        <p style="margin-top: 4px;">Start ArangoDB: <code>docker-compose -f docker-compose.bron.yml up -d</code></p>
        <p style="margin-top: 2px;">Then load data: <code>node cli.js --update-bron</code></p>
      </div>
    `;

    return `
      <div class="glass-panel mb-6" style="border-color:rgba(16,185,129,0.2);">
        <div class="panel-header">
          <span class="panel-title">🔗 BRON Knowledge Graph</span>
          <span class="panel-subtitle">${statusBadge}</span>
        </div>
        <div style="padding: var(--sp-3);">
          <div class="text-sm text-muted" style="margin-bottom: var(--sp-2);">
            Linked cybersecurity intelligence: ATT&CK ↔ CAPEC ↔ CWE ↔ CVE ↔ CPE ↔ D3FEND. Search by CVE ID, attack name (DDoS, SQL injection), technique ID, or product name.
          </div>
          ${statsHtml}
          ${connected ? `
            <div style="margin-top: var(--sp-3); display: flex; gap: 8px;">
              <input type="text" class="input" id="bron-search-input" placeholder="Search: CVE-2021-44228, DDoS, SQL injection, firebase, T1190, apache..." style="flex:1;">
              <button class="btn btn-primary" id="bron-search-btn">🔍 Search</button>
            </div>
            <div class="text-xs text-muted" style="margin-top: 4px;">
              💡 Try: attack names (DDoS, XSS, buffer overflow), product names (apache, nginx, wordpress), CVE IDs, or technique IDs
            </div>
            <div id="bron-results" style="margin-top: var(--sp-3);"></div>
          ` : ''}
        </div>
      </div>
    `;
  }

  getSourceBadge(source) {
    const badges = {
      'virustotal': ' <span class="badge" style="background:rgba(57,117,249,0.15); color:#3975f9; font-size:9px; padding:1px 5px;">VT</span>',
      'shodan': ' <span class="badge" style="background:rgba(204,51,51,0.15); color:#cc3333; font-size:9px; padding:1px 5px;">SHODAN</span>',
      'shodan-intel': ' <span class="badge" style="background:rgba(204,51,51,0.15); color:#cc3333; font-size:9px; padding:1px 5px;">SHODAN</span>',
      'otx': ' <span class="badge" style="background:rgba(34,197,94,0.15); color:#22c55e; font-size:9px; padding:1px 5px;">OTX</span>',
      'mitre-attack': ' <span class="badge" style="background:rgba(239,68,68,0.15); color:#ef4444; font-size:9px; padding:1px 5px;">ATT&CK</span>',
      'hibp': ' <span class="badge" style="background:rgba(59,130,246,0.15); color:#3b82f6; font-size:9px; padding:1px 5px;">HIBP</span>',
      'c2intel': ' <span class="badge" style="background:rgba(249,115,22,0.15); color:#f97316; font-size:9px; padding:1px 5px;">C2</span>',
      'tor-exits': ' <span class="badge" style="background:rgba(124,58,237,0.15); color:#7c3aed; font-size:9px; padding:1px 5px;">TOR</span>',
      'attack-memory': ' <span class="badge" style="background:rgba(139,92,246,0.15); color:#8b5cf6; font-size:9px; padding:1px 5px;">MEMORY</span>',
    };
    return badges[source] || '';
  }

  setupHandlers() {
    window.__jarvisOpenCVE = (id) => this._openCVEDetail(id);

    // Auto-learn button
    const learnBtn = document.getElementById('auto-learn-btn');
    if (learnBtn) {
      learnBtn.addEventListener('click', async () => {
        learnBtn.disabled = true;
        learnBtn.innerHTML = '<div class="spinner" style="width:16px;height:16px;display:inline-block;"></div> Learning...';
        const statusEl = document.getElementById('learn-status');
        const progressEl = document.getElementById('learn-progress');
        const progressBar = document.getElementById('learn-progress-bar');
        const progressText = document.getElementById('learn-progress-text');

        if (progressEl) progressEl.style.display = 'block';

        // Trigger learning
        await this.app.apiPost('/learn', {});

        // Poll for completion
        const sources = [
          'NVD CVEs', 'CISA KEV', 'GitHub Advisories', 'EPSS Scores',
          'Exploit-DB', 'InTheWild Exploits', 'PacketStorm', 'Vulners',
          'abuse.ch Malware', 'Feodo Tracker', 'SSL Blacklist',
          'OpenPhish', 'PhishTank', 'URLScan.io',
          'MITRE CAPEC', 'Tool Knowledge', 'Nuclei Templates', 'Nuclei CVEs',
          'Security News', 'CISA Alerts', 'Ransomware Tracker',
          'VirusTotal 🔬', 'Shodan 🌐', 'AlienVault OTX 🛡️',
          'MITRE ATT&CK ⚔️', 'HIBP Breaches 🔓', 'C2 Infrastructure 💀', 'TOR Exit Nodes 🧅',
          'Attack Memory 🧠'
        ];
        let pollCount = 0;

        const pollInterval = setInterval(async () => {
          pollCount++;
          const progress = Math.min(pollCount * 3.5, 95);
          if (progressBar) progressBar.style.width = progress + '%';
          if (progressText && pollCount <= sources.length) {
            progressText.textContent = `📡 Fetching: ${sources[Math.min(pollCount - 1, sources.length - 1)]}...`;
          }

          try {
            const status = await this.app.api('/learning-status');
            if (!status.inProgress) {
              clearInterval(pollInterval);
              if (progressBar) progressBar.style.width = '100%';
              if (progressText) progressText.textContent = '✅ Complete! Refreshing data...';
              if (statusEl) {
                const stats = status.stats || {};
                statusEl.innerHTML = `<span class="badge success">✅ Done</span> CVEs: ${stats.cves || 0}, Exploits: ${stats.exploits || 0}, Threats: ${stats.threats || 0}`;
              }
              setTimeout(() => {
                const container = document.getElementById('page-content');
                if (container) this.render(container);
              }, 1500);
            }
          } catch { /* ignore poll errors */ }
        }, 3000);
      });
    }

    // ═══ Intel Search (local DB) ═══
    const searchBtn = document.getElementById('intel-search-btn');
    const searchInput = document.getElementById('intel-search');

    const doSearch = async () => {
      const query = searchInput?.value?.trim();
      if (!query) return;

      const resultsEl = document.getElementById('intel-search-results');
      if (!resultsEl) return;

      resultsEl.innerHTML = '<div class="flex items-center gap-2"><div class="spinner"></div><span class="text-sm text-muted">Searching...</span></div>';

      const [intelResults, exploitResults] = await Promise.all([
        this.app.api(`/threat-intel/search?q=${encodeURIComponent(query)}`),
        this.app.api(`/exploits/search?q=${encodeURIComponent(query)}`),
      ]);

      const allResults = [
        ...(intelResults?.results || []).map(r => ({ ...r, _type: 'intel' })),
        ...(exploitResults?.results || []).map(r => ({ ...r, _type: 'exploit' })),
      ];

      if (allResults.length === 0) {
        resultsEl.innerHTML = '<div class="text-sm text-muted">No results found in local database.</div>';
        return;
      }

      resultsEl.innerHTML = `
        <div class="text-sm text-muted mb-4">${allResults.length} results</div>
        <table class="data-table">
          <thead><tr><th>Type</th><th>ID</th><th>Title</th><th>Source</th><th>Severity</th><th></th></tr></thead>
          <tbody>
            ${allResults.slice(0, 30).map(r => {
              const cveId = r.identifier || r.exploit_id || '';
              const isCVE = cveId && /^CVE-/i.test(cveId);
              return `
              <tr class="${isCVE ? 'cve-clickable-row' : ''}" ${isCVE ? `data-cve-id="${this._escapeAttr(cveId)}"` : ''}>
                <td><span class="badge ${r._type === 'exploit' ? 'danger' : 'info'}">${r._type}</span></td>
                <td class="mono text-cyan">${cveId || '—'}</td>
                <td class="truncate" style="max-width:300px;">${r.title || '—'}</td>
                <td class="text-sm text-muted">${r.source || '—'}</td>
                <td>${r.severity ? `<span class="badge ${(r.severity || '').toLowerCase()}">${r.severity}</span>` : '—'}</td>
                <td>${isCVE ? '<button class="cve-view-btn">Details</button>' : ''}</td>
              </tr>
            `;
            }).join('')}
          </tbody>
        </table>
      `;

      // Attach click handlers to new results
      this._attachCVEClickHandlers(resultsEl);
    };

    searchBtn?.addEventListener('click', doSearch);
    searchInput?.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSearch(); });

    // ═══ BRON Search Handlers (Smart Search) ═══
    const bronSearchBtn = document.getElementById('bron-search-btn');
    const bronSearchInput = document.getElementById('bron-search-input');

    const doBronSearch = async () => {
      const query = bronSearchInput?.value?.trim();
      if (!query) return;
      const resultsEl = document.getElementById('bron-results');
      if (!resultsEl) return;

      // Detect query type
      const isCVE = /^CVE-\d{4}-\d+$/i.test(query);
      const isNodeId = /^(TA\d+|T\d+|CAPEC-\d+|CWE-\d+|D3-|EAC\d+|SAC\d+)/i.test(query);

      if (isCVE) {
        // Direct CVE detail lookup
        resultsEl.innerHTML = '<div class="flex items-center gap-2"><div class="spinner"></div><span class="text-sm text-muted">Loading CVE details...</span></div>';
        this._openCVEDetail(query);
        resultsEl.innerHTML = '';
        return;
      }

      if (isNodeId) {
        // Direct node lookup (technique, tactic, etc.)
        resultsEl.innerHTML = '<div class="flex items-center gap-2"><div class="spinner"></div><span class="text-sm text-muted">Looking up node...</span></div>';
        const node = await this.app.api(`/bron/node/${encodeURIComponent(query)}`);

        if (node?.error || !node?.original_id) {
          // Fall back to exploit search
          await this._doExploitSearch(query, resultsEl);
          return;
        }

        let html = `<div style="padding:12px; border-radius:8px; background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.06);">`;
        html += `<div style="font-weight:600; color:var(--text-primary); margin-bottom:8px;">${node.original_id} — ${node.name || ''}</div>`;
        if (node.description) html += `<div class="text-sm text-muted" style="margin-bottom:8px;">${node.description.slice(0, 500)}</div>`;

        const outbound = node.neighbors?.outbound || [];
        const inbound = node.neighbors?.inbound || [];
        if (outbound.length + inbound.length > 0) {
          html += `<div class="text-sm" style="font-weight:600; margin-top:8px;">Connections (${outbound.length + inbound.length})</div>`;
          html += '<div style="margin-top:4px; max-height:200px; overflow-y:auto;">';
          for (const n of [...outbound, ...inbound].slice(0, 20)) {
            const dir = n.direction === 'outbound' ? '→' : '←';
            const isCveConn = n.id && /^CVE-/i.test(n.id);
            html += `<div class="text-sm" style="padding:2px 0; ${isCveConn ? 'cursor:pointer;' : ''}" ${isCveConn ? `onclick="window.__jarvisOpenCVE?.('${this._escapeAttr(n.id)}')"` : ''}>`;
            html += `<span class="text-muted">${dir}</span> <span class="mono text-cyan">${n.id}</span> <span class="text-muted">${n.name || ''}</span>`;
            if (isCveConn) html += ' <span class="cve-view-btn" style="font-size:0.65rem;">View</span>';
            html += `</div>`;
          }
          html += '</div>';
        }
        html += '</div>';
        resultsEl.innerHTML = html;
        return;
      }

      // Free-text search → exploit/attack name search
      await this._doExploitSearch(query, resultsEl);
    };

    bronSearchBtn?.addEventListener('click', doBronSearch);
    bronSearchInput?.addEventListener('keydown', (e) => { if (e.key === 'Enter') doBronSearch(); });

    // ═══ Clickable CVE rows in the main table ═══
    this._attachCVEClickHandlers(document);
  }

  // ═══════════════════════════════════════════════
  // EXPLOIT NAME SEARCH
  // ═══════════════════════════════════════════════

  async _doExploitSearch(query, resultsEl) {
    resultsEl.innerHTML = '<div class="flex items-center gap-2"><div class="spinner"></div><span class="text-sm text-muted">Searching BRON graph, local DB, and NVD API...</span></div>';

    const data = await this.app.api(`/bron/exploit-search?q=${encodeURIComponent(query)}`);

    if (!data || data.error) {
      resultsEl.innerHTML = `<div class="text-sm text-muted">Search error: ${data?.error || 'Unknown error'}</div>`;
      return;
    }

    const { capecs = [], techniques = [], cwes = [], cves = [], localExploits = [], totalCVEs = 0, nvdFetched = false } = data;
    const hasResults = capecs.length + techniques.length + cwes.length + cves.length + localExploits.length > 0;

    if (!hasResults) {
      resultsEl.innerHTML = `
        <div style="padding:var(--sp-4); text-align:center;">
          <div class="text-sm text-muted" style="margin-bottom:8px;">No results found for "<strong>${this._escapeHtml(query)}</strong>"</div>
          <div class="text-xs text-muted">Try different terms like: DDoS, XSS, SQL injection, buffer overflow, remote code execution, apache, nginx, wordpress</div>
        </div>`;
      return;
    }

    let html = '<div class="exploit-search-results">';

    // Summary with NVD badge
    const nvdBadge = nvdFetched ? ' <span class="badge" style="background:rgba(0,240,255,0.12);color:var(--cyan);font-size:9px;">🌐 NVD Live</span>' : '';
    html += `<div class="text-sm text-muted">Found: ${techniques.length} techniques, ${capecs.length} attack patterns, ${cwes.length} weaknesses, ${cves.length} CVEs${totalCVEs > cves.length ? ` (showing ${cves.length} of ${totalCVEs})` : ''}${localExploits.length ? `, ${localExploits.length} exploits` : ''}${nvdBadge}</div>`;

    // ATT&CK Techniques
    if (techniques.length > 0) {
      html += `<div class="exploit-search-group">
        <div class="exploit-search-group-header">
          <span>⚔️ ATT&CK Techniques</span>
          <span class="exploit-search-group-count">${techniques.length}</span>
        </div>
        <div style="padding: var(--sp-3);">
          ${techniques.map(t => `
            <div style="padding:6px 0; border-bottom:1px solid rgba(255,255,255,0.03);">
              <span class="mono text-cyan" style="font-weight:600;">${t.id}</span> — <span class="text-sm">${t.name}</span>
              ${t.description ? `<div class="text-xs text-muted" style="margin-top:2px; max-height:40px; overflow:hidden;">${t.description.slice(0, 200)}</div>` : ''}
              ${t.platforms?.length ? `<div style="margin-top:3px;">${t.platforms.slice(0, 5).map(p => `<span class="tag" style="margin-right:3px;">${p}</span>`).join('')}</div>` : ''}
            </div>
          `).join('')}
        </div>
      </div>`;
    }

    // CAPEC Attack Patterns
    if (capecs.length > 0) {
      html += `<div class="exploit-search-group">
        <div class="exploit-search-group-header">
          <span>🗺️ CAPEC Attack Patterns</span>
          <span class="exploit-search-group-count">${capecs.length}</span>
        </div>
        <div style="padding: var(--sp-3);">
          ${capecs.map(c => `
            <div style="padding:6px 0; border-bottom:1px solid rgba(255,255,255,0.03);">
              <span class="mono" style="color:#f59e0b; font-weight:600;">${c.id}</span> — <span class="text-sm">${c.name}</span>
              ${c.severity ? ` <span class="badge" style="font-size:9px;">${c.severity}</span>` : ''}
              ${c.description ? `<div class="text-xs text-muted" style="margin-top:2px; max-height:40px; overflow:hidden;">${c.description.slice(0, 250)}</div>` : ''}
            </div>
          `).join('')}
        </div>
      </div>`;
    }

    // CWE Weaknesses
    if (cwes.length > 0) {
      html += `<div class="exploit-search-group">
        <div class="exploit-search-group-header">
          <span>🔓 CWE Weaknesses</span>
          <span class="exploit-search-group-count">${cwes.length}</span>
        </div>
        <div style="padding: var(--sp-3);">
          ${cwes.map(c => `
            <div style="padding:4px 0; border-bottom:1px solid rgba(255,255,255,0.03);">
              <span class="mono" style="color:#ef4444; font-weight:600;">${c.id}</span> — <span class="text-sm">${c.name}</span>
            </div>
          `).join('')}
        </div>
      </div>`;
    }

    // Related CVEs
    if (cves.length > 0) {
      html += `<div class="exploit-search-group">
        <div class="exploit-search-group-header">
          <span>🐛 Related CVEs</span>
          <span class="exploit-search-group-count">${cves.length}${totalCVEs > cves.length ? ` / ${totalCVEs}` : ''}</span>
        </div>
        <div style="padding: 0;">
          <table class="data-table" style="margin:0;">
            <thead><tr><th>CVE ID</th><th>Description</th><th>Severity</th><th>CVSS</th><th></th></tr></thead>
            <tbody>
              ${cves.slice(0, 30).map(c => {
                const sevClass = (c.severity || '').toLowerCase();
                return `
                <tr class="cve-clickable-row" data-cve-id="${this._escapeAttr(c.cve_id || '')}">
                  <td class="mono text-cyan" style="white-space:nowrap;">${c.cve_id || '—'}</td>
                  <td class="text-sm" style="max-width:300px;"><div class="truncate">${c.description ? c.description.slice(0, 150) : '—'}</div></td>
                  <td>${c.severity ? `<span class="badge ${sevClass}">${c.severity}</span>` : '—'}</td>
                  <td class="mono">${c.cvss ? Number(c.cvss).toFixed(1) : '—'}</td>
                  <td><button class="cve-view-btn">Details</button></td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
    }

    // Local Exploits
    if (localExploits.length > 0) {
      html += `<div class="exploit-search-group">
        <div class="exploit-search-group-header">
          <span>💀 Known Exploits</span>
          <span class="exploit-search-group-count">${localExploits.length}</span>
        </div>
        <div style="padding: var(--sp-3);">
          ${localExploits.slice(0, 15).map(e => `
            <div style="padding:6px 0; border-bottom:1px solid rgba(255,255,255,0.03);">
              <span class="mono text-rose" style="font-weight:600;">${e.exploit_id || '—'}</span>
              <span class="text-sm"> — ${e.title || '—'}</span>
              ${e.platform ? ` <span class="tag">${e.platform}</span>` : ''}
              ${e.cve_ids ? ` <span class="text-xs text-muted">${e.cve_ids}</span>` : ''}
              ${e.description ? `<div class="text-xs text-muted" style="margin-top:2px; max-height:30px; overflow:hidden;">${e.description.slice(0, 150)}</div>` : ''}
            </div>
          `).join('')}
        </div>
      </div>`;
    }

    html += '</div>';
    resultsEl.innerHTML = html;

    // Attach CVE click handlers to new results
    this._attachCVEClickHandlers(resultsEl);
  }

  // ═══════════════════════════════════════════════
  // CVE DETAIL PANEL
  // ═══════════════════════════════════════════════

  _attachCVEClickHandlers(container) {
    const rows = container.querySelectorAll('.cve-clickable-row');
    rows.forEach(row => {
      row.addEventListener('click', (e) => {
        // Don't trigger if clicking an actual link
        if (e.target.tagName === 'A') return;
        const cveId = row.dataset.cveId;
        if (cveId) this._openCVEDetail(cveId);
      });
    });
  }

  async _openCVEDetail(cveId) {
    // Remove existing overlay
    const existing = document.querySelector('.cve-detail-overlay');
    if (existing) existing.remove();

    // Create overlay + panel with loading state
    const overlay = document.createElement('div');
    overlay.className = 'cve-detail-overlay';
    overlay.innerHTML = `
      <div class="cve-detail-panel">
        <div class="cve-detail-header">
          <div class="cve-detail-header-info">
            <div class="cve-detail-id">${this._escapeHtml(cveId)}</div>
            <div class="text-sm text-muted">Loading details...</div>
          </div>
          <button class="cve-detail-close" id="cve-detail-close">✕</button>
        </div>
        <div class="cve-detail-loading">
          <div class="skeleton-line" style="width:100%;height:20px;"></div>
          <div class="skeleton-line" style="width:80%;height:14px;"></div>
          <div class="skeleton-line" style="width:60%;height:14px;"></div>
          <div class="skeleton-line" style="width:90%;height:80px;"></div>
          <div class="skeleton-line" style="width:70%;height:14px;"></div>
          <div class="skeleton-line" style="width:50%;height:14px;"></div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Close handlers
    const closePanel = () => overlay.remove();
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay || e.target.closest('.cve-detail-close')) {
        closePanel();
      }
    });
    document.addEventListener('keydown', function escHandler(e) {
      if (e.key === 'Escape') {
        closePanel();
        document.removeEventListener('keydown', escHandler);
      }
    });

    // Fetch detailed CVE data
    const data = await this.app.api(`/bron/cve/${encodeURIComponent(cveId)}`);

    if (!data || data.error) {
      const panel = overlay.querySelector('.cve-detail-panel');
      panel.innerHTML = `
        <div class="cve-detail-header">
          <div class="cve-detail-header-info">
            <div class="cve-detail-id">${this._escapeHtml(cveId)}</div>
            <div class="text-sm text-muted">Not found in BRON graph or local database</div>
          </div>
          <button class="cve-detail-close" onclick="this.closest('.cve-detail-overlay').remove()">✕</button>
        </div>
        <div class="cve-detail-body">
          <div class="cve-detail-section">
            <div class="cve-detail-section-header">ℹ️ Info</div>
            <div class="cve-detail-section-body">
              <p class="text-sm text-muted">This CVE was not found in the BRON knowledge graph or local database. You may need to:</p>
              <ul style="margin-top:8px; padding-left:20px; color:var(--text-muted); font-size:0.82rem; line-height:1.6;">
                <li>Run <code>node cli.js --update-bron</code> to refresh BRON data</li>
                <li>Run auto-learning to fetch latest CVEs from NVD</li>
                <li>This CVE may be too new or not yet in public databases</li>
              </ul>
              <a href="https://nvd.nist.gov/vuln/detail/${encodeURIComponent(cveId)}" target="_blank" class="cve-external-link" style="margin-top:12px;">🔗 Check on NVD →</a>
            </div>
          </div>
        </div>
      `;
      return;
    }

    // Render full detail panel
    this._renderCVEDetailPanel(overlay, data);
  }

  _renderCVEDetailPanel(overlay, data) {
    const cve = data.cve || {};
    const cwes = data.cwes || [];
    const capecs = data.capecs || [];
    const techniques = data.techniques || [];
    const tactics = data.tactics || [];
    const defenses = data.defenses || [];
    const cpes = data.cpes || [];

    // CVSS color
    const cvss = cve.cvss || 0;
    const sevColor = this._getSeverityColor(cve.severity);
    const circumference = 2 * Math.PI * 34;
    const dashOffset = circumference - (cvss / 10) * circumference;

    const panel = overlay.querySelector('.cve-detail-panel');
    panel.innerHTML = `
      <div class="cve-detail-header">
        <div class="cve-detail-header-info">
          <div class="cve-detail-id">${this._escapeHtml(cve.id || '')}</div>
          <div class="flex items-center gap-2" style="margin-top:4px;">
            <span class="badge" style="background:${sevColor}22;color:${sevColor};font-size:11px;">${(cve.severity || 'UNKNOWN').toUpperCase()}</span>
            ${cve.published ? `<span class="text-xs text-muted">Published: ${cve.published.slice(0, 10)}</span>` : ''}
            ${data.source === 'local_db' ? '<span class="tag" style="font-size:0.65rem;">Local DB</span>' : ''}
            ${data.source === 'nvd_live' ? '<span class="badge" style="background:rgba(0,240,255,0.12);color:var(--cyan);font-size:9px;">🌐 NVD Live</span>' : ''}
          </div>
        </div>
        <button class="cve-detail-close" onclick="this.closest('.cve-detail-overlay').remove()">✕</button>
      </div>

      <div class="cve-detail-body">
        <!-- CVSS Gauge -->
        <div class="cvss-gauge-container">
          <div class="cvss-gauge">
            <svg viewBox="0 0 80 80">
              <circle class="cvss-gauge-bg" cx="40" cy="40" r="34"></circle>
              <circle class="cvss-gauge-fill" cx="40" cy="40" r="34"
                stroke="${sevColor}"
                stroke-dasharray="${circumference}"
                stroke-dashoffset="${dashOffset}">
              </circle>
            </svg>
            <div class="cvss-gauge-value" style="color:${sevColor};">${cvss ? cvss.toFixed(1) : 'N/A'}</div>
          </div>
          <div class="cvss-gauge-meta">
            <div class="severity-label" style="color:${sevColor};">${(cve.severity || 'UNKNOWN').toUpperCase()}</div>
            <div class="text-sm text-muted">CVSS Base Score</div>
            ${cve.published ? `<div class="published-date">📅 ${cve.published.slice(0, 10)}</div>` : ''}
          </div>
          <a href="https://nvd.nist.gov/vuln/detail/${encodeURIComponent(cve.id || '')}" target="_blank" class="cve-external-link" style="margin-left:auto;">🔗 NVD</a>
        </div>

        <!-- Description -->
        <div class="cve-detail-section">
          <div class="cve-detail-section-header">📋 Description</div>
          <div class="cve-detail-section-body">
            <div class="cve-detail-description">
              ${cve.description ? this._escapeHtml(cve.description) : '<span class="text-muted">No description available.</span>'}
            </div>
          </div>
        </div>

        <!-- How the Exploit Works (CAPEC) -->
        ${capecs.length > 0 ? `
          <div class="cve-detail-section" style="border-color:rgba(245,158,11,0.2);">
            <div class="cve-detail-section-header" style="color:#f59e0b;">⚡ How This Exploit Works</div>
            <div class="cve-detail-section-body">
              ${capecs.map(c => `
                <div style="margin-bottom:12px; padding-bottom:12px; border-bottom:1px solid rgba(255,255,255,0.04);">
                  <div style="font-weight:600; font-size:0.85rem;">
                    <span class="mono" style="color:#f59e0b;">${c.id}</span> — ${this._escapeHtml(c.name || '')}
                  </div>
                  ${c.severity ? `<span class="badge" style="font-size:9px; margin-top:4px;">${c.severity}</span>` : ''}
                  ${c.likelihood ? ` <span class="text-xs text-muted">Likelihood: ${c.likelihood}</span>` : ''}
                  ${c.description ? `<div class="text-sm text-muted" style="margin-top:6px; line-height:1.6;">${this._escapeHtml(c.description.slice(0, 600))}</div>` : ''}
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <!-- Attack Chain -->
        ${(cwes.length + techniques.length + tactics.length) > 0 ? `
          <div class="cve-detail-section" style="border-color:rgba(244,63,94,0.2);">
            <div class="cve-detail-section-header" style="color:#f43f5e;">⛓️ Attack Chain</div>
            <div class="cve-detail-section-body">
              <div class="cve-attack-chain">
                ${cwes.map(cwe => `
                  <div class="cve-chain-node node-cwe">
                    <div class="cve-chain-node-inner">
                      <div class="cve-chain-type" style="color:#ef4444;">🔓 CWE (Weakness)</div>
                      <div class="cve-chain-id">${cwe.id}</div>
                      <div class="cve-chain-name">${this._escapeHtml(cwe.name || '')}</div>
                      ${cwe.description && cwe.description !== cwe.name ? `<div class="cve-chain-desc">${this._escapeHtml(cwe.description.slice(0, 200))}</div>` : ''}
                    </div>
                  </div>
                `).join('')}

                ${techniques.map(tech => `
                  <div class="cve-chain-node node-technique">
                    <div class="cve-chain-node-inner">
                      <div class="cve-chain-type" style="color:#f43f5e;">⚔️ ATT&CK Technique</div>
                      <div class="cve-chain-id">${tech.id}</div>
                      <div class="cve-chain-name">${this._escapeHtml(tech.name || '')}</div>
                      ${tech.description ? `<div class="cve-chain-desc">${this._escapeHtml(tech.description.slice(0, 200))}</div>` : ''}
                      ${tech.platforms?.length ? `<div style="margin-top:4px;">${tech.platforms.slice(0, 4).map(p => `<span class="tag" style="font-size:0.6rem;">${p}</span>`).join(' ')}</div>` : ''}
                    </div>
                  </div>
                `).join('')}

                ${tactics.map(tactic => `
                  <div class="cve-chain-node node-tactic">
                    <div class="cve-chain-node-inner">
                      <div class="cve-chain-type" style="color:#8b5cf6;">🎯 Tactic (Goal)</div>
                      <div class="cve-chain-id">${tactic.id}</div>
                      <div class="cve-chain-name">${this._escapeHtml(tactic.name || '')}</div>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>
        ` : ''}

        <!-- Attack ↔ Defense Graph Visualization -->
        ${this._renderAttackDefenseGraph(cve, cwes, capecs, techniques, tactics, defenses)}

        <!-- Recommended Defenses (Enhanced) -->
        ${this._renderDefenseSection(cve, cwes, capecs, techniques, defenses)}

        <!-- Affected Products -->
        ${cpes.length > 0 ? `
          <div class="cve-detail-section" style="border-color:rgba(6,182,212,0.2);">
            <div class="cve-detail-section-header" style="color:#06b6d4;">💻 Affected Products (${cpes.length})</div>
            <div class="cve-detail-section-body">
              <div class="cve-product-list">
                ${cpes.slice(0, 15).map(cpe => `
                  <div class="cve-product-item">
                    <span>📦</span>
                    ${cpe.vendor ? `<span class="vendor">${this._escapeHtml(cpe.vendor)}</span>` : ''}
                    ${cpe.product ? `<span>${this._escapeHtml(cpe.product)}</span>` : ''}
                    ${cpe.version && cpe.version !== '*' ? `<span class="version">v${this._escapeHtml(cpe.version)}</span>` : ''}
                  </div>
                `).join('')}
                ${cpes.length > 15 ? `<div class="text-xs text-muted" style="padding:4px;">+${cpes.length - 15} more products</div>` : ''}
              </div>
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }

  // ═══════════════════════════════════════════════
  // ATTACK ↔ DEFENSE GRAPH (SVG)
  // ═══════════════════════════════════════════════

  _renderAttackDefenseGraph(cve, cwes, capecs, techniques, tactics, defenses) {
    // Build nodes for the graph: CVE → CWE → CAPEC → Technique → Tactic (left), Defenses (right)
    const hasAttackChain = cwes.length + capecs.length + techniques.length + tactics.length > 0;
    const hasDefenses = defenses.length > 0;
    if (!hasAttackChain && !hasDefenses) return '';

    // Collect all node groups
    const attackNodes = [];
    const defenseNodes = [];

    // CVE node (center-left)
    attackNodes.push({ id: cve.id || 'CVE', label: cve.id || 'CVE', type: 'cve', color: '#ec4899' });

    // CWEs
    cwes.slice(0, 3).forEach(c => {
      attackNodes.push({ id: c.id, label: c.id, sublabel: (c.name || '').slice(0, 25), type: 'cwe', color: '#ef4444' });
    });

    // CAPECs
    capecs.slice(0, 3).forEach(c => {
      attackNodes.push({ id: c.id, label: c.id, sublabel: (c.name || '').slice(0, 25), type: 'capec', color: '#f59e0b' });
    });

    // Techniques
    techniques.slice(0, 3).forEach(t => {
      attackNodes.push({ id: t.id, label: t.id, sublabel: (t.name || '').slice(0, 25), type: 'technique', color: '#f43f5e' });
    });

    // Tactics
    tactics.slice(0, 2).forEach(t => {
      attackNodes.push({ id: t.id, label: t.id, sublabel: (t.name || '').slice(0, 25), type: 'tactic', color: '#8b5cf6' });
    });

    // Defenses
    defenses.slice(0, 5).forEach(d => {
      defenseNodes.push({ id: d.id || d.name, label: (d.name || d.id || '').slice(0, 22), sublabel: d.category || '', type: 'd3fend', color: '#10b981' });
    });

    // Layout params
    const nodeW = 140, nodeH = 48, gapY = 14, gapX = 50;
    const attackCount = attackNodes.length;
    const defenseCount = defenseNodes.length;
    const maxRows = Math.max(attackCount, defenseCount, 1);
    const svgH = maxRows * (nodeH + gapY) + 60;
    const svgW = defenseCount > 0 ? (nodeW * 2 + gapX * 3 + 100) : (nodeW + gapX * 2 + 100);
    const centerX = defenseCount > 0 ? svgW / 2 : svgW / 2;

    // Compute positions
    const attackX = defenseCount > 0 ? centerX - gapX / 2 - nodeW : centerX - nodeW / 2;
    const defenseX = centerX + gapX / 2;
    const attackStartY = (svgH - attackCount * (nodeH + gapY)) / 2 + 20;
    const defenseStartY = (svgH - defenseCount * (nodeH + gapY)) / 2 + 20;

    let svg = `<svg width="100%" viewBox="0 0 ${svgW} ${svgH}" xmlns="http://www.w3.org/2000/svg" style="max-width:${svgW}px;">`;

    // Title
    svg += `<text x="${svgW / 2}" y="16" text-anchor="middle" fill="#64748b" font-size="10" font-weight="600" letter-spacing="0.08em">ATTACK → DEFENSE RELATIONSHIP GRAPH</text>`;

    // Draw connection lines (attack → defense, flowing right)
    if (defenseCount > 0 && attackCount > 0) {
      // Draw lines from last attack node (technique/tactic) to each defense
      const srcIdx = attackCount - 1; // bottom-most attack node
      const srcY = attackStartY + srcIdx * (nodeH + gapY) + nodeH / 2;
      const srcX2 = attackX + nodeW;

      for (let d = 0; d < defenseCount; d++) {
        const dstY = defenseStartY + d * (nodeH + gapY) + nodeH / 2;
        const dstX1 = defenseX;
        const midX = (srcX2 + dstX1) / 2;
        svg += `<path d="M${srcX2},${srcY} C${midX},${srcY} ${midX},${dstY} ${dstX1},${dstY}" fill="none" stroke="rgba(16,185,129,0.3)" stroke-width="1.5" stroke-dasharray="4 3">
          <animate attributeName="stroke-dashoffset" from="28" to="0" dur="2s" repeatCount="indefinite"/>
        </path>`;
        // Arrow
        svg += `<polygon points="${dstX1},${dstY} ${dstX1 - 6},${dstY - 3} ${dstX1 - 6},${dstY + 3}" fill="rgba(16,185,129,0.5)"/>`;
      }

      // Draw connector lines between sequential attack nodes
      for (let i = 0; i < attackCount - 1; i++) {
        const y1 = attackStartY + i * (nodeH + gapY) + nodeH;
        const y2 = attackStartY + (i + 1) * (nodeH + gapY);
        const cx = attackX + nodeW / 2;
        svg += `<line x1="${cx}" y1="${y1}" x2="${cx}" y2="${y2}" stroke="rgba(244,63,94,0.25)" stroke-width="1.5"/>`;
        svg += `<polygon points="${cx},${y2} ${cx - 3},${y2 - 5} ${cx + 3},${y2 - 5}" fill="rgba(244,63,94,0.4)"/>`;
      }
    } else if (attackCount > 1) {
      // No defenses — still draw attack chain lines
      for (let i = 0; i < attackCount - 1; i++) {
        const y1 = attackStartY + i * (nodeH + gapY) + nodeH;
        const y2 = attackStartY + (i + 1) * (nodeH + gapY);
        const cx = attackX + nodeW / 2;
        svg += `<line x1="${cx}" y1="${y1}" x2="${cx}" y2="${y2}" stroke="rgba(244,63,94,0.25)" stroke-width="1.5"/>`;
        svg += `<polygon points="${cx},${y2} ${cx - 3},${y2 - 5} ${cx + 3},${y2 - 5}" fill="rgba(244,63,94,0.4)"/>`;
      }
    }

    // Draw attack nodes
    attackNodes.forEach((node, i) => {
      const x = attackX;
      const y = attackStartY + i * (nodeH + gapY);
      svg += this._svgNode(x, y, nodeW, nodeH, node);
    });

    // Draw defense nodes
    defenseNodes.forEach((node, i) => {
      const x = defenseX;
      const y = defenseStartY + i * (nodeH + gapY);
      svg += this._svgNode(x, y, nodeW, nodeH, node);
    });

    // Legend
    const legendY = svgH - 8;
    const legendItems = [
      { label: 'CVE', color: '#ec4899' },
      { label: 'CWE', color: '#ef4444' },
      { label: 'CAPEC', color: '#f59e0b' },
      { label: 'Technique', color: '#f43f5e' },
      { label: 'Tactic', color: '#8b5cf6' },
    ];
    if (defenseCount > 0) legendItems.push({ label: 'Defense', color: '#10b981' });

    let lx = 10;
    legendItems.forEach(item => {
      svg += `<rect x="${lx}" y="${legendY - 7}" width="8" height="8" rx="2" fill="${item.color}" opacity="0.7"/>`;
      svg += `<text x="${lx + 12}" y="${legendY}" fill="#64748b" font-size="8">${item.label}</text>`;
      lx += item.label.length * 5.5 + 22;
    });

    svg += `</svg>`;

    return `
      <div class="cve-detail-section" style="border-color:rgba(139,92,246,0.2);">
        <div class="cve-detail-section-header" style="color:#a78bfa;">🔗 Attack ↔ Defense Graph</div>
        <div class="cve-detail-section-body">
          <div class="cve-graph-container">${svg}</div>
        </div>
      </div>
    `;
  }

  _svgNode(x, y, w, h, node) {
    const fill = node.type === 'd3fend' ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.03)';
    const stroke = node.color + '44';
    const icon = {
      'cve': '🐛', 'cwe': '🔓', 'capec': '⚡', 'technique': '⚔️', 'tactic': '🎯', 'd3fend': '🛡️'
    }[node.type] || '•';

    let svg = `<g class="cve-graph-node">`;
    svg += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>`;
    // Icon + label
    svg += `<text x="${x + 8}" y="${y + 18}" font-size="11">${icon}</text>`;
    svg += `<text x="${x + 24}" y="${y + 18}" fill="${node.color}" font-size="10" font-weight="700">${this._escapeHtml(node.label)}</text>`;
    if (node.sublabel) {
      svg += `<text x="${x + 8}" y="${y + 34}" fill="#64748b" font-size="8">${this._escapeHtml(node.sublabel)}</text>`;
    }
    svg += `</g>`;
    return svg;
  }

  // ═══════════════════════════════════════════════
  // DEFENSE SECTION (ENHANCED)
  // ═══════════════════════════════════════════════

  _renderDefenseSection(cve, cwes, capecs, techniques, defenses) {
    // Merge D3FEND defenses + generate CWE-based generic recommendations
    const allDefenses = [...defenses];
    const seenIds = new Set(defenses.map(d => d.id || d.name));

    // Generate CWE-based defense recommendations as fallback
    const cweDefenses = this._getCWEDefenses(cwes);
    for (const wd of cweDefenses) {
      if (!seenIds.has(wd.id)) {
        seenIds.add(wd.id);
        allDefenses.push(wd);
      }
    }

    // Generate generic defenses based on severity if we still have none
    if (allDefenses.length === 0) {
      allDefenses.push(...this._getGenericDefenses(cve));
    }

    if (allDefenses.length === 0) return '';

    const categoryIcons = {
      'Detect': '🔍', 'Harden': '🔒', 'Isolate': '🧱', 'Deceive': '🎭',
      'Evict': '🚫', 'Monitor': '📡', 'Model': '📐', 'Unknown': '🛡️',
    };

    return `
      <div class="cve-detail-section cve-defense-section-enhanced" style="border-color:rgba(16,185,129,0.2);">
        <div class="cve-detail-section-header" style="color:#10b981;">🛡️ Defensive Mechanisms & Countermeasures (${allDefenses.length})</div>
        <div class="cve-detail-section-body">
          <div class="text-xs text-muted" style="margin-bottom: var(--sp-3);">
            Recommended defensive techniques to detect, prevent, and mitigate this vulnerability. ${defenses.length > 0 ? 'Sources: MITRE D3FEND ontology.' : 'Sources: CWE mitigation database.'}
          </div>
          <div style="display:flex; flex-direction:column; gap: 10px;">
            ${allDefenses.map(d => {
              const cat = d.category || 'Unknown';
              const icon = categoryIcons[cat] || '🛡️';
              const mitigation = d.mitigation || '';
              return `
                <div class="cve-defense-card-v2">
                  <div class="def-header">
                    <span class="def-icon">${icon}</span>
                    <span class="def-name">${this._escapeHtml(d.name || d.id || '')}</span>
                    ${d.id ? `<span class="def-id">${this._escapeHtml(d.id)}</span>` : ''}
                  </div>
                  ${d.description ? `<div class="def-desc">${this._escapeHtml(d.description)}</div>` : ''}
                  ${cat !== 'Unknown' ? `<span class="def-category">${cat}</span>` : ''}
                  ${mitigation ? `<div class="def-mitigation">${mitigation}</div>` : ''}
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    `;
  }

  // Map CWE IDs to practical defense recommendations
  _getCWEDefenses(cwes) {
    const map = {
      'CWE-79': [
        { id: 'DEF-XSS-1', name: 'Output Encoding / Escaping', description: 'Encode all untrusted data before rendering in HTML, JavaScript, CSS, or URL contexts.', category: 'Harden', mitigation: 'Use context-aware encoders: <code>htmlspecialchars()</code> (PHP), <code>DOMPurify.sanitize()</code> (JS), or template engine auto-escaping (React, Jinja2). Apply Content-Security-Policy headers.' },
        { id: 'DEF-XSS-2', name: 'Content Security Policy', description: 'Deploy CSP headers to prevent inline script execution and restrict script sources.', category: 'Isolate', mitigation: 'Set <code>Content-Security-Policy: default-src \'self\'; script-src \'self\'</code> in HTTP response headers.' },
      ],
      'CWE-89': [
        { id: 'DEF-SQLI-1', name: 'Parameterized Queries', description: 'Use prepared statements or parameterized queries for all database interactions.', category: 'Harden', mitigation: 'Replace string concatenation with parameterized queries: <code>db.query("SELECT * FROM users WHERE id = ?", [userId])</code>. Use ORM frameworks (SQLAlchemy, Sequelize, Hibernate).' },
        { id: 'DEF-SQLI-2', name: 'Input Validation & WAF', description: 'Validate and sanitize all user input. Deploy a Web Application Firewall.', category: 'Detect', mitigation: 'Whitelist-validate input types/lengths. Deploy ModSecurity or cloud WAF (Cloudflare, AWS WAF) to catch known SQLi patterns.' },
      ],
      'CWE-78': [
        { id: 'DEF-CMDI-1', name: 'Avoid OS Command Execution', description: 'Use language-native APIs instead of shelling out. If unavoidable, use strict allowlists.', category: 'Harden', mitigation: 'Replace <code>os.system()</code> / <code>exec()</code> with native library calls. If shell is needed, allowlist characters: <code>/^[a-zA-Z0-9._-]+$/</code>' },
      ],
      'CWE-22': [
        { id: 'DEF-TRAV-1', name: 'Path Canonicalization', description: 'Canonicalize file paths and verify they resolve within the intended base directory.', category: 'Harden', mitigation: 'Use <code>path.resolve()</code> and verify the result starts with the base directory. Reject paths containing <code>../</code> or <code>..\\\\</code>.' },
      ],
      'CWE-287': [
        { id: 'DEF-AUTH-1', name: 'Multi-Factor Authentication', description: 'Require multiple authentication factors for sensitive operations.', category: 'Harden', mitigation: 'Implement TOTP (Google Authenticator), WebAuthn/FIDO2, or SMS-based 2FA. Enforce MFA for admin accounts and privileged actions.' },
      ],
      'CWE-502': [
        { id: 'DEF-DESER-1', name: 'Safe Deserialization', description: 'Avoid deserializing untrusted data. Use allowlists for permitted classes.', category: 'Harden', mitigation: 'Use JSON instead of native serialization. If native deserialization is required, use <code>ObjectInputFilter</code> (Java) or type-safe alternatives.' },
      ],
      'CWE-200': [
        { id: 'DEF-INFO-1', name: 'Error Handling & Data Masking', description: 'Return generic error messages. Mask sensitive data in logs and responses.', category: 'Harden', mitigation: 'Never expose stack traces, database errors, or internal paths to end users. Use custom error pages and structured logging.' },
      ],
      'CWE-119': [
        { id: 'DEF-BOF-1', name: 'Memory-Safe Languages & Mitigations', description: 'Use memory-safe languages (Rust, Go) or enable compiler protections.', category: 'Harden', mitigation: 'Enable ASLR, DEP/NX, Stack Canaries (<code>-fstack-protector-strong</code>), and CFI. Use <code>strncpy</code> instead of <code>strcpy</code>. Prefer Rust/Go for new code.' },
      ],
      'CWE-20': [
        { id: 'DEF-INPUT-1', name: 'Input Validation Framework', description: 'Validate all input against strict type, length, format, and range constraints.', category: 'Harden', mitigation: 'Use validation libraries (Joi, Zod, marshmallow). Apply whitelist validation: reject by default, accept known-good patterns only.' },
      ],
      'CWE-352': [
        { id: 'DEF-CSRF-1', name: 'Anti-CSRF Tokens', description: 'Include unique, unpredictable tokens in state-changing requests.', category: 'Harden', mitigation: 'Use framework CSRF middleware (Django CSRF, Express csurf). Set <code>SameSite=Strict</code> on cookies.' },
      ],
      'CWE-611': [
        { id: 'DEF-XXE-1', name: 'Disable External Entities', description: 'Disable DTD processing and external entity resolution in XML parsers.', category: 'Harden', mitigation: 'Set <code>XMLReader.setFeature("http://xml.org/sax/features/external-general-entities", false)</code>. Use JSON instead of XML where possible.' },
      ],
      'CWE-918': [
        { id: 'DEF-SSRF-1', name: 'URL Allowlisting & Network Segmentation', description: 'Restrict outbound requests to approved domains/IPs. Block internal network access.', category: 'Isolate', mitigation: 'Allowlist permitted URLs. Block requests to <code>127.0.0.1</code>, <code>169.254.169.254</code> (cloud metadata), and RFC1918 ranges. Use a proxy for outbound requests.' },
      ],
    };

    const results = [];
    for (const cwe of cwes) {
      const cweId = cwe.id || '';
      if (map[cweId]) {
        results.push(...map[cweId]);
      }
    }
    return results;
  }

  // Generic fallback defenses based on severity
  _getGenericDefenses(cve) {
    const severity = (cve.severity || '').toUpperCase();
    const defenses = [
      { id: 'GEN-PATCH', name: 'Apply Vendor Patches', description: 'Install the latest security patches from the affected software vendor.', category: 'Harden', mitigation: 'Check vendor advisories and apply patches immediately for critical/high severity. Automate patch management with tools like <code>unattended-upgrades</code> (Linux) or WSUS (Windows).' },
      { id: 'GEN-MONITOR', name: 'Network & Endpoint Monitoring', description: 'Monitor for exploitation attempts using IDS/IPS and endpoint detection.', category: 'Detect', mitigation: 'Deploy Suricata/Snort IDS rules targeting this CVE. Enable endpoint logging (Sysmon, auditd) and centralize with SIEM.' },
    ];

    if (severity === 'CRITICAL' || severity === 'HIGH') {
      defenses.push(
        { id: 'GEN-ISOLATE', name: 'Network Segmentation', description: 'Isolate affected systems behind firewalls until patches are applied.', category: 'Isolate', mitigation: 'Place vulnerable systems in a restricted VLAN. Apply firewall rules to limit inbound access to only required services and trusted IPs.' },
        { id: 'GEN-WAF', name: 'Virtual Patching (WAF)', description: 'Deploy WAF rules to block known exploitation patterns while awaiting a permanent patch.', category: 'Detect', mitigation: 'Create ModSecurity/cloud WAF rules to detect and block known exploit payloads targeting this vulnerability.' },
      );
    }
    return defenses;
  }

  // ═══════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════

  _getSeverityColor(severity) {
    const s = (severity || '').toUpperCase();
    if (s === 'CRITICAL') return '#f43f5e';
    if (s === 'HIGH') return '#f59e0b';
    if (s === 'MEDIUM') return '#8b5cf6';
    if (s === 'LOW') return '#10b981';
    return '#6b7280';
  }

  _escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  _escapeAttr(str) {
    if (!str) return '';
    return String(str).replace(/'/g, "\\'").replace(/"/g, '&quot;');
  }

  formatNumber(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return String(n);
  }
}
