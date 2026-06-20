// Jarvis Cyber — Reports View
import { renderMarkdown } from '../components/markdown.js';
import { Toast } from '../components/toast.js';

export class ReportsView {
  constructor(app) {
    this.app = app;
  }

  async render(container) {
    container.innerHTML = '<div class="glass-panel"><div class="skeleton skeleton-card" style="height:200px;"></div></div>';

    const [execLog, usageStats, reportsList] = await Promise.all([
      this.app.api('/execution-log'),
      this.app.api('/usage-stats'),
      this.app.api('/reports-list'),
    ]);

    container.innerHTML = this.buildHTML(execLog, usageStats, reportsList);
    this.setupHandlers();
  }

  teardown() {}

  buildHTML(execLog, usageStats, reportsList) {
    const log = execLog || [];
    const stats = usageStats || {};
    const reports = reportsList?.reports || [];

    const totalCalls = Object.values(stats).reduce((sum, s) => sum + s.calls, 0);
    const totalSuccess = Object.values(stats).reduce((sum, s) => sum + s.successes, 0);
    const totalFail = Object.values(stats).reduce((sum, s) => sum + s.failures, 0);

    // Execution timeline (last 30)
    const recent = log.slice(-30).reverse();
    let timelineHtml = '';
    if (recent.length > 0) {
      timelineHtml = `
        <table class="data-table">
          <thead>
            <tr><th>#</th><th>Time</th><th>Tool</th><th>Action</th><th>MITRE</th><th>Status</th><th>Duration</th></tr>
          </thead>
          <tbody>
            ${recent.map((entry, i) => `
              <tr>
                <td class="mono text-muted">${log.length - i}</td>
                <td class="mono">${entry.timestamp?.slice(11, 19) || '—'}</td>
                <td><span class="text-cyan">${entry.tool}</span></td>
                <td class="text-muted">${entry.args_summary || '—'}</td>
                <td>${entry.mitre ? `<span class="tag" style="color:var(--violet);">${entry.mitre}</span>` : '—'}</td>
                <td>${entry.success ? '<span class="badge success">✅</span>' : '<span class="badge danger">❌</span>'}</td>
                <td class="mono text-muted">${entry.duration_ms ? entry.duration_ms + 'ms' : '—'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } else {
      timelineHtml = '<div class="empty-state"><span class="empty-icon">📝</span><span class="empty-title">No execution data</span><span class="empty-description">Run tools via the Agent Chat to generate an execution log.</span></div>';
    }

    // Reports list
    let reportsListHtml = '';
    if (reports.length > 0) {
      reportsListHtml = reports.map(f => `
        <div class="flex items-center gap-3" style="padding:var(--sp-2) 0; border-bottom:1px solid var(--border-subtle);">
          <span>📝</span>
          <span class="text-mono text-sm truncate" style="flex:1;" title="${f}">${f}</span>
          <a class="btn btn-sm btn-secondary" href="/api/reports/download/${encodeURIComponent(f)}" download>⬇️ Download</a>
        </div>
      `).join('');
    } else {
      reportsListHtml = '<div class="text-sm text-muted" style="padding:var(--sp-4);">No reports generated yet.</div>';
    }

    return `
      <!-- Stats -->
      <div class="stats-grid mb-6">
        <div class="glass-panel stat-card glow-cyan cyan">
          <span class="stat-icon">⚡</span>
          <div class="stat-value">${totalCalls}</div>
          <div class="stat-label">Total Executions</div>
        </div>
        <div class="glass-panel stat-card glow-emerald emerald">
          <span class="stat-icon">✅</span>
          <div class="stat-value">${totalSuccess}</div>
          <div class="stat-label">Successful</div>
        </div>
        <div class="glass-panel stat-card glow-rose rose">
          <span class="stat-icon">❌</span>
          <div class="stat-value">${totalFail}</div>
          <div class="stat-label">Failed</div>
        </div>
        <div class="glass-panel stat-card glow-violet violet">
          <span class="stat-icon">📝</span>
          <div class="stat-value">${reports.length}</div>
          <div class="stat-label">Reports</div>
        </div>
      </div>

      <div class="grid-2 mb-6">
        <!-- Generate Report -->
        <div class="glass-panel glow-cyan">
          <div class="panel-header">
            <span class="panel-title">📝 Generate Report</span>
          </div>
          <div class="flex flex-col gap-4">
            <div class="input-group">
              <label class="input-label">Target</label>
              <input type="text" class="input" id="report-target" placeholder="e.g., example.com">
            </div>
            <div class="input-group">
              <label class="input-label">Objective</label>
              <input type="text" class="input" id="report-objective" placeholder="e.g., Security Assessment" value="Security Assessment">
            </div>
            <button class="btn btn-primary btn-lg" id="generate-report-btn" ${log.length === 0 ? 'disabled' : ''}>
              📊 Generate Pentest Report
            </button>
            ${log.length === 0 ? '<div class="text-xs text-muted">Run some tools first to generate a report from execution data.</div>' : ''}
          </div>
          <div id="report-result"></div>
        </div>

        <!-- Past Reports -->
        <div class="glass-panel glow-violet">
          <div class="panel-header">
            <span class="panel-title">📂 Past Reports</span>
            <span class="panel-subtitle">${reports.length} files</span>
          </div>
          <div class="scroll-container" style="max-height:300px;">
            ${reportsListHtml}
          </div>
        </div>
      </div>

      <!-- Execution Timeline -->
      <div class="glass-panel">
        <div class="panel-header">
          <span class="panel-title">🕐 Execution Timeline</span>
          <span class="panel-subtitle">${log.length} total executions</span>
        </div>
        <div class="scroll-container" style="max-height:500px;">
          ${timelineHtml}
        </div>
      </div>
    `;
  }

  setupHandlers() {
    const generateBtn = document.getElementById('generate-report-btn');
    generateBtn?.addEventListener('click', async () => {
      const target = document.getElementById('report-target')?.value?.trim() || 'Unknown Target';
      const objective = document.getElementById('report-objective')?.value?.trim() || 'Security Assessment';
      const resultEl = document.getElementById('report-result');

      generateBtn.disabled = true;
      generateBtn.textContent = '⏳ Generating...';

      const result = await this.app.apiPost('/report', { target, objective });

      generateBtn.disabled = false;
      generateBtn.textContent = '📊 Generate Pentest Report';

      if (result?.success) {
        Toast.success(`Report generated: ${result.filename}`);
        if (resultEl) {
          resultEl.innerHTML = `
            <div class="glass-panel" style="border-color:rgba(16,185,129,0.3); margin-top:var(--sp-4);">
              <div class="flex items-center gap-2 mb-2">
                <span class="badge success">Generated</span>
                <span class="text-mono text-sm truncate" style="max-width:200px;" title="${result.filename}">${result.filename}</span>
              </div>
              <div class="text-sm text-muted mb-3">
                ${result.tools_used} tools · ${result.total_executions} executions · ${result.findings_count} findings · ${(result.report_length / 1024).toFixed(1)}KB
              </div>
              <a class="btn btn-primary" href="/api/reports/download/${encodeURIComponent(result.filename)}" download style="width:100%;">⬇️ Download Report File</a>
            </div>
          `;
        }
      } else {
        Toast.error(result?.error || 'Failed to generate report');
        if (resultEl) {
          resultEl.innerHTML = `<div class="text-sm text-rose" style="margin-top:var(--sp-4);">⚠️ ${result?.error || 'Unknown error'}</div>`;
        }
      }
    });
  }
}
