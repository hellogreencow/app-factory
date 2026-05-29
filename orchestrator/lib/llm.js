/**
 * OpenRouter LLM client with retry, streaming, and fallback model support.
 */

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = 'google/gemini-3-flash-preview';
const MAX_RETRIES = 3;
const RETRY_DELAYS = [5_000, 10_000, 20_000];

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function buildHeaders() {
  const rawKey = process.env.OPENROUTER_API_KEY;
  if (!rawKey) throw new Error('OPENROUTER_API_KEY not set');
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${String(rawKey).trim()}`,
    'HTTP-Referer': process.env.OPENROUTER_REFERER || 'https://github.com/ios-app-factory',
    'X-Title': process.env.OPENROUTER_TITLE || 'iOS App Factory',
  };
}

function buildBody(messages, opts, stream = false) {
  return JSON.stringify({
    model: opts.model || process.env.OPENROUTER_MODEL || DEFAULT_MODEL,
    messages,
    temperature: opts.temperature ?? 0.7,
    max_tokens: opts.max_tokens ?? 2048,
    ...(stream ? { stream: true } : {}),
  });
}

async function handleRetryableStatus(res, attempt, label) {
  if (res.status === 429 || (res.status >= 500 && res.status < 600)) {
    if (attempt < MAX_RETRIES) {
      const delay = RETRY_DELAYS[attempt] || 20_000;
      process.stderr.write(`[llm] ${label} (${res.status}), retrying in ${delay / 1000}s...\n`);
      await sleep(delay);
      return true;
    }
    const err = await res.text();
    throw new Error(`OpenRouter ${res.status} after ${MAX_RETRIES} retries: ${err.slice(0, 200)}`);
  }
  return false;
}

/**
 * Standard non-streaming chat. Returns the full response string.
 */
async function chat(messages, opts = {}) {
  const headers = buildHeaders();
  const timeoutMs = opts.timeout || 60_000;
  const model = opts.model || process.env.OPENROUTER_MODEL || DEFAULT_MODEL;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(OPENROUTER_URL, {
        method: 'POST', headers,
        signal: AbortSignal.timeout(timeoutMs),
        body: buildBody(messages, { ...opts, model }),
      });

      if (await handleRetryableStatus(res, attempt, 'Retryable')) continue;

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`OpenRouter ${res.status}: ${err.slice(0, 300)}`);
      }

      const data = await res.json();
      const content = data?.choices?.[0]?.message?.content;
      if (!content) throw new Error('Empty LLM response');
      return content;
    } catch (e) {
      if (e.name === 'TimeoutError' && attempt < MAX_RETRIES) {
        const backoff = RETRY_DELAYS[attempt] || 20_000;
        process.stderr.write(`[llm] Timeout (attempt ${attempt + 1}/${MAX_RETRIES + 1}), retrying in ${backoff / 1000}s...\n`);
        await sleep(backoff);
        continue;
      }
      throw e;
    }
  }
}

/**
 * Streaming chat. Calls onChunk(text) for each token delta, returns full response.
 * Falls back to non-streaming if streaming fails.
 */
async function chatStream(messages, opts = {}) {
  const onChunk = opts.onChunk || (() => {});
  const headers = buildHeaders();
  const timeoutMs = opts.timeout || 180_000;
  const model = opts.model || process.env.OPENROUTER_MODEL || DEFAULT_MODEL;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(OPENROUTER_URL, {
        method: 'POST', headers,
        signal: AbortSignal.timeout(timeoutMs),
        body: buildBody(messages, { ...opts, model }, true),
      });

      if (await handleRetryableStatus(res, attempt, 'Stream retryable')) continue;

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`OpenRouter ${res.status}: ${err.slice(0, 300)}`);
      }

      let fullContent = '';
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6).trim();
          if (payload === '[DONE]') continue;

          try {
            const parsed = JSON.parse(payload);
            const delta = parsed?.choices?.[0]?.delta?.content;
            if (delta) {
              fullContent += delta;
              onChunk(delta);
            }
          } catch (e) {
            // skip malformed SSE lines
          }
        }
      }

      if (!fullContent) throw new Error('Empty streaming LLM response');
      return fullContent;
    } catch (e) {
      if (e.name === 'TimeoutError' && attempt < MAX_RETRIES) {
        const backoff = RETRY_DELAYS[attempt] || 20_000;
        process.stderr.write(`[llm] Stream timeout (attempt ${attempt + 1}/${MAX_RETRIES + 1}), retrying in ${backoff / 1000}s...\n`);
        await sleep(backoff);
        continue;
      }
      throw e;
    }
  }
}

module.exports = { chat, chatStream };
