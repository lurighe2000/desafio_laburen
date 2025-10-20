const OpenAI = require('openai');
const dotenv = require('dotenv');
dotenv.config();

const API_KEY = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY;

function isPlaceholderKey(k) {
  if (!k) return true;
  return /^your[_-]/i.test(k) || k.includes('xxxx') || k.length < 20;
}

if (isPlaceholderKey(API_KEY)) {
  console.warn('LLM API key looks like a placeholder or is missing. Adapter will throw if used.');
}

const client = new OpenAI({ apiKey: API_KEY });

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function callChatCompletion({ model = 'gpt-3.5-turbo', messages, max_tokens = 200, retries = 2 }) {
  if (isPlaceholderKey(API_KEY)) throw Object.assign(new Error('LLM API key not set or looks like placeholder (LLM_API_KEY/OPENAI_API_KEY).'), { code: 'NO_KEY' });

  let attempt = 0;
  while (true) {
    try {
      // Using new OpenAI client: client.chat.create
  const resp = await client.chat.completions.create({ model, messages, max_tokens });
  const choice = resp?.choices && resp.choices[0];
  // For this SDK, resp.choices[n].message.content holds the text
  return choice?.message?.content ?? JSON.stringify(resp);
    } catch (err) {
      attempt++;
      const status = err?.response?.status || err?.status || null;
      // If unauthorized, bubble up
      if (status === 401 || status === 403) {
        const e = new Error('LLM provider returned auth error');
        e.status = status;
        throw e;
      }

      if (attempt > retries) throw err;
      const backoff = 200 * Math.pow(2, attempt);
      await sleep(backoff);
    }
  }
}

module.exports = { callChatCompletion, isPlaceholderKey };
