// Jarvis Cyber — Dashboard View
import { Chart } from '../components/chart.js';
import { Modal } from '../components/modal.js';

export class DashboardView {
  constructor(app) {
    this.app = app;
    this.refreshInterval = null;
  }

  async render(container) {
    container.innerHTML = this.getSkeletonHTML();
    
    // Load data in parallel
    const [stats, health, usageStats, executionLog, services, frameworks] = await Promise.all([
      this.app.api('/stats'),
      this.app.api('/health'),
      this.app.api('/usage-stats'),
      this.app.api('/execution-log'),
      this.app.api('/services'),
      this.app.api('/frameworks'),
    ]);

    container.innerHTML = this.buildHTML(stats, health, usageStats, executionLog, services, frameworks);

    // Animate counters
    this.animateCounters();

    // Setup db cards click handlers
    this.setupDbCardHandlers();

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

  buildHTML(stats, health, usageStats, executionLog, services, frameworks) {
    const s = stats || {};
    const h = health || {};
    const toolUsageEntries = Object.entries(usageStats || {}).sort((a, b) => b[1].calls - a[1].calls).slice(0, 12);
    const execLog = executionLog || [];
    const svc = services || {};
    const fw = frameworks || {};

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

    // MITRE ATT&CK — Full tactic-grouped heatmap from backend
    const mitreTechniques = {};
    execLog.forEach(e => { if (e.mitre) mitreTechniques[e.mitre] = (mitreTechniques[e.mitre] || 0) + 1; });

    const mitreTactics = fw.mitre?.tactics || [];
    const mitreHtml = this.buildMitreHeatmap(mitreTactics, mitreTechniques);

    // Cyber Kill Chain visualization
    const killChainPhases = fw.killChain?.phases || [];
    const killChainHtml = this.buildKillChainViz(killChainPhases, execLog);

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

      <!-- Cyber Kill Chain -->
      <div class="glass-panel glow-rose mb-6">
        <div class="panel-header">
          <span class="panel-title">⚔️ Cyber Kill Chain — Phase Progression</span>
          <span class="panel-subtitle">Lockheed Martin Model • ${killChainPhases.length} Phases</span>
        </div>
        ${killChainHtml}
      </div>

      <!-- MITRE ATT&CK Full Heatmap -->
      <div class="glass-panel glow-cyan mb-6">
        <div class="panel-header">
          <span class="panel-title">🎯 MITRE ATT&CK Enterprise Coverage</span>
          <span class="panel-subtitle">${mitreTactics.length} tactics • ${Object.keys(mitreTechniques).length} techniques triggered this session</span>
        </div>
        ${mitreHtml}
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

  // ═══ MITRE ATT&CK Full Heatmap ═══
  buildMitreHeatmap(tactics, activeTechniques) {
    if (!tactics || tactics.length === 0) {
      return `<div class="empty-state"><span class="empty-icon">🎯</span><span class="empty-title">No framework data</span><span class="empty-description">Framework data unavailable. Check /api/frameworks endpoint.</span></div>`;
    }

    return `<div class="mitre-tactics-container">
      ${tactics.map(tactic => {
        const techniques = tactic.techniques || [];
        const activeCount = techniques.filter(t => activeTechniques[t.id]).length;
        const tacticColor = this.getTacticColor(tactic.id);

        return `
          <div class="mitre-tactic-group">
            <div class="mitre-tactic-header" style="border-left: 3px solid ${tacticColor};">
              <div class="mitre-tactic-id" style="color:${tacticColor};">${tactic.id}</div>
              <div class="mitre-tactic-name">${tactic.name}</div>
              <div class="mitre-tactic-count">${techniques.length} techniques${activeCount > 0 ? ` • <span style="color:var(--cyan);">${activeCount} active</span>` : ''}</div>
            </div>
            <div class="mitre-techniques-grid">
              ${techniques.map(t => {
                const hits = activeTechniques[t.id] || 0;
                const isActive = hits > 0;
                return `
                  <div class="mitre-cell ${isActive ? 'active' : ''}" title="${t.id}: ${t.name}${t.sub ? '\nSub-techniques: ' + t.sub.join(', ') : ''}${isActive ? '\n\nHits: ' + hits : ''}">
                    <div style="font-weight:700;font-size:0.62rem;">${t.id}</div>
                    <div style="font-size:0.58rem;line-height:1.2;margin-top:1px;">${t.name.length > 22 ? t.name.slice(0, 20) + '…' : t.name}</div>
                    ${isActive ? `<div style="margin-top:2px;font-weight:700;color:var(--cyan);font-size:0.65rem;">${hits}</div>` : ''}
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        `;
      }).join('')}
    </div>`;
  }

  getTacticColor(tacticId) {
    const colors = {
      'TA0043': '#00f0ff', // Reconnaissance — cyan
      'TA0042': '#8b5cf6', // Resource Dev — violet
      'TA0001': '#f43f5e', // Initial Access — rose
      'TA0002': '#f59e0b', // Execution — amber
      'TA0003': '#10b981', // Persistence — emerald
      'TA0004': '#ec4899', // Priv Esc — pink
      'TA0005': '#6366f1', // Defense Evasion — indigo
      'TA0006': '#ef4444', // Credential Access — red
      'TA0007': '#14b8a6', // Discovery — teal
      'TA0008': '#f97316', // Lateral Movement — orange
      'TA0009': '#a855f7', // Collection — purple
      'TA0011': '#06b6d4', // C2 — sky
      'TA0010': '#eab308', // Exfiltration — yellow
      'TA0040': '#dc2626', // Impact — deep red
    };
    return colors[tacticId] || '#64748b';
  }

  // ═══ Cyber Kill Chain Visualization ═══
  buildKillChainViz(phases, execLog) {
    if (!phases || phases.length === 0) {
      return '<div class="empty-state"><span class="empty-icon">⚔️</span><span class="empty-title">No Kill Chain data</span><span class="empty-description">Framework data unavailable.</span></div>';
    }

    const phaseIcons = ['🔍', '⚒️', '📬', '💥', '🔩', '📡', '🎯'];
    const phaseColors = ['#00f0ff', '#8b5cf6', '#f59e0b', '#f43f5e', '#10b981', '#06b6d4', '#ec4899'];

    return `
      <div class="kill-chain-container">
        <div class="kill-chain-track">
          ${phases.map((phase, i) => {
            const mitreTactics = (phase.mitre_tactics || []).join(', ');
            return `
              <div class="kill-chain-phase" style="--phase-color: ${phaseColors[i]};">
                <div class="kill-chain-node">
                  <div class="kill-chain-icon">${phaseIcons[i] || '⚡'}</div>
                  <div class="kill-chain-number">Phase ${phase.id}</div>
                </div>
                <div class="kill-chain-info">
                  <div class="kill-chain-phase-name">${phase.name}</div>
                  <div class="kill-chain-phase-desc">${phase.description}</div>
                  <div class="kill-chain-phase-meta">
                    ${mitreTactics ? `<span class="tag" style="color:var(--violet);font-size:0.6rem;">${mitreTactics}</span>` : ''}
                    <span class="tag" style="font-size:0.6rem;">${(phase.objectives || []).length} objectives</span>
                  </div>
                </div>
                ${i < phases.length - 1 ? '<div class="kill-chain-arrow">→</div>' : ''}
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <!-- Kill Chain Details Grid -->
      <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: var(--sp-3); margin-top: var(--sp-5);">
        ${phases.map((phase, i) => `
          <div class="kill-chain-detail-card" style="border-top: 2px solid ${phaseColors[i]};">
            <div class="flex items-center gap-2" style="margin-bottom: var(--sp-3);">
              <span style="font-size:1.2rem;">${phaseIcons[i]}</span>
              <span style="font-weight:700; font-size:0.9rem;">${phase.name}</span>
              <span class="badge info" style="margin-left:auto;">Phase ${phase.id}</span>
            </div>
            <ul class="kill-chain-objectives">
              ${(phase.objectives || []).slice(0, 4).map(obj => `
                <li>${obj}</li>
              `).join('')}
              ${(phase.objectives || []).length > 4 ? `<li class="text-muted">+${phase.objectives.length - 4} more</li>` : ''}
            </ul>
            ${(phase.tool_categories || []).length > 0 ? `
              <div style="margin-top:var(--sp-2); display:flex; flex-wrap:wrap; gap:4px;">
                ${phase.tool_categories.slice(0, 4).map(cat => `<span class="tag" style="font-size:0.6rem;">${cat}</span>`).join('')}
              </div>
            ` : ''}
          </div>
        `).join('')}
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
      <div class="clickable-db-card" data-table="${t.key}" style="background:var(--bg-elevated);padding:var(--sp-3);border-radius:var(--radius-md);border:1px solid var(--border-subtle);text-align:center;cursor:pointer;transition:all var(--transition-fast);">
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

  setupDbCardHandlers() {
    document.querySelectorAll('.clickable-db-card').forEach(card => {
      card.addEventListener('click', async () => {
        const table = card.dataset.table;
        const title = card.querySelector('.text-xs').textContent + ' Database Records';

        let contentHtml = '<div class="flex items-center gap-2" style="padding:var(--sp-4);"><div class="spinner"></div><span>Loading records...</span></div>';
        const modal = Modal.show(title, contentHtml, { width: '800px' });

        try {
          let data = null;
          if (table === 'loot') {
            data = await this.app.api('/loot');
          } else if (table === 'targets') {
            data = await this.app.api('/targets');
          } else if (table === 'scan_results') {
            data = await this.app.api('/scan-results');
          } else if (table === 'operations') {
            data = await this.app.api('/operations');
          } else {
            data = await this.app.api(`/memory/table/${table}`);
          }

          if (data && data.results && data.results.length > 0) {
            contentHtml = this.buildTableModalHTML(table, data.results);
          } else {
            contentHtml = '<div class="text-sm text-muted" style="padding:var(--sp-4);">No records found.</div>';
          }
        } catch (err) {
          contentHtml = `<div class="text-sm text-rose" style="padding:var(--sp-4);">Error loading records: ${err.message}</div>`;
        }

        modal.querySelector('.modal-body').innerHTML = contentHtml;
      });
    });
  }

  buildTableModalHTML(table, results) {
    if (table === 'loot') {
      return `
        <div class="scroll-container" style="max-height:450px;">
          <table class="data-table">
            <thead><tr><th>Target</th><th>Type</th><th>Credentials / Loot</th><th>Date</th></tr></thead>
            <tbody>
              ${results.slice(0, 20).map(r => {
                const lootVal = typeof r.data === 'object' ? JSON.stringify(r.data, null, 2) : r.data;
                return `
                  <tr>
                    <td><span class="text-cyan font-semibold">${r.target || 'Global'}</span></td>
                    <td><span class="badge info">${r.type}</span></td>
                    <td><pre class="code-block" style="font-size:0.75rem;padding:var(--sp-2) var(--sp-3);margin:0;max-height:100px;overflow-y:auto;white-space:pre-wrap;word-break:break-all;">${lootVal}</pre></td>
                    <td class="mono text-muted text-xs" style="white-space:nowrap;">${r.created_at?.slice(0, 19) || '—'}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    if (table === 'targets') {
      return `
        <div class="scroll-container" style="max-height:450px;">
          <table class="data-table">
            <thead><tr><th>Identifier</th><th>Type</th><th>Details</th><th>Source</th></tr></thead>
            <tbody>
              ${results.slice(0, 20).map(r => {
                const details = typeof r.data === 'object' ? JSON.stringify(r.data, null, 2) : r.data;
                return `
                  <tr>
                    <td><span class="text-cyan font-semibold">${r.identifier}</span></td>
                    <td><span class="badge info">${r.type}</span></td>
                    <td><pre class="code-block" style="font-size:0.75rem;padding:var(--sp-2) var(--sp-3);margin:0;max-height:100px;overflow-y:auto;white-space:pre-wrap;word-break:break-all;">${details}</pre></td>
                    <td><span class="tag">${r.source || 'manual'}</span></td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    if (table === 'scan_results') {
      return `
        <div class="scroll-container" style="max-height:450px;">
          <table class="data-table">
            <thead><tr><th>Target</th><th>Scanner</th><th>Ports</th><th>Vulns</th><th>OS</th></tr></thead>
            <tbody>
              ${results.slice(0, 20).map(r => `
                <tr>
                  <td><span class="text-cyan font-semibold">${r.target}</span></td>
                  <td><span class="badge info">${r.scanner}</span></td>
                  <td class="mono text-xs">${r.ports || '—'}</td>
                  <td style="max-width:150px;" class="truncate" title="${r.vulns || ''}">${r.vulns || '—'}</td>
                  <td><span class="tag">${r.os_detected || '—'}</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    if (table === 'operations') {
      return `
        <div class="scroll-container" style="max-height:450px;">
          <table class="data-table">
            <thead><tr><th>Type</th><th>Target</th><th>Tool</th><th>Status</th><th>Summary</th></tr></thead>
            <tbody>
              ${results.slice(0, 20).map(r => `
                <tr>
                  <td><span class="badge info">${r.op_type}</span></td>
                  <td class="mono text-xs" style="white-space:nowrap;">${r.target || '—'}</td>
                  <td><span class="text-cyan font-semibold">${r.tool_name}</span></td>
                  <td><span class="badge ${r.status === 'completed' ? 'success' : r.status === 'failed' ? 'danger' : 'warning'}">${r.status}</span></td>
                  <td style="max-width:150px;" class="truncate" title="${r.result_summary || ''}">${r.result_summary || '—'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    if (results && results.length > 0) {
      const allKeys = Object.keys(results[0]).filter(k => k !== 'embedding');
      return `
        <div class="scroll-container" style="max-height:450px;overflow-x:auto;">
          <table class="data-table">
            <thead>
              <tr>
                ${allKeys.map(k => `<th>${this._escapeHtml(k.replace(/_/g, ' ').toUpperCase())}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${results.slice(0, 30).map(r => `
                <tr>
                  ${allKeys.map(k => {
                    let val = r[k];
                    if (val === null || val === undefined) return '<td class="text-muted">—</td>';
                    let strVal = typeof val === 'object' ? JSON.stringify(val) : String(val);
                    if (strVal.length > 80) {
                      return `<td style="max-width:200px;" class="truncate" title="${this._escapeHtml(strVal)}">${this._escapeHtml(strVal.slice(0, 77))}...</td>`;
                    }
                    return `<td>${this._escapeHtml(strVal)}</td>`;
                  }).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    return '<div class="text-sm text-muted">Preview not supported for this table.</div>';
  }

  _escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
