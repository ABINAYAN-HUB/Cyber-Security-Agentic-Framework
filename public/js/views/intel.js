// Jarvis Cyber — Threat Intelligence View
import { Chart } from '../components/chart.js';

export class IntelView {
  constructor(app) {
    this.app = app;
  }

  async render(container) {
    container.innerHTML = '<div class="glass-panel"><div class="skeleton skeleton-card" style="height:200px;"></div></div>';

    const [intel, learningStats, attackMemory] = await Promise.all([
      this.app.api('/threat-intel?limit=50'),
      this.app.api('/learning-stats'),
      this.app.api('/attack-memory-stats'),
    ]);

    container.innerHTML = this.buildHTML(intel, learningStats, attackMemory);
    this.setupHandlers();
  }

  teardown() {}

  buildHTML(intel, learningStats, attackMemory) {
    const i = intel || {};
    const cves = i.cves || [];
    const ls = learningStats || [];
    const am = attackMemory || {};

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
          <span class="panel-subtitle">${cves.length} records</span>
        </div>
        <div class="scroll-container" style="max-height:500px;">
          ${cveTableHtml}
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

        // Poll for completion — updated for 28+ sources
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
              // Auto-refresh the page after a brief delay
              setTimeout(() => {
                const container = document.getElementById('page-content');
                if (container) this.render(container);
              }, 1500);
            }
          } catch { /* ignore poll errors */ }
        }, 3000);
      });
    }

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
          <thead><tr><th>Type</th><th>ID</th><th>Title</th><th>Source</th><th>Severity</th></tr></thead>
          <tbody>
            ${allResults.slice(0, 30).map(r => `
              <tr>
                <td><span class="badge ${r._type === 'exploit' ? 'danger' : 'info'}">${r._type}</span></td>
                <td class="mono text-cyan">${r.identifier || r.exploit_id || '—'}</td>
                <td class="truncate" style="max-width:300px;">${r.title || '—'}</td>
                <td class="text-sm text-muted">${r.source || '—'}</td>
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
