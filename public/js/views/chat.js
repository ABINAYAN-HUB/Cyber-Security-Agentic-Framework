// Jarvis Cyber — Chat View (Agent Interaction) — Production Grade
// Features: History sidebar, session management, thinking steps, tool cards, smart scroll
import { renderMarkdown, escapeHtml } from '../components/markdown.js';
import { Toast } from '../components/toast.js';

export class ChatView {
  constructor(app) {
    this.app = app;
    this.messages = [];
    this.isStreaming = false;
    this.currentStreamContent = '';
    this.currentThinkingContent = '';
    this.currentToolCalls = [];
    this.toolStepCounter = 0;
    this.rendered = false;
    this.autoScroll = true;
    this.thinkingStartTime = null;
    this.thinkingTimerInterval = null;
    this.streamStartTime = null;
    // Session state
    this.activeSessionId = null;
    this.sessions = [];
    this.historyOpen = true;
    this.searchQuery = '';
  }

  render(container) {
    container.innerHTML = `
      <div class="chat-view">
        <div class="chat-history-panel ${this.historyOpen ? 'open' : ''}" id="chat-history-panel">
          <div class="history-header">
            <span class="history-title">💬 Chat History</span>
            <button class="history-close-btn" id="history-close-btn" title="Close history">✕</button>
          </div>
          <div class="history-actions">
            <button class="history-new-chat-btn" id="new-chat-btn" title="New Chat">
              <span>＋</span> New Chat
            </button>
          </div>
          <div class="history-search">
            <input type="text" class="history-search-input" id="history-search"
              placeholder="Search chats..." />
          </div>
          <div class="history-sessions-list" id="history-sessions-list">
            <div class="history-loading">Loading...</div>
          </div>
        </div>
        <div class="chat-main">
          <div class="chat-header">
            <div class="chat-header-left">
              <button class="history-toggle-btn" id="history-toggle-btn" title="Chat history">
                <span class="menu-icon"></span>
              </button>
              <h1 class="chat-header-title" id="chat-header-title">New Chat</h1>
            </div>
            <div class="chat-header-right">
              <div class="chat-model-pill" id="chat-model-pill" title="Current AI Model">
                <span class="chat-model-dot" id="chat-model-dot"></span>
                <span class="chat-model-name" id="chat-model-name">Loading...</span>
              </div>
            </div>
          </div>
          <div class="chat-messages" id="chat-messages">
            ${this.messages.length === 0 ? this.getWelcomeHTML() : ''}
          </div>
          <div class="chat-input-area">
            <button class="scroll-to-bottom" id="scroll-to-bottom" title="Jump to bottom">↓</button>
            <div class="chat-input-wrapper">
              <div class="chat-input-container">
                <textarea class="chat-input" id="chat-input"
                  placeholder="Ask Jarvis anything..."
                  rows="1"></textarea>
                <div class="slash-dropdown hidden" id="slash-dropdown"></div>
              </div>
              <button class="chat-send-btn" id="chat-send" title="Send message">
                <span id="send-icon">➤</span>
              </button>
            </div>
            <div class="chat-footer-info">
              <span><kbd>Enter</kbd> to send · <kbd>Shift+Enter</kbd> for newline</span>
              <span id="chat-token-info"></span>
            </div>
          </div>
        </div>
      </div>
    `;

    this.rendered = true;
    this.setupInputHandlers();
    this.setupScrollDetection();
    this.setupHistoryPanel();

    // Re-render existing messages
    if (this.messages.length > 0) {
      const messagesEl = document.getElementById('chat-messages');
      messagesEl.innerHTML = '';
      this.messages.forEach(msg => this.appendMessageDOM(msg));
      this.scrollToBottom(true);
    }

    // Setup suggestion chips, model pill & load sessions after DOM is ready
    requestAnimationFrame(() => {
      this.setupSuggestionChips();
      this.setupModelPill();
      this.loadSessions();
    });
  }

  teardown() {
    this.rendered = false;
    this.stopThinkingTimer();
  }

  // ═══ MODEL PILL (Header indicator linking to Settings) ═══

  setupModelPill() {
    const pill = document.getElementById('chat-model-pill');
    if (pill) {
      pill.style.cursor = 'pointer';
      pill.title = 'Current AI Model — Click to configure in Settings';
      pill.addEventListener('click', () => {
        window.location.hash = 'settings';
      });
    }
    this._updateModelPill(this.app.state.activeProvider || 'nvidia', this.app.state.model);
  }

  _updateModelPill(provider, model) {
    const headerPill = document.getElementById('chat-model-name');
    const headerDot = document.getElementById('chat-model-dot');
    const isLocal = provider === 'local';
    if (headerPill) {
      if (isLocal) {
        const shortName = (model && model.trim() !== '' && model !== '—') ? model.split('/').pop() : 'Local AI';
        headerPill.textContent = `💻 ${shortName}`;
      } else {
        const shortName = (model && model.trim() !== '' && model !== '—') ? model.split('/').pop() : 'Nemotron';
        headerPill.textContent = `⚡ ${shortName}`;
      }
    }
    if (headerDot) {
      headerDot.className = `chat-model-dot ${isLocal ? 'local' : 'cloud'}`;
    }
  }

