// Core Agent Loop — gathers context, acts via tools, verifies, repeats
import { streamChat } from './api.js';
import { toolDefinitions, toolExecutors, safeTools, writeTools, dangerousTools } from './tools/index.js';
import { buildSystemPrompt } from './system-prompt.js';
import config from './config.js';
import * as ui from './ui.js';
import { memory } from './memory.js';
import { toolInstaller } from './tool-installer.js';
import { exec as _exec } from 'child_process';

export class Agent {
  constructor(cwd) {
    this.cwd = cwd;
    this.messages = [];
    this.systemPrompt = buildSystemPrompt(cwd);
    this.totalInputTokens = 0;
    this.totalOutputTokens = 0;
    this.turnCount = 0;
    this.isSubagent = false;
    this.subagentId = null;
    // Generic Anti-loop state
    this.consecutiveFailures = 0;
    this.failedToolSignatures = {};
    this.networkRetryCount = 0; // Caps network reconnection attempts per message turn
  }

  /**
   * Process a user message through the agentic loop.
   * Loops: send to LLM → if tool calls, execute them → re-send → repeat until text response.
   */
  async processMessage(userMessage, onUpdate = null, onTool = null) {
    this.messages.push({ role: 'user', content: userMessage });
    this.turnCount++;

    // --- CRITICAL FIX: Auto Compaction ---
    // Deep reasoning APIs slow down quadratically with large contexts.
    // If we exceed max history, prune and summarize automatically to stay fast.
    if (this.messages.length > config.maxHistoryMessages) {
      if (!this.isSubagent) ui.printInfo(`Auto-compacting history (exceeded ${config.maxHistoryMessages} messages) to improve speed...`);
      await this.compactHistory();
    }

    let loopCount = 0;
    const maxLoops = 50; // High limit for complex multi-step hacking/coding tasks

    const sendDesktopNotification = (title, message) => {
      try { _exec(`notify-send "${title}" "${message}"`); } catch {}
    };

    while (loopCount < maxLoops) {
      loopCount++;

      try {
        const result = await this._streamResponse(onUpdate);

        if (result.toolCalls && result.toolCalls.length > 0) {
          // Execute tool calls SEQUENTIALLY to guarantee message history ordering
          // Promise.all() causes race conditions where tool results push to
          // this.messages in random order, corrupting the conversation
          for (const tc of result.toolCalls) {
            await this._handleToolCall(tc, onTool);
          }
          
          // Continue the loop — LLM needs to process all tool results
          continue;
        }

        // No tool calls — we're done with this turn
        if (!this.isSubagent && result.text) {
          console.log(); // Final newline after streamed response
          sendDesktopNotification("Agentic Cyber AI", "Mission Accomplished: The background operation has finished successfully.");
        }

        break;

      } catch (error) {
        ui.printError(`Agent error: ${error.message}`);
        
        // Persistent retry loop for network outages so the agent task doesn't just die
        if (error.message.includes('NVIDIA NIM API') || error.message.includes('fetch failed') || error.message.includes('network error')) {
          this.networkRetryCount++;
          if (this.networkRetryCount > 10) {
            ui.printError('Network has been unreachable for 10+ consecutive retries. Stopping to avoid infinite loop.');
            this.messages.push({ role: 'user', content: '[SYSTEM] CRITICAL: Network connectivity lost for extended period. All API calls are failing. Cannot continue until network is restored.' });
            break;
          }
          if (!this.isSubagent) ui.printWarning(`Network disconnection detected (retry ${this.networkRetryCount}/10). Waiting 30s before auto-reconnecting...`);
          sendDesktopNotification("Agentic Cyber AI", "Alert: Network error. Retrying in 30s...");
          await new Promise(r => setTimeout(r, 30000));
          if (loopCount > 0) loopCount--;
          continue;
        }

        sendDesktopNotification("Agentic Cyber AI", "Alert: Processing halted due to an error.");
        this.messages.push({ role: 'user', content: `[SYSTEM] CRITICAL EXECUTION ERROR: ${error.message}` });
        break;
      }
    }

    if (loopCount >= maxLoops) {
      const msg = `Reached maximum tool call loop limit (${maxLoops}). Stopping. Please ask the user for guidance.`;
      if (!this.isSubagent) ui.printWarning(msg);
      this.messages.push({ role: 'user', content: `[SYSTEM] ${msg}` });
      sendDesktopNotification("Agentic Cyber AI", "Alert: Maximum retry loop reached. Need human input.");
    }
  }

