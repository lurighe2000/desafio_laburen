# Laburen - Agente IA (Backend)

Este repositorio contiene una implementación mínima, ejecutable y documentada, que demuestra cómo un agente de IA puede vender productos mediante una API propia y una base de datos PostgreSQL.

El contenido y los pasos están alineados con el enunciado del desafío (archivo adjunto `Desafio Tecnico AI Engineer - Laburen.com.txt`).

Resumen rápido
- API REST (Express + Prisma) con los endpoints requeridos: `GET /products`, `GET /products/:id`, `POST /carts`, `PATCH /carts/:id`.
- Base de datos PostgreSQL (Prisma ORM). Los productos se importan desde `products.xlsx`.
- Seed que exige `products.xlsx` (no hay fallback con datos embebidos).
- Integración demo para un agente LLM (scripts) y webhook demo para WhatsApp (Meta).

Contenido del repositorio
- `src/` - servidor Express y adaptadores (webhook, whatsapp helper, llm adapter).
- `prisma/` - esquema Prisma (`schema.prisma`).
- `scripts/` - demos y tests (smoke, agent_demo, llm_conversation, webhook_demo).
- `products.xlsx` - archivo fuente de productos (debe estar en la raíz para el seed).
- `docs/` - diagramas y especificación del API.

Requisitos
- Node.js >= 18
- PostgreSQL (local o en Docker)
- Opcional: ngrok para exponer el webhook en desarrollo

Variables de entorno
Copiar `.env.example` a `.env` y completar los valores sensibles:

    cp .env.example .env
    # editar .env con el editor de su preferencia

Las variables importantes:
- `DATABASE_URL` - URL de conexión PostgreSQL
- `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`, `WHATSAPP_VERIFY_TOKEN` - para integrar WhatsApp (opcional)
- `LLM_API_KEY` - clave para el proveedor LLM (opcional; si no se provee, se usa un demo simulado)

Instalación y arranque (Windows PowerShell)

1) Instalar dependencias

    npm install

2) Generar cliente Prisma y aplicar migraciones

    npx prisma generate
    npx prisma migrate deploy

3) Preparar `products.xlsx`

- Coloque el archivo `products.xlsx` en la raíz del repositorio. Cada fila debe representar un producto y contener al menos: `name`, `description`, `price`, `stock`.
- El script de seed requiere explícitamente `products.xlsx` y abortará si no está presente — esto fuerza que la fuente de productos sea única y reproducible.

4) Ejecutar seed para poblar la base de datos

    npm run seed
    # Debe ver: "Seed finished. Total products: <N>"

5) Iniciar servidor

    npm start
    # o
    node src/server.js

6) Ejecutar pruebas y demos

    # Smoke tests (ejecuta GET/POST/PATCH básicos)
    node scripts/smoke.js

    # Demo del agente (simula un flujo: listar, obtener, crear carrito, actualizar)
    node scripts/agent_demo.js

    # Demo LLM (si no hay clave, corre un demo simulado)
    node scripts/llm_conversation.js

    # Demo de webhook (envía un payload simplificado al endpoint /webhook/messages)
    node scripts/webhook_demo.js

Cómo funciona la relación entre `products.xlsx` y la DB
- `products.xlsx` es la fuente de verdad. El seed importa sus filas a la tabla `Product` en PostgreSQL.
- En tiempo de ejecución la API no lee `products.xlsx` directamente: el servidor usa Prisma para consultar la base de datos. Por eso es obligatorio ejecutar el seed antes de usar la API.

Notas sobre el webhook y WhatsApp
- El endpoint `POST /webhook/messages` acepta payloads en el formato que usa Meta (WhatsApp Cloud) y, para facilitar pruebas locales, también acepta un payload simplificado `{ from, text }`.
- Si el mensaje contiene la palabra "comprar" el webhook crea un carrito y añade el primer producto disponible (esto evita asumir un id fijo). En producción se debe mejorar la resolución por nombre/codigo y la confirmación al usuario.

Recomendaciones y próximos pasos
- Si no quieres que el seed borre carritos en cada ejecución, puedo convertir el seed para que haga upsert (idempotente). ¿Lo quieres así?
- Puedo reemplazar este README por una versión aún más breve o dividirlo en secciones si preferís (por ejemplo: DEV.md y PROD.md).
- Para crear el Pull Request y mergearlo a `main` necesito un PAT con scope `repo` — si prefieres puedo dejar la rama lista y vos creás el PR desde GitHub.

Documentación adicional
- Lee `docs/API_SPEC.md` y `docs/DIAGRAMS.md` para el diagrama de flujo y ejemplos de payloads (son parte de la entrega técnica).

Anexo: enunciado del desafío
- El archivo `Desafio Tecnico AI Engineer - Laburen.com.txt` está incluido en el repositorio (o en los attachments) y describe los requisitos de la prueba técnica.

----

