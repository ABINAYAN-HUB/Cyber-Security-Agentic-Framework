// Jarvis Cyber — Settings View (Model Selection & System Configuration)
import { Toast } from '../components/toast.js';

export class SettingsView {
  constructor(app) {
    this.app = app;
  }

  async render(container) {
    container.innerHTML = '<div class="glass-panel"><div class="skeleton skeleton-card"></div></div>';

    const [configData, health, modelStatus, agentUsage, stats] = await Promise.all([
      this.app.api('/config'),
      this.app.api('/health'),
      this.app.api('/model-status'),
      this.app.api('/agent-usage'),
      this.app.api('/stats'),
    ]);

    container.innerHTML = this.buildHTML(configData, health, modelStatus, agentUsage, stats);
    this.setupHandlers(configData, modelStatus);
  }

  teardown() { }

  buildHTML(cfg, health, modelStatus, usage, stats) {
    const c = cfg || {};
    const h = health || {};
    const ms = modelStatus || {};
    const u = usage || {};
    const s = stats || {};

    const activeProvider = c.activeProvider || ms.activeProvider || 'nvidia';
    const isCloud = activeProvider === 'nvidia';
    const isLocal = activeProvider === 'local';

    const cloudStatus = ms.nvidia || {};
    const localStatus = ms.local || {};

    const cloudModelName = c.model || 'nvidia/nemotron-3-super-120b-a12b';
    const verifiedNvidiaModels = cloudStatus.verifiedModels || [
      { id: 'nvidia/nemotron-3-super-120b-a12b', name: 'Nemotron 3 Super (120B)', tag: 'Recommended • Flagship' },
      { id: 'meta/llama-3.2-11b-vision-instruct', name: 'Llama 3.2 (11B Vision)', tag: 'Ultra-Fast' },
      { id: 'nvidia/nemotron-3.5-lightning-30b-a3b', name: 'Nemotron 3.5 Lightning (30B)', tag: 'Fast' },
      { id: 'openai/gpt-oss-20b', name: 'OpenAI GPT-OSS (20B)', tag: 'Standard' },
    ];
    const localModelName = c.localAiModel || '';
    const localBackend = c.localAiBackend || 'lmstudio';
    const localBaseUrl = c.localAiBaseUrl || 'http://localhost:1234/v1';

    const backendLabels = {
      lmstudio: 'LM Studio',
      ollama: 'Ollama',
      jan: 'Jan.ai',
      custom: 'Custom Server',
    };
    const localBackendLabel = backendLabels[localBackend] || 'Local AI';

    return `
      <!-- ═══ ACTIVE MODEL & PROVIDER SELECTION ═══ -->
      <div class="glass-panel mb-6" style="border-color: rgba(99, 102, 241, 0.25);">
        <div class="panel-header" style="margin-bottom: var(--sp-2);">
          <div>
            <div class="panel-title" style="font-size:1.15rem; font-weight:800; display:flex; align-items:center; gap:8px;">
              <span>🧠</span> Model Selection & AI Provider
            </div>
            <div class="text-xs text-muted" style="margin-top:2px;">
              Choose between Cloud (NVIDIA NIM) and Local AI servers (LM Studio, Ollama, Jan.ai).
            </div>
          </div>
          <span class="badge ${isCloud ? 'info' : 'success'}" style="font-size:0.8rem; padding: 4px 12px;">
            Active: ${isCloud ? '⚡ Cloud (NVIDIA NIM)' : `💻 Local AI (${localBackendLabel})`}
          </span>
        </div>

        <div class="grid-2" style="margin-top: var(--sp-4);">
          <!-- ── Card 1: Cloud AI (NVIDIA NIM) ── -->
          <div class="model-card cloud-card ${isCloud ? 'active' : ''}" id="card-nvidia">
            <div class="model-card-header">
              <div class="model-card-title">
                <span>⚡</span> Cloud AI (NVIDIA NIM)
              </div>
              <div class="model-card-badges">
                <span class="badge ${cloudStatus.ok !== false ? 'success' : 'danger'}">
                  <span class="status-dot ${cloudStatus.ok !== false ? 'online' : 'offline'}" style="margin-right:4px;"></span>
                  ${cloudStatus.ok !== false ? 'Connected' : 'Offline'}
                </span>
                <span class="badge info">Cloud • NIM</span>
              </div>
            </div>

            <p class="model-card-desc">
              High-speed cloud inference via NVIDIA NIM API. Ideal for complex multi-step reasoning, deep attack chain analysis, and rapid tool orchestration.
            </p>

            <div class="model-specs-table">
              <div class="model-spec-item">
                <span class="model-spec-label">Model:</span>
                <span class="model-spec-value text-cyan" title="${cloudModelName}">${cloudModelName}</span>
              </div>
              <div class="model-spec-item">
                <span class="model-spec-label">Provider:</span>
                <span class="model-spec-value">NVIDIA NIM API</span>
              </div>
              <div class="model-spec-item">
                <span class="model-spec-label">Endpoint:</span>
                <span class="model-spec-value text-muted" title="${c.baseUrl || 'https://integrate.api.nvidia.com/v1'}">${c.baseUrl || 'https://integrate.api.nvidia.com/v1'}</span>
              </div>
            </div>

            <!-- Verified Models Quick Switch -->
            <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.06);">
              <div class="text-xs text-muted" style="margin-bottom: 6px; font-weight: 600;">⚡ Verified Models (Fast & Tool-Calling Tested):</div>
              <div style="display: flex; flex-direction: column; gap: 4px;">
                ${verifiedNvidiaModels.map(m => `
                  <button class="nvidia-model-select-btn ${cloudModelName === m.id ? 'active' : ''}" data-model="${m.id}" style="display: flex; align-items: center; justify-content: space-between; padding: 6px 10px; border-radius: 6px; border: 1px solid ${cloudModelName === m.id ? 'var(--color-primary, #6366f1)' : 'rgba(255,255,255,0.08)'}; background: ${cloudModelName === m.id ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255,255,255,0.03)'}; cursor: pointer; text-align: left; font-size: 0.75rem; color: #e2e8f0; transition: all 0.15s ease;">
                    <div style="font-weight: 600; display: flex; align-items: center; gap: 6px;">
                      <span style="color: ${cloudModelName === m.id ? 'var(--color-primary, #6366f1)' : '#64748b'};">${cloudModelName === m.id ? '●' : '○'}</span>
                      <span>${m.name}</span>
                    </div>
                    <span class="badge ${cloudModelName === m.id ? 'success' : 'secondary'}" style="font-size: 0.65rem; padding: 2px 6px;">${m.tag || 'Verified'}</span>
                  </button>
                `).join('')}
              </div>
            </div>

            <div class="model-card-footer">
              ${isCloud
        ? '<span class="model-active-tag cloud">✓ Currently Active</span>'
        : '<button class="btn btn-primary btn-sm switch-provider-btn" data-provider="nvidia">Switch to Cloud</button>'
      }
              <button class="btn btn-ghost btn-sm" id="quick-test-cloud-btn" title="Ping NVIDIA NIM">Test Ping</button>
            </div>
          </div>

          <!-- ── Card 2: Local AI Server (LM Studio, Ollama, Jan.ai) ── -->
          <div class="model-card local-card ${isLocal ? 'active' : ''}" id="card-local">
            <div class="model-card-header">
              <div class="model-card-title">
                <span>💻</span> Local AI Server
              </div>
              <div class="model-card-badges">
                <span class="badge ${localStatus.ok ? 'success' : 'secondary'}">
                  <span class="status-dot ${localStatus.ok ? 'online' : 'offline'}" style="margin-right:4px;"></span>
                  ${localStatus.ok ? 'Connected' : 'Offline / Standby'}
                </span>
                <span class="badge" style="background: rgba(139, 92, 246, 0.2); color: #c4b5fd; border: 1px solid rgba(139, 92, 246, 0.4);">
                  Local • Offline
                </span>
              </div>
            </div>

            <p class="model-card-desc">
              Run open-source LLMs locally on your own GPU/CPU via LM Studio, Ollama, or Jan.ai. Completely private and offline-capable.
            </p>

            <div class="model-specs-table">
              <div class="model-spec-item">
                <span class="model-spec-label">Backend:</span>
                <span class="model-spec-value text-violet">${localBackendLabel}</span>
              </div>
              <div class="model-spec-item">
                <span class="model-spec-label">Model:</span>
                <span class="model-spec-value ${localModelName ? 'text-violet' : 'text-muted'}" title="${localModelName || 'Auto / Default'}">
                  ${localModelName || 'Auto / Default Server Model'}
                </span>
              </div>
              <div class="model-spec-item">
                <span class="model-spec-label">Endpoint:</span>
                <span class="model-spec-value text-muted" title="${localBaseUrl}">${localBaseUrl}</span>
              </div>
            </div>

            <div class="model-card-footer">
              ${isLocal
        ? '<span class="model-active-tag local">✓ Currently Active</span>'
        : '<button class="btn btn-primary btn-sm switch-provider-btn" data-provider="local">Switch to Local</button>'
      }
              <button class="btn btn-ghost btn-sm" id="quick-test-local-btn" title="Ping Local Server">Test Ping</button>
            </div>
          </div>
        </div>
      </div>

      <!-- ═══ LOCAL AI SERVER CONFIGURATION PANEL ═══ -->
      <div class="glass-panel mb-6 glow-cyan">
        <div class="panel-header">
          <div>
            <span class="panel-title">🛠️ Local AI Server Configuration</span>
            <div class="text-xs text-muted" style="margin-top:2px;">
              Configure connection to your local LM Studio, Ollama, Jan.ai, or custom OpenAI-compatible server.
            </div>
          </div>
          <span class="badge ${localStatus.ok ? 'success' : 'secondary'}">
            ${localStatus.ok ? `Connected (${localStatus.models?.length || 0} models)` : 'Not Connected'}
          </span>
        </div>

        <!-- Quick Presets -->
        <div style="margin-bottom: var(--sp-4);">
          <label class="input-label" style="margin-bottom: 6px; display:block;">Quick Presets</label>
          <div class="preset-pill-group">
            <button class="preset-pill-btn ${localBackend === 'lmstudio' ? 'active' : ''}" data-preset="lmstudio">
              <span>🖥️</span> LM Studio (Port 1234)
            </button>
            <button class="preset-pill-btn ${localBackend === 'ollama' ? 'active' : ''}" data-preset="ollama">
              <span>🦙</span> Ollama (Port 11434)
            </button>
            <button class="preset-pill-btn ${localBackend === 'jan' ? 'active' : ''}" data-preset="jan">
              <span>🤖</span> Jan.ai (Port 1337)
            </button>
            <button class="preset-pill-btn ${localBackend === 'custom' ? 'active' : ''}" data-preset="custom">
              <span>⚙️</span> Custom Port / URL
            </button>
          </div>
        </div>

        <!-- Inputs Grid -->
        <div class="grid-2 mb-4">
          <div class="input-group">
            <label class="input-label" for="local-backend-select">Backend Type</label>
            <select class="input-field" id="local-backend-select">
              <option value="lmstudio" ${localBackend === 'lmstudio' ? 'selected' : ''}>LM Studio (OpenAI-compatible)</option>
              <option value="ollama" ${localBackend === 'ollama' ? 'selected' : ''}>Ollama (/v1 compatibility)</option>
              <option value="jan" ${localBackend === 'jan' ? 'selected' : ''}>Jan.ai (OpenAI-compatible)</option>
              <option value="custom" ${localBackend === 'custom' ? 'selected' : ''}>Custom Server</option>
            </select>
          </div>

          <div class="input-group">
            <label class="input-label" for="local-base-url">API Base URL</label>
            <input type="text" class="input-field text-mono" id="local-base-url"
              value="${localBaseUrl}"
              placeholder="http://localhost:1234/v1" />
            <div class="text-xs text-muted" style="margin-top:2px;">Must include the /v1 path (e.g. http://localhost:1234/v1)</div>
          </div>
        </div>

        <div class="grid-2 mb-4">
          <div class="input-group">
            <label class="input-label" for="local-model-input">Model Name (or ID)</label>
            <input type="text" class="input-field text-mono" id="local-model-input"
              value="${localModelName}"
              placeholder="e.g. qwen2.5-coder-7b or llama3" />
            <div class="text-xs text-muted" style="margin-top:2px;">Click "Test & Discover Models" below to auto-populate from your server</div>
          </div>

          <div class="input-group">
            <label class="input-label" for="local-api-key">API Key (Optional)</label>
            <input type="password" class="input-field text-mono" id="local-api-key"
              value="${c.localAiApiKey && c.localAiApiKey !== 'none' ? c.localAiApiKey : ''}"
              placeholder="Optional — leave blank if server requires none" />
            <div class="text-xs text-muted" style="margin-top:2px;">Most local servers (LM Studio/Ollama) do not require an API key</div>
          </div>
        </div>

        <!-- Action Buttons -->
        <div style="display:flex; gap: var(--sp-3); flex-wrap: wrap;">
          <button class="btn btn-primary" id="save-local-btn">
            💾 Save Local Settings
          </button>
          <button class="btn btn-secondary" id="test-local-btn">
            🔍 Test & Discover Models
          </button>
        </div>

        <!-- Test Results Box -->
        <div id="local-test-result" style="display:none;"></div>
      </div>

      <!-- ═══ GENERATION PARAMETERS ═══ -->
      <div class="glass-panel mb-6 glow-violet">
        <div class="panel-header">
          <span class="panel-title">⚙️ Generation Parameters</span>
        </div>

        <div class="slider-group mb-4">
          <div class="slider-header">
            <label class="input-label">Temperature</label>
            <span class="text-mono text-sm text-cyan" id="temp-value">${c.temperature || 0.4}</span>
          </div>
          <input type="range" id="temp-slider" min="0" max="1" step="0.05" value="${c.temperature || 0.4}">
          <div class="text-xs text-muted">Lower = more deterministic, Higher = more creative</div>
        </div>

        <div class="slider-group mb-4">
          <div class="slider-header">
            <label class="input-label">Top P</label>
            <span class="text-mono text-sm text-cyan" id="topp-value">${c.topP || 0.9}</span>
          </div>
          <input type="range" id="topp-slider" min="0" max="1" step="0.05" value="${c.topP || 0.9}">
          <div class="text-xs text-muted">Nucleus sampling probability threshold</div>
        </div>

        <div class="slider-group mb-4">
          <div class="slider-header">
            <label class="input-label">Max Tokens</label>
            <span class="text-mono text-sm text-cyan" id="maxtok-value">${c.maxTokens || 16384}</span>
          </div>
          <input type="range" id="maxtok-slider" min="1024" max="32768" step="1024" value="${c.maxTokens || 16384}">
          <div class="text-xs text-muted">Maximum response tokens per turn</div>
        </div>

        <button class="btn btn-primary" id="save-config-btn" style="width:100%; margin-top: auto;">💾 Save Generation Parameters</button>
      </div>

      <!-- ═══ SESSION INFO & STORAGE ═══ -->
      <div class="grid-2 mb-6">
        <!-- Session Info -->
        <div class="glass-panel glow-emerald">
          <div class="panel-header">
            <span class="panel-title">📊 Session Diagnostics</span>
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
              <span class="text-sm text-muted">Total Messages</span>
              <span class="text-mono text-sm">${u.messages || 0}</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-sm text-muted">Agent Turns</span>
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
            <span class="panel-title">💾 Storage & Database</span>
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
            <div class="divider"></div>
            <div class="text-xs text-muted">Database Records</div>
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
              150+ Kali Tools • NVIDIA NIM (Nemotron 120B) & Local AI (LM Studio, Ollama) • MITRE ATT&CK
            </div>
          </div>
        </div>
      </div>
    `;
  }