  /**
   * Stream a response from the LLM, collecting text and tool calls.
   */
  async _streamResponse(onUpdate = null) {
    let spinner;
    if (!this.isSubagent) {
      spinner = ui.createSpinner('Thinking...');
      spinner.start();
    }

    let fullText = '';
    const toolCalls = [];
    let spinnerStopped = false;

    try {
      for await (const chunk of streamChat(this.messages, toolDefinitions, this.systemPrompt)) {
        if (chunk.type === 'text') {
          if (!spinnerStopped && !this.isSubagent) {
            spinner.stop();
            spinnerStopped = true;
            console.log(); // Clean line
          }
          fullText += chunk.content;
          if (!this.isSubagent) ui.printStreamChunk(chunk.content);
          if (onUpdate) onUpdate({ type: 'text', content: chunk.content });
        }

        // Print thinking/reasoning tokens but don't add them to fullText history
        if (chunk.type === 'thinking') {
          if (!spinnerStopped && !this.isSubagent) {
            spinner.stop();
            spinnerStopped = true;
          }
          if (!this.isSubagent) ui.printThinkingChunk(chunk.content);
          if (onUpdate) onUpdate({ type: 'thinking', content: chunk.content });
          continue;
        }

        if (chunk.type === 'tool_call') {
          if (!spinnerStopped && !this.isSubagent) {
            spinner.stop();
            spinnerStopped = true;
          }
          toolCalls.push(chunk.tool_call);
        }

        if (chunk.type === 'done') {
          if (chunk.usage) {
            this.totalInputTokens += chunk.usage.prompt_tokens || 0;
            this.totalOutputTokens += chunk.usage.completion_tokens || 0;
          }
        }
      }
    } catch (error) {
      if (spinner) spinner.stop();
      throw error;
    }

    if (!spinnerStopped && spinner) spinner.stop();

    // Always finalize thinking UI state to prevent terminal corruption
    ui.finalizeThinking();

    // Add the assistant's response to history
    const assistantMsg = { role: 'assistant', content: fullText || null };
    if (toolCalls.length > 0) {
      assistantMsg.tool_calls = toolCalls;
      if (!assistantMsg.content) assistantMsg.content = null;
    }
    this.messages.push(assistantMsg);

    return { text: fullText, toolCalls };
  }

