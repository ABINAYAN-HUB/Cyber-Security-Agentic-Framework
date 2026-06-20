// Jarvis Cyber — Settings View
import { Toast } from '../components/toast.js';

export class SettingsView {
  constructor(app) {
    this.app = app;
  }

  async render(container) {
    container.innerHTML = '<div class="glass-panel"><div class="skeleton skeleton-card"></div></div>';

    const [configData, health, agentUsage, stats] = await Promise.all([
      this.app.api('/config'),
      this.app.api('/health'),
      this.app.api('/agent-usage'),
      this.app.api('/stats'),
    ]);

    container.innerHTML = this.buildHTML(configData, health, agentUsage, stats);
    this.setupHandlers(configData);
  }

  teardown() {}

  buildHTML(cfg, health, usage, stats) {
    const c = cfg || {};
    const h = health || {};
    const u = usage || {};
    const s = stats || {};

    // Available models
    const models = h.availableModels || [];
    let modelsHtml = '';
    if (models.length > 0) {
      modelsHtml = models.map(m => `
        <div class="flex items-center gap-2" style="padding:var(--sp-2) 0;">
          <span class="status-dot ${m.id === c.model ? 'online' : ''}" style="${m.id !== c.model ? 'background:var(--text-dim);' : ''}"></span>
          <span class="text-mono text-sm">${m.id}</span>
          ${m.id === c.model ? '<span class="badge info" style="margin-left:auto;">Active</span>' : `<button class="btn btn-sm btn-ghost model-select-btn" data-model="${m.id}" style="margin-left:auto;">Use</button>`}
        </div>
      `).join('');
    } else {
      modelsHtml = `<div class="text-mono text-sm" style="padding:var(--sp-2) 0;">${c.model || '—'}</div>`;
    }

    return `
      <div class="grid-2 mb-6">
        <!-- Model Configuration -->
        <div class="glass-panel glow-cyan">
          <div class="panel-header">
            <span class="panel-title">🧠 AI Model</span>
            <span class="badge ${h.apiConnected ? 'success' : 'danger'}">${h.apiConnected ? 'Connected' : 'Offline'}</span>
          </div>

          <div class="input-group mb-4">
            <label class="input-label">Current Model</label>
            <div class="text-mono" style="font-size:1rem; color:var(--cyan); padding:var(--sp-2) 0;">${c.model || '—'}</div>
          </div>

          <div class="input-group mb-4">
            <label class="input-label">Available Models</label>
            <div class="scroll-container" style="max-height:200px;">
              ${modelsHtml}
            </div>
          </div>

          <div class="divider"></div>

          <div class="input-group mb-4">
            <label class="input-label">API Base URL</label>
            <div class="text-mono text-sm text-muted">${c.baseUrl || '—'}</div>
          </div>
        </div>

        <!-- Generation Parameters -->
        <div class="glass-panel glow-violet">
          <div class="panel-header">
            <span class="panel-title">⚙️ Generation Parameters</span>
          </div>

          <div class="slider-group mb-4">
            <div class="slider-header">
              <label class="input-label">Temperature</label>
              <span class="text-mono text-sm text-cyan" id="temp-value">${c.temperature || 0.4}</span>
            </div>
            <input type="range" id="temp-slider" min="0" max="1" step="0.05" value="${c.temperature || 0.4}">
            <div class="text-xs text-muted">Lower = more focused, Higher = more creative</div>
          </div>

          <div class="slider-group mb-4">
            <div class="slider-header">
              <label class="input-label">Top P</label>
              <span class="text-mono text-sm text-cyan" id="topp-value">${c.topP || 0.9}</span>
            </div>
            <input type="range" id="topp-slider" min="0" max="1" step="0.05" value="${c.topP || 0.9}">
            <div class="text-xs text-muted">Nucleus sampling threshold</div>
          </div>

          <div class="slider-group mb-4">
            <div class="slider-header">
              <label class="input-label">Max Tokens</label>
              <span class="text-mono text-sm text-cyan" id="maxtok-value">${c.maxTokens || 16384}</span>
            </div>
            <input type="range" id="maxtok-slider" min="1024" max="32768" step="1024" value="${c.maxTokens || 16384}">
            <div class="text-xs text-muted">Maximum response length</div>
          </div>

          <button class="btn btn-primary" id="save-config-btn" style="width:100%;">💾 Save Configuration</button>
        </div>
      </div>

      <div class="grid-2 mb-6">
        <!-- Session Info -->
        <div class="glass-panel glow-emerald">
          <div class="panel-header">
            <span class="panel-title">📊 Session Info</span>
          </div>
          <div style="display:flex; flex-direction:column; gap:var(--sp-3);">
            <div class="flex justify-between items-center">
              <span class="text-sm text-muted">Input Tokens</span>
              <span class="text-mono text-sm">${(u.inputTokens || 0).toLocaleString()}</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-sm text-muted">Output Tokens</span>
              <span class="text-mono text-sm">${(u.outputTokens || 0).toLocaleString()}</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-sm text-muted">Messages</span>
              <span class="text-mono text-sm">${u.messages || 0}</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-sm text-muted">Turns</span>
              <span class="text-mono text-sm">${u.turns || 0}</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-sm text-muted">Server Uptime</span>
              <span class="text-mono text-sm">${h.uptime ? this.formatUptime(h.uptime) : '—'}</span>
            </div>
          </div>
        </div>

        <!-- Storage & Paths -->
        <div class="glass-panel glow-rose">
          <div class="panel-header">
            <span class="panel-title">💾 Storage</span>
          </div>
          <div style="display:flex; flex-direction:column; gap:var(--sp-3);">
            <div class="flex justify-between items-center">
              <span class="text-sm text-muted">Data Directory</span>
              <span class="text-mono text-xs text-muted truncate" style="max-width:200px;" title="${c.dataDir || ''}">${c.dataDir || '—'}</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-sm text-muted">Output Directory</span>
              <span class="text-mono text-xs text-muted truncate" style="max-width:200px;" title="${c.outputDir || ''}">${c.outputDir || '—'}</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-sm text-muted">Auto-Learning</span>
              <span class="badge ${c.learningEnabled ? 'success' : 'warning'}">${c.learningEnabled ? 'Enabled' : 'Disabled'}</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-sm text-muted">Max History</span>
              <span class="text-mono text-sm">${c.maxHistoryMessages || 50} messages</span>
            </div>
            <div class="divider"></div>
            <div class="text-xs text-muted">Database Tables</div>
            <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap: var(--sp-2);">
              ${Object.entries(s).filter(([k]) => k !== 'active_skills').map(([k, v]) => `
                <div style="text-align:center;padding:var(--sp-2);background:var(--bg-elevated);border-radius:var(--radius-sm);">
                  <div class="text-mono text-sm" style="font-weight:700;">${v}</div>
                  <div class="text-xs text-muted">${k.replace(/_/g, ' ')}</div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      </div>

      <!-- About -->
      <div class="glass-panel">
        <div class="panel-header">
          <span class="panel-title">🐉 About Jarvis Cyber</span>
        </div>
        <div class="flex items-center gap-4">
          <span style="font-size:3rem; filter: drop-shadow(0 0 15px rgba(0,240,255,0.3));">🐉</span>
          <div>
            <div style="font-size:1.2rem; font-weight:800;">
              <span style="background:linear-gradient(135deg,var(--cyan),var(--violet));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;">Jarvis Cyber v4.0</span>
            </div>
            <div class="text-sm text-muted" style="margin-top:var(--sp-1);">
              Autonomous AI Cybersecurity Agent — Framework-Driven Offensive Security
            </div>
            <div class="text-xs text-muted" style="margin-top:var(--sp-2);">
              150+ Kali Tools • MCP Server • MITRE ATT&CK • Dynamic Strategy Engine • Report Engine
            </div>
          </div>
        </div>
      </div>
    `;
  }

  setupHandlers(configData) {
    // Slider live updates
    const sliders = [
      { id: 'temp-slider', display: 'temp-value' },
      { id: 'topp-slider', display: 'topp-value' },
      { id: 'maxtok-slider', display: 'maxtok-value' },
    ];
    sliders.forEach(({ id, display }) => {
      const slider = document.getElementById(id);
      const value = document.getElementById(display);
      if (slider && value) {
        slider.addEventListener('input', () => { value.textContent = slider.value; });
      }
    });

    // Save config
    document.getElementById('save-config-btn')?.addEventListener('click', async () => {
      const temp = parseFloat(document.getElementById('temp-slider')?.value);
      const topP = parseFloat(document.getElementById('topp-slider')?.value);
      const maxTokens = parseInt(document.getElementById('maxtok-slider')?.value);

      const result = await this.app.apiPost('/config', { temperature: temp, topP, maxTokens });
      if (result?.success) {
        Toast.success('Configuration saved');
      } else {
        Toast.error('Failed to save configuration');
      }
    });

    // Model select buttons
    document.querySelectorAll('.model-select-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const model = btn.dataset.model;
        const result = await this.app.apiPost('/config', { model });
        if (result?.success) {
          Toast.success(`Model changed to ${model}`);
          document.getElementById('model-badge').textContent = model.split('/').pop();
          // Re-render the view
          const container = document.getElementById('page-content');
          this.render(container);
        }
      });
    });
  }

  formatUptime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}h ${m}m ${s}s`;
    return `${m}m ${s}s`;
  }
}