  setupHandlers(configData, modelStatus) {
    const container = document.getElementById('page-content');

    // ═══ 1. SWITCH ACTIVE PROVIDER BUTTONS ═══
    document.querySelectorAll('.switch-provider-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const targetProvider = btn.dataset.provider;
        btn.disabled = true;
        btn.textContent = 'Switching...';

        const result = await this.app.apiPost('/switch-model', { provider: targetProvider });
        if (result?.ok) {
          Toast.success(`Switched provider to ${targetProvider === 'local' ? 'Local AI' : 'NVIDIA NIM'}`);
          if (container) this.render(container);
        } else {
          Toast.error(`Failed to switch provider: ${result?.error || 'Unknown error'}`);
          btn.disabled = false;
          btn.textContent = targetProvider === 'local' ? 'Switch to Local' : 'Switch to Cloud';
        }
      });
    });

    // ═══ QUICK SWITCH NVIDIA MODEL ═══
    document.querySelectorAll('.nvidia-model-select-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const targetModel = btn.dataset.model;
        if (!targetModel) return;
        btn.style.opacity = '0.5';
        const result = await this.app.apiPost('/switch-model', { provider: 'nvidia', model: targetModel });
        if (result?.ok) {
          Toast.success(`Switched NVIDIA model to ${targetModel.split('/').pop()}`);
          if (container) this.render(container);
        } else {
          Toast.error(`Failed to switch model: ${result?.error || 'Unknown error'}`);
          btn.style.opacity = '1';
        }
      });
    });

    // ═══ 2. TEST CLOUD CONNECTION ═══
    const quickTestCloudBtn = document.getElementById('quick-test-cloud-btn');
    quickTestCloudBtn?.addEventListener('click', async () => {
      quickTestCloudBtn.disabled = true;
      quickTestCloudBtn.textContent = 'Testing...';

      const res = await this.app.apiPost('/test-provider', { provider: 'nvidia' });
      quickTestCloudBtn.disabled = false;
      quickTestCloudBtn.textContent = 'Test Ping';

      if (res?.ok) {
        Toast.success(`NVIDIA NIM connected (${res.latencyMs || 120}ms)`);
      } else {
        Toast.error(`Cloud test failed: ${res?.message || 'Offline'}`);
      }
    });

    // ═══ 3. TEST LOCAL CONNECTION ═══
    const quickTestLocalBtn = document.getElementById('quick-test-local-btn');
    quickTestLocalBtn?.addEventListener('click', async () => {
      quickTestLocalBtn.disabled = true;
      quickTestLocalBtn.textContent = 'Testing...';

      const res = await this.app.apiPost('/test-provider', { provider: 'local' });
      quickTestLocalBtn.disabled = false;
      quickTestLocalBtn.textContent = 'Test Ping';

      if (res?.ok) {
        Toast.success(`Local AI connected (${res.latencyMs || 8}ms) — ${res.models?.length || 0} models available`);
      } else {
        Toast.error(`Local test failed: ${res?.message || 'Offline'}`);
      }
    });

    // ═══ 4. PRESET PILLS HANDLING ═══
    const presets = {
      lmstudio: { url: 'http://localhost:1234/v1', backend: 'lmstudio' },
      ollama: { url: 'http://localhost:11434/v1', backend: 'ollama' },
      jan: { url: 'http://localhost:1337/v1', backend: 'jan' },
      custom: { url: 'http://localhost:8080/v1', backend: 'custom' },
    };

    document.querySelectorAll('.preset-pill-btn').forEach(pill => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('.preset-pill-btn').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');

        const presetKey = pill.dataset.preset;
        const config = presets[presetKey];
        if (config) {
          const urlInput = document.getElementById('local-base-url');
          const backendSelect = document.getElementById('local-backend-select');
          if (urlInput) urlInput.value = config.url;
          if (backendSelect) backendSelect.value = config.backend;
        }
      });
    });

    // Backend select auto-updates Base URL if using standard default
    const backendSelect = document.getElementById('local-backend-select');
    backendSelect?.addEventListener('change', () => {
      const selected = backendSelect.value;
      const urlInput = document.getElementById('local-base-url');
      if (presets[selected] && urlInput) {
        urlInput.value = presets[selected].url;
      }
      document.querySelectorAll('.preset-pill-btn').forEach(p => {
        p.classList.toggle('active', p.dataset.preset === selected);
      });
    });

    // ═══ 5. TEST & DISCOVER LOCAL MODELS ═══
    const testLocalBtn = document.getElementById('test-local-btn');
    const resultBox = document.getElementById('local-test-result');

    testLocalBtn?.addEventListener('click', async () => {
      const baseUrl = document.getElementById('local-base-url')?.value?.trim();
      const apiKey = document.getElementById('local-api-key')?.value?.trim();

      if (!baseUrl) {
        Toast.warning('Please enter a Base URL');
        return;
      }

      testLocalBtn.disabled = true;
      testLocalBtn.textContent = 'Probing Server...';

      if (resultBox) {
        resultBox.style.display = 'block';
        resultBox.className = 'test-result-box testing';
        resultBox.innerHTML = `<span>⏳ Connecting to ${baseUrl}...</span>`;
      }

      const res = await this.app.apiPost('/test-provider', {
        provider: 'local',
        baseUrl,
        apiKey: apiKey || 'none',
      });

      testLocalBtn.disabled = false;
      testLocalBtn.textContent = '🔍 Test & Discover Models';

      if (resultBox) {
        if (res?.ok) {
          resultBox.className = 'test-result-box success';
          const modelsList = res.models || [];
          let modelsHtml = '';
          if (modelsList.length > 0) {
            modelsHtml = `
              <div style="margin-top:8px;">
                <div style="font-weight:600; margin-bottom:4px;">Available Models (click to select):</div>
                <div style="display:flex; flex-wrap:wrap; gap:6px;">
                  ${modelsList.map(m => `
                    <button class="btn btn-ghost btn-xs select-model-pill" data-model="${m}" style="font-family:var(--font-mono); font-size:0.75rem;">
                      ${m}
                    </button>
                  `).join('')}
                </div>
              </div>
            `;
          }

          resultBox.innerHTML = `
            <div><strong>✅ Connection Successful!</strong></div>
            <div style="font-size:0.8rem; margin-top:2px;">Response time: <strong>${res.latencyMs || 0}ms</strong> | Models found: <strong>${modelsList.length}</strong></div>
            ${modelsHtml}
          `;

          // Handle clicking a model pill to auto-fill the model input
          resultBox.querySelectorAll('.select-model-pill').forEach(pill => {
            pill.addEventListener('click', () => {
              const modelInput = document.getElementById('local-model-input');
              if (modelInput) {
                modelInput.value = pill.dataset.model;
                Toast.success(`Selected model: ${pill.dataset.model}`);
              }
            });
          });

          // Auto-fill model if input is empty and exactly 1 model exists
          const modelInput = document.getElementById('local-model-input');
          if (modelInput && !modelInput.value.trim() && modelsList.length > 0) {
            modelInput.value = modelsList[0];
          }

          Toast.success(`Connected to local server (${res.latencyMs}ms)`);
        } else {
          resultBox.className = 'test-result-box error';
          resultBox.innerHTML = `
            <div><strong>❌ Connection Failed</strong></div>
            <div style="font-size:0.8rem; margin-top:2px;">${res?.message || 'Server not reachable'}</div>
            <div style="font-size:0.75rem; margin-top:4px; opacity:0.8;">Make sure LM Studio or Ollama is running and its server is started.</div>
          `;
          Toast.error(res?.message || 'Local connection failed');
        }
      }
    });

    // ═══ 6. SAVE LOCAL SETTINGS ═══
    const saveLocalBtn = document.getElementById('save-local-btn');
    saveLocalBtn?.addEventListener('click', async () => {
      const backend = document.getElementById('local-backend-select')?.value;
      const baseUrl = document.getElementById('local-base-url')?.value?.trim();
      const model = document.getElementById('local-model-input')?.value?.trim();
      const apiKey = document.getElementById('local-api-key')?.value?.trim();

      saveLocalBtn.disabled = true;
      saveLocalBtn.textContent = 'Saving...';

      const result = await this.app.apiPost('/config', {
        localAiBackend: backend,
        localAiBaseUrl: baseUrl,
        localAiModel: model,
        localAiApiKey: apiKey || 'none',
      });

      saveLocalBtn.disabled = false;
      saveLocalBtn.textContent = '💾 Save Local Settings';

      if (result?.success) {
        Toast.success('Local AI settings saved');
        if (container) this.render(container);
      } else {
        Toast.error('Failed to save local settings');
      }
    });

    // ═══ 7. GENERATION PARAMETERS (Sliders + Save) ═══
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

    document.getElementById('save-config-btn')?.addEventListener('click', async () => {
      const temp = parseFloat(document.getElementById('temp-slider')?.value);
      const topP = parseFloat(document.getElementById('topp-slider')?.value);
      const maxTokens = parseInt(document.getElementById('maxtok-slider')?.value);

      const result = await this.app.apiPost('/config', { temperature: temp, topP, maxTokens });
      if (result?.success) {
        Toast.success('Generation parameters saved');
      } else {
        Toast.error('Failed to save generation parameters');
      }
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
