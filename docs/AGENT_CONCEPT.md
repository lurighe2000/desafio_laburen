## Agente IA - Resumen conceptual

Este documento describe, en forma concisa, la arquitectura del agente IA que demuestra la venta de productos vía WhatsApp Cloud API y una API propia (Express + Prisma + PostgreSQL).

Objetivo
- Demostrar un flujo de punta a punta: WhatsApp (entrada) → webhook (server) → orquestador/LLM → llamadas a la API propia (productos/carrito) → respuestas vía WhatsApp (salida).

Componentes principales
- API HTTP (Express + Prisma): expone endpoints REST para productos y carritos.
- Base de datos (PostgreSQL): almacena `Product`, `Cart`, y `CartItem`.
- Seed: `src/seed.js` importa `products.xlsx` y hace upsert por nombre.
- Adaptador WhatsApp: `src/whatsapp/meta.js` envía mensajes usando la Graph API de Meta.
- Webhook: `POST /webhook/messages` en `src/server.js` recibe notificaciones y payloads de prueba.
- Scripts de validación/CI: `scripts/check_token.js` y `scripts/validate_integration.js`.

Diagrama (alto nivel)

 WhatsApp Client (user)
        |
        | mensaje
        v
  Meta WhatsApp Cloud
        | (webhook)
        v
  https://<ngrok-or-deploy-url>/webhook/messages   --->  src/server.js (webhook handler)
        |                                              - parsea payload
        |                                              - detecta intención
        v                                              - crea/actualiza carrito en DB (Prisma)
  src/server.js  <---  src/whatsapp/meta.js (sendText)  <-- LLM adapter (scripts/llm_conversation.js)


Endpoints (resumen)
- GET /products
  - Query: q (string), limit (int), offset (int)
  - Response: { products: [ Product ] }

- GET /products/:id
  - Response: Product or 404

- POST /carts
  - Body: { items: [ { product_id: number, qty: number } ] }
  - Success: 201 { cart_id, items: [{ product_id, qty, unit_price }], total }
  - Errores: 400 (items required), 404 (product not found), 400 (insufficient stock)

- PATCH /carts/:id
  - Body: { items: [ { product_id, qty } ] }
  - Comportamiento: aplica los cambios (qty=0 → borra item; else upsert). Devuelve cart actualizado con total.

- GET /carts/:id
  - Devuelve items con nombre del producto, qty, unit_price, total

- GET /webhook/messages (verification)
  - Usado por Meta para verificar webhook (hub.mode / hub.verify_token)

- POST /webhook/messages
  - Recepción de notificaciones: maneja estructuras Meta (entry.changes.value.messages) y, para pruebas locales, acepta { from, text }.
  - Lógica de demo: si el texto contiene "comprar" crea un carrito con el primer producto disponible y responde via `sendText`.


Modelos de datos (síntesis)
- Product: { id, name, description?, price (float), stock (int), createdAt, updatedAt }
- Cart: { id, createdAt, updatedAt }
- CartItem: { id, cartId, productId, qty, unitPrice }

Flujo de ejemplo (usuario quiere comprar)
1) Usuario envía por WhatsApp: "Quiero comprar"
2) Meta envía webhook a `/webhook/messages` con la estructura de mensajes
3) El servidor parsea el mensaje, detecta la intención "comprar" y crea un `Cart` con 1 item (primer product disponible)
4) El servidor llama a `sendText(to, text)` (en `src/whatsapp/meta.js`) para responder al usuario
5) Meta entrega el mensaje al usuario y devuelve status callbacks que también llegan a `/webhook/messages` (si está configurado)

Ejemplos de payloads para pruebas locales
- Simplificado (demo):
  POST /webhook/messages
  Body: { "from": "541161503314", "text": "Quiero comprar" }

- Formato Meta (simplificado):
  {
    "entry": [{
      "changes": [{
        "value": { "messages": [{ "from": "541161503314", "text": { "body": "Quiero comprar" } }] }
      }]
    }]
  }


