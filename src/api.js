import { Agent } from 'undici';
import config from './config.js';
import { EventEmitter } from 'events';

export const apiEvents = new EventEmitter();

// ═══ Active Provider Helpers (NVIDIA NIM or Local AI) ═══
export function getActiveProviderName(provider = null) {
  const p = provider || config.activeProvider || 'nvidia';
  if (p === 'local') {
    const backend = (config.localAiBackend || 'lmstudio').toLowerCase();
    if (backend === 'ollama') return 'Ollama';
    if (backend === 'jan') return 'Jan.ai';
    if (backend === 'lmstudio') return 'LM Studio';
    return 'Local AI';
  }
  return 'NVIDIA NIM';
}

export function getActiveModel(provider = null) {
  const p = provider || config.activeProvider || 'nvidia';
  if (p === 'local') {
    return config.localAiModel || 'Local Model';
  }
  return config.model;
}

function getHeaders() {
  const isLocal = config.activeProvider === 'local';
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'text/event-stream',
  };
  const apiKey = isLocal ? config.localAiApiKey : config.apiKey;
  if (apiKey && apiKey !== 'none' && apiKey.trim() !== '') {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }
  return headers;
}

function getApiUrl() {
  const isLocal = config.activeProvider === 'local';
  const base = isLocal ? (config.localAiBaseUrl || 'http://localhost:1234/v1') : config.baseUrl;
  return `${base.replace(/\/+$/, '')}/chat/completions`;
}

// DeepSeek models use native reasoning_content — they don't need chat_template_kwargs.
// Local models (LM Studio / Ollama) standard OpenAI endpoints reject chat_template_kwargs.
// Only GLM needs the explicit enable_thinking flag.
function shouldSendThinkingKwargs() {
  if (config.activeProvider === 'local') return false;
  const model = config.model.toLowerCase();
  return model.includes('glm');
}

// Model generation parameters
function buildModelParams() {
  const params = {
    temperature: config.temperature,
    top_p: config.topP,
    max_tokens: config.maxTokens,
  };
  if (config.activeProvider === 'local') {
    return params;
  }
  const model = config.model.toLowerCase();
  if (model.includes('deepseek')) {
    params.presence_penalty = config.presencePenalty;
  } else {
    params.presence_penalty = config.presencePenalty;
    params.repetition_penalty = config.repetitionPenalty;
  }
  return params;
}


export const VERIFIED_NVIDIA_MODELS = [
  { id: 'deepseek-ai/deepseek-v4-flash-0731', name: 'DeepSeek V4 Flash', tag: 'Fast • Reasoning' },
  { id: 'deepseek-ai/deepseek-v4-pro-0813', name: 'DeepSeek V4 Pro', tag: 'Powerful • Reasoning' },
];

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

