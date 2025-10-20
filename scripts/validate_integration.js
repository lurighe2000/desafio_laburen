// scripts/validate_integration.js
// Valida: WHATSAPP_TOKEN, que el WHATSAPP_PHONE_ID exista en la WABA y que la webhook URL coincida con la esperada
const token = process.env.WHATSAPP_TOKEN;
const phoneId = process.env.WHATSAPP_PHONE_ID;
const expectedWebhook = process.env.WHATSAPP_WEBHOOK_URL;
const wabaId = process.env.WABA_ID || '807524341770906';

if (!token) {
  console.error('ERROR: WHATSAPP_TOKEN no está definido en el entorno. Pegar el token o usar .env');
  process.exit(2);
}
if (!phoneId) {
  console.error('ERROR: WHATSAPP_PHONE_ID no está definido en el entorno. Revisá .env');
  process.exit(3);
}

const headers = { Authorization: `Bearer ${token}` };

async function run() {
  try {
    console.log('Validando token con GET /me...');
    const meRes = await fetch('https://graph.facebook.com/v24.0/me', { headers });
    const me = await meRes.json();
    console.log('GET /me ->', meRes.status);
    console.log(JSON.stringify(me, null, 2));

    console.log(`Obteniendo phone_numbers de WABA ${wabaId}...`);
    const phonesRes = await fetch(`https://graph.facebook.com/v24.0/${wabaId}/phone_numbers`, { headers });
    const phonesJson = await phonesRes.json();
    if (!phonesRes.ok) {
      console.error('Error al obtener phone_numbers:', phonesRes.status, JSON.stringify(phonesJson));
      process.exit(4);
    }

    const phones = phonesJson.data || [];
    const phone = phones.find(p => p.id === phoneId || p.display_phone_number === phoneId);
    if (!phone) {
      console.error('No se encontró el phone id en la WABA. Phone list:');
      console.error(JSON.stringify(phones, null, 2));
      process.exit(5);
    }

    console.log('Phone encontrado:');
    console.log(JSON.stringify(phone, null, 2));

    const configuredWebhook = phone.webhook_configuration && phone.webhook_configuration.application;
    console.log('Webhook configurado en phone:', configuredWebhook || '(no configurado)');

    if (expectedWebhook) {
      if (configuredWebhook && configuredWebhook.startsWith(expectedWebhook)) {
        console.log('La webhook configurada coincide con la esperada. ✅');
      } else {
        console.warn('La webhook configurada NO coincide con la esperada. ⚠️');
        console.warn('Esperada:', expectedWebhook);
        console.warn('Configurada:', configuredWebhook || '(no configurada)');
        console.warn('Si usás ngrok, asegurate de ejecutar `ngrok http 3000` y de pegar la URL en WhatsApp Manager > Phone Number > Webhook');
      }
    } else {
      console.log('No se proporcionó WHATSAPP_WEBHOOK_URL esperada. Mostrando configuración actual.');
    }

    console.log('\nComprobaciones completadas.');
    process.exit(0);
  } catch (err) {
    console.error('Exception:', err);
    process.exit(10);
  }
}

run();
