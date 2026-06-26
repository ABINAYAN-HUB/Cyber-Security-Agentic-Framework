// Jarvis Cyber — Main Application Controller
// Router, WebSocket manager, global state, view orchestration
import { Toast } from './components/toast.js';
import { DashboardView } from './views/dashboard.js';
import { ChatView } from './views/chat.js';
import { ToolsView } from './views/tools.js';
import { IntelView } from './views/intel.js';
import { ReportsView } from './views/reports.js';
import { SettingsView } from './views/settings.js';

class App {
  constructor() {
    this.socket = null;
    this.currentView = null;
    this.currentViewName = '';
    this.views = {};
    this.state = {
      connected: false,
      model: '—',
      health: null,
      stats: null,
    };
  }

  async init() {
    Toast.init();

    // Initialize views
    this.views = {
      dashboard: new DashboardView(this),
      chat: new ChatView(this),
      tools: new ToolsView(this),
      intel: new IntelView(this),
      reports: new ReportsView(this),
      settings: new SettingsView(this),
    };

    // Setup navigation
    this.setupNav();

    // Connect WebSocket
    this.connectSocket();

    // Load initial health data
    this.loadHealth();

    // Route to initial view
    const hash = window.location.hash.slice(1) || 'dashboard';
    this.navigate(hash);

    // Listen for hash changes
    window.addEventListener('hashchange', () => {
      const view = window.location.hash.slice(1) || 'dashboard';
      this.navigate(view);
    });
  }

  // ═══ NAVIGATION ═══

  setupNav() {
    document.querySelectorAll('.nav-item[data-view]').forEach(item => {
      item.addEventListener('click', () => {
        const view = item.dataset.view;
        window.location.hash = view;
        // Close sidebar on mobile after navigation
        const sidebar = document.getElementById('sidebar');
        if (sidebar && window.innerWidth <= 900) {
          sidebar.classList.remove('open');
        }
      });
    });

    // Mobile sidebar toggle
    const toggleBtn = document.getElementById('sidebar-toggle');
    const sidebar = document.getElementById('sidebar');
    if (toggleBtn && sidebar) {
      // Show toggle on mobile
      const updateToggleVisibility = () => {
        toggleBtn.style.display = window.innerWidth <= 900 ? 'flex' : 'none';
      };
      updateToggleVisibility();
      window.addEventListener('resize', updateToggleVisibility);

      toggleBtn.addEventListener('click', () => {
        sidebar.classList.toggle('open');
      });
    }
  }

  navigate(viewName) {
    if (!this.views[viewName]) viewName = 'dashboard';

    // Update nav active state
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    const navItem = document.querySelector(`.nav-item[data-view="${viewName}"]`);
    if (navItem) navItem.classList.add('active');

    // Update header
    const titles = {
      dashboard: ['Dashboard', 'Overview'],
      chat: ['Agent Chat', 'AI Interaction'],
      tools: ['Tools', '150+ Security Tools'],
      intel: ['Threat Intel', 'CVEs, Exploits & IOCs'],
      reports: ['Reports', 'Pentest Reports'],
      settings: ['Settings', 'Configuration'],
    };
    const [title, breadcrumb] = titles[viewName] || ['—', '—'];
    document.getElementById('page-title').textContent = title;
    document.getElementById('page-breadcrumb').textContent = breadcrumb;

    // Teardown current view
    if (this.currentView && this.currentView.teardown) {
      this.currentView.teardown();
    }

    // Render new view
    const container = document.getElementById('page-content');

    // Chat view needs full height (no padding/scroll on parent)
    if (viewName === 'chat') {
      container.style.padding = '0';
      container.style.overflow = 'hidden';
    } else {
      container.style.padding = '';
      container.style.overflow = '';
    }

    this.currentView = this.views[viewName];
    this.currentViewName = viewName;
    this.currentView.render(container);
  }

  // ═══ WEBSOCKET ═══

  connectSocket() {
    this.socket = io({
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionAttempts: Infinity,
    });

    this.socket.on('connect', () => {
      this.state.connected = true;
      this.updateConnectionStatus(true);
      Toast.success('Connected to Jarvis Cyber');
    });

    this.socket.on('disconnect', () => {
      this.state.connected = false;
      this.updateConnectionStatus(false);
      Toast.warning('Disconnected from server');
    });

    this.socket.on('chat:ready', (data) => {
      this.state.model = data.model;
      document.getElementById('model-badge').textContent = data.model?.split('/').pop() || '—';
    });

    // Forward all chat events to the chat view
    const chatEvents = ['chat:text', 'chat:thinking', 'chat:tool_start', 'chat:tool_done', 'chat:done', 'chat:error', 'chat:cleared', 'chat:compacted'];
    chatEvents.forEach(event => {
      this.socket.on(event, (data) => {
        if (this.views.chat && this.views.chat.handleSocketEvent) {
          this.views.chat.handleSocketEvent(event, data);
        }
      });
    });
  }

  updateConnectionStatus(online) {
    const dot = document.getElementById('status-dot');
    const text = document.getElementById('status-text');
    if (online) {
      dot.className = 'status-dot online';
      text.textContent = 'Connected';
    } else {
      dot.className = 'status-dot offline';
      text.textContent = 'Disconnected';
    }
  }

  // ═══ API HELPERS ═══

  async api(path) {
    try {
      const res = await fetch(`/api${path}`);
      return await res.json();
    } catch (err) {
      console.error(`API error [${path}]:`, err);
      return null;
    }
  }

  async apiPost(path, body) {
    try {
      const res = await fetch(`/api${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      return await res.json();
    } catch (err) {
      console.error(`API POST error [${path}]:`, err);
      return null;
    }
  }

  async loadHealth() {
    const health = await this.api('/health');
    if (health) {
      this.state.health = health;
      this.state.model = health.model;
      document.getElementById('model-badge').textContent = health.model?.split('/').pop() || '—';
    }
  }
}

// ═══ BOOT ═══
const app = new App();
document.addEventListener('DOMContentLoaded', () => app.init());
