// Jarvis Cyber — Chat View (Agent Interaction) — Production Grade
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
  }

  render(container) {
    container.innerHTML = `
      <div class="chat-view">
        <div class="chat-messages" id="chat-messages">
          ${this.messages.length === 0 ? this.getWelcomeHTML() : ''}
        </div>
        <button class="scroll-to-bottom" id="scroll-to-bottom" title="Jump to bottom">↓</button>
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
    this.setupScrollDetection();

    // Re-render existing messages
    if (this.messages.length > 0) {
      const messagesEl = document.getElementById('chat-messages');
      messagesEl.innerHTML = '';
      this.messages.forEach(msg => this.appendMessageDOM(msg));
      this.scrollToBottom(true);
    }

    // Setup suggestion chips after DOM is ready
    requestAnimationFrame(() => this.setupSuggestionChips());
  }

  teardown() {
    this.rendered = false;
    this.stopThinkingTimer();
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
      // If user scrolled up more than 100px from bottom, disable auto-scroll
      this.autoScroll = distanceFromBottom < 100;
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
    if (this.autoScroll) {
      fab.classList.remove('visible');
    } else {
      fab.classList.add('visible');
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
    this.app.socket.emit('chat:message', { message });
  }

  stopStreaming() {
    if (!this.isStreaming) return;
    this.app.socket.emit('chat:abort');
    this.finishStreaming({ usage: null }, false);
    Toast.info('Request stopped');
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

  // ═══ MESSAGE MANAGEMENT ═══

  addMessage(role, content, opts = {}) {
    const msg = { role, content, timestamp: new Date(), ...opts };
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
      contentHtml = this.processMarkdownWithCopyButtons(msg.content);
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
  }

  // ═══ STREAMING UPDATES ═══

  updateStreamingMessage() {
    const idx = this.messages.length - 1;
    const contentEl = document.getElementById(`msg-content-${idx}`);
    if (!contentEl) return;

    // Remove typing indicator if still showing
    const typingEl = contentEl.querySelector('.typing-indicator');
    if (typingEl) typingEl.remove();

    // Preserve thinking block and tool cards
    const thinkingBlock = contentEl.querySelector('.thinking-block');
    const toolCards = contentEl.querySelectorAll('.tool-call-card');

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
      // Start thinking timer
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

    // Auto-scroll the thinking content to bottom
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

    // Remove typing indicator if still showing
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

    // Insert before the stream-text container if it exists, otherwise append
    const streamText = contentEl.querySelector('.stream-text');
    if (streamText) {
      contentEl.insertBefore(card, streamText);
    } else {
      contentEl.appendChild(card);
    }

    // Setup toggle
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
    // Find the latest running tool card for this name
    const cards = document.querySelectorAll('.tool-call-card.running');
    for (let i = cards.length - 1; i >= 0; i--) {
      const card = cards[i];
      if (card.dataset.toolName === name) {
        const success = result?.success !== false;
        const statusClass = success ? 'success' : 'error';

        // Update card class
        card.classList.remove('running');
        card.classList.add(statusClass);

        // Update badge
        const badge = card.querySelector('.tool-step-badge');
        if (badge) {
          badge.classList.remove('running');
          badge.classList.add(statusClass);
        }

        // Update status text
        const statusEl = card.querySelector('.tool-call-status');
        if (statusEl) {
          statusEl.className = `tool-call-status ${statusClass}`;
          statusEl.innerHTML = success ? '✅ Done' : '❌ Failed';
        }

        // Show result
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

  // ═══ FINISH STREAMING ═══

  finishStreaming(data, isError = false) {
    this.isStreaming = false;
    this.stopThinkingTimer();
    this.updateSendButton(false);

    const idx = this.messages.length - 1;
    const msgEl = document.getElementById(`msg-${idx}`);
    const contentEl = document.getElementById(`msg-content-${idx}`);

    // Remove streaming class from message
    if (msgEl) msgEl.classList.remove('streaming');

    if (contentEl) {
      // Remove typing indicator
      const typingEl = contentEl.querySelector('.typing-indicator');
      if (typingEl) typingEl.remove();

      // Remove streaming cursor
      const cursor = contentEl.querySelector('.streaming-cursor');
      if (cursor) cursor.remove();

      // Finalize thinking block
      const thinkingBlock = contentEl.querySelector('.thinking-block');
      if (thinkingBlock) {
        thinkingBlock.classList.remove('active');

        // Remove pulse dot
        const pulse = thinkingBlock.querySelector('.thinking-pulse');
        if (pulse) pulse.remove();

        // Update label
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

        // Collapse thinking content, but keep it expandable
        const chevron = thinkingBlock.querySelector('.thinking-chevron');
        const thinkingContent = thinkingBlock.querySelector('.thinking-content');
        if (chevron) chevron.classList.remove('open');
        if (thinkingContent) thinkingContent.classList.remove('expanded');

        // Remove elapsed timer display
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
    }

    // Update the stored message content
    if (this.messages[idx]) {
      this.messages[idx].content = this.currentStreamContent;
      this.messages[idx].streaming = false;
    }

    // Update token info
    if (data.usage) this.updateTokenInfo(data.usage);

    this.thinkingStartTime = null;
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
      el.textContent = `🪙 ${(usage.inputTokens || 0).toLocaleString()} in / ${(usage.outputTokens || 0).toLocaleString()} out · ${usage.turns || 0} turns`;
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

  processMarkdownWithCopyButtons(text) {
    if (!text) return '';
    const html = renderMarkdown(text);
    // We'll add copy buttons via DOM manipulation after inserting
    return html;
  }

  addCopyButtonsToCodeBlocks(container) {
    if (!container) return;
    const preBlocks = container.querySelectorAll('pre');
    preBlocks.forEach(pre => {
      // Don't add if already has one
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

  // Called after render to attach suggestion chip listeners (called from render)
  setupSuggestionChips() {
    document.querySelectorAll('.suggestion-chip[data-suggestion]').forEach(chip => {
      chip.addEventListener('click', () => {
        const suggestion = chip.dataset.suggestion;
        const input = document.getElementById('chat-input');
        if (input) {
          input.value = suggestion;
          input.focus();
          // Actually send the message
          this.sendMessage();
        }
      });
    });
  }
}