  /**
   * Handle a single tool call — check permissions, execute, show results.
   */
  async _handleToolCall(toolCall, onTool = null) {
    const name = toolCall.function.name;
    let args = {};
    
    try {
      args = JSON.parse(toolCall.function.arguments || '{}');
    } catch (parseError) {
      // CRITICAL FIX: The NVIDIA API strictly validates tool_calls.arguments in the history.
      // If the model produced invalid JSON (or stream timed out halfway), and we send it back,
      // the API throws a 400 Bad Request ("Unterminated string").
      // We must sanitize the broken string into valid JSON so the next API call succeeds.
      toolCall.function.arguments = JSON.stringify({ _error: "Invalid JSON from model" });
      
      const safeMsg = parseError && parseError.message ? parseError.message : String(parseError);
      const errorResult = { 
        success: false, 
        error: `Failed to parse tool arguments. Invalid JSON syntax: ${safeMsg}. Payload: ${toolCall.function.arguments}` 
      };
      this._addToolResult(toolCall.id, name, errorResult);
      if (!this.isSubagent) ui.printToolResult(name, errorResult);
      return;
    }

    // Construct a unique signature for this exact tool execution
    const signature = `${name}:${JSON.stringify(args)}`;

    // Generic Anti-Loop: Prevent repeating the exact same failed command
    if ((this.failedToolSignatures[signature] || 0) >= 2) {
      const loopError = { 
        success: false, 
        error: `SYSTEM OVERRIDE: You have already tried this exact action multiple times and it failed. DO NOT TRY THIS AGAIN. Change your approach or ask the user for help.`
      };
      this._addToolResult(toolCall.id, name, loopError);
      if (!this.isSubagent) ui.printToolResult(name, loopError);
      return;
    }

    // Generic Anti-Loop: Prevent alternating failure loops (A -> B -> C -> A)
    // threshold increased to 15 to allow for extensive reconnaissance/scanning
    if (this.consecutiveFailures >= 15) {
      const loopError = { 
        success: false, 
        error: `SYSTEM OVERRIDE: You have failed 15 consecutive tool calls across different approaches. You are stuck in a failure loop. STOP EXECUTING TOOLS. Summarize what you tried and ask the user for completely new guidance.`
      };
      this._addToolResult(toolCall.id, name, loopError);
      if (!this.isSubagent) ui.printToolResult(name, loopError);
      return;
    }

    // Show the tool call
    if (!this.isSubagent) ui.printToolCall(name, args);
    if (onTool) onTool({ type: 'start', name, args });

    // Check permissions
    const executor = toolExecutors[name];
    if (!executor) {
      const errorResult = { success: false, error: `Unknown tool: ${name}` };
      this._addToolResult(toolCall.id, name, errorResult);
      if (!this.isSubagent) ui.printToolResult(name, errorResult);
      return;
    }

    // Permission check
    const approved = await this._checkPermission(name, args);
    if (!approved) {
      const deniedResult = { success: false, error: 'User denied permission' };
      this._addToolResult(toolCall.id, name, deniedResult);
      if (!this.isSubagent) ui.printToolResult(name, deniedResult);
      return;
    }

    // --- SEMANTIC EXECUTION CACHE INTERCEPT ---
    const cacheableReconTools = ['shodan_search', 'dns_recon', 'whois_lookup', 'ip_geolocation', 'port_scanner', 'waf_detector', 'subdomain_enum', 'cve_lookup', 'cloud_enum', 'email_harvester', 'wayback_machine'];
    const cacheableCommands = /^(nmap|masscan|nuclei|nikto|dirb|gobuster|ffuf|whatweb|wpscan|dig|nslookup|whois|curl|wget)\b/i;
    
    let isCacheable = cacheableReconTools.includes(name);
    if (name === 'execute_command' && args.command && !args.background) {
      if (cacheableCommands.test(args.command.trim())) isCacheable = true;
    }

    const cacheKey = `exec_cache:${name}:${JSON.stringify(args)}`;

    if (isCacheable) {
      const cachedResult = memory.getCached(cacheKey);
      if (cachedResult) {
        if (!this.isSubagent) {
          console.log(ui.colors.success(`     ⚡ [CACHE HIT] Loaded instantly from Recon DB`));
          ui.printToolResult(name, cachedResult);
        }
        
        // Reset failures since we successfully moved forward in the action tree
        this.consecutiveFailures = 0;
        delete this.failedToolSignatures[signature];

        this._addToolResult(toolCall.id, name, cachedResult);
        if (onTool) onTool({ type: 'done', name, args, result: cachedResult });
        return;
      }
    }

    // Execute the tool
    let execSpinner;
    if (!this.isSubagent && name !== 'execute_command') {
      execSpinner = ui.createSpinner(`Running ${name}...`);
      execSpinner.start();
    } else if (!this.isSubagent && name === 'execute_command') {
      console.log(ui.colors.muted('     ┌─ live stream ─'));
    }

    try {
      const result = await executor(args, this.cwd);
      if (execSpinner) execSpinner.stop();
      
      // Update global failure state
      const isActuallyFailure = this._isSubstantialFailure(name, args, result);

      if (isActuallyFailure) {
        this.consecutiveFailures++;
        this.failedToolSignatures[signature] = (this.failedToolSignatures[signature] || 0) + 1;
      } else {
        // Reset failures if the tool successfully changed the state (e.g. wrote a file or executed successfully)
        const nonResettingPattern = /^(echo|pwd|true|false|:)\b/i;
        const isNonResetting = nonResettingPattern.test(args.command || '');
        
        const isFileModifier = name === 'write_file' || name === 'replace_file_content' || name === 'multi_replace_file_content';
        
        if (!isNonResetting) {
          this.consecutiveFailures = 0;
          delete this.failedToolSignatures[signature];
        }

        // --- CRITICAL FIX: DYNAMIC RETRY ---
        // If the agent successfully rewrote a file, it means it's trying to fix a broken script.
        // We MUST clear the entire failed execution memory so it is allowed to re-run the exact same `python exploit.py` command without being blocked.
        if (isFileModifier) {
          this.consecutiveFailures = 0;
          this.failedToolSignatures = {};
        }
      }

      // --- SAVE TO SEMANTIC CACHE ---
      if (isCacheable && result.success !== false && !result.error) {
        let ttlHours = 24; // DNS, WHOIS change rarely
        if (name === 'port_scanner' || name === 'waf_detector' || name === 'execute_command') {
           ttlHours = 2; // Port states change frequently
        }
        memory.cacheResult(cacheKey, result, name, ttlHours);
      }

      this._addToolResult(toolCall.id, name, result);
      if (!this.isSubagent) ui.printToolResult(name, result);
      if (onTool) onTool({ type: 'done', name, args, result });
    } catch (error) {
      if (execSpinner) execSpinner.stop();
      
      this.consecutiveFailures++;
      this.failedToolSignatures[signature] = (this.failedToolSignatures[signature] || 0) + 1;

      // ═══ DYNAMIC ERROR SELF-HEALING ═══
      // If the error is a missing tool/module, auto-install and notify AI to retry
      const errorMsg = error.message || '';
      const selfHealResult = toolInstaller.resolveFromError(errorMsg);
      
      if (selfHealResult && selfHealResult.success) {
        // Successfully auto-installed the missing dependency
        if (!this.isSubagent) {
          console.log(ui.colors.success(`     ⚡ [SELF-HEAL] Auto-installed missing dependency via ${selfHealResult.method}`));
        }
        // Clear failure signatures so the AI can retry the same command
        this.consecutiveFailures = Math.max(0, this.consecutiveFailures - 1);
        delete this.failedToolSignatures[signature];
        
        const healResult = { 
          success: false, 
          error: error.message,
          self_heal: `SYSTEM: Missing dependency was AUTO-INSTALLED via ${selfHealResult.method}. You can now RETRY this exact command — it should work now.`
        };
        this._addToolResult(toolCall.id, name, healResult);
        if (!this.isSubagent) ui.printToolResult(name, healResult);
        if (onTool) onTool({ type: 'done', name, args, result: healResult });
        return;
      }

      const errorResult = { success: false, error: error.message };
      this._addToolResult(toolCall.id, name, errorResult);
      if (!this.isSubagent) ui.printToolResult(name, errorResult);
      if (onTool) onTool({ type: 'done', name, args, result: errorResult });
    }
  }

