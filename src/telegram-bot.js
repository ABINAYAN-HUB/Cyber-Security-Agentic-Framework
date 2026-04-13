// Jarvis Cyber — Telegram Bot Interface
// Full AI agent control via Telegram messaging
import TelegramBot from 'node-telegram-bot-api';
import { Agent } from './agent.js';
import config from './config.js';
import { memory } from './memory.js';
import { existsSync, readFileSync, writeFileSync, unlinkSync, createReadStream, readdirSync, statSync } from 'fs';
import { join } from 'path';

export class TelegramInterface {
  constructor() {
    this.bot = null;
    this.agent = null;
    this.sessions = new Map(); // chatId -> Agent instance
    this.processing = new Set(); // chatIds currently being processed
  }

  async start() {
    if (!config.telegramToken) {
      throw new Error('TELEGRAM_BOT_TOKEN not set in .env');
    }

    // Initialize memory
    try { memory.init(); } catch {}

    console.log('🤖 Jarvis Cyber Telegram Bot starting...');

    // ═══ Step 1: Kill any existing bot process using PID lock file ═══
    const pidFile = join(config.dataDir, '.jarvis-bot.pid');
    try {
      if (existsSync(pidFile)) {
        const oldPid = parseInt(readFileSync(pidFile, 'utf-8').trim(), 10);
        if (oldPid && oldPid !== process.pid) {
          try {
            // Check if process is alive
            process.kill(oldPid, 0);
            // It's alive — kill it
            console.log(`⚠️  Killing old bot instance (PID ${oldPid})...`);
            process.kill(oldPid, 'SIGTERM');
            await new Promise(r => setTimeout(r, 2000));
            // Force kill if still alive
            try { process.kill(oldPid, 'SIGKILL'); } catch {}
            await new Promise(r => setTimeout(r, 1000));
          } catch {
            // Process doesn't exist anymore — stale PID file, that's fine
          }
        }
      }
    } catch {}

    // Write our PID
    try { writeFileSync(pidFile, String(process.pid)); } catch {}

    // Clean up PID file on exit
    const cleanPid = () => { try { if (existsSync(pidFile)) { unlinkSync(pidFile); } } catch {} };
    process.on('exit', cleanPid);
    process.on('SIGINT', () => { cleanPid(); process.exit(0); });
    process.on('SIGTERM', () => { cleanPid(); process.exit(0); });

    // ═══ Step 2: AGGRESSIVE Telegram lock release ═══
    // This is the KEY fix for 409 Conflict errors.
    // We MUST: (a) delete any webhook, (b) drain the update queue, (c) wait for Telegram to release
    const token = config.telegramToken;
    const apiBase = `https://api.telegram.org/bot${token}`;

    console.log('🔄 Releasing Telegram polling lock...');

    // (a) Delete webhook + drop pending updates — this is CRITICAL
    try {
      const resp = await fetch(`${apiBase}/deleteWebhook?drop_pending_updates=true`);
      const data = await resp.json();
      if (data.ok) {
        console.log('   ✅ Webhook deleted & pending updates dropped');
      } else {
        console.log(`   ⚠️  deleteWebhook: ${JSON.stringify(data)}`);
      }
    } catch (e) {
      console.log(`   ⚠️  deleteWebhook failed: ${e.message}`);
    }

    // (b) Flush the getUpdates queue with a high offset to clear any stale lock
    try {
      // First call: get latest update_id
      const resp1 = await fetch(`${apiBase}/getUpdates?offset=-1&timeout=0&limit=1`);
      const data1 = await resp1.json();
      if (data1.ok && data1.result && data1.result.length > 0) {
        const lastUpdateId = data1.result[data1.result.length - 1].update_id;
        // Second call: acknowledge by requesting offset = lastUpdateId + 1
        await fetch(`${apiBase}/getUpdates?offset=${lastUpdateId + 1}&timeout=0&limit=1`);
        console.log(`   ✅ Flushed update queue (last update_id: ${lastUpdateId})`);
      } else {
        console.log('   ✅ Update queue is clean');
      }
    } catch (e) {
      console.log(`   ⚠️  getUpdates flush: ${e.message}`);
    }

    // (c) Wait for Telegram servers to fully release the polling connection
    await new Promise(r => setTimeout(r, 2000));

    // ═══ Step 3: Start the bot with polling ═══
    this.bot = new TelegramBot(token, { 
      polling: {
        interval: 1500,
        autoStart: true,
        params: { timeout: 15 }
      }
    });

    // ═══ Handle polling errors gracefully ═══
    let conflict409Count = 0;
    let isRetrying409 = false;

    this.bot.on('polling_error', async (err) => {
      const msg = err.message || '';

      if (msg.includes('409') || msg.includes('Conflict')) {
        conflict409Count++;

        if (conflict409Count <= 3) {
          console.warn('⚠️  409 Conflict — retrying lock release...');
        }

        // Auto-recovery: try to release the lock again
        if (!isRetrying409 && conflict409Count <= 5) {
          isRetrying409 = true;
          try {
            // Stop polling, flush, restart
            this.bot.stopPolling();
            await new Promise(r => setTimeout(r, 2000));
            
            await fetch(`${apiBase}/deleteWebhook?drop_pending_updates=true`);
            const resp = await fetch(`${apiBase}/getUpdates?offset=-1&timeout=0&limit=1`);
            const data = await resp.json();
            if (data.ok && data.result && data.result.length > 0) {
              const lastId = data.result[data.result.length - 1].update_id;
              await fetch(`${apiBase}/getUpdates?offset=${lastId + 1}&timeout=0&limit=1`);
            }
            
            await new Promise(r => setTimeout(r, 3000));
            this.bot.startPolling();
            console.log('🔄 Re-started polling after lock release');
          } catch {} finally {
            isRetrying409 = false;
          }
        }

        if (conflict409Count >= 10) {
          console.error('❌ Persistent 409 Conflict. Run: pkill -f "node cli.js" && sleep 5 && jarvis --telegram');
        }
      } else if (msg.includes('ETIMEDOUT') || msg.includes('ECONNRESET') || msg.includes('ENOTFOUND')) {
        // Network issues — silent, they auto-recover
      } else if (msg.includes('504')) {
        // Gateway timeout — Telegram server overloaded, auto-recovers
      } else {
        console.warn(`⚠️  Telegram: ${msg.slice(0, 150)}`);
      }
    });

    // Register command handlers
    this.bot.onText(/\/start/, (msg) => this._handleStart(msg));
    this.bot.onText(/\/help/, (msg) => this._handleHelp(msg));
    this.bot.onText(/\/clear/, (msg) => this._handleClear(msg));
    this.bot.onText(/\/status/, (msg) => this._handleStatus(msg));
    this.bot.onText(/\/tools/, (msg) => this._handleTools(msg));
    this.bot.onText(/\/model(.*)/, (msg, match) => this._handleModel(msg, match));
    this.bot.onText(/\/skills/, (msg) => this._handleSkills(msg));
    this.bot.onText(/\/memory(.*)/, (msg, match) => this._handleMemory(msg, match));
    this.bot.onText(/\/loot/, (msg) => this._handleLoot(msg));
    this.bot.onText(/\/myid/, (msg) => this._handleMyId(msg));

    // Handle regular messages (NOT commands)
    this.bot.on('message', (msg) => {
      // Skip if it's a command — already handled by onText
      if (msg.text && msg.text.startsWith('/')) return;
      this._handleMessage(msg);
    });

    // Handle documents (file uploads)
    this.bot.on('document', (msg) => this._handleDocument(msg));

    const me = await this.bot.getMe();
    console.log(`✅ Bot online: @${me.username} (${me.id})`);
    
    // Reset 409 counter on successful start
    conflict409Count = 0;

    if (config.telegramAllowedIds.length === 0) {
      console.log('🔓 No allowed IDs configured — first user to message will be auto-authorized!');
    } else {
      console.log(`🔒 Allowed users: ${config.telegramAllowedIds.join(', ')}`);
    }

    return this;
  }

