import config from './config.js';
import { EventEmitter } from 'events';
import { Agent as HttpsAgent } from 'https';
import { Agent as HttpAgent } from 'http';

export const apiEvents = new EventEmitter();

// ═══ Connection pool — reuse TCP/TLS connections across requests ═══
const httpsAgent = new HttpsAgent({ keepAlive: true, maxSockets: 5, keepAliveMsecs: 30000 });
const httpAgent = new HttpAgent({ keepAlive: true, maxSockets: 5 });

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

async function fetchWithRetry(url, options, maxRetries = 5) {
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      
      // Specifically catch 429 Rate Limits and trigger backoff. 
      if (response.status === 429) {
        console.warn(`\n  ⚠️  NVIDIA NIM API Rate Limit (429) Hit. Backing off for ${attempt * 3} seconds...`);
        lastError = new Error(`API error (429): Too Many Requests`);
        await sleep(3000 * attempt);
        continue;
      }

      // If it's a success or client error (except 429), return normally
      if (response.status < 500) return response; 

      const errText = await response.text().catch(() => '');
      lastError = new Error(`API error (${response.status}): ${errText}`);
      if (config.verbose || attempt >= maxRetries - 1) {
        console.error(`\n  ⚠️  Attempt ${attempt}/${maxRetries} failed (${response.status}). Retrying in ${attempt * 2}s...`);
      }
    } catch (e) {
      lastError = e;
      if (config.verbose || attempt >= maxRetries - 1) {
        console.error(`\n  ⚠️  Attempt ${attempt}/${maxRetries} — network error: ${e.message}`);
      }
    }
    if (attempt < maxRetries) await sleep(2000 * attempt);
  }
  throw new Error(`CRITICAL: Connection to NVIDIA NIM API completely failed after ${maxRetries} attempts. Network Error: ${lastError.message}`);
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

export async function* streamChat(messages, tools, systemPrompt) {
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
    stream: true,
    extra_body: {
      chat_template_kwargs: {
        enable_thinking: true,
        clear_thinking: false
      }
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
    response = await fetchWithRetry(apiUrl, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(1800000), // 30 minute hard timeout
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

        const finishReason = chunk.choices?.[0]?.finish_reason;
      }
    }
  } catch (err) {
    if (err.message && err.message.includes('terminated')) {
      console.error('\n[API] Stream terminated prematurely by server. Recovering data...');
    } else {
      console.error(`\n[API] Uncaught stream error: ${err.message}`);
    }
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
    extra_body: {
      chat_template_kwargs: {
        enable_thinking: true,
        clear_thinking: false
      }
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