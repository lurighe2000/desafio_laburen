const fetch = require('node-fetch');
const dotenv = require('dotenv');
dotenv.config();
const API_BASE = `http://localhost:${process.env.PORT || 3000}`;

async function sendDemo() {
  const payload = {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'whatsapp_business_account_id',
        changes: [
          {
            value: {
              messaging_product: 'whatsapp',
              metadata: { display_phone_number: '123', phone_number_id: process.env.WHATSAPP_PHONE_ID || 'PHONE_ID' },
              contacts: [{ profile: { name: 'Demo' }, wa_id: '5491111111111' }],
              messages: [{ from: '5491111111111', id: 'msgid1', text: { body: 'Quiero comprar' } }],
            },
            field: 'messages',
          },
        ],
      },
    ],
  };

  const res = await fetch(API_BASE + '/webhook/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  console.log('webhook status', res.status);
  console.log(await res.text());
}

if (require.main === module) sendDemo().catch(console.error);