  // ═══ Authorization Check ═══
  _isAllowed(msg) {
    const userId = String(msg.from.id);

    // If no IDs are configured, auto-authorize the first user
    if (config.telegramAllowedIds.length === 0) {
      this._autoAuthorize(userId);
      return true;
    }

    return config.telegramAllowedIds.includes(userId);
  }

  // ═══ Auto-authorize first user and save to .env ═══
  _autoAuthorize(userId) {
    console.log(`🔑 Auto-authorizing first user: ${userId}`);
    config.telegramAllowedIds.push(userId);

    // Save to .env file
    try {
      const envPath = config.envFilePath;
      if (existsSync(envPath)) {
        let envContent = readFileSync(envPath, 'utf-8');
        
        // Replace placeholder or empty TELEGRAM_ALLOWED_IDS
        if (envContent.includes('TELEGRAM_ALLOWED_IDS=')) {
          envContent = envContent.replace(
            /TELEGRAM_ALLOWED_IDS=.*/,
            `TELEGRAM_ALLOWED_IDS=${userId}`
          );
        } else {
          envContent += `\nTELEGRAM_ALLOWED_IDS=${userId}\n`;
        }
        
        writeFileSync(envPath, envContent);
        console.log(`✅ Saved user ID ${userId} to ${envPath}`);
      }
    } catch (err) {
      console.error(`⚠️ Could not save user ID to .env: ${err.message}`);
    }
  }

