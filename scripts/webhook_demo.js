const fetch = require('node-fetch');
const dotenv = require('dotenv');
dotenv.config();

const API_BASE = `http://localhost:${process.env.PORT || 3000}`;

async function send(message) {
  const res = await fetch(API_BASE + '/webhook/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: 'user', text: message }),
  });
  const body = await res.json().catch(() => null);
  console.log('webhook response', res.status, body);
}

if (require.main === module) {
  const msg = process.argv[2] || 'Quiero comprar 1 camiseta azul';
  send(msg).catch(console.error);
}
