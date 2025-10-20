// scripts/check_token.js
// Simple verification script used by CI to validate WHATSAPP_TOKEN
const token = process.env.WHATSAPP_TOKEN;
const waba = process.env.WABA_ID || '807524341770906';
if (!token) {
  console.error('ERROR: WHATSAPP_TOKEN environment variable not set');
  process.exit(2);
}

const headers = { Authorization: `Bearer ${token}` };

async function run() {
  try {
    const me = await fetch('https://graph.facebook.com/v24.0/me', { headers });
    const meJson = await me.json();
    console.log('GET /me ->', me.status);
    console.log(JSON.stringify(meJson, null, 2));

    const phones = await fetch(`https://graph.facebook.com/v24.0/${waba}/phone_numbers`, { headers });
    const phonesJson = await phones.json();
    console.log(`GET /${waba}/phone_numbers ->`, phones.status);
    console.log(JSON.stringify(phonesJson, null, 2));

    if (me.ok && phones.ok) {
      console.log('Token validation: OK');
      process.exit(0);
    }

    console.error('Token validation: FAILED');
    process.exit(1);
  } catch (err) {
    console.error('Exception while validating token:', err);
    process.exit(3);
  }
}

run();