async function fetchWithRetry(url, options, maxRetries = 3) {
  let lastError;
  let rateLimitHits = 0;
  const MAX_RATE_LIMIT_RETRIES = 3; // Fast backoff

  const customDispatcher = new Agent({
    headersTimeout: 1800000, // 30 minutes
    bodyTimeout: 1800000,
  });

  // Extract the caller's signal so we can create per-attempt timeouts
  const callerSignal = options.signal || null;
  const isServerCheck = callerSignal && callerSignal.timeout === 3000;
  const PER_ATTEMPT_TIMEOUT_MS = isServerCheck ? 3000 : 1800000; // 30 minutes for heavy reasoning streams

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    // Combine caller's signal with a per-attempt timeout
    let attemptSignal;
    try {
      if (callerSignal && !callerSignal.aborted) {
        attemptSignal = AbortSignal.any([
          callerSignal,
          AbortSignal.timeout(PER_ATTEMPT_TIMEOUT_MS),
        ]);
      } else {
        attemptSignal = AbortSignal.timeout(PER_ATTEMPT_TIMEOUT_MS);
      }
    } catch {
      attemptSignal = AbortSignal.timeout(PER_ATTEMPT_TIMEOUT_MS);
    }

    try {
      const response = await fetch(url, { ...options, signal: attemptSignal, dispatcher: customDispatcher });

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
          throw new Error(`API rate limit (429) persists after ${rateLimitHits} attempts. Your API quota may be exhausted — wait a few minutes or check your plan.`);
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
  const providerName = getActiveProviderName();
  let finalErrorMsg = `CRITICAL: Connection to ${providerName} API completely failed after ${maxRetries} attempts. Network Error: ${lastError.message}`;
  finalErrorMsg += networkErrorHint(lastError.message, lastError);
  if (!finalErrorMsg.includes('(')) {
    finalErrorMsg += config.activeProvider === 'local'
      ? ' (Check if your local AI server, e.g. LM Studio / Ollama, is running)'
      : ' (Check your internet connection, DNS, or VPN)';
  }
  throw new Error(finalErrorMsg);
}

export async function checkServer(targetProvider = null) {
  const prov = targetProvider || config.activeProvider || 'nvidia';
  const isLocal = prov === 'local';
  const baseUrl = (isLocal ? (config.localAiBaseUrl || 'http://localhost:1234/v1') : config.baseUrl).replace(/\/+$/, '');
  const apiKey = isLocal ? config.localAiApiKey : config.apiKey;
  const headers = {};
  if (apiKey && apiKey !== 'none' && apiKey.trim() !== '') {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }
  const providerName = getActiveProviderName(prov);

  try {
    const res = await fetch(`${baseUrl}/models`, {
      headers,
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      const data = await res.json();
      const rawModels = (data.data || []).map(m => m.id || m.name || m);
      const models = isLocal ? rawModels : VERIFIED_NVIDIA_MODELS.map(m => m.id);
      return { ok: true, models, provider: providerName, baseUrl };
    }
    return { ok: false, error: `Server returned ${res.status}`, provider: providerName, baseUrl };
  } catch (e) {
    return { ok: false, error: e.message, provider: providerName, baseUrl };
  }
}

export async function* streamChat(messages, tools = null, systemPrompt = null, signal = null) {
  const modelParams = buildModelParams();
  const activeModel = getActiveModel();
  const body = {
    model: activeModel,
    messages: [
      { role: 'system', content: systemPrompt || 'You are a helpful assistant.' },
      ...messages
    ],
    ...modelParams,
    stream: true,
  };

  // Only add thinking kwargs for models that support it (not DeepSeek)
  if (shouldSendThinkingKwargs()) {
    body.chat_template_kwargs = {
      enable_thinking: true,
      clear_thinking: false
    };
  }

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

  // Stream watchdog: aborts if no chunk is received within 30 minutes (heavy reasoning delay)
  const STREAM_CHUNK_TIMEOUT_MS = 1800000;
  const readWithTimeout = async () => {
    let timer;
    const timeoutPromise = new Promise((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error(`Model "${activeModel}" stalled: No tokens received within 30s. The model may be offline or overloaded.`));
      }, STREAM_CHUNK_TIMEOUT_MS);
    });
    try {
      return await Promise.race([reader.read(), timeoutPromise]);
    } finally {
      clearTimeout(timer);
    }
  };

  try {
    while (true) {
      const { done, value } = await readWithTimeout();
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
    if (err.message && err.message.includes('stalled')) {
      throw err;
    } else if (err.message && err.message.includes('terminated')) {
      console.error('\n[API] Stream terminated prematurely by server. Recovering data...');
    } else {
      console.error(`\n[API] Stream error: ${err.message}`);
      throw err;
    }
  } finally {
    try { reader.cancel().catch(() => { }); } catch { }
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
  const modelParams = buildModelParams();
  const activeModel = getActiveModel();
  const body = {
    model: activeModel,
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages,
    ],
    ...modelParams,
    stream: false,
  };

  // Only add thinking kwargs for models that support it (not DeepSeek / local models)
  if (shouldSendThinkingKwargs()) {
    body.chat_template_kwargs = {
      enable_thinking: true,
      clear_thinking: false
    };
  }

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
    throw new Error(`${getActiveProviderName()} API error (${response.status}): ${errText}`);
  }

  return await response.json();
}