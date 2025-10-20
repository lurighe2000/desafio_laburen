# Laburen AI Agent - Backend (Express + Prisma)

Este repositorio contiene una implementación mínima de la API solicitada en el challenge: gestión de productos y carritos usando PostgreSQL con Prisma. También incluye scripts de seed, demos y soporte para integrar un agente LLM que actúe sobre la API.

Requisitos
- Node.js >= 18
- PostgreSQL (local o remoto)
- Opcional: ngrok (para exponer el servidor local y probar webhooks)

Inicio rápido (PowerShell)

1) Copiar el archivo de ejemplo de entorno y editarlo

```powershell
Copy-Item .env.example .env
notepad .env
```

2) Instalar dependencias

```powershell
npm install
```

3) Generar Prisma Client y aplicar migraciones

```powershell
npx prisma generate
npx prisma migrate deploy
```

Si querés crear y aplicar migraciones de desarrollo (local):

```powershell
npx prisma migrate dev --name init
```

4) Poblar la base de datos (seed)

```powershell
npm run seed
```

5) Iniciar el servidor

```powershell
npm start
```

Pruebas rápidas y demos
- Smoke tests:

```powershell
node scripts/smoke.js
```

- Demo del agente (simula un LLM llamando a la API):

```powershell
node scripts/agent_demo.js
```

- Demo webhook Meta (simula una notificación de WhatsApp al webhook):

```powershell
node scripts/meta_whatsapp_demo.js
```

Docker (rápido) — si no querés instalar Postgres localmente

```powershell
docker run --name laburen-postgres -e POSTGRES_USER=laburen_user -e POSTGRES_PASSWORD=MiPassSegura -e POSTGRES_DB=laburen -p 5432:5432 -d postgres:15
# luego actualizar .env: DATABASE_URL=postgresql://laburen_user:MiPassSegura@localhost:5432/laburen
```

Exponer el servidor con ngrok (para probar webhooks)

```powershell
ngrok http 3000
# usar la URL HTTPS que genera ngrok para configurar el webhook en Meta
```

Integración con WhatsApp (resumen y pasos)

Se incluyó soporte básico para WhatsApp Cloud API (Meta). Los endpoints importantes son:
- `GET /webhook/messages` — verificación del webhook (Meta envía hub.challenge)
- `POST /webhook/messages` — recibe notificaciones de mensajes entrantes (demo)

Pasos para configurar Meta (WhatsApp Cloud API)
1. Crear app en Facebook Developers (https://developers.facebook.com) — tipo "Business".
2. Agregar el producto WhatsApp en el dashboard de la app.
3. En la sección "Getting Started" de WhatsApp copiar:
   - `Phone Number ID` → poner en `.env` como `WHATSAPP_PHONE_ID`
   - `Temporary Token` → poner en `.env` como `WHATSAPP_TOKEN`
4. Configurar webhook usando ngrok:
   - Ejecutar `ngrok http 3000` y copiar la URL HTTPS.
   - En "Webhooks" del WhatsApp product, setear la callback URL a `https://<NGROK_ID>.ngrok.io/webhook/messages` y definir un `Verify Token` (string secreto). Guardar ese token en `.env` como `WHATSAPP_VERIFY_TOKEN`.
5. Probar enviando un mensaje desde WhatsApp al número de prueba; la app recibirá la notificación y el handler de demo responderá creando un carrito y contestando por la API.

Notas de producción
- Generar tokens permanentes vía System Users y Business Manager.
- Implementar verificación de firma (X-Hub-Signature) y manejo idempotente de eventos.

Variables de entorno (añadir en `.env` local)
- `DATABASE_URL`
- `PORT` (3000 por defecto)
- `LLM_API_KEY` (OpenAI u otro)
- `WHATSAPP_TOKEN` (Meta access token)
- `WHATSAPP_PHONE_ID` (Phone number id)
- `WHATSAPP_VERIFY_TOKEN` (verify token para webhook)

Cómo crear y darme el token de GitHub para que haga PRs y merges por vos
- Si querés que cree el Pull Request y lo mergee automáticamente, necesitaré un Personal Access Token (PAT) con permisos `repo`.
- Pasos para generar el PAT:
  1. Ir a https://github.com/settings/tokens
  2. Click en "Generate new token" → elegir "Classic" o token de "fine-grained" (recomendado classic para simplicidad).
  3. Seleccionar scope `repo` (control total) y `workflow` si querés que también cree GitHub Actions.
  4. Generar token y copiarlo (se mostrará solo una vez). Pegalo aquí (privado) para que lo use y después lo revoco.

-- Fin
