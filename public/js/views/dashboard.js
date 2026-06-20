// Jarvis Cyber — Dashboard View
import { Chart } from '../components/chart.js';

export class DashboardView {
  constructor(app) {
    this.app = app;
    this.refreshInterval = null;
  }

  async render(container) {
    container.innerHTML = this.getSkeletonHTML();
    
    // Load data in parallel
    const [stats, health, usageStats, executionLog, services] = await Promise.all([
      this.app.api('/stats'),
      this.app.api('/health'),
      this.app.api('/usage-stats'),
      this.app.api('/execution-log'),
      this.app.api('/services'),
    ]);

    container.innerHTML = this.buildHTML(stats, health, usageStats, executionLog, services);

    // Animate counters
    this.animateCounters();

    // Auto-refresh every 30s
    this.refreshInterval = setInterval(() => this.refreshData(container), 30000);
  }

  teardown() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  async refreshData(container) {
    const [stats, usageStats] = await Promise.all([
      this.app.api('/stats'),
      this.app.api('/usage-stats'),
    ]);
    // Update only the stat values without full re-render
    if (stats) {
      this.updateStat('stat-tools', (stats.tool_knowledge || 0));
      this.updateStat('stat-intel', (stats.threat_intel || 0));
      this.updateStat('stat-scans', (stats.scan_results || 0));
      this.updateStat('stat-ops', (stats.operations || 0));
    }
  }

  updateStat(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = this.formatNumber(value);
  }

