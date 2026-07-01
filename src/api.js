import config from './config.js';
import { EventEmitter } from 'events';

export const apiEvents = new EventEmitter();

// ═══ Dynamic header builder — always uses current config values ═══
function getHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${config.apiKey}`,
    'Accept': 'text/event-stream',
  };
}

function getApiUrl() {
  return `${config.baseUrl}/chat/completions`;
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ═══ Network error diagnostic helper ═══
function networkErrorHint(errMsg, err) {
  if (!errMsg) return '';
  let msg = typeof errMsg === 'string' ? errMsg : '';
  if (err?.cause) {
    msg += ` ${err.cause.code || ''} ${err.cause.message || ''}`;
  }
  if (msg.includes('ENOTFOUND')) return ' (DNS resolution failed — check internet connection or DNS settings)';
  if (msg.includes('ECONNREFUSED')) return ' (Connection refused — server may be down or blocked by firewall)';
  if (msg.includes('ETIMEDOUT') || msg.includes('UND_ERR_CONNECT_TIMEOUT')) return ' (Connection timed out — server unreachable or network too slow)';
  if (msg.includes('ECONNRESET')) return ' (Connection reset by server — try again or check if IP is blocked)';
  if (msg.includes('CERT_HAS_EXPIRED') || msg.includes('UNABLE_TO_VERIFY')) return ' (SSL/TLS certificate error)';
  if (msg.includes('aborted') || msg.includes('AbortError')) return ' (Request was aborted — likely a timeout or client disconnect. Will auto-retry.)';
  if (msg.includes('fetch failed')) return ' (Hint: Likely a local network outage. Verify connectivity with ping 8.8.8.8)';
  return '';
}

async function fetchWithRetry(url, options, maxRetries = 10) {
  let lastError;
  let rateLimitHits = 0;
  const MAX_RATE_LIMIT_RETRIES = 6; // Don't burn all 10 retries on rate limits

  // Extract the caller's signal so we can create per-attempt timeouts
  const callerSignal = options.signal || null;
  const PER_ATTEMPT_TIMEOUT_MS = 120000; // 2 minutes per individual attempt

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    // CRITICAL FIX: If the caller's signal is already aborted (e.g., WebSocket disconnect),
    // don't waste retries — each attempt would fail instantly with "aborted".
    // Instead, create a fresh timeout-only signal for each attempt.
    let attemptSignal;
    try {
      if (callerSignal && !callerSignal.aborted) {
        // Combine caller's signal with a fresh per-attempt timeout
        attemptSignal = AbortSignal.any([
          callerSignal,
          AbortSignal.timeout(PER_ATTEMPT_TIMEOUT_MS),
        ]);
      } else {
        // Caller signal is dead/missing — use a standalone per-attempt timeout
        attemptSignal = AbortSignal.timeout(PER_ATTEMPT_TIMEOUT_MS);
      }
    } catch {
      // AbortSignal.any() not available in older Node — fallback to per-attempt timeout
      attemptSignal = AbortSignal.timeout(PER_ATTEMPT_TIMEOUT_MS);
    }

    try {
      const response = await fetch(url, { ...options, signal: attemptSignal });
      
      // Specifically catch 429 Rate Limits and trigger aggressive backoff
      if (response.status === 429) {
        rateLimitHits++;
        
        // Respect Retry-After header if the server provides one
        const retryAfter = response.headers.get('Retry-After');
        let waitMs;
        if (retryAfter) {
          const retrySeconds = parseInt(retryAfter, 10);
          waitMs = (isNaN(retrySeconds) ? attempt * 5 : retrySeconds) * 1000;
        } else {
          waitMs = 5000 * attempt; // 5s, 10s, 15s, 20s, 25s, 30s...
        }
        
        console.warn(`\n  ⚠️  API Rate Limit (429) — attempt ${rateLimitHits}/${MAX_RATE_LIMIT_RETRIES}. Waiting ${(waitMs / 1000).toFixed(0)}s...`);
        lastError = new Error(`API error (429): Too Many Requests`);
        
        // Give up early on persistent rate limits — don't waste all retries
        if (rateLimitHits >= MAX_RATE_LIMIT_RETRIES) {
          throw new Error(`API rate limit (429) persists after ${rateLimitHits} attempts. Your API quota may be exhausted — wait a few minutes or check your plan at https://build.nvidia.com/`);
        }
        
        await sleep(waitMs);
        continue;
      }

      // If it's a success or non-retryable client error (except 429), return normally
      // For 400 errors, we still return the response but log a warning since it usually
      // indicates malformed JSON in the request body (e.g., broken tool_call arguments)
      if (response.status < 500) {
        if (response.status === 400 && (config.verbose || attempt >= maxRetries - 1)) {
          const peekBody = await response.clone().text().catch(() => '');
          console.warn(`\n  ⚠️  API returned 400 Bad Request: ${peekBody.slice(0, 300)}`);
        }
        return response;
      }

      const errText = await response.text().catch(() => '');
      lastError = new Error(`API error (${response.status}): ${errText}`);
      if (config.verbose || attempt >= maxRetries - 1) {
        console.error(`\n  ⚠️  Attempt ${attempt}/${maxRetries} failed (${response.status}). Retrying in ${attempt * 2}s...`);
      }
    } catch (e) {
      // Re-throw rate limit exhaustion immediately
      if (e.message?.includes('rate limit (429) persists')) throw e;
      
      lastError = e;
      if (config.verbose || attempt >= maxRetries - 1) {
        let errorMsg = `\n  ⚠️  Attempt ${attempt}/${maxRetries} — network error: ${e.message}`;
        errorMsg += networkErrorHint(e.message, e);
        console.error(errorMsg);
      }
    }
    if (attempt < maxRetries) await sleep(2000 * attempt);
  }
  let finalErrorMsg = `CRITICAL: Connection to NVIDIA NIM API completely failed after ${maxRetries} attempts. Network Error: ${lastError.message}`;
  finalErrorMsg += networkErrorHint(lastError.message, lastError);
  if (!finalErrorMsg.includes('(')) {
    finalErrorMsg += ' (Check your local internet connection, DNS, or VPN)';
  }
  throw new Error(finalErrorMsg);
}

