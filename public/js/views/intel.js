// Jarvis Cyber — Threat Intelligence View
import { Chart } from '../components/chart.js';

export class IntelView {
  constructor(app) {
    this.app = app;
  }

  async render(container) {
    container.innerHTML = '<div class="glass-panel"><div class="skeleton skeleton-card" style="height:200px;"></div></div>';

    const [intel, learningStats] = await Promise.all([
      this.app.api('/threat-intel?limit=50'),
      this.app.api('/learning-stats'),
    ]);

    container.innerHTML = this.buildHTML(intel, learningStats);
    this.setupHandlers();
  }

  teardown() {}

  buildHTML(intel, learningStats) {
    const i = intel || {};
    const cves = i.cves || [];
    const ls = learningStats || [];

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
                <td><span class="text-cyan">${s.source}</span></td>
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

    // CVE table
    let cveTableHtml = '';
    if (cves.length > 0) {
      cveTableHtml = `
        <table class="data-table">
          <thead>
            <tr><th>CVE ID</th><th>Title</th><th>Severity</th><th>CVSS</th><th>Published</th></tr>
          </thead>
          <tbody>
            ${cves.map(c => {
              const sev = (c.severity || 'info').toLowerCase();
              const sevClass = sev === 'critical' ? 'critical' : sev === 'high' ? 'high' : sev === 'medium' ? 'medium' : 'low';
              return `
                <tr>
                  <td><span class="text-mono text-cyan">${c.identifier || '—'}</span></td>
                  <td style="max-width:300px;" class="truncate">${c.title || '—'}</td>
                  <td><span class="badge ${sevClass}">${(c.severity || 'N/A').toUpperCase()}</span></td>
                  <td class="mono">${c.cvss_score ? c.cvss_score.toFixed(1) : '—'}</td>
                  <td class="mono text-muted">${c.published_at ? c.published_at.slice(0, 10) : '—'}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      `;
    } else {
      cveTableHtml = '<div class="empty-state"><span class="empty-icon">🛡️</span><span class="empty-title">No CVE data</span><span class="empty-description">Run auto-learning to fetch CVEs from NVD, CISA, and other feeds.</span></div>';
    }

    return `
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
      </div>

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
            <span class="panel-title">📡 Learning Sources</span>
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
          <input type="text" class="input" id="intel-search" placeholder="Search CVEs, exploits, IOCs..." style="flex:1;">
          <button class="btn btn-primary" id="intel-search-btn">Search</button>
        </div>
        <div id="intel-search-results" style="margin-top:var(--sp-4);"></div>
      </div>

      <!-- CVE Table -->
      <div class="glass-panel">
        <div class="panel-header">
          <span class="panel-title">🔒 Latest CVEs</span>
          <span class="panel-subtitle">${cves.length} records</span>
        </div>
        <div class="scroll-container" style="max-height:500px;">
          ${cveTableHtml}
        </div>
      </div>
    `;
  }

  setupHandlers() {
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
        resultsEl.innerHTML = '<div class="text-sm text-muted">No results found.</div>';
        return;
      }

      resultsEl.innerHTML = `
        <div class="text-sm text-muted mb-4">${allResults.length} results</div>
        <table class="data-table">
          <thead><tr><th>Type</th><th>ID</th><th>Title</th><th>Severity</th></tr></thead>
          <tbody>
            ${allResults.slice(0, 30).map(r => `
              <tr>
                <td><span class="badge ${r._type === 'exploit' ? 'danger' : 'info'}">${r._type}</span></td>
                <td class="mono text-cyan">${r.identifier || r.exploit_id || '—'}</td>
                <td class="truncate" style="max-width:300px;">${r.title || '—'}</td>
                <td>${r.severity ? `<span class="badge ${(r.severity || '').toLowerCase()}">${r.severity}</span>` : '—'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    };

    searchBtn?.addEventListener('click', doSearch);
    searchInput?.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSearch(); });
  }

  formatNumber(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return String(n);
  }
}