  buildHTML(stats, health, usageStats, executionLog, services) {
    const s = stats || {};
    const h = health || {};
    const toolUsageEntries = Object.entries(usageStats || {}).sort((a, b) => b[1].calls - a[1].calls).slice(0, 12);
    const execLog = executionLog || [];
    const svc = services || {};

    // Build tool usage chart data
    const chartData = toolUsageEntries.map(([name, data]) => ({
      label: name,
      value: data.calls,
      color: data.failures > data.successes ? '#f43f5e' : '#00f0ff',
    }));

    // Build services HTML
    let servicesHtml = '';
    const activeServices = svc.services ? Object.entries(svc.services) : [];
    if (activeServices.length > 0) {
      servicesHtml = activeServices.map(([, srv]) => `
        <div class="flex items-center gap-2" style="padding: var(--sp-2) 0;">
          <span class="status-dot online"></span>
          <span style="font-weight:600; font-size:0.85rem;">${srv.displayName}</span>
          <span class="text-mono text-xs text-muted" style="margin-left:auto;">${srv.host}:${srv.port}</span>
          <span class="badge info">${srv.type}</span>
        </div>
      `).join('');
    } else {
      servicesHtml = '<div class="text-sm text-muted" style="padding:var(--sp-3) 0;">No active services detected</div>';
    }

    // Build activity timeline (last 8)
    const recent = execLog.slice(-8).reverse();
    let timelineHtml = '';
    if (recent.length > 0) {
      timelineHtml = recent.map(entry => `
        <div class="timeline-item">
          <div class="timeline-dot ${entry.success ? 'success' : 'error'}"></div>
          <div class="timeline-content">
            <div class="timeline-time">${entry.timestamp?.slice(11, 19) || '—'}</div>
            <div class="timeline-title">${entry.tool}</div>
            <div class="timeline-desc">${entry.args_summary || '—'} ${entry.mitre ? `<span class="tag" style="margin-left:4px;">${entry.mitre}</span>` : ''}</div>
          </div>
        </div>
      `).join('');
    } else {
      timelineHtml = '<div class="text-sm text-muted" style="padding:var(--sp-4);">No activity yet this session. Start a chat to begin.</div>';
    }

    // MITRE heatmap data
    const mitreTechniques = {};
    execLog.forEach(e => { if (e.mitre) mitreTechniques[e.mitre] = (mitreTechniques[e.mitre] || 0) + 1; });
    const mitreData = [
      { id: 'T1595', name: 'Active Scanning' },
      { id: 'T1592', name: 'Gather Info' },
      { id: 'T1590', name: 'Network Info' },
      { id: 'T1596', name: 'Search DBs' },
      { id: 'T1593', name: 'Search Web' },
      { id: 'T1046', name: 'Network Svc Discovery' },
      { id: 'T1190', name: 'Exploit Public App' },
      { id: 'T1110', name: 'Brute Force' },
      { id: 'T1071', name: 'App Layer Protocol' },
      { id: 'T1587', name: 'Develop Capabilities' },
      { id: 'T1021', name: 'Remote Services' },
      { id: 'T1040', name: 'Network Sniffing' },
      { id: 'T1557', name: 'Adversary-in-Middle' },
      { id: 'T1087', name: 'Account Discovery' },
      { id: 'T1068', name: 'Privilege Escalation' },
      { id: 'T1572', name: 'Protocol Tunneling' },
      { id: 'T1588', name: 'Obtain Capabilities' },
      { id: 'T1189', name: 'Drive-by Compromise' },
    ];
    const mitreHtml = mitreData.map(t => `
      <div class="mitre-cell ${mitreTechniques[t.id] ? 'active' : ''}" title="${t.id}: ${t.name} (${mitreTechniques[t.id] || 0} hits)">
        <div style="font-weight:700;">${t.id}</div>
        <div>${t.name}</div>
        ${mitreTechniques[t.id] ? `<div style="margin-top:2px;font-weight:700;color:var(--cyan);">${mitreTechniques[t.id]}</div>` : ''}
      </div>
    `).join('');

    return `
      <!-- Stats Row -->
      <div class="stats-grid mb-6">
        <div class="glass-panel stat-card glow-cyan cyan">
          <span class="stat-icon">🔧</span>
          <div class="stat-value" id="stat-tools" data-target="${s.tool_knowledge || 0}">${this.formatNumber(s.tool_knowledge || 0)}</div>
          <div class="stat-label">Tool Knowledge</div>
          <div class="stat-trend text-emerald">+ Active Registry</div>
        </div>
        <div class="glass-panel stat-card glow-violet violet">
          <span class="stat-icon">🛡️</span>
          <div class="stat-value" id="stat-intel" data-target="${s.threat_intel || 0}">${this.formatNumber(s.threat_intel || 0)}</div>
          <div class="stat-label">Threat Intel</div>
          <div class="stat-trend text-muted">CVEs + IOCs + Exploits</div>
        </div>
        <div class="glass-panel stat-card glow-emerald emerald">
          <span class="stat-icon">🔬</span>
          <div class="stat-value" id="stat-scans" data-target="${s.scan_results || 0}">${this.formatNumber(s.scan_results || 0)}</div>
          <div class="stat-label">Scan Results</div>
          <div class="stat-trend text-muted">Historical scans</div>
        </div>
        <div class="glass-panel stat-card glow-rose rose">
          <span class="stat-icon">⚡</span>
          <div class="stat-value" id="stat-ops" data-target="${s.operations || 0}">${this.formatNumber(s.operations || 0)}</div>
          <div class="stat-label">Operations</div>
          <div class="stat-trend text-muted">Logged actions</div>
        </div>
      </div>

      <!-- Main Grid -->
      <div class="grid-2 mb-6">
        <!-- System Health -->
        <div class="glass-panel glow-cyan">
          <div class="panel-header">
            <span class="panel-title">📡 System Health</span>
            <span class="badge ${h.apiConnected ? 'success' : 'danger'}">${h.apiConnected ? 'Online' : 'Offline'}</span>
          </div>
          <div style="display:flex; flex-direction:column; gap:var(--sp-3);">
            <div class="flex justify-between items-center">
              <span class="text-sm text-muted">AI Model</span>
              <span class="text-mono text-sm">${h.model || '—'}</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-sm text-muted">API Status</span>
              <span class="badge ${h.apiConnected ? 'success' : 'danger'}">${h.apiConnected ? 'Connected' : 'Unreachable'}</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-sm text-muted">Server Uptime</span>
              <span class="text-mono text-sm">${h.uptime ? this.formatUptime(h.uptime) : '—'}</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-sm text-muted">Knowledge Entries</span>
              <span class="text-mono text-sm">${this.formatNumber(s.knowledge || 0)}</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-sm text-muted">Nuclei Results</span>
              <span class="text-mono text-sm">${this.formatNumber(s.nuclei_results || 0)}</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-sm text-muted">Exploits DB</span>
              <span class="text-mono text-sm">${this.formatNumber(s.exploit_db || 0)}</span>
            </div>
          </div>
        </div>

        <!-- Active Services -->
        <div class="glass-panel glow-emerald">
          <div class="panel-header">
            <span class="panel-title">🔌 Active Services</span>
            <span class="panel-subtitle">${activeServices.length} detected</span>
          </div>
          ${servicesHtml}
          ${svc.proxy ? `<div class="divider"></div><div class="flex items-center gap-2 text-sm"><span style="color:var(--emerald);">🌐</span><span>Active Proxy:</span><span class="text-mono text-cyan">${svc.proxy}</span></div>` : ''}
        </div>
      </div>

      <div class="grid-2 mb-6">
        <!-- Tool Usage Chart -->
        <div class="glass-panel glow-violet">
          <div class="panel-header">
            <span class="panel-title">📊 Session Tool Usage</span>
            <span class="panel-subtitle">${execLog.length} executions</span>
          </div>
          ${chartData.length > 0
            ? Chart.horizontalBar(chartData, { width: 500 })
            : '<div class="empty-state"><span class="empty-icon">📊</span><span class="empty-title">No tools used yet</span><span class="empty-description">Start a chat and run some commands to see usage data.</span></div>'
          }
        </div>

        <!-- Activity Timeline -->
        <div class="glass-panel glow-rose">
          <div class="panel-header">
            <span class="panel-title">🕐 Recent Activity</span>
            <span class="panel-subtitle">Last ${recent.length} actions</span>
          </div>
          <div class="timeline scroll-container" style="max-height:340px;">
            ${timelineHtml}
          </div>
        </div>
      </div>

      <!-- MITRE ATT&CK Heatmap -->
      <div class="glass-panel glow-cyan mb-6">
        <div class="panel-header">
          <span class="panel-title">🎯 MITRE ATT&CK Coverage</span>
          <span class="panel-subtitle">${Object.keys(mitreTechniques).length} techniques triggered</span>
        </div>
        <div class="mitre-grid">
          ${mitreHtml}
        </div>
      </div>

      <!-- Database Tables Overview -->
      <div class="glass-panel">
        <div class="panel-header">
          <span class="panel-title">💾 Database Overview</span>
        </div>
        <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: var(--sp-3);">
          ${this.buildDbCards(s)}
        </div>
      </div>
    `;
  }