  /**
   * Check if a tool call requires permission and prompt the user.
   */
  async _checkPermission(toolName, args) {
    if (this.isSubagent) return true; // Subagents inherit auto-approved sandbox implicitly to not hang the logic

    // Safe tools — auto-approve
    if (safeTools.has(toolName) && config.autoApproveReadTools) {
      return true;
    }

    // Write tools
    if (writeTools.has(toolName) && config.autoApproveWriteTools) {
      return true;
    }

    // Auto-approve if configured
    if (toolName === 'execute_command' && config.autoApproveCommands) {
      return true;
    }

    // Dangerous commands — check patterns
    let isDangerous = false;
    if (toolName === 'execute_command' && args.command) {
      isDangerous = config.dangerousPatterns.some(p => p.test(args.command));
    }

    // Prompt user
    ui.printPermissionRequest(toolName, args);
    if (isDangerous) {
      console.log(ui.colors.danger('     ⚠️  This command matches a DANGEROUS pattern!'));
    }
    
    const answer = await this._promptYesNo('     Allow? (y/n): ');
    return answer;
  }

  /**
   * Simple yes/no prompt.
   */
  async _promptYesNo(question) {
    return new Promise((resolve) => {
      process.stdout.write(ui.colors.warning(question));
      const wasRaw = process.stdin.isRaw;
      process.stdin.resume();
      process.stdin.setEncoding('utf8');

      const onData = (data) => {
        process.stdin.removeListener('data', onData);
        // Restore raw mode if it was set before
        if (wasRaw !== undefined) {
          try { process.stdin.setRawMode(wasRaw); } catch {}
        }
        const a = data.trim().toLowerCase();
        process.stdout.write('\n');
        resolve(a === 'y' || a === 'yes' || a === '');
      };

      process.stdin.once('data', onData);
    });
  }

  /**
   * Add a tool result to the message history.
   * Truncates oversized results to prevent token bloat on subsequent API calls.
   */
  _addToolResult(toolCallId, toolName, result) {
    let content;
    try {
      content = JSON.stringify(result);
    } catch (e) {
      content = JSON.stringify({ success: false, error: "Result serialization failed: " + String(e) });
      result = { _clipped: true }; // prevent further processing issues
    }
    
    // Truncate massive tool results (e.g. full file contents, huge command output)
    // to prevent sending 50KB+ back to the API on the next turn
    if (content.length > 8000) {
      const truncated = { ...result };
      if (truncated.stdout && truncated.stdout.length > 4000) {
        truncated.stdout = truncated.stdout.slice(0, 4000) + `\n... [truncated, ${truncated.stdout.length} chars total]`;
      }
      if (truncated.content && typeof truncated.content === 'string' && truncated.content.length > 4000) {
        truncated.content = truncated.content.slice(0, 4000) + `\n... [truncated, ${truncated.content.length} chars total]`;
      }
      if (truncated.listing && truncated.listing.length > 3000) {
        truncated.listing = truncated.listing.slice(0, 3000) + `\n... [truncated]`;
      }
      if (truncated.results && Array.isArray(truncated.results) && truncated.results.length > 50) {
        truncated.results = truncated.results.slice(0, 50);
        truncated._note = `Showing first 50 of ${result.results.length} results`;
      }
      content = JSON.stringify(truncated);
    }
    
    this.messages.push({
      role: 'tool',
      tool_call_id: toolCallId,
      content,
    });
  }

