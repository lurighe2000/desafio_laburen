const fetch = require('node-fetch');
const dotenv = require('dotenv');
dotenv.config();

const TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_ID = process.env.WHATSAPP_PHONE_ID;
const API_BASE = `https://graph.facebook.com/v15.0/${PHONE_ID}`;

async function sendText(to, text) {
  if (!TOKEN || !PHONE_ID) throw new Error('WHATSAPP_TOKEN or WHATSAPP_PHONE_ID not set');
  const res = await fetch(`${API_BASE}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body: text } }),
  });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

module.exports = { sendText };
