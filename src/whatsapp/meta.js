const fetch = require('node-fetch');
const dotenv = require('dotenv');
dotenv.config();

const TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_ID = process.env.WHATSAPP_PHONE_ID;
const API_BASE = `https://graph.facebook.com/v15.0/${PHONE_ID}`;

async function sendText(to, text) {
  if (!TOKEN || !PHONE_ID) throw new Error('WHATSAPP_TOKEN or WHATSAPP_PHONE_ID not set');
  const url = `${API_BASE}/messages`;
  const payload = { messaging_product: 'whatsapp', to, type: 'text', text: { body: text } };
  try {
    // Log request summary (mask token) for debugging
    const tokenPreview = TOKEN && TOKEN.length > 8 ? TOKEN.slice(0, 8) + '...' : '<no-token>';
    console.log('whatsapp send ->', url, 'to=', to, 'phoneId=', PHONE_ID, 'tokenPrefix=', tokenPreview, 'bodyPreview=', JSON.stringify(payload).slice(0, 200));
  } catch (e) {
    /* ignore logging errors */
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => null);
  try {
    console.log('whatsapp response <-', res.status, body ? JSON.stringify(body).slice(0, 1000) : '<no-body>');
  } catch (e) {
    /* ignore */
  }
  return { status: res.status, body };
}

module.exports = { sendText };