Si querés, ahora:
- hago el seed idempotente (upsert) y lo commiteo, o
- actualizo los `docs/*.md` para eliminar ejemplos hardcodeados y dejar placeholders, o
- creo la PR hacia `main` si me das un token con permisos `repo`.
# Laburen AI Agent - Backend (Express + Prisma)

This repository contains a minimal implementation of the API required by the challenge: products and carts with PostgreSQL (Prisma ORM). It also includes seed scripts to load `products.xlsx` if present.

Prerequisites
- Node.js >= 18
- PostgreSQL running locally or remote
- Optional: ngrok for exposing local server to the internet

Quick start (Windows PowerShell)

1. Copy `.env.example` to `.env` and set `DATABASE_URL` accordingly.

```powershell
cp .env.example .env
# edit .env with your editor
notepad .env
```

2. Install dependencies

```powershell
npm install
```

3. Generate Prisma client and run migrations

```powershell
npx prisma generate
npx prisma migrate deploy
```

If you want to create a new dev migration (local):

```powershell
npx prisma migrate dev --name init
```

4. Seed the database (reads `products.xlsx` if present, otherwise inserts sample products)

```powershell
npm run seed
```

5. Start server

```powershell
npm start
```

7. Run smoke tests (optional)

```powershell
# run the provided smoke test script
node scripts/smoke.js
```

8. Run agent demo (simulates an LLM calling the API)

```powershell
# runs a demo that lists products, creates a cart and updates it
node scripts/agent_demo.js
```

Docker quick start (if you don't have Postgres locally)

```powershell
docker run --name laburen-postgres -e POSTGRES_USER=laburen_user -e POSTGRES_PASSWORD=MiPassSegura -e POSTGRES_DB=laburen -p 5432:5432 -d postgres:15
# then update .env: DATABASE_URL=postgresql://laburen_user:MiPassSegura@localhost:5432/laburen
```

6. Expose with ngrok (optional)

```powershell
ngrok http 3000
# copy the HTTP URL and set your WhatsApp webhook to https://<ngrok-id>.ngrok.io/webhook/messages
```

WhatsApp integration (summary)
- Configure WhatsApp Cloud API (or Twilio) webhook to point to `/webhook/messages`.
- The webhook handler in this repo is a placeholder; in production it should parse incoming messages, send them to the LLM/orchestrator and let the LLM call the provided HTTP endpoints (`GET /products`, `POST /carts`, `PATCH /carts/:id`).

Agent adapter guidance
- Use OpenAI Functions or LangChain tools that allow defining functions matching the API (list_products, get_product, create_cart, update_cart). On receiving messages, the agent should:
  1. detect intent and required slots,
  2. call the corresponding function (which will perform the HTTP request to this API),
  3. validate results and reply via WhatsApp API.

Notes
- Sensitive variables must be stored in `.env` (DATABASE_URL, WHATSAPP_TOKEN, LLM_API_KEY).
- No authentication is implemented as requested.

## Meta (WhatsApp Cloud API) - detailed setup

1) Create a Facebook Developer account and app
- Go to https://developers.facebook.com and create a new app (Business type).

2) Add the WhatsApp product
- In the App Dashboard click "Add product" and select WhatsApp. Follow the onboarding steps.

3) Get Phone Number ID and temporary token
- In the WhatsApp product section you'll find a "Getting Started" area with a test phone number and a temporary token. Copy:
  - `Phone Number ID` -> set as `WHATSAPP_PHONE_ID` in `.env`
  - `Temporary Token` -> set as `WHATSAPP_TOKEN` in `.env`

4) Configure webhook URL (use ngrok during development)
- Run ngrok to expose your local server: `ngrok http 3000` and copy the HTTPS URL.
- In the App Dashboard -> WhatsApp -> Webhooks, add a callback URL: `https://<NGROK_ID>.ngrok.io/webhook/messages` and set a Verify Token (choose a secret string). Put that string in `.env` as `WHATSAPP_VERIFY_TOKEN`.
- Our server's GET `/webhook/messages` endpoint verifies the challenge automatically.

5) Test message flow
- Send a message from your WhatsApp to the test phone number (the account displayed in the dashboard). The webhook should receive an entry and our POST `/webhook/messages` handler will process it and (in demo mode) create a cart and reply via the Meta API.

6) Production notes
- For production use, create a System User in Business Manager and generate a permanent access token with the `whatsapp_business_management` scope. Use that token as `WHATSAPP_TOKEN`.
- Implement message signature verification and idempotency for production webhooks.

7) Environment variables (add to `.env` locally)
- `WHATSAPP_TOKEN` - your access token
- `WHATSAPP_PHONE_ID` - the phone number id from Meta
- `WHATSAPP_VERIFY_TOKEN` - your webhook verification token

If you want, I can now:
- create a Pull Request from `feature/llm-integration` to `main` and merge it (I need a GitHub token to create the PR via API), or you can create it in the GitHub UI and I will merge it once you confirm.
