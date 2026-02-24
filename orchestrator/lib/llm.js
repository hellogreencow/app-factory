/**
 * OpenRouter LLM client.
 * Uses OPENROUTER_API_KEY from env. Load .env via run scripts.
 * Docs: https://openrouter.ai/docs
 */

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = 'openai/gpt-4o-mini';

async function chat(messages, opts = {}) {
  const rawKey = process.env.OPENROUTER_API_KEY;
  if (!rawKey) throw new Error('OPENROUTER_API_KEY not set');
  const key = String(rawKey).trim();
  const model = opts.model || process.env.OPENROUTER_MODEL || DEFAULT_MODEL;

  const timeoutMs = opts.timeout || 30_000;

  const doRequest = (useModel) => {
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
      'HTTP-Referer': process.env.OPENROUTER_REFERER || 'https://github.com/ios-app-factory',
      'X-Title': process.env.OPENROUTER_TITLE || 'iOS App Factory',
    };
    return fetch(OPENROUTER_URL, {
      method: 'POST',
      headers,
      signal: AbortSignal.timeout(timeoutMs),
      body: JSON.stringify({
        model: useModel,
        messages,
        temperature: opts.temperature ?? 0.7,
        max_tokens: opts.max_tokens ?? 2048,
      }),
    });
  };

  const res = await doRequest(model);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenRouter ${res.status}: ${err}`);
  }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('Empty LLM response');
  return content;
}

module.exports = { chat };