  buildDbCards(s) {
    const tables = [
      { name: 'Knowledge', key: 'knowledge', icon: '📚' },
      { name: 'Targets', key: 'targets', icon: '🎯' },
      { name: 'Operations', key: 'operations', icon: '⚡' },
      { name: 'Scan Results', key: 'scan_results', icon: '🔬' },
      { name: 'Threat Intel', key: 'threat_intel', icon: '🛡️' },
      { name: 'Exploits', key: 'exploit_db', icon: '💀' },
      { name: 'Attack Logs', key: 'attack_logs', icon: '⚔️' },
      { name: 'Nuclei', key: 'nuclei_results', icon: '⚛️' },
      { name: 'FOFA', key: 'fofa_results', icon: '🌐' },
      { name: 'Loot', key: 'loot', icon: '💎' },
      { name: 'Tool Knowledge', key: 'tool_knowledge', icon: '🔧' },
      { name: 'Tasks', key: 'tasks', icon: '📋' },
    ];

    return tables.map(t => `
      <div style="background:var(--bg-elevated);padding:var(--sp-3);border-radius:var(--radius-md);border:1px solid var(--border-subtle);text-align:center;">
        <div style="font-size:1.3rem;margin-bottom:var(--sp-1);">${t.icon}</div>
        <div class="text-mono" style="font-size:1.1rem;font-weight:800;color:var(--text-primary);">${this.formatNumber(s[t.key] || 0)}</div>
        <div class="text-xs text-muted">${t.name}</div>
      </div>
    `).join('');
  }

  getSkeletonHTML() {
    return `
      <div class="stats-grid mb-6">
        ${Array(4).fill('<div class="glass-panel stat-card"><div class="skeleton skeleton-title"></div><div class="skeleton skeleton-text" style="width:60%;height:28px;"></div><div class="skeleton skeleton-text" style="width:40%;"></div></div>').join('')}
      </div>
      <div class="grid-2 mb-6">
        <div class="glass-panel"><div class="skeleton skeleton-card"></div></div>
        <div class="glass-panel"><div class="skeleton skeleton-card"></div></div>
      </div>
    `;
  }

  formatNumber(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return String(n);
  }

  formatUptime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  }

  animateCounters() {
    document.querySelectorAll('.stat-value[data-target]').forEach(el => {
      const target = parseInt(el.dataset.target) || 0;
      if (target === 0) return;
      let current = 0;
      const step = Math.max(1, Math.ceil(target / 40));
      const interval = setInterval(() => {
        current = Math.min(current + step, target);
        el.textContent = this.formatNumber(current);
        if (current >= target) clearInterval(interval);
      }, 30);
    });
  }
}