export async function checkServer() {
  try {
    const res = await fetch(`${config.baseUrl}/models`, {
      headers: { 'Authorization': `Bearer ${config.apiKey}` },
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const data = await res.json();
      return { ok: true, models: data.data || [] };
    }
    return { ok: false, error: `Server returned ${res.status}` };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

export async function* streamChat(messages, tools = null, systemPrompt = null, signal = null) {
  const body = {
    model: config.model,
    messages: [
      { role: 'system', content: systemPrompt || 'You are a helpful assistant.' },
      ...messages
    ],
    temperature: config.temperature,
    top_p: config.topP,
    max_tokens: config.maxTokens,
    presence_penalty: config.presencePenalty,
    repetition_penalty: config.repetitionPenalty,
    stream: true,
    chat_template_kwargs: {
      enable_thinking: true,
      clear_thinking: false
    }
  };

  if (tools && tools.length > 0) {
    body.tools = tools;
    body.tool_choice = 'auto';
  }
  
  const apiUrl = getApiUrl();

  apiEvents.emit('apiRequest', {
    url: apiUrl,
    body: body
  });

  let response;
  try {
    // CRITICAL FIX: If the caller's signal is already aborted (e.g., from a WebSocket disconnect),
    // don't pass it in — create a fresh timeout so the request can actually succeed.
    let fetchSignal;
    if (signal && !signal.aborted) {
      fetchSignal = signal;
    } else {
      fetchSignal = AbortSignal.timeout(1800000); // 30 minute hard timeout
    }
    response = await fetchWithRetry(apiUrl, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(body),
      signal: fetchSignal,
    });
  } catch (e) {
    throw new Error(`Cannot connect to NVIDIA NIM API: ${e.message}`);
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => 'Unknown error');
    throw new Error(`NVIDIA NIM API error (${response.status}): ${errText}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const toolCalls = {};
  let usage = null;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.length === 0) continue;

        if (line.startsWith('data: [DONE]')) {
          const calls = Object.values(toolCalls);
          if (calls.length > 0) {
            // Deduplicate tool calls on DONE
            const uniqueCalls = [];
            const seenSignatures = new Set();
            for (const tc of calls) {
              const sig = `${tc.function.name}:${tc.function.arguments}`;
              if (!seenSignatures.has(sig)) {
                seenSignatures.add(sig);
                uniqueCalls.push(tc);
              }
            }
            for (let j = 0; j < uniqueCalls.length; j++) yield { type: 'tool_call', tool_call: uniqueCalls[j] };
          }
          yield { type: 'done', usage };
          return;
        }

        if (!line.startsWith('data: ')) continue;

        let chunk;
        try { 
          chunk = JSON.parse(line.slice(6)); 
        } catch { 
          continue; 
        }

        if (chunk.usage) usage = chunk.usage;

        const delta = chunk.choices?.[0]?.delta;
        if (!delta) continue;

        // Reasoner outputs reasoning in 'reasoning_content'
        if (delta.reasoning_content) yield { type: 'thinking', content: delta.reasoning_content };
        else if (delta.content) yield { type: 'text', content: delta.content };

        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index ?? 0;
            if (!toolCalls[idx]) {
              toolCalls[idx] = {
                id: tc.id || `call_${idx}_${Date.now()}`,
                type: 'function',
                function: { name: '', arguments: '' },
              };
            }
            if (tc.id) toolCalls[idx].id = tc.id;
            if (tc.function?.name) toolCalls[idx].function.name += tc.function.name;
            if (tc.function?.arguments) toolCalls[idx].function.arguments += tc.function.arguments;
          }
        }

      }
    }
  } catch (err) {
    if (err.message && err.message.includes('terminated')) {
      console.error('\n[API] Stream terminated prematurely by server. Recovering data...');
    } else {
      console.error(`\n[API] Uncaught stream error: ${err.message}`);
    }
  } finally {
    try { reader.cancel().catch(() => {}); } catch {}
  }

  const remainingCalls = Object.values(toolCalls);
  if (remainingCalls.length > 0) {
    // Deduplication filter: prevent identical parallel tool hallucinations
    const uniqueCalls = [];
    const seenSignatures = new Set();
    
    for (const tc of remainingCalls) {
      const sig = `${tc.function.name}:${tc.function.arguments}`;
      if (!seenSignatures.has(sig)) {
        seenSignatures.add(sig);
        uniqueCalls.push(tc);
      } else {
        if (config.verbose) console.warn(`\n[API] Blocked duplicate identical tool call: ${tc.function.name}`);
      }
    }
    
    for (const tc of uniqueCalls) yield { type: 'tool_call', tool_call: tc };
  }
  yield { type: 'done', usage };
}

export async function chatCompletion(messages, tools, systemPrompt) {
  const body = {
    model: config.model,
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages,
    ],
    temperature: config.temperature,
    top_p: config.topP,
    max_tokens: config.maxTokens,
    presence_penalty: config.presencePenalty,
    repetition_penalty: config.repetitionPenalty,
    stream: false,
    chat_template_kwargs: {
      enable_thinking: true,
      clear_thinking: false
    }
  };

  if (tools && tools.length > 0) {
    body.tools = tools;
    body.tool_choice = 'auto';
  }

  const apiUrl = getApiUrl();

  const response = await fetchWithRetry(apiUrl, {
    method: 'POST',
    headers: { ...getHeaders(), Accept: 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(1800000), // 30 minute hard timeout
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => 'Unknown error');
    throw new Error(`NVIDIA NIM API error (${response.status}): ${errText}`);
  }

  return await response.json();
}