// Jarvis Cyber — Chat View (Agent Interaction)
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
    this.rendered = false;
  }

  render(container) {
    container.innerHTML = `
      <div class="chat-view">
        <div class="chat-messages" id="chat-messages">
          ${this.messages.length === 0 ? this.getWelcomeHTML() : ''}
        </div>
        <div class="chat-input-area">
          <div class="chat-input-wrapper">
            <div class="chat-input-container">
              <textarea class="chat-input" id="chat-input"
                placeholder="Ask Jarvis anything... (e.g., 'Scan example.com for vulnerabilities')"
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
    `;

    this.rendered = true;
    this.setupInputHandlers();

    // Re-render existing messages
    if (this.messages.length > 0) {
      const messagesEl = document.getElementById('chat-messages');
      messagesEl.innerHTML = '';
      this.messages.forEach(msg => this.appendMessageDOM(msg));
      this.scrollToBottom();
    }
  }

  teardown() {
    this.rendered = false;
  }

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
        this.sendMessage();
      }
    });

    sendBtn.addEventListener('click', () => this.sendMessage());
  }

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
    this.updateSendButton(true);

    // Add placeholder for assistant response
    this.addMessage('assistant', '', { streaming: true });

    // Send to server
    this.app.socket.emit('chat:message', { message });
  }

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
        this.currentToolCalls.push({
          name: data.name,
          args: data.args,
          status: 'running',
          result: null,
        });
        this.appendToolCallCard(data.name, data.args);
        break;

      case 'chat:tool_done':
        // Update the tool call status
        const tc = this.currentToolCalls.find(t => t.name === data.name && t.status === 'running');
        if (tc) {
          tc.status = data.result?.success === false ? 'error' : 'success';
          tc.result = data.result;
        }
        this.updateToolCallStatus(data.name, data.result);
        break;

      case 'chat:done':
        this.finishStreaming(data);
        break;

      case 'chat:error':
        this.finishStreaming(data, true);
        Toast.error(`Agent error: ${data.error}`);
        break;

      case 'chat:cleared':
        this.messages = [];
        if (this.rendered) {
          const messagesEl = document.getElementById('chat-messages');
          if (messagesEl) messagesEl.innerHTML = this.getWelcomeHTML();
        }
        Toast.info('Conversation cleared');
        break;

      case 'chat:compacted':
        Toast.info('History compacted');
        if (data.usage) this.updateTokenInfo(data.usage);
        break;
    }
  }

  addMessage(role, content, opts = {}) {
    const msg = { role, content, timestamp: new Date(), ...opts };
    this.messages.push(msg);
    if (this.rendered) {
      this.appendMessageDOM(msg);
      this.scrollToBottom();
    }
  }

  appendMessageDOM(msg) {
    const messagesEl = document.getElementById('chat-messages');
    if (!messagesEl) return;

    const div = document.createElement('div');
    div.className = `message ${msg.role}`;
    div.id = `msg-${this.messages.length - 1}`;

    const avatar = msg.role === 'user' ? '👤' : '🐉';
    const sender = msg.role === 'user' ? 'You' : 'Jarvis';
    const time = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

    let contentHtml = '';
    if (msg.streaming) {
      contentHtml = '<span class="streaming-cursor"></span>';
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
        <div class="message-content" id="msg-content-${this.messages.length - 1}">
          ${contentHtml}
        </div>
      </div>
    `;

    messagesEl.appendChild(div);
  }

  updateStreamingMessage() {
    const idx = this.messages.length - 1;
    const contentEl = document.getElementById(`msg-content-${idx}`);
    if (!contentEl) return;

    contentEl.innerHTML = renderMarkdown(this.currentStreamContent) + '<span class="streaming-cursor"></span>';
    this.scrollToBottom();
  }

  updateThinkingBlock() {
    const idx = this.messages.length - 1;
    const contentEl = document.getElementById(`msg-content-${idx}`);
    if (!contentEl) return;

    let thinkingBlock = contentEl.querySelector('.thinking-block');
    if (!thinkingBlock) {
      thinkingBlock = document.createElement('div');
      thinkingBlock.className = 'thinking-block';
      thinkingBlock.innerHTML = `
        <div class="thinking-header" onclick="this.querySelector('.chevron').classList.toggle('open'); this.nextElementSibling.classList.toggle('expanded');">
          <span class="chevron">▶</span>
          <span>🧠 Reasoning...</span>
        </div>
        <div class="thinking-content"></div>
      `;
      contentEl.insertBefore(thinkingBlock, contentEl.firstChild);
    }

    const thinkingContent = thinkingBlock.querySelector('.thinking-content');
    thinkingContent.textContent = this.currentThinkingContent;
  }

  appendToolCallCard(name, args) {
    const idx = this.messages.length - 1;
    const contentEl = document.getElementById(`msg-content-${idx}`);
    if (!contentEl) return;

    // Remove streaming cursor temporarily
    const cursor = contentEl.querySelector('.streaming-cursor');

    const card = document.createElement('div');
    card.className = 'tool-call-card';
    card.id = `tool-${name}-${Date.now()}`;

    const argsStr = args ? JSON.stringify(args, null, 2) : '{}';

    card.innerHTML = `
      <div class="tool-call-header" onclick="this.nextElementSibling.classList.toggle('expanded')">
        <span class="tool-call-icon">🔧</span>
        <span class="tool-call-name">${name}</span>
        <span class="tool-call-status running" id="${card.id}-status">⏳ Running...</span>
      </div>
      <div class="tool-call-body">
        <div class="tool-call-section">
          <div class="tool-call-section-label">Arguments</div>
          <div class="tool-call-json">${escapeHtml(argsStr)}</div>
        </div>
        <div class="tool-call-section" id="${card.id}-result" style="display:none;">
          <div class="tool-call-section-label">Result</div>
          <div class="tool-call-json" id="${card.id}-result-json"></div>
        </div>
      </div>
    `;

    contentEl.insertBefore(card, cursor);
    this.scrollToBottom();
  }

  updateToolCallStatus(name, result) {
    // Find the latest running tool card for this name
    const cards = document.querySelectorAll('.tool-call-card');
    for (let i = cards.length - 1; i >= 0; i--) {
      const card = cards[i];
      const statusEl = card.querySelector('.tool-call-status.running');
      if (statusEl && card.querySelector('.tool-call-name')?.textContent === name) {
        const success = result?.success !== false;
        statusEl.className = `tool-call-status ${success ? 'success' : 'error'}`;
        statusEl.textContent = success ? '✅ Success' : '❌ Failed';

        // Show result
        const resultSection = card.querySelector(`[id$="-result"]`);
        const resultJson = card.querySelector(`[id$="-result-json"]`);
        if (resultSection && resultJson) {
          resultSection.style.display = 'block';
          const resultStr = JSON.stringify(result, null, 2);
          resultJson.textContent = resultStr.length > 2000 ? resultStr.slice(0, 2000) + '\n... [truncated]' : resultStr;
        }
        break;
      }
    }
    this.scrollToBottom();
  }

  finishStreaming(data, isError = false) {
    this.isStreaming = false;
    this.updateSendButton(false);

    const idx = this.messages.length - 1;
    const contentEl = document.getElementById(`msg-content-${idx}`);
    if (contentEl) {
      // Remove streaming cursor
      const cursor = contentEl.querySelector('.streaming-cursor');
      if (cursor) cursor.remove();

      // Finalize thinking block
      const thinkingHeader = contentEl.querySelector('.thinking-header');
      if (thinkingHeader) {
        const label = thinkingHeader.querySelector('span:last-child');
        if (label) label.textContent = '🧠 Reasoning (click to expand)';
      }

      if (isError && data.error) {
        contentEl.innerHTML += `<div style="color:var(--rose);margin-top:var(--sp-2);font-size:0.85rem;">⚠️ ${escapeHtml(data.error)}</div>`;
      }
    }

    // Update the stored message content
    if (this.messages[idx]) {
      this.messages[idx].content = this.currentStreamContent;
      this.messages[idx].streaming = false;
    }

    // Update token info
    if (data.usage) this.updateTokenInfo(data.usage);
  }

  updateSendButton(loading) {
    const btn = document.getElementById('chat-send');
    const icon = document.getElementById('send-icon');
    if (!btn || !icon) return;

    if (loading) {
      btn.disabled = true;
      icon.innerHTML = '<div class="spinner" style="width:18px;height:18px;border-color:rgba(0,0,0,0.2);border-top-color:var(--bg-deep);"></div>';
    } else {
      btn.disabled = false;
      icon.textContent = '➤';
    }
  }

  updateTokenInfo(usage) {
    const el = document.getElementById('chat-token-info');
    if (el) {
      el.textContent = `🪙 ${(usage.inputTokens || 0).toLocaleString()} in / ${(usage.outputTokens || 0).toLocaleString()} out · ${usage.turns || 0} turns`;
    }
  }

  scrollToBottom() {
    const container = document.getElementById('chat-messages');
    if (container) {
      requestAnimationFrame(() => {
        container.scrollTop = container.scrollHeight;
      });
    }
  }

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
          <div class="suggestion-chip" onclick="document.getElementById('chat-input').value='Scan example.com for open ports and vulnerabilities'; document.getElementById('chat-input').focus();">
            🔍 Scan a target
          </div>
          <div class="suggestion-chip" onclick="document.getElementById('chat-input').value='Search for recent critical CVEs'; document.getElementById('chat-input').focus();">
            🛡️ Search CVEs
          </div>
          <div class="suggestion-chip" onclick="document.getElementById('chat-input').value='What tools do you have for web application testing?'; document.getElementById('chat-input').focus();">
            🔧 List web tools
          </div>
          <div class="suggestion-chip" onclick="document.getElementById('chat-input').value='Generate a recon strategy for a bug bounty target'; document.getElementById('chat-input').focus();">
            🎯 Build a strategy
          </div>
        </div>
      </div>
    `;
  }
}
