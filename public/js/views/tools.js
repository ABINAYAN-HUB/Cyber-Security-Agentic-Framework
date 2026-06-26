// Jarvis Cyber — Tools Browser View
export class ToolsView {
  constructor(app) {
    this.app = app;
    this.allTools = [];
    this.kaliTools = [];
    this.categories = [];
    this.activeCategory = 'all';
    this.searchQuery = '';
  }

  async render(container) {
    container.innerHTML = '<div class="stats-grid"><div class="glass-panel"><div class="skeleton skeleton-card"></div></div></div>';

    const [apiTools, kaliData] = await Promise.all([
      this.app.api('/tools'),
      this.app.api('/kali-tools'),
    ]);

    this.allTools = apiTools || [];
    this.kaliTools = kaliData?.tools || [];
    this.categories = kaliData?.categories || [];

    // Update nav badge
    const badge = document.getElementById('tools-count');
    if (badge) badge.textContent = this.allTools.length + this.kaliTools.length;

    container.innerHTML = this.buildHTML(kaliData);
    this.setupHandlers();
  }

  teardown() {}

  buildHTML(kaliData) {
    const totalInstalled = kaliData?.installed || 0;
    const totalKali = kaliData?.total || 0;

    // Category tabs
    const catTabs = [
      { id: 'all', label: `All (${this.allTools.length + this.kaliTools.length})` },
      { id: 'api', label: `API Tools (${this.allTools.length})` },
      ...this.categories.map(c => ({
        id: c,
        label: `${c.replace(/-/g, ' ')} (${this.kaliTools.filter(t => t.category === c).length})`,
      })),
    ];

    return `
      <!-- Stats -->
      <div class="stats-grid mb-6">
        <div class="glass-panel stat-card glow-cyan cyan">
          <span class="stat-icon">🔧</span>
          <div class="stat-value">${this.allTools.length}</div>
          <div class="stat-label">API Tools</div>
        </div>
        <div class="glass-panel stat-card glow-violet violet">
          <span class="stat-icon">⚔️</span>
          <div class="stat-value">${totalKali}</div>
          <div class="stat-label">Kali Tools</div>
        </div>
        <div class="glass-panel stat-card glow-emerald emerald">
          <span class="stat-icon">✅</span>
          <div class="stat-value">${totalInstalled}</div>
          <div class="stat-label">Installed</div>
        </div>
        <div class="glass-panel stat-card glow-rose rose">
          <span class="stat-icon">📦</span>
          <div class="stat-value">${totalKali - totalInstalled}</div>
          <div class="stat-label">Not Installed</div>
        </div>
      </div>

      <!-- Search + Filter -->
      <div class="glass-panel mb-6">
        <div class="flex items-center gap-4 mb-4">
          <div class="search-input-wrapper" style="flex:1;">
            <span class="search-icon">🔍</span>
            <input type="text" class="input" id="tools-search" placeholder="Search tools by name, description, or MITRE technique..." style="padding-left: 36px;">
          </div>
        </div>
        <div class="chip-list" id="category-chips">
          ${catTabs.map(c => `
            <button class="chip ${c.id === 'all' ? 'active' : ''}" data-category="${c.id}">
              ${c.label}
            </button>
          `).join('')}
        </div>
      </div>

      <!-- Tools Grid -->
      <div id="tools-grid" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: var(--sp-4);">
        ${this.renderTools('all', '')}
      </div>
    `;
  }

  renderTools(category, query) {
    let tools = [];

    if (category === 'all' || category === 'api') {
      const apiCards = this.allTools.map(t => ({
        name: t.name,
        description: t.description,
        category: 'API Tool',
        installed: true,
        mitre: [],
        usage: [],
        isApi: true,
      }));
      if (category === 'api') {
        tools = apiCards;
      } else {
        tools = [...apiCards, ...this.kaliTools];
      }
    } else {
      tools = this.kaliTools.filter(t => t.category === category);
    }

    // Search filter
    if (query) {
      const q = query.toLowerCase();
      tools = tools.filter(t =>
        t.name.toLowerCase().includes(q) ||
        (t.description || '').toLowerCase().includes(q) ||
        (t.mitre || []).some(m => m.toLowerCase().includes(q)) ||
        (t.category || '').toLowerCase().includes(q)
      );
    }

    if (tools.length === 0) {
      return '<div class="empty-state" style="grid-column:1/-1;"><span class="empty-icon">🔍</span><span class="empty-title">No tools found</span><span class="empty-description">Try a different search or category filter.</span></div>';
    }

    return tools.map(t => `
      <div class="glass-panel tool-card ${t.installed ? 'glow-cyan' : ''}">
        <div class="tool-name">
          <span>${t.installed ? '✅' : '📦'}</span>
          <span>${t.name}</span>
          ${t.isApi ? '<span class="badge info">API</span>' : ''}
        </div>
        <div class="tool-desc">${(t.description || '').slice(0, 120)}</div>
        <div class="tool-meta">
          <span class="tag">${t.category || 'general'}</span>
          ${(t.mitre || []).map(m => `<span class="tag" style="color:var(--violet);">${m}</span>`).join('')}
          ${t.bin ? `<span class="tag" style="color:var(--text-dim);">${t.bin}</span>` : ''}
        </div>
        ${(t.usage || []).length > 0 ? `
          <div style="margin-top:var(--sp-3);">
            <div class="text-xs text-muted mb-2" style="margin-bottom:4px;">Usage Example:</div>
            <div class="code-block" style="font-size:0.72rem;padding:var(--sp-2) var(--sp-3);">${t.usage[0]}</div>
          </div>
        ` : ''}
      </div>
    `).join('');
  }

  setupHandlers() {
    // Search
    const searchInput = document.getElementById('tools-search');
    if (searchInput) {
      let debounceTimer;
      searchInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          this.searchQuery = searchInput.value;
          document.getElementById('tools-grid').innerHTML = this.renderTools(this.activeCategory, this.searchQuery);
        }, 200);
      });
    }

    // Category chips
    document.getElementById('category-chips')?.addEventListener('click', (e) => {
      const chip = e.target.closest('.chip');
      if (!chip) return;

      document.querySelectorAll('#category-chips .chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');

      this.activeCategory = chip.dataset.category;
      document.getElementById('tools-grid').innerHTML = this.renderTools(this.activeCategory, this.searchQuery);
    });
  }
}