  /**
   * Clear conversation history.
   */
  clearHistory() {
    this.messages = [];
    this.turnCount = 0;
  }

  /**
   * Compact history — keep recent messages, trim bloated tool results.
   */
  async compactHistory() {
    if (this.messages.length <= 6) {
      ui.printInfo('History is already short, nothing to compact.');
      return;
    }

    const summary = `[Conversation summary: ${this.turnCount} turns, ${this.messages.length} messages. Working in ${this.cwd}.]`;
    
    // Keep the last 8 messages for better context continuity
    const kept = this.messages.slice(-8);
    
    // Truncate oversized tool results in kept messages to reduce token bloat
    for (const msg of kept) {
      if (msg.role === 'tool' && msg.content) {
        try {
          const parsed = JSON.parse(msg.content);
          // Truncate huge stdout/content fields that waste API tokens
          if (parsed.stdout && parsed.stdout.length > 3000) {
            parsed.stdout = parsed.stdout.slice(0, 3000) + '\n... [truncated for context efficiency]';
          }
          if (parsed.content && typeof parsed.content === 'string' && parsed.content.length > 3000) {
            parsed.content = parsed.content.slice(0, 3000) + '\n... [truncated]';
          }
          if (parsed.listing && parsed.listing.length > 2000) {
            parsed.listing = parsed.listing.slice(0, 2000) + '\n... [truncated]';
          }
          msg.content = JSON.stringify(parsed);
        } catch {}
      }
    }
    
    this.messages = [
      { role: 'user', content: summary },
      { role: 'assistant', content: 'Understood. I have context from our previous conversation. How can I help you next?' },
      ...kept,
    ];

    ui.printInfo(`Compacted history: kept last 8 messages, summarized ${this.turnCount} turns.`);
  }

  /**
   * Determine if a tool result is a 'substantial failure' for anti-loop purposes.
   * Reconciliation: commands like pkill, grep, or ls exiting with code 1 is often 'expected'.
   * Network-heavy tools (nmap, nc, ping) timing out is often just part of the scanning process.
   */
  _isSubstantialFailure(name, args, result) {
    if (result.success !== false) return false;

    // Timeout is usually a failure, UNLESS it's a network tool (informative result)
    if (result.error === 'Command timed out' || result.error === 'Timed out waiting for more output') {
      const networkTools = /^(nmap|nc|ping|curl|wget|bg_interact|check_port)\b/i;
      const cmd = args.command || '';
      if (networkTools.test(cmd) || networkTools.test(name)) {
        return false; // A timeout on a port scan or nc ping is "information", not a system failure
      }
      return true;
    }

    // If it's a command execution, check the exit code
    if (name === 'execute_command' && args.command) {
      // Recon/Cleanup tools that return code 1 (not found/stopped) are not substantial failures
      const softFailureTools = /^(pkill|kill|grep|pgrep|lsof|ss|netstat|ls|test|rm|mkdir|cat)\b/i;
      if (softFailureTools.test(args.command) && (result.exit_code === 1 || result.exit_code === 2)) {
        return false; 
      }
      // WiFi/network tools commonly exit non-zero during normal operation
      // timeout exits with code 124, airodump/aireplay exit with 1 after capture
      const wifiNetTools = /^(sudo\s+)?(timeout\s+\d+\s+)?(airodump-ng|aireplay-ng|airmon-ng|mdk4|hcxdumptool|reaver|wash|tcpdump|tshark)\b/i;
      if (wifiNetTools.test(args.command) && (result.exit_code === 1 || result.exit_code === 124)) {
        return false;
      }
    }

    // check_port 'failure' (closed) is useful information, not a failure of the agent
    if (name === 'check_port') return false;

    return true;
  }

  /**
   * Get token usage stats.
   */
  getUsage() {
    return {
      inputTokens: this.totalInputTokens,
      outputTokens: this.totalOutputTokens,
      messages: this.messages.length,
      turns: this.turnCount,
    };
  }
}