LLM / Orquestador (resumen)
- Se provee un adaptador de ejemplo (scripts/llm_conversation.js) que puede simular el rol del LLM. En producción el agente LLM debería:
  - recibir el texto entrante,
  - detectar intención y entidades (slots),
  - llamar a la API interna (listar productos, crear carrito, actualizar carrito) usando las rutas definidas,
  - validar resultados y componer la respuesta para enviar al usuario por WhatsApp.


Estrategias de error y casos extremos
- Sin stock o producto no encontrado → 400/404 y el agente debe informar al usuario.
- Token expirado / permisos → scripts de validación/CI (`scripts/check_token.js`) detectan y fallan (exit != 0).
- Webhook no verificado → GET /webhook/messages responde 403 si el verify_token no coincide.


Cómo ejecutar localmente (resumen rápido)
1) Copiar `.env.example` → `.env` y completar `DATABASE_URL`. Opcionalmente añadir `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_WEBHOOK_URL`.
2) npm install
3) npx prisma generate
4) npx prisma migrate deploy (o `prisma migrate dev --name init` en desarrollo)
5) Colocar `products.xlsx` en la raíz y ejecutar `npm run seed` (importa productos y hace upsert)
6) npm start
7) (Opcional) ngrok http 3000 → copiar URL y pegar en WhatsApp Manager > Phone Number > Webhook callback URL; establecer el mismo verify token que en `.env`

CI y GitHub Secrets
- Agregar un Secret de repositorio llamado `WHATSAPP_TOKEN` con un token de System User (preferible) en GitHub → Repository → Settings → Secrets and variables → Actions → New repository secret.
- El workflow `.github/workflows/ci.yml` ejecutará `scripts/check_token.js` y fallará si el token no es válido o no tiene acceso a la WABA.


Registro y depuración
- `src/whatsapp/meta.js` imprime en consola un resumen de cada envío (`whatsapp send ->`) con un token prefix enmascarado y la respuesta del servidor de Meta (`whatsapp response <-`).
- El servidor escribe logs `incoming webhook body` en el handler del webhook para ayudar a depurar.


Notas finales
- La implementación es una demo con la mayoría de comportamientos requeridos por el challenge: endpoints listados, seed desde `products.xlsx`, integración WhatsApp (send/receive), adaptadores y scripts de validación.
- Próximos pasos sugeridos: añadir `/health` que valide integraciones en tiempo de ejecución; documentar diagramas visuales (por ejemplo un PNG en `docs/`), y añadir tests automatizados para los endpoints críticos.

---
Documento generado automáticamente como parte de la entrega técnica.
# Diseño conceptual del Agente de IA para ventas (Máx. 2 páginas)

Resumen corto
- Objetivo: agente de IA que puede mostrar productos, crear y editar carritos consumiendo una API REST propia respaldada por PostgreSQL. No es un bot de menús; debe ejecutar llamadas HTTP programáticas (OpenAI Functions / LangChain o similar).

## 1) Diagrama de flujo de interacción (resumen)
Ver los diagramas mermaid en `./DIAGRAMS.md` (flowchart y sequence). En palabras: el usuario (WhatsApp) expresa intención → agente NLU detecta intención (buscar/productos/compra/editar) → agente mapea a función HTTP (GET /products, POST /carts, PATCH /carts/:id) → ejecuta llamada a la API → valida respuesta y confirma/clarifica en el canal.

## 2) Arquitectura de alto nivel
Componentes principales:
- LLM / Orquestador: modelo que detecta intención, genera y valida llamadas HTTP (ej. OpenAI Functions, LangChain Tools o Gemini + función HTTP).
- API REST (Node.js ≥18 con Express + Prisma/Sequelize) exponiendo `/products` y `/carts`.
- Base de datos: PostgreSQL con tablas `products`, `carts`, `cart_items`.
- Conector de mensajería: WhatsApp Cloud API o Twilio (sandbox) para enviar/recibir mensajes y exponer webhooks.
- Túnel de desarrollo: ngrok para exponer localmente la API a WhatsApp en pruebas.

Sensibles en `.env`:
- DATABASE_URL=postgres://...
- PORT=3000
- WHATSAPP_TOKEN=...
- OPENAI_API_KEY / GEMINI_KEY
- NGROK_AUTHTOKEN (opcional)