  // Called by app.js when model switches
  onModelUpdate(provider, model) {
    if (this.rendered) {
      this._updateModelPill(provider, model);
    }
  }

  // ═══ INPUT HANDLING ═══

  setupInputHandlers() {
    const input = document.getElementById('chat-input');
    const sendBtn = document.getElementById('chat-send');

    // Auto-resize textarea
    input.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 200) + 'px';
      this.handleSlashCommands(input.value);
    });

    // Send on Enter
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (this.isStreaming) {
          this.stopStreaming();
        } else {
          this.sendMessage();
        }
      }
    });

    sendBtn.addEventListener('click', () => {
      if (this.isStreaming) {
        this.stopStreaming();
      } else {
        this.sendMessage();
      }
    });

    // Focus the input on render
    setTimeout(() => input.focus(), 100);
  }

  // ═══ SCROLL DETECTION ═══

  setupScrollDetection() {
    const container = document.getElementById('chat-messages');
    if (!container) return;

    container.addEventListener('scroll', () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      this.autoScroll = distanceFromBottom < 150;
      this.updateScrollFab();
    });

    const fab = document.getElementById('scroll-to-bottom');
    if (fab) {
      fab.addEventListener('click', () => {
        this.autoScroll = true;
        this.scrollToBottom(true);
        this.updateScrollFab();
      });
    }
  }

  updateScrollFab() {
    const fab = document.getElementById('scroll-to-bottom');
    if (!fab) return;
    fab.classList.toggle('visible', !this.autoScroll);
  }

  // ═══ HISTORY PANEL ═══

  setupHistoryPanel() {
    const closeBtn = document.getElementById('history-close-btn');
    const toggleBtn = document.getElementById('history-toggle-btn');
    const newChatBtn = document.getElementById('new-chat-btn');
    const searchInput = document.getElementById('history-search');

    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.toggleHistory(false));
    }
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => this.toggleHistory(!this.historyOpen));
    }
    if (newChatBtn) {
      newChatBtn.addEventListener('click', () => this.createNewSession());
    }
    if (searchInput) {
      let debounceTimer;
      searchInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          this.searchQuery = searchInput.value.trim();
          this.loadSessions();
        }, 300);
      });
    }
  }

  toggleHistory(open) {
    this.historyOpen = open;
    const panel = document.getElementById('chat-history-panel');
    if (panel) {
      panel.classList.toggle('open', open);
    }
  }

  async loadSessions() {
    try {
      const url = this.searchQuery
        ? `/api/chat/search?q=${encodeURIComponent(this.searchQuery)}`
        : '/api/chat/sessions';
      const res = await fetch(url);
      const data = await res.json();
      this.sessions = data.sessions || [];
      this.renderSessionList();
    } catch (err) {
      console.error('Failed to load sessions:', err);
    }
  }

  renderSessionList() {
    const container = document.getElementById('history-sessions-list');
    if (!container) return;

    if (this.sessions.length === 0) {
      container.innerHTML = `
        <div class="history-empty">
          <span>📭</span>
          <p>${this.searchQuery ? 'No matching chats' : 'No chat history yet'}</p>
        </div>
      `;
      return;
    }

    // Group by date
    const groups = this.groupSessionsByDate(this.sessions);
    let html = '';

    for (const [label, sessions] of groups) {
      html += `<div class="history-date-label">${escapeHtml(label)}</div>`;
      for (const s of sessions) {
        const isActive = s.id === this.activeSessionId;
        const title = s.title || 'Untitled Chat';
        const msgCount = s.message_count || 0;
        html += `
        <div class="history-session-item ${isActive ? 'active' : ''}" data-session-id="${escapeHtml(s.id)}">
          <div class="history-session-info">
            <span class="history-session-title" title="${escapeHtml(title)}">${escapeHtml(title)}</span>
            <span class="history-session-meta">${msgCount} message${msgCount !== 1 ? 's' : ''}</span>
          </div>
          <div class="history-session-actions">
            <button class="history-action-btn rename-btn" data-id="${escapeHtml(s.id)}" title="Rename">✎</button>
            <button class="history-action-btn delete-btn" data-id="${escapeHtml(s.id)}" title="Delete">✕</button>
          </div>
        </div>
        `;
      }
    }

    container.innerHTML = html;

    // Attach event listeners
    container.querySelectorAll('.history-session-item').forEach(item => {
      item.addEventListener('click', (e) => {
        // Don't switch if clicking action buttons
        if (e.target.closest('.history-action-btn')) return;
        const id = item.dataset.sessionId;
        if (id !== this.activeSessionId) {
          this.switchSession(id);
        }
      });
    });

    container.querySelectorAll('.rename-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.renameSession(btn.dataset.id);
      });
    });

    container.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.deleteSession(btn.dataset.id);
      });
    });
  }

  groupSessionsByDate(sessions) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
    const weekAgo = new Date(today); weekAgo.setDate(weekAgo.getDate() - 7);

    const groups = new Map();
    groups.set('Today', []);
    groups.set('Yesterday', []);
    groups.set('Previous 7 Days', []);
    groups.set('Older', []);

    for (const s of sessions) {
      const d = new Date(s.updated_at || s.created_at);
      if (d >= today) {
        groups.get('Today').push(s);
      } else if (d >= yesterday) {
        groups.get('Yesterday').push(s);
      } else if (d >= weekAgo) {
        groups.get('Previous 7 Days').push(s);
      } else {
        groups.get('Older').push(s);
      }
    }

    // Filter out empty groups
    return [...groups.entries()].filter(([, items]) => items.length > 0);
  }

  createNewSession() {
    if (this.isStreaming) {
      Toast.warning('Cannot create new chat while streaming');
      return;
    }
    this.app.socket.emit('chat:new_session');
  }

  switchSession(sessionId) {
    if (this.isStreaming) {
      Toast.warning('Cannot switch while streaming');
      return;
    }
    
    // Show loading state
    const messagesEl = document.getElementById('chat-messages');
    if (messagesEl) {
      messagesEl.innerHTML = `
        <div style="display:flex; justify-content:center; padding: 40px; color: var(--text-sub);">
          <div class="tool-spinner" style="margin-right: 12px; border-color: rgba(0, 240, 255, 0.3); border-top-color: var(--cyan);"></div>
          <span>Loading session...</span>
        </div>
      `;
    }
    
    this.app.socket.emit('chat:switch_session', { sessionId });
  }

  async renameSession(id) {
    const session = this.sessions.find(s => s.id === id);
    const currentTitle = session?.title || 'Untitled';
    const newTitle = prompt('Rename chat:', currentTitle);
    if (!newTitle || newTitle.trim() === '' || newTitle === currentTitle) return;

    try {
      await fetch(`/api/chat/sessions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle.trim() }),
      });
      await this.loadSessions();
      Toast.success('Chat renamed');
    } catch (err) {
      Toast.error('Failed to rename');
    }
  }

  async deleteSession(id) {
    if (!confirm('Delete this chat? This cannot be undone.')) return;

    try {
      await fetch(`/api/chat/sessions/${id}`, { method: 'DELETE' });
      // If we deleted the active session, create a new one
      if (id === this.activeSessionId) {
        this.messages = [];
        this.activeSessionId = null;
        this.app.socket.emit('chat:new_session');
      }
      await this.loadSessions();
      Toast.success('Chat deleted');
    } catch (err) {
      Toast.error('Failed to delete');
    }
  }

  // ═══ SEND / STOP ═══

  sendMessage() {
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    if (!message || this.isStreaming) return;

    // Add user message
    this.addMessage('user', message);

    // Clear input
    input.value = '';
    input.style.height = 'auto';

    // Hide welcome
    const welcome = document.querySelector('.chat-welcome');
    if (welcome) welcome.remove();

    // Start streaming state
    this.isStreaming = true;
    this.currentStreamContent = '';
    this.currentThinkingContent = '';
    this.currentToolCalls = [];
    this.toolStepCounter = 0;
    this.streamStartTime = Date.now();
    this.autoScroll = true;
    this.updateSendButton(true);

    // Add placeholder for assistant response
    this.addMessage('assistant', '', { streaming: true });

    // Send to server
    this.app.socket.emit('chat:message', { 
      message,
      sessionId: this.activeSessionId 
    });
  }

  stopStreaming() {
    if (!this.isStreaming) return;
    this.app.socket.emit('chat:abort');
    // Don't call finishStreaming here — the server will emit chat:done
    // which will trigger finishStreaming. This prevents double-finish (Bug 2 fix).
  }

  // ═══ SOCKET EVENTS ═══

  handleSocketEvent(event, data) {
    switch (event) {
      case 'chat:text':
        this.currentStreamContent += data.content;
        this.updateStreamingMessage();
        break;

      case 'chat:thinking':
        this.currentThinkingContent += data.content;
        this.updateThinkingBlock();
        break;

      case 'chat:tool_start':
        this.toolStepCounter++;
        this.currentToolCalls.push({
          name: data.name,
          args: data.args,
          status: 'running',
          result: null,
          step: this.toolStepCounter,
        });
        this.appendToolCallCard(data.name, data.args, this.toolStepCounter);
        break;

      case 'chat:tool_done': {
        const tc = this.currentToolCalls.find(t => t.name === data.name && t.status === 'running');
        if (tc) {
          tc.status = data.result?.success === false ? 'error' : 'success';
          tc.result = data.result;
        }
        this.updateToolCallStatus(data.name, data.result);
        
        if (data.result && data.result.requestedFeedback) {
          this.renderApprovalCard(data.result);
        }
        break;
      }

      case 'chat:done':
        if (this.isStreaming) {
          this.finishStreaming(data);
        }
        break;

      case 'chat:error':
        if (this.isStreaming) {
          this.finishStreaming(data, true);
        }
        Toast.error(`Agent error: ${data.error}`);
        break;

      case 'chat:cleared':
        // Bug 4 fix: reset streaming state
        this.isStreaming = false;
        this.stopThinkingTimer();
        this.updateSendButton(false);
        this.messages = [];
        if (this.rendered) {
          const messagesEl = document.getElementById('chat-messages');
          if (messagesEl) messagesEl.innerHTML = this.getWelcomeHTML();
          // Bug 1 fix: re-wire suggestion chips after clearing
          requestAnimationFrame(() => this.setupSuggestionChips());
        }
        Toast.info('Conversation cleared');
        break;

      case 'chat:compacted':
        Toast.info('History compacted');
        if (data.usage) this.updateTokenInfo(data.usage);
        break;

      case 'chat:session_created':
        this.activeSessionId = data.id;
        this.updateHeaderTitle(data.title || 'New Chat');
        this.loadSessions();
        break;

      case 'chat:session_loaded':
        this.activeSessionId = data.sessionId;
        const session = this.sessions.find(s => s.id === data.sessionId);
        this.updateHeaderTitle(session?.title || 'Chat Session');
        this.messages = [];
        // Rebuild messages from server data
        const messagesEl = document.getElementById('chat-messages');
        if (messagesEl) messagesEl.innerHTML = '';
        if (data.messages && data.messages.length > 0) {
          data.messages.forEach(m => {
            if (m.role === 'user' || m.role === 'assistant') {
              this.addMessage(m.role, m.content || '', { timestamp: new Date(m.timestamp) });
            }
          });
        } else {
          if (messagesEl) messagesEl.innerHTML = this.getWelcomeHTML();
          requestAnimationFrame(() => this.setupSuggestionChips());
        }
        if (data.usage) this.updateTokenInfo(data.usage);
        this.loadSessions();
        this.scrollToBottom(true);
        break;
    }
  }

  // ═══ MESSAGE MANAGEMENT ═══

  addMessage(role, content, opts = {}) {
    const msg = { role, content, timestamp: opts.timestamp || new Date(), ...opts };
    this.messages.push(msg);
    if (this.rendered) {
      this.appendMessageDOM(msg);
      if (this.autoScroll) this.scrollToBottom();
    }
  }

  appendMessageDOM(msg) {
    const messagesEl = document.getElementById('chat-messages');
    if (!messagesEl) return;

    const idx = this.messages.length - 1;
    const div = document.createElement('div');
    div.className = `message ${msg.role}${msg.streaming ? ' streaming' : ''}`;
    div.id = `msg-${idx}`;

    const avatar = msg.role === 'user' ? '👤' : '🐉';
    const sender = msg.role === 'user' ? 'You' : 'Jarvis';
    const time = msg.timestamp
      ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '';

    let contentHtml = '';
    if (msg.streaming) {
      contentHtml = this.getTypingIndicatorHTML();
    } else if (msg.role === 'assistant') {
      contentHtml = renderMarkdown(msg.content);
    } else {
      contentHtml = escapeHtml(msg.content);
    }

    div.innerHTML = `
      <div class="message-avatar">${avatar}</div>
      <div class="message-body">
        <div class="message-meta">
          <span class="message-sender">${sender}</span>
          <span>${time}</span>
        </div>
        <div class="message-content" id="msg-content-${idx}">
          ${contentHtml}
        </div>
      </div>
    `;

    messagesEl.appendChild(div);

    // Bug 5 fix: add copy buttons to code blocks for non-streaming assistant messages
    if (!msg.streaming && msg.role === 'assistant') {
      const contentEl = div.querySelector('.message-content');
      this.addCopyButtonsToCodeBlocks(contentEl);
    }
  }

  // ═══ STREAMING UPDATES ═══

  updateStreamingMessage() {
    const idx = this.messages.length - 1;
    const contentEl = document.getElementById(`msg-content-${idx}`);
    if (!contentEl) return;

    // Remove typing indicator if still showing
    const typingEl = contentEl.querySelector('.typing-indicator');
    if (typingEl) typingEl.remove();

    // Build the text content section
    let textContainer = contentEl.querySelector('.stream-text');
    if (!textContainer) {
      textContainer = document.createElement('div');
      textContainer.className = 'stream-text';
      contentEl.appendChild(textContainer);
    }
    textContainer.innerHTML = renderMarkdown(this.currentStreamContent) + '<span class="streaming-cursor"></span>';

    // Add copy buttons to code blocks
    this.addCopyButtonsToCodeBlocks(textContainer);

    if (this.autoScroll) this.scrollToBottom();
  }

  // ═══ THINKING BLOCK ═══

  updateThinkingBlock() {
    const idx = this.messages.length - 1;
    const contentEl = document.getElementById(`msg-content-${idx}`);
    if (!contentEl) return;

    // Remove typing indicator if still showing
    const typingEl = contentEl.querySelector('.typing-indicator');
    if (typingEl) typingEl.remove();

    let thinkingBlock = contentEl.querySelector('.thinking-block');
    if (!thinkingBlock) {
      this.thinkingStartTime = Date.now();
      this.startThinkingTimer();

      thinkingBlock = document.createElement('div');
      thinkingBlock.className = 'thinking-block active';
      thinkingBlock.innerHTML = `
        <div class="thinking-header">
          <span class="thinking-chevron open">▶</span>
          <div class="thinking-label">
            <span class="thinking-label-icon">🧠</span>
            <span class="thinking-label-text">Reasoning...</span>
          </div>
          <span class="thinking-pulse"></span>
          <span class="thinking-elapsed" id="thinking-elapsed">0s</span>
        </div>
        <div class="thinking-content expanded"></div>
      `;
      contentEl.insertBefore(thinkingBlock, contentEl.firstChild);

      // Setup toggle
      const header = thinkingBlock.querySelector('.thinking-header');
      header.addEventListener('click', () => {
        const chevron = header.querySelector('.thinking-chevron');
        const content = thinkingBlock.querySelector('.thinking-content');
        chevron.classList.toggle('open');
        content.classList.toggle('expanded');
      });
    }

    const thinkingContent = thinkingBlock.querySelector('.thinking-content');
    thinkingContent.textContent = this.currentThinkingContent;
    thinkingContent.scrollTop = thinkingContent.scrollHeight;

    if (this.autoScroll) this.scrollToBottom();
  }

  startThinkingTimer() {
    this.stopThinkingTimer();
    this.thinkingTimerInterval = setInterval(() => {
      const el = document.getElementById('thinking-elapsed');
      if (el && this.thinkingStartTime) {
        const elapsed = Math.floor((Date.now() - this.thinkingStartTime) / 1000);
        if (elapsed < 60) {
          el.textContent = `${elapsed}s`;
        } else {
          const mins = Math.floor(elapsed / 60);
          const secs = elapsed % 60;
          el.textContent = `${mins}m ${secs}s`;
        }
      }
    }, 1000);
  }

  stopThinkingTimer() {
    if (this.thinkingTimerInterval) {
      clearInterval(this.thinkingTimerInterval);
      this.thinkingTimerInterval = null;
    }
  }

  // ═══ TOOL CALL CARDS ═══

  appendToolCallCard(name, args, step) {
    const idx = this.messages.length - 1;
    const contentEl = document.getElementById(`msg-content-${idx}`);
    if (!contentEl) return;

    const typingEl = contentEl.querySelector('.typing-indicator');
    if (typingEl) typingEl.remove();

    const cardId = `tool-${step}-${Date.now()}`;
    const card = document.createElement('div');
    card.className = 'tool-call-card running';
    card.id = cardId;
    card.dataset.toolName = name;
    card.dataset.step = step;

    const argsStr = args ? JSON.stringify(args, null, 2) : '{}';

    card.innerHTML = `
      <div class="tool-call-header">
        <div class="tool-step-badge running">${step}</div>
        <span class="tool-call-icon">🔧</span>
        <span class="tool-call-name">${escapeHtml(name)}</span>
        <span class="tool-call-status running" id="${cardId}-status">
          <span class="tool-spinner"></span>
          Running
        </span>
        <span class="tool-call-expand-chevron">▶</span>
      </div>
      <div class="tool-call-body">
        <div class="tool-call-section">
          <div class="tool-call-section-label">Arguments</div>
          <div class="tool-call-json">${escapeHtml(argsStr)}</div>
        </div>
        <div class="tool-call-section" id="${cardId}-result-section" style="display:none;">
          <div class="tool-call-section-label">Result</div>
          <div class="tool-call-json" id="${cardId}-result-json"></div>
        </div>
      </div>
    `;

    const streamText = contentEl.querySelector('.stream-text');
    if (streamText) {
      contentEl.insertBefore(card, streamText);
    } else {
      contentEl.appendChild(card);
    }

    const header = card.querySelector('.tool-call-header');
    header.addEventListener('click', () => {
      const chevron = card.querySelector('.tool-call-expand-chevron');
      const body = card.querySelector('.tool-call-body');
      chevron.classList.toggle('open');
      body.classList.toggle('expanded');
    });

    if (this.autoScroll) this.scrollToBottom();
  }

  updateToolCallStatus(name, result) {
    const cards = document.querySelectorAll('.tool-call-card.running');
    for (let i = cards.length - 1; i >= 0; i--) {
      const card = cards[i];
      if (card.dataset.toolName === name) {
        const success = result?.success !== false;
        const statusClass = success ? 'success' : 'error';

        card.classList.remove('running');
        card.classList.add(statusClass);

        const badge = card.querySelector('.tool-step-badge');
        if (badge) {
          badge.classList.remove('running');
          badge.classList.add(statusClass);
        }

        const statusEl = card.querySelector('.tool-call-status');
        if (statusEl) {
          statusEl.className = `tool-call-status ${statusClass}`;
          statusEl.innerHTML = success ? '✅ Done' : '❌ Failed';
        }

        const cardId = card.id;
        const resultSection = document.getElementById(`${cardId}-result-section`);
        const resultJson = document.getElementById(`${cardId}-result-json`);
        if (resultSection && resultJson) {
          resultSection.style.display = 'block';
          const resultStr = JSON.stringify(result, null, 2);
          resultJson.textContent = resultStr.length > 2000
            ? resultStr.slice(0, 2000) + '\n... [truncated]'
            : resultStr;
        }
        break;
      }
    }
    if (this.autoScroll) this.scrollToBottom();
  }

  // ═══ APPROVAL CARD (PLANNING MODE) ═══

  renderApprovalCard(result) {
    const idx = this.messages.length - 1;
    const contentEl = document.getElementById(`msg-content-${idx}`);
    if (!contentEl) return;

    // We don't want the approval card to be buried under streaming text, so we append it at the end
    const cardId = `approval-${Date.now()}`;
    const card = document.createElement('div');
    card.className = 'approval-card';
    card.id = cardId;

    const summary = result.summary || 'The agent has proposed a plan or action that requires your explicit approval.';

    card.innerHTML = `
      <div class="approval-header">
        <span class="approval-icon">🛡️</span>
        <span class="approval-title">User Approval Required</span>
      </div>
      <div class="approval-body">
        <p class="approval-summary">${escapeHtml(summary)}</p>
        <div id="plan-preview-${cardId}" class="approval-plan-preview markdown-body" style="margin: 12px 0; padding: 12px; background: rgba(0,0,0,0.2); border-radius: 6px; border: 1px solid rgba(255,255,255,0.05); font-size: 0.9em; max-height: 400px; overflow-y: auto;">
          <div class="spinner" style="width: 14px; height: 14px; display: inline-block; margin-right: 6px; vertical-align: middle;"></div> <span style="vertical-align: middle;">Loading plan details...</span>
        </div>
        <p class="approval-hint">Review the plan above. The agent is paused and waiting for your decision.</p>
        <div class="approval-actions">
          <button class="btn-proceed" id="btn-proceed-${cardId}">Proceed</button>
          <button class="btn-edit" id="btn-edit-${cardId}">Edit Plan</button>
          <button class="btn-reject" id="btn-reject-${cardId}">Reject</button>
        </div>
      </div>
    `;

    contentEl.appendChild(card);

    // Auto-load plan content
    if (result.path) {
      fetch(`/api/file?path=${encodeURIComponent(result.path)}`)
        .then(res => res.json())
        .then(data => {
          const previewEl = document.getElementById(`plan-preview-${cardId}`);
          if (previewEl && data.content) {
            previewEl.innerHTML = renderMarkdown(data.content);
            if (this.autoScroll) this.scrollToBottom();
          } else if (previewEl) {
            previewEl.style.display = 'none';
          }
        })
        .catch(err => {
          const previewEl = document.getElementById(`plan-preview-${cardId}`);
          if (previewEl) previewEl.style.display = 'none';
        });
    } else {
      const previewEl = document.getElementById(`plan-preview-${cardId}`);
      if (previewEl) previewEl.style.display = 'none';
    }

    const btnProceed = document.getElementById(`btn-proceed-${cardId}`);
    const btnEdit = document.getElementById(`btn-edit-${cardId}`);
    const btnReject = document.getElementById(`btn-reject-${cardId}`);

    btnProceed.addEventListener('click', () => {
      card.innerHTML = `<div class="approval-header success"><span class="approval-icon">✅</span><span class="approval-title">Plan Approved</span></div>`;
      const input = document.getElementById('chat-input');
      input.value = "Approved. Please proceed with the plan.";
      this.sendMessage();
    });

    btnEdit.addEventListener('click', async () => {
      if (!result.path) {
        Toast.error('Cannot edit plan: file path not available.');
        return;
      }
      btnEdit.disabled = true;
      btnEdit.textContent = 'Loading...';

      try {
        const res = await fetch(`/api/file?path=${encodeURIComponent(result.path)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        // Transform body into editor
        const bodyEl = card.querySelector('.approval-body');
        bodyEl.innerHTML = `
          <p class="approval-hint">Edit the markdown plan below. Changes are saved automatically when you proceed.</p>
          <textarea class="approval-editor" id="editor-${cardId}">${escapeHtml(data.content)}</textarea>
          <div class="approval-actions">
            <button class="btn-proceed" id="btn-save-${cardId}">Save & Proceed</button>
            <button class="btn-reject" id="btn-cancel-${cardId}">Cancel</button>
          </div>
        `;

        document.getElementById(`btn-save-${cardId}`).addEventListener('click', async () => {
          const newContent = document.getElementById(`editor-${cardId}`).value;
          const saveBtn = document.getElementById(`btn-save-${cardId}`);
          saveBtn.disabled = true;
          saveBtn.textContent = 'Saving...';

          try {
            const saveRes = await fetch('/api/file', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ path: result.path, content: newContent })
            });
            if (!saveRes.ok) throw new Error(await saveRes.text());
            
            card.innerHTML = `<div class="approval-header success"><span class="approval-icon">✅</span><span class="approval-title">Plan Edited & Approved</span></div>`;
            const input = document.getElementById('chat-input');
            input.value = "I have updated the plan. Approved. Please proceed with the plan.";
            this.sendMessage();
          } catch (err) {
            Toast.error(`Save failed: ${err.message}`);
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save & Proceed';
          }
        });

        document.getElementById(`btn-cancel-${cardId}`).addEventListener('click', () => {
          // Re-render the original card
          this.renderApprovalCard(result);
          card.remove(); // removes the current editor card
        });

      } catch (err) {
        Toast.error(`Failed to load plan: ${err.message}`);
        btnEdit.disabled = false;
        btnEdit.textContent = 'Edit Plan';
      }
    });

    btnReject.addEventListener('click', () => {
      card.innerHTML = `<div class="approval-header error"><span class="approval-icon">❌</span><span class="approval-title">Plan Rejected</span></div>`;
      const input = document.getElementById('chat-input');
      input.value = "Plan rejected. Please modify your approach: ";
      input.focus();
    });

    if (this.autoScroll) this.scrollToBottom();
  }

  // ═══ FINISH STREAMING ═══

  finishStreaming(data, isError = false) {
    this.isStreaming = false;
    this.stopThinkingTimer();
    this.updateSendButton(false);

    const idx = this.messages.length - 1;
    const msgEl = document.getElementById(`msg-${idx}`);
    const contentEl = document.getElementById(`msg-content-${idx}`);

    if (msgEl) msgEl.classList.remove('streaming');

    if (contentEl) {
      const typingEl = contentEl.querySelector('.typing-indicator');
      if (typingEl) typingEl.remove();

      const cursor = contentEl.querySelector('.streaming-cursor');
      if (cursor) cursor.remove();

      // Finalize thinking block
      const thinkingBlock = contentEl.querySelector('.thinking-block');
      if (thinkingBlock) {
        thinkingBlock.classList.remove('active');

        const pulse = thinkingBlock.querySelector('.thinking-pulse');
        if (pulse) pulse.remove();

        const labelText = thinkingBlock.querySelector('.thinking-label-text');
        if (labelText) {
          const elapsed = this.thinkingStartTime
            ? Math.floor((Date.now() - this.thinkingStartTime) / 1000)
            : 0;
          const timeStr = elapsed < 60
            ? `${elapsed}s`
            : `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`;
          labelText.textContent = `Reasoning complete (${timeStr})`;
        }

        const chevron = thinkingBlock.querySelector('.thinking-chevron');
        const thinkingContent = thinkingBlock.querySelector('.thinking-content');
        if (chevron) chevron.classList.remove('open');
        if (thinkingContent) thinkingContent.classList.remove('expanded');

        const elapsedEl = thinkingBlock.querySelector('.thinking-elapsed');
        if (elapsedEl) elapsedEl.remove();
      }

      // Show error if present
      if (isError && data.error) {
        const errorEl = document.createElement('div');
        errorEl.className = 'chat-error-inline';
        errorEl.innerHTML = `
          <span class="error-icon">⚠️</span>
          <span>${escapeHtml(data.error)}</span>
        `;
        contentEl.appendChild(errorEl);
      }

      // Bug 5 fix: add copy buttons to final rendered code blocks
      const streamText = contentEl.querySelector('.stream-text');
      if (streamText) {
        this.addCopyButtonsToCodeBlocks(streamText);
      }
    }

    // Update the stored message content
    if (this.messages[idx]) {
      this.messages[idx].content = this.currentStreamContent;
      this.messages[idx].streaming = false;
    }

    if (data.usage) this.updateTokenInfo(data.usage);
    this.thinkingStartTime = null;

    // Refresh session list to update message counts
    this.loadSessions();
  }

  // ═══ UI HELPERS ═══

  updateSendButton(streaming) {
    const btn = document.getElementById('chat-send');
    const icon = document.getElementById('send-icon');
    if (!btn || !icon) return;

    if (streaming) {
      btn.classList.add('stop-mode');
      btn.disabled = false;
      btn.title = 'Stop generation';
      icon.innerHTML = '<div class="stop-icon"></div>';
    } else {
      btn.classList.remove('stop-mode');
      btn.disabled = false;
      btn.title = 'Send message';
      icon.textContent = '➤';
    }
  }

  updateTokenInfo(usage) {
    const el = document.getElementById('chat-token-info');
    if (el) {
      el.textContent = `Tokens: ${(usage.inputTokens || 0).toLocaleString()} in / ${(usage.outputTokens || 0).toLocaleString()} out`;
    }
  }

  updateHeaderTitle(title) {
    const headerTitle = document.getElementById('chat-header-title');
    if (headerTitle) {
      headerTitle.textContent = title;
    }
  }

  scrollToBottom(force = false) {
    if (!this.autoScroll && !force) return;
    const container = document.getElementById('chat-messages');
    if (container) {
      requestAnimationFrame(() => {
        container.scrollTop = container.scrollHeight;
      });
    }
  }

  getTypingIndicatorHTML() {
    return `
      <div class="typing-indicator">
        <div class="typing-dots">
          <span class="typing-dot"></span>
          <span class="typing-dot"></span>
          <span class="typing-dot"></span>
        </div>
        <span class="typing-indicator-label">Thinking...</span>
      </div>
    `;
  }

  addCopyButtonsToCodeBlocks(container) {
    if (!container) return;
    const preBlocks = container.querySelectorAll('pre');
    preBlocks.forEach(pre => {
      if (pre.querySelector('.code-copy-btn')) return;

      const copyBtn = document.createElement('button');
      copyBtn.className = 'code-copy-btn';
      copyBtn.textContent = '📋';
      copyBtn.title = 'Copy code';
      copyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const code = pre.querySelector('code');
        const text = code ? code.textContent : pre.textContent;
        navigator.clipboard.writeText(text).then(() => {
          copyBtn.textContent = '✓';
          copyBtn.classList.add('copied');
          setTimeout(() => {
            copyBtn.textContent = '📋';
            copyBtn.classList.remove('copied');
          }, 2000);
        }).catch(() => {
          Toast.error('Failed to copy');
        });
      });
      pre.style.position = 'relative';
      pre.appendChild(copyBtn);
    });
  }

  // ═══ SLASH COMMANDS ═══

  handleSlashCommands(value) {
    const dropdown = document.getElementById('slash-dropdown');
    if (!dropdown) return;

    if (value.startsWith('/') && !value.includes(' ')) {
      const commands = [
        { cmd: '/clear', desc: 'Clear conversation history' },
        { cmd: '/compact', desc: 'Compact history to save tokens' },
        { cmd: '/help', desc: 'Show available commands' },
      ];

      const filtered = commands.filter(c => c.cmd.startsWith(value));
      if (filtered.length > 0) {
        dropdown.innerHTML = filtered.map(c => `
          <div class="slash-item" data-cmd="${c.cmd}">
            <span class="slash-cmd">${c.cmd}</span>
            <span class="slash-desc">${c.desc}</span>
          </div>
        `).join('');
        dropdown.classList.remove('hidden');

        dropdown.querySelectorAll('.slash-item').forEach(item => {
          item.addEventListener('click', () => {
            const cmd = item.dataset.cmd;
            if (cmd === '/clear') {
              this.app.socket.emit('chat:clear');
            } else if (cmd === '/compact') {
              this.app.socket.emit('chat:compact');
            }
            document.getElementById('chat-input').value = '';
            dropdown.classList.add('hidden');
          });
        });
        return;
      }
    }

    dropdown.classList.add('hidden');
  }

  // ═══ WELCOME SCREEN ═══

  getWelcomeHTML() {
    return `
      <div class="chat-welcome">
        <span class="welcome-icon">🐉</span>
        <h2 class="welcome-title">Jarvis Cyber Agent</h2>
        <p class="welcome-desc">
          I'm your autonomous AI cybersecurity agent. I can scan targets, discover vulnerabilities,
          generate reports, and help you with security research — all powered by 150+ tools and MITRE ATT&CK mapping.
        </p>
        <div class="welcome-suggestions">
          <div class="suggestion-chip" data-suggestion="Scan example.com for open ports and vulnerabilities">
            🔍 Scan a target
          </div>
          <div class="suggestion-chip" data-suggestion="Search for recent critical CVEs">
            🛡️ Search CVEs
          </div>
          <div class="suggestion-chip" data-suggestion="What tools do you have for web application testing?">
            🔧 List web tools
          </div>
          <div class="suggestion-chip" data-suggestion="Generate a recon strategy for a bug bounty target">
            🎯 Build a strategy
          </div>
        </div>
      </div>
    `;
  }

  setupSuggestionChips() {
    document.querySelectorAll('.suggestion-chip[data-suggestion]').forEach(chip => {
      chip.addEventListener('click', () => {
        const suggestion = chip.dataset.suggestion;
        const input = document.getElementById('chat-input');
        if (input) {
          input.value = suggestion;
          input.focus();
          this.sendMessage();
        }
      });
    });
  }
}