  _getAgent(chatId) {
    if (!this.sessions.has(chatId)) {
      const agent = new Agent(process.cwd());
      // CRITICAL: Set as subagent to suppress CLI stdout output
      // All output will be captured from messages array and sent to Telegram instead
      agent.isSubagent = true;
      this.sessions.set(chatId, agent);
    }
    return this.sessions.get(chatId);
  }

  // ═══ HTML Escape for Telegram ═══
  _escapeHtml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // ═══ Convert Markdown to Telegram-safe HTML ═══
  _markdownToTelegramHtml(text) {
    if (!text) return '';
    
    let result = text;

    // Convert fenced code blocks: ```lang\ncode\n``` -> <pre><code>code</code></pre>
    result = result.replace(/```[\w]*\n?([\s\S]*?)```/g, (match, code) => {
      return `<pre><code>${this._escapeHtml(code.trim())}</code></pre>`;
    });

    // Convert inline code: `code` -> <code>code</code>
    // Simple approach: skip content already inside <pre><code> blocks
    result = result.replace(/`([^`\n]+)`/g, (match, code) => {
      return `<code>${this._escapeHtml(code)}</code>`;
    });

    // Convert bold: **text** or __text__
    result = result.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
    result = result.replace(/__([^_]+)__/g, '<b>$1</b>');

    // Convert italic: *text* or _text_ (careful not to match ** or __)
    result = result.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<i>$1</i>');

    // Escape any remaining HTML entities NOT inside tags
    // (leave our already-converted tags intact)

    return result;
  }

  // ═══ Safe Message Sending ═══
  // Tries HTML first, falls back to plain text on failure
  async _sendLong(chatId, text, parseMode = 'HTML', isRawHtml = false) {
    if (!text || text.trim().length === 0) return;
    
    // Convert markdown to HTML if using HTML mode, UNLESS already raw HTML
    let formattedText = text;
    if (parseMode === 'HTML' && !isRawHtml) {
      formattedText = this._markdownToTelegramHtml(text);
    }

    // Telegram max message length is 4096
    const maxLen = 4000;
    const chunks = [];
    let remaining = formattedText;

    while (remaining.length > 0) {
      if (remaining.length <= maxLen) {
        chunks.push(remaining);
        break;
      }
      
      // Find a good break point
      let breakAt = remaining.lastIndexOf('\n', maxLen);
      if (breakAt < maxLen * 0.3) breakAt = maxLen;
      
      let chunk = remaining.slice(0, breakAt);
      remaining = remaining.slice(breakAt);

      // CRITICAL FIX: Balance HTML tags if broken mid-string
      const preCount = (chunk.match(/<pre>/g) || []).length;
      const preCloseCount = (chunk.match(/<\/pre>/g) || []).length;
      
      if (preCount > preCloseCount) {
         chunk += '</pre>';
         remaining = '<pre>' + remaining;
      }

      chunks.push(chunk);
    }

    for (const chunk of chunks) {
      await this._safeSend(chatId, chunk, parseMode);
    }
  }

  async _safeSend(chatId, text, parseMode = 'HTML', returnMsg = false) {
    // Try with parse_mode first
    try {
      const msg = await this.bot.sendMessage(chatId, text, { parse_mode: parseMode });
      if (returnMsg) return msg;
      return;
    } catch {}

    // Fallback: send as plain text (strip HTML tags)
    try {
      const plainText = text
        .replace(/<pre><code>([\s\S]*?)<\/code><\/pre>/g, '```\n$1\n```')
        .replace(/<code>([\s\S]*?)<\/code>/g, '`$1`')
        .replace(/<b>([\s\S]*?)<\/b>/g, '$1')
        .replace(/<i>([\s\S]*?)<\/i>/g, '$1')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&');
      const msg = await this.bot.sendMessage(chatId, plainText);
      if (returnMsg) return msg;
      return;
    } catch (e2) {
      console.error(`Failed to send message: ${e2.message}`);
    }
  }

  // ═══ /start Command ═══
  async _handleStart(msg) {
    const userId = String(msg.from.id);

    if (!this._isAllowed(msg)) {
      return this._safeSend(msg.chat.id, 
        `🔒 Access Denied.\n\nYour Telegram ID: ${userId}\n\nTo authorize yourself, add this ID to TELEGRAM_ALLOWED_IDS in your .env file.`
      );
    }

    const welcome = `🐉 <b>Jarvis Cyber — Online</b>

Your autonomous cybersecurity AI agent is ready.

<b>Available Commands:</b>
/help — Show all commands
/clear — Clear conversation
/status — Agent &amp; memory status
/tools — List available tools
/model — Show/change AI model
/skills — List loaded skills
/memory [query] — Search memory
/loot — View collected loot
/myid — Show your Telegram ID

Just type any message to interact with the AI agent.
It can execute commands, scan targets, write exploits, and more.`;

    await this._safeSend(msg.chat.id, welcome, 'HTML');
  }

  // ═══ /help Command ═══
  async _handleHelp(msg) {
    if (!this._isAllowed(msg)) return;

    const help = `🔧 <b>Jarvis Cyber — Command Reference</b>

<b>Chat Commands:</b>
Just type naturally. Examples:
• Scan 192.168.1.1 for open ports
• Find CVEs for Apache 2.4.49
• Generate a Python reverse shell
• Do WHOIS lookup on example.com
• Search Shodan for vulnerable webcams

<b>Slash Commands:</b>
/clear — Reset conversation history
/status — Show token usage &amp; memory stats
/tools — List all 30+ security tools
/model [name] — Switch AI model
/skills — List loaded skill modules
/memory [search term] — Query persistent memory
/loot — Show collected credentials/data
/myid — Show your Telegram user ID

<b>File Support:</b>
• Send any file and the agent will analyze it
• Agent can send back generated scripts/reports`;

    await this._safeSend(msg.chat.id, help, 'HTML');
  }

  // ═══ /myid Command ═══
  async _handleMyId(msg) {
    const userId = String(msg.from.id);
    const isAuthorized = config.telegramAllowedIds.includes(userId);
    await this._safeSend(msg.chat.id, 
      `🆔 Your Telegram ID: <code>${userId}</code>\n🔐 Status: ${isAuthorized ? '✅ Authorized' : '❌ Not authorized'}`,
      'HTML'
    );
  }

  // ═══ /clear Command ═══
  async _handleClear(msg) {
    if (!this._isAllowed(msg)) return;
    const chatId = msg.chat.id;
    const agent = this._getAgent(chatId);
    agent.clearHistory();
    await this._safeSend(chatId, '🗑 Conversation cleared.');
  }

  // ═══ /status Command ═══
  async _handleStatus(msg) {
    if (!this._isAllowed(msg)) return;
    const chatId = msg.chat.id;
    const agent = this._getAgent(chatId);
    const usage = agent.getUsage();
    
    let stats = { knowledge: 0, targets: 0, loot: 0, tasks: 0, skills: 0 };
    try { stats = memory.getStats(); } catch {}

    const status = `📊 <b>Jarvis Status</b>

<b>Model:</b> <code>${this._escapeHtml(config.model)}</code>
<b>Input Tokens:</b> ${usage.inputTokens.toLocaleString()}
<b>Output Tokens:</b> ${usage.outputTokens.toLocaleString()}
<b>Messages:</b> ${usage.messages}
<b>Turns:</b> ${usage.turns}

<b>Memory:</b>
• Knowledge entries: ${stats.knowledge}
• Targets profiled: ${stats.targets}
• Loot items: ${stats.loot}
• Queued tasks: ${stats.tasks}
• Skills loaded: ${stats.skills}`;

    await this._safeSend(msg.chat.id, status, 'HTML');
  }

  // ═══ /tools Command ═══
  async _handleTools(msg) {
    if (!this._isAllowed(msg)) return;
    const { toolDefinitions } = await import('./tools/index.js');
    
    let text = '🔧 <b>Available Tools:</b>\n\n';
    for (const t of toolDefinitions) {
      text += `• <code>${t.function.name}</code> — ${this._escapeHtml(t.function.description.slice(0, 60))}...\n`;
    }
    await this._safeSend(msg.chat.id, text, 'HTML');
  }

  // ═══ /model Command ═══
  async _handleModel(msg, match) {
    if (!this._isAllowed(msg)) return;
    const newModel = match[1]?.trim();
    if (newModel) {
      config.model = newModel;
      await this._safeSend(msg.chat.id, `✅ Model switched to: <code>${this._escapeHtml(newModel)}</code>`, 'HTML');
    } else {
      await this._safeSend(msg.chat.id, `Current model: <code>${this._escapeHtml(config.model)}</code>`, 'HTML');
    }
  }

  // ═══ /skills Command ═══
  async _handleSkills(msg) {
    if (!this._isAllowed(msg)) return;
    try {
      const skills = memory.getSkills();
      if (skills.length === 0) {
        await this._safeSend(msg.chat.id, '📦 No skills loaded. Add skill folders to skills/ directory.');
        return;
      }
      let text = '📦 <b>Loaded Skills:</b>\n\n';
      for (const s of skills) {
        text += `• <b>${this._escapeHtml(s.name)}</b> — ${this._escapeHtml(s.description)}\n`;
      }
      await this._safeSend(msg.chat.id, text, 'HTML');
    } catch {
      await this._safeSend(msg.chat.id, '📦 No skills loaded yet.');
    }
  }

  // ═══ /memory Command ═══
  async _handleMemory(msg, match) {
    if (!this._isAllowed(msg)) return;
    const query = match[1]?.trim();
    if (!query) {
      await this._safeSend(msg.chat.id, 'Usage: /memory search term');
      return;
    }
    try {
      const results = memory.searchKnowledge(query);
      if (results.length === 0) {
        await this._safeSend(msg.chat.id, `No memory entries found for: ${this._escapeHtml(query)}`);
        return;
      }
      let text = `🧠 <b>Memory Search:</b> "${this._escapeHtml(query)}"\n\n`;
      for (const r of results) {
        text += `• <b>${this._escapeHtml(r.key)}</b> [${this._escapeHtml(r.category)}]: ${this._escapeHtml(String(r.value).slice(0, 100))}\n`;
      }
      await this._safeSend(msg.chat.id, text, 'HTML');
    } catch {
      await this._safeSend(msg.chat.id, 'Memory not initialized.');
    }
  }

  // ═══ /loot Command ═══
  async _handleLoot(msg) {
    if (!this._isAllowed(msg)) return;
    try {
      const loot = memory.getLoot();
      if (loot.length === 0) {
        await this._safeSend(msg.chat.id, '💰 No loot collected yet.');
        return;
      }
      let text = '💰 <b>Collected Loot:</b>\n\n';
      for (const l of loot.slice(0, 20)) {
        text += `• [${this._escapeHtml(l.type)}] ${this._escapeHtml(l.target)}: ${this._escapeHtml(String(l.data).slice(0, 80))}\n`;
      }
      await this._safeSend(msg.chat.id, text, 'HTML');
    } catch {
      await this._safeSend(msg.chat.id, '💰 No loot collected yet.');
    }
  }

  // ═══ Document Upload ═══
  async _handleDocument(msg) {
    if (!this._isAllowed(msg)) return;
    const chatId = msg.chat.id;

    try {
      const fileId = msg.document.file_id;
      const fileName = msg.document.file_name || 'uploaded_file';
      const filePath = await this.bot.downloadFile(fileId, config.outputDir);
      
      await this._safeSend(chatId, `📁 File saved: <code>${this._escapeHtml(filePath)}</code>`, 'HTML');
      
      // Send to agent for analysis
      const agent = this._getAgent(chatId);
      const prompt = msg.caption || `Analyze this file I just uploaded: ${filePath} (original name: ${fileName})`;
      
      await this._processAgentMessage(chatId, prompt);
    } catch (err) {
      await this._safeSend(chatId, `❌ Error processing file: ${this._escapeHtml(err.message)}`);
    }
  }

  // ═══ Regular Message Handler ═══
  async _handleMessage(msg) {
    if (!this._isAllowed(msg)) {
      const userId = String(msg.from.id);
      return this._safeSend(msg.chat.id, 
        `🔒 Access Denied.\n\nYour Telegram ID: <code>${userId}</code>\nAdd this to TELEGRAM_ALLOWED_IDS in .env to authorize.`,
        'HTML'
      );
    }
    if (!msg.text) return;
    
    const chatId = msg.chat.id;
    await this._processAgentMessage(chatId, msg.text);
  }

  // ═══ Format tool result for Telegram (HTML) ═══
  _formatToolResult(toolName, args, result) {
    const esc = (s) => this._escapeHtml(String(s || ''));
    
    if (result.success === false) {
      let errText = `❌ <b>${esc(toolName)}</b> failed`;
      if (result.error) errText += `\n<code>${esc(result.error)}</code>`;
      if (result.stderr && result.stderr !== result.error) {
        const stderr = String(result.stderr).slice(0, 1500);
        errText += `\n<pre>${esc(stderr)}</pre>`;
      }
      return errText;
    }

    let text = '';

    // ═══ Command execution output ═══
    if (toolName === 'execute_command') {
      const cmd = result.command || args?.command || 'unknown';
      const stdout = (result.stdout || '').trim();
      const stderr = (result.stderr || '').trim();
      
      text += `⚡ <b>Command:</b> <code>${esc(cmd)}</code>\n`;
      
      if (stdout && stdout !== '(no output)') {
        const truncated = stdout.length > 2500 ? stdout.slice(0, 2500) + '\n... (truncated)' : stdout;
        text += `<pre>${esc(truncated)}</pre>`;
      } else {
        text += `<i>(no output)</i>`;
      }
      
      if (stderr && stderr !== stdout) {
        const truncStderr = stderr.length > 500 ? stderr.slice(0, 500) + '\n...' : stderr;
        text += `\n⚠️ <pre>${esc(truncStderr)}</pre>`;
      }
      
      return text;
    }

    // ═══ Write file ═══
    if (toolName === 'write_file') {
      return `📝 <b>File written:</b> <code>${esc(result.path || args?.path || 'file')}</code> (${result.bytes || '?'} bytes)`;
    }

    // ═══ Replace/Edit file ═══
    if (toolName === 'replace_file_content' || toolName === 'multi_replace_file_content' || toolName === 'edit_file') {
      return `✏️ <b>File edited:</b> <code>${esc(result.path || args?.path || args?.file_path || 'file')}</code>`;
    }

    // ═══ Read file ═══
    if (toolName === 'read_file' && result.content) {
      const lines = result.content.split('\n').length;
      const preview = result.content.slice(0, 500);
      return `📄 <b>Read file</b> (${lines} lines):\n<pre>${esc(preview)}${result.content.length > 500 ? '\n...(truncated)' : ''}</pre>`;
    }

    // ═══ Port scanner ═══
    if (toolName === 'port_scanner' && result.results) {
      text += `📡 <b>${result.open_ports} open ports</b> on <code>${esc(result.host)}</code> (${result.ports_scanned} scanned, ${result.scan_time_ms}ms)\n`;
      for (const r of result.results.slice(0, 20)) {
        text += `  ${r.port}/tcp  ${r.service || ''}  ${r.banner ? esc(r.banner.slice(0, 60)) : ''}\n`;
      }
      return text;
    }

    // ═══ Subdomain enum ═══
    if (toolName === 'subdomain_enum' && result.subdomains) {
      text += `🔍 Found <b>${result.total}</b> subdomains for <code>${esc(result.domain)}</code>:\n`;
      for (const s of result.subdomains.slice(0, 30)) {
        text += `  • ${esc(s)}\n`;
      }
      if (result.total > 30) text += `  ... and ${result.total - 30} more\n`;
      return text;
    }

    // ═══ Shodan ═══
    if (toolName === 'shodan_search' && result.results) {
      text += `📡 <b>Shodan:</b> ${result.total} results\n`;
      for (const r of (result.results || []).slice(0, 10)) {
        text += `  ${esc(r.ip_str || r.ip)}:${r.port} — ${esc(r.product || r.data?.slice(0, 60) || '')}\n`;
      }
      return text;
    }

    // ═══ CVE lookup ═══
    if (toolName === 'cve_lookup') {
      if (result.cve_id) {
        text += `🛡️ <b>${esc(result.cve_id)}</b>\n`;
        if (result.cvss) text += `CVSS: ${result.cvss.score} (${result.cvss.severity})\n`;
        if (result.description) text += `${esc(result.description.slice(0, 500))}\n`;
      } else if (result.results) {
        text += `🛡️ <b>CVE Search:</b> ${result.total} results\n`;
        for (const r of result.results.slice(0, 10)) {
          text += `  ${esc(r.id)} — CVSS ${r.cvss?.score || 'N/A'} — ${esc((r.description || '').slice(0, 80))}\n`;
        }
      }
      return text;
    }

    // ═══ Web/Tavily search ═══
    if ((toolName === 'web_search' || toolName === 'tavily_search') && result.results) {
      if (result.answer) text += `💡 ${esc(result.answer.slice(0, 300))}\n\n`;
      for (const r of result.results.slice(0, 5)) {
        text += `🔗 <b>${esc(r.title)}</b>\n   ${esc(r.url)}\n   ${esc((r.snippet || r.content || '').slice(0, 120))}\n\n`;
      }
      return text;
    }

    // ═══ Header analysis ═══
    if (toolName === 'header_analysis' && result.grade) {
      text += `🛡️ <b>Security Grade: ${esc(result.grade)}</b> (${result.score})\n`;
      if (result.headers_missing?.length) {
        text += `<b>Missing headers:</b>\n`;
        for (const h of result.headers_missing.slice(0, 8)) {
          text += `  ⚠️ ${esc(h.header)} (${esc(h.importance)})\n`;
        }
      }
      if (result.information_leakage?.length) {
        text += `<b>Info leaks:</b>\n`;
        for (const l of result.information_leakage) {
          text += `  🔓 ${esc(l.header)}: ${esc(l.value)}\n`;
        }
      }
      return text;
    }

    // ═══ WAF detector ═══
    if (toolName === 'waf_detector' && result.wafs) {
      if (result.waf_detected) {
        for (const w of result.wafs) text += `🛡️ WAF Detected: <b>${esc(w.waf)}</b>\n`;
      } else {
        text += `✅ No WAF detected\n`;
      }
      return text;
    }

    // ═══ DNS recon ═══
    if (toolName === 'dns_recon' && result.records) {
      text += `🌐 <b>DNS for ${esc(result.domain)}:</b>\n`;
      for (const [type, records] of Object.entries(result.records || {})) {
        if (records && records.length) {
          text += `  <b>${esc(type)}:</b> ${esc(JSON.stringify(records).slice(0, 200))}\n`;
        }
      }
      return text;
    }

    // ═══ Read URL ═══
    if (toolName === 'read_url' && result.content) {
      const preview = result.content.slice(0, 500);
      text += `🌐 <b>URL content</b> (${result.content.length} chars):\n<pre>${esc(preview)}${result.content.length > 500 ? '\n...(truncated)' : ''}</pre>`;
      return text;
    }

    // ═══ Memory store ═══
    if (toolName === 'memory_store') {
      return `🧠 ${esc(result.message || 'Memory operation completed')}`;
    }

    // ═══ Save artifact ═══
    if (toolName === 'save_artifact') {
      return `💾 <b>Artifact saved:</b> <code>${esc(result.path || args?.filename || 'file')}</code>`;
    }

    // ═══ Search files / list directory ═══
    if (toolName === 'search_files' || toolName === 'list_directory') {
      const count = result.results?.length || result.entries?.length || 0;
      return `📂 <b>${esc(toolName)}:</b> ${count} results found`;
    }

    // ═══ WHOIS ═══
    if (toolName === 'whois_lookup' && result.data) {
      const data = typeof result.data === 'string' ? result.data : JSON.stringify(result.data, null, 2);
      const truncated = data.slice(0, 2000);
      return `📋 <b>WHOIS:</b>\n<pre>${esc(truncated)}${data.length > 2000 ? '\n...(truncated)' : ''}</pre>`;
    }

    // ═══ Generic success ═══
    if (result.success === true) {
      const summary = result.message || result.note || result.summary || '';
      if (summary) return `✅ <b>${esc(toolName)}:</b> ${esc(summary)}`;
      
      // Even for "empty" successes, show something meaningful
      const resultStr = JSON.stringify(result, null, 2);
      if (resultStr.length > 10 && resultStr !== '{"success":true}') {
        const truncated = resultStr.slice(0, 1500);
        return `✅ <b>${esc(toolName)}:</b>\n<pre>${esc(truncated)}${resultStr.length > 1500 ? '\n...' : ''}</pre>`;
      }
      return `✅ <b>${esc(toolName)}</b> completed`;
    }

    // ═══ Fallback: show raw JSON for anything we don't specifically handle ═══
    const raw = JSON.stringify(result, null, 2);
    if (raw && raw.length > 2) {
      const truncated = raw.slice(0, 1500);
      return `🔧 <b>${esc(toolName)}:</b>\n<pre>${esc(truncated)}${raw.length > 1500 ? '\n...' : ''}</pre>`;
    }

    return null;
  }

  // ═══ Agent Message Processing ═══
  async _processAgentMessage(chatId, text) {
    // Prevent concurrent processing for same chat
    if (this.processing.has(chatId)) {
      await this._safeSend(chatId, '⏳ Still processing previous request...');
      return;
    }

    this.processing.add(chatId);

    // Keep sending typing indicator every 4 seconds while processing
    const typingInterval = setInterval(async () => {
      try { await this.bot.sendChatAction(chatId, 'typing'); } catch {}
    }, 4000);

    try {
      // Send initial typing indicator
      await this.bot.sendChatAction(chatId, 'typing');

      const agent = this._getAgent(chatId);
      
      // Record where we are in the message history
      const msgCountBefore = agent.messages.length;
      
      let streamingMessageId = null;
      let streamedText = '';
      let lastEditTime = 0;
      let hasSentThinking = false;

      const onUpdate = async (chunk) => {
        if (chunk.type === 'thinking') {
           if (!hasSentThinking) {
              hasSentThinking = true;
              try {
                const initMsg = await this._safeSend(chatId, '🧠 <i>Thinking...</i>', 'HTML', true);
                if (initMsg) streamingMessageId = initMsg.message_id;
              } catch {}
           }
           return; // Don't stream tokens to Telegram (too bulky/rapid)
        }
        
        if (chunk.type === 'text') {
          streamedText += chunk.content;
          
          const now = Date.now();
          // Telegram limit: 1 edit per second. We use 1.5s to be safe.
          if (now - lastEditTime > 1500 && streamedText.trim().length > 0) {
             lastEditTime = now;
             
             // Safely bounds-check telegram limits
             const displayRaw = streamedText.length > 3900 ? streamedText.slice(-3900) : streamedText;
             // Unclosed HTML tags cause edit failures, so we use markdown conversion
             // If markdown slicing breaks, it falls back cleanly-enough.
             const display = this._markdownToTelegramHtml(displayRaw) + ' ▌';
             
             if (!streamingMessageId) {
                try {
                  const newMsg = await this._safeSend(chatId, display, 'HTML', true);
                  if (newMsg) streamingMessageId = newMsg.message_id;
                } catch {}
             } else {
                try {
                  await this.bot.editMessageText(display, { chat_id: chatId, message_id: streamingMessageId, parse_mode: 'HTML' });
                } catch {}
             }
          }
        }
      };

      // ═══ Real-Time Tool Streaming Callback ═══
      const onTool = async (event) => {
         if (event.type === 'start') {
            const toolName = event.name;
            const args = event.args || {};
            let summary = `🔧 <b>${this._escapeHtml(toolName)}</b>`;
            if (toolName === 'execute_command' && args.command) {
              summary += `: <code>${this._escapeHtml(args.command.slice(0, 200))}</code>`;
            } else if ((toolName === 'write_file' || toolName === 'read_file') && args.path) {
              summary += `: <code>${this._escapeHtml(args.path)}</code>`;
            } else if ((toolName === 'web_search' || toolName === 'tavily_search') && args.query) {
              summary += `: "${this._escapeHtml(args.query)}"`;
            }
            await this._safeSend(chatId, summary, 'HTML');
         } else if (event.type === 'done') {
            const formatted = this._formatToolResult(event.name, event.args || {}, event.result);
            if (formatted) {
               await this._sendLong(chatId, formatted, 'HTML', true); // isRawHtml = true
            }
         }
      };

      // Process the message (agent runs in subagent mode — no CLI output)
      await agent.processMessage(text, onUpdate, onTool);
      
      // ═══ Collect ALL output from the agent's message history ═══
      const newMessages = agent.messages.slice(msgCountBefore);
      const responseParts = [];
      let dispatchedToolOutputs = false;

      for (const m of newMessages) {
        // Collect assistant text responses
        if (m.role === 'assistant' && m.content) {
          responseParts.push(m.content);
        }
        if (m.role === 'tool') dispatchedToolOutputs = true;
      }

      // Then send the assistant's text response
      const assistantText = responseParts.join('\n').trim();
      if (assistantText) {
        if (streamingMessageId && assistantText.length < 3900) {
          // Finalize streaming text by removing the cursor block and pushing standard complete payload
          try {
            await this.bot.editMessageText(this._markdownToTelegramHtml(assistantText), { chat_id: chatId, message_id: streamingMessageId, parse_mode: 'HTML' });
          } catch {
            await this._sendLong(chatId, assistantText, 'HTML');
          }
        } else {
          // Use standard chunked send array if huge block
          await this._sendLong(chatId, assistantText, 'HTML');
        }
      } else if (streamingMessageId && hasSentThinking) {
        // If thinking was sent but no text followed, remove the 'Thinking...' message
        try { await this.bot.deleteMessage(chatId, streamingMessageId); } catch {}
      }

      // If nothing at all was captured, say so
      if (!dispatchedToolOutputs && !assistantText) {
        await this._safeSend(chatId, '✅ Task completed (no text output).');
      }

      // Send any generated files
      await this._sendOutputFiles(chatId);

    } catch (err) {
      console.error(`Agent error for chat ${chatId}: ${err.message}`);
      await this._safeSend(chatId, `❌ Error: ${this._escapeHtml(err.message)}`);
    } finally {
      clearInterval(typingInterval);
      this.processing.delete(chatId);
    }
  }

  // ═══ Send Recently Generated Files ═══
  async _sendOutputFiles(chatId) {
    try {
      if (!existsSync(config.outputDir)) return;
      
      const files = readdirSync(config.outputDir);
      const recentFiles = files
        .map(f => ({ name: f, path: join(config.outputDir, f), stat: statSync(join(config.outputDir, f)) }))
        .filter(f => Date.now() - f.stat.mtimeMs < 30000) // Modified in last 30 seconds
        .filter(f => f.stat.isFile());

      for (const file of recentFiles.slice(0, 5)) {
        try {
          await this.bot.sendDocument(chatId, file.path, { caption: `📎 ${file.name}` });
        } catch {}
      }
    } catch {}
  }

  stop() {
    if (this.bot) {
      this.bot.stopPolling();
    }
  }
}