## 3) Endpoints (contrato mínimo)

- GET /products
  - Query params: `q` (opcional) búsqueda por nombre o descripción, `limit`, `offset`.
  - Response 200: { products: [{id,name,description,price,stock}] }
  - Errors: 500 Internal Server Error

- GET /products/:id
  - Response 200: { id,name,description,price,stock }
  - 404: { error: "product not found" }

- POST /carts
  - Body: { items: [{ product_id: number, qty: number }] }
  - Behavior: crea `carts` + `cart_items`. Valida stock; si algún product_id no existe devuelve 404 para ese item.
  - Success 201: { cart_id, items: [{ product_id, qty, unit_price }], total }
  - 404: { error: "product not found", product_id }

- PATCH /carts/:id  (extra)
  - Body: { items: [{ product_id, qty }] }
  - Behavior: actualiza qty (0 → elimina). Recalcula totales y valida stock.
  - 200: { cart_id, items, total }
  - 404: { error: "cart not found" }

Ejemplo breve de flujo JSON (crear carrito):
POST /carts
Body:
{ "items": [{ "product_id": 12, "qty": 2 }, { "product_id": 5, "qty": 1 }] }

200/201:
{ "cart_id": 42, "items": [{ "product_id":12, "qty":2, "unit_price":9.5 }], "total":29.0 }

## 4) Contrato del agente (mini-API que el LLM invoca)
- Funciones que el agente puede llamar (ejemplo para OpenAI Functions / LangChain Tools):
  - list_products(q: string|null, limit?: int, offset?: int) -> products[] | error
  - get_product(id: int) -> product | 404
  - create_cart(items: [{product_id:int, qty:int}]) -> cart | 404|error
  - update_cart(cart_id:int, items:[...]) -> cart | 404|error

Entrada/Salida, modos de error:
- Input: texto libre del usuario desde WhatsApp. Agente extrae intención y slots (producto, cantidad, editar-cart-id).
- Output: mensajes confirmatorios + llamadas HTTP. Si llamada falla, agente devuelve mensaje humano-amigable y propone alternativas (p.e. productos similares, pedir menos cantidad).
- Errores: 4xx (cliente: p.e. producto no encontrado), 5xx (reintentar con backoff y notificar).

## 5) Edge cases y decisiones
- Stock insuficiente: agent muestra stock disponible y ofrece alternativa (backorder no soportado por defecto).
- Productos eliminados entre pasos: 404 → agente informa y ofrece reemplazos.
- Intenciones ambiguas: el agente pregunta una aclaración corta (si confianza < umbral, p.e. 0.7).
- Conversaciones largas: cada conversación corresponde a un `cart` (crear carrito nuevo por webhookId/convId).

## 6) Métricas recomendadas
- Tasa de conversión (intent->cart created / intent total).
- Latencia promedio de endpoint `/carts`.
- Errores 4xx/5xx por endpoint.
- Promedio de items por cart.

## 7) Prueba en WhatsApp (pasos resumidos)
1. Ejecutar API local: `PORT=3000 npm start` (expone `/products` y `/carts`).
2. Abrir túnel: `ngrok http 3000` y copiar la URL pública.
3. Configurar webhook en WhatsApp Cloud API (o Twilio) apuntando al webhook recibido por el servidor (por ejemplo `/webhook/messages`).
4. Agente (orquestador LLM) se puede ejecutar en el mismo host y suscribirse al webhook para recibir mensajes; al detectar intención, llamará a los endpoints.
5. Pruebas: pedir al número test "quiero comprar 2 unidades del producto X" → el agente debe: buscar el producto, crear carrito (POST /carts) y responder con confirmación y link/ID del carrito.

## 8) Pasos siguientes (prácticos)
- Implementar la API (Node.js + Prisma) y scripts para cargar `products.xlsx` a PostgreSQL.
- Implementar adaptador del agente (OpenAI Functions o LangChain tool) que mapea intenciones a las funciones HTTP.
- Desplegar en un entorno con HTTPS y conectar WhatsApp Cloud API.

---
Archivo: `./DIAGRAMS.md` contiene los diagramas mermaid que acompañan este documento.
