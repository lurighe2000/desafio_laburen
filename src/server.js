require('dotenv').config();
const express = require('express');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const app = express();
app.use(express.json());

const fetch = require('node-fetch');

const PORT = process.env.PORT || 3000;

// GET /products?q=&limit=&offset=
app.get('/products', async (req, res) => {
  try {
    const q = req.query.q || '';
    const externalIdQuery = req.query.externalId || req.query.externalid || null;
    const limit = parseInt(req.query.limit || '20', 10);
    const offset = parseInt(req.query.offset || '0', 10);

    let where = q
      ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {};

    // allow direct lookup by externalId
    if (externalIdQuery) {
      where = { externalId: externalIdQuery };
    }

    const products = await prisma.product.findMany({ where, take: limit, skip: offset });
    res.json({ products });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal server error' });
  }
});

// GET /products/external/:externalId - lookup by externalId (legacy Excel ID)
app.get('/products/external/:externalId', async (req, res) => {
  try {
    const externalId = req.params.externalId;
    let product = await prisma.product.findFirst({ where: { externalId } });
    if (!product) {
      // fallback: some rows kept ID only in description; try to match 'ID: 008' in description
      const needle = `ID: ${externalId}`;
      product = await prisma.product.findFirst({ where: { description: { contains: needle, mode: 'insensitive' } } });
    }
    if (!product) return res.status(404).json({ error: 'product not found' });
    res.json(product);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal server error' });
  }
});

// GET /products/:id
app.get('/products/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  try {
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) return res.status(404).json({ error: 'product not found' });
    res.json(product);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal server error' });
  }
});

// POST /carts
app.post('/carts', async (req, res) => {
  const items = req.body.items || [];
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'items required' });
  }

  try {
    // Validate products and stock
    const productIds = items.map((it) => it.product_id);
    const products = await prisma.product.findMany({ where: { id: { in: productIds } } });
    const productsById = Object.fromEntries(products.map((p) => [p.id, p]));

    for (const it of items) {
      const p = productsById[it.product_id];
      if (!p) return res.status(404).json({ error: 'product not found', product_id: it.product_id });
      if (it.qty > p.stock) return res.status(400).json({ error: 'insufficient stock', product_id: it.product_id, available: p.stock });
    }

    const result = await prisma.$transaction(async (tx) => {
      const cart = await tx.cart.create({ data: {} });
      const createdItems = [];
      let total = 0;
      for (const it of items) {
        const p = productsById[it.product_id];
        const unitPrice = p.price;
        total += unitPrice * it.qty;
        const ci = await tx.cartItem.create({ data: { cartId: cart.id, productId: p.id, qty: it.qty, unitPrice } });
        createdItems.push({ product_id: p.id, qty: it.qty, unit_price: unitPrice });
      }
      return { cart_id: cart.id, items: createdItems, total };
    });

    res.status(201).json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal server error' });
  }
});

// PATCH /carts/:id
app.patch('/carts/:id', async (req, res) => {
  const cartId = parseInt(req.params.id, 10);
  const items = req.body.items || [];
  if (!Array.isArray(items)) return res.status(400).json({ error: 'items must be array' });

  try {
    const cart = await prisma.cart.findUnique({ where: { id: cartId }, include: { items: true } });
    if (!cart) return res.status(404).json({ error: 'cart not found' });

    const productIds = items.map((it) => it.product_id);
    const products = await prisma.product.findMany({ where: { id: { in: productIds } } });
    const productsById = Object.fromEntries(products.map((p) => [p.id, p]));

    const result = await prisma.$transaction(async (tx) => {
      // apply updates: if qty == 0 delete, else upsert
      for (const it of items) {
        const p = productsById[it.product_id];
        if (!p) throw { status: 404, body: { error: 'product not found', product_id: it.product_id } };
        if (it.qty > p.stock) throw { status: 400, body: { error: 'insufficient stock', product_id: it.product_id, available: p.stock } };

        const existing = await tx.cartItem.findFirst({ where: { cartId: cartId, productId: it.product_id } });
        if (it.qty === 0) {
          if (existing) await tx.cartItem.delete({ where: { id: existing.id } });
        } else {
          if (existing) {
            await tx.cartItem.update({ where: { id: existing.id }, data: { qty: it.qty, unitPrice: p.price } });
          } else {
            await tx.cartItem.create({ data: { cartId: cartId, productId: p.id, qty: it.qty, unitPrice: p.price } });
          }
        }
      }

      const updatedItems = await tx.cartItem.findMany({ where: { cartId: cartId } });
      const total = updatedItems.reduce((s, it) => s + it.qty * it.unitPrice, 0);
      return { cart_id: cartId, items: updatedItems.map((it) => ({ product_id: it.productId, qty: it.qty, unit_price: it.unitPrice })), total };
    });

    res.json(result);
  } catch (err) {
    console.error(err);
    if (err && err.status) return res.status(err.status).json(err.body);
    res.status(500).json({ error: 'internal server error' });
  }
});

// GET /carts/:id - retrieve cart details
app.get('/carts/:id', async (req, res) => {
  const cartId = parseInt(req.params.id, 10);
  try {
    const cart = await prisma.cart.findUnique({ where: { id: cartId }, include: { items: { include: { product: true } } } });
    if (!cart) return res.status(404).json({ error: 'cart not found' });

    const items = cart.items.map((it) => ({ product_id: it.productId, qty: it.qty, unit_price: it.unitPrice, product_name: it.product?.name }));
    const total = cart.items.reduce((s, it) => s + it.qty * it.unitPrice, 0);
    res.json({ cart_id: cart.id, items, total, createdAt: cart.createdAt, updatedAt: cart.updatedAt });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal server error' });
  }
});

// Webhook endpoints for WhatsApp (Meta) - verification and message handling
app.get('/webhook/messages', (req, res) => {
  // Verification challenge from Meta
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
  if (mode && token) {
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('Webhook verified');
      return res.status(200).send(challenge);
    }
    return res.sendStatus(403);
  }
  res.status(400).send('no verification query');
});

// Lightweight healthcheck
app.get('/health', async (req, res) => {
  const result = { ok: true, checks: {} };
  // check DB
  try {
    const count = await prisma.product.count();
    result.checks.database = { ok: true, product_count: count };
  } catch (err) {
    result.ok = false;
    result.checks.database = { ok: false, error: String(err && err.message ? err.message : err) };
  }

  // check WhatsApp integration lightly: presence of token and phone id and ability to call /me
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  if (!token) {
    result.ok = false;
    result.checks.whatsapp = { ok: false, reason: 'no_token' };
  } else if (!phoneId) {
    result.ok = false;
    result.checks.whatsapp = { ok: false, reason: 'no_phone_id' };
  } else {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const meRes = await fetch('https://graph.facebook.com/v24.0/me', { headers });
      const meJson = await meRes.json().catch(() => null);
      if (!meRes.ok) {
        result.ok = false;
        result.checks.whatsapp = { ok: false, status: meRes.status, body: meJson };
      } else {
        result.checks.whatsapp = { ok: true, me: meJson };
      }
    } catch (err) {
      result.ok = false;
      result.checks.whatsapp = { ok: false, error: String(err && err.message ? err.message : err) };
    }
  }

  res.status(result.ok ? 200 : 503).json(result);
});

const { sendText } = require('./whatsapp/meta');
const { orchestrate } = require('./agent/orchestrator');
// pending actions waiting for user confirmation: map from normalizedFrom -> { actionObj }
const pendingActions = new Map();

// phone normalization helper (kept in server too for incoming messages)
function normalizePhoneNumber(raw) {
  if (!raw && raw !== 0) return raw;
  try {
    let s = String(raw).trim();
    s = s.replace(/[^\d+]/g, '');
    if (s.startsWith('+')) s = s.slice(1);
    if (s.startsWith('549')) {
      const converted = '541' + s.slice(3);
      console.log('normalizePhoneNumber (incoming): converted', s, '->', converted);
      return converted;
    }
    return s;
  } catch (e) {
    return raw;
  }
}

app.post('/webhook/messages', async (req, res) => {
  try {
    // Meta sends structured notifications; for demo, handle simplified payloads
    console.log('incoming webhook body', JSON.stringify(req.body).slice(0, 1000));
    // Try to find message text and sender
    // Try Meta structured payload first
    const entry = req.body.entry && req.body.entry[0];
    const changes = entry && entry.changes && entry.changes[0];
    const value = changes && changes.value;
    const messages = value && value.messages;

    // helper to handle a single message object { from, text }
    async function handleMessage(m) {
      const rawFrom = m.from;
      const from = normalizePhoneNumber(rawFrom) || rawFrom;
      const text = (m.text && m.text.body) || (typeof m === 'string' ? m : undefined);
      if (!text) return null;

      // If user has a pending action and confirms, execute it
      const lower = text && text.toLowerCase && text.toLowerCase().trim();
      if (pendingActions.has(from) && (lower === 'si' || lower === 'sí' || lower === 'confirmar' || lower === 'yes')) {
        const actionObj = pendingActions.get(from);
        pendingActions.delete(from);
        try {
          const execRes = await require('./agent/orchestrator').executeAction(actionObj);
          await sendText(from, execRes.text);
          return res.json({ status: 'ok', acted: 'confirmed', result: execRes });
        } catch (e) {
          console.error('error executing confirmed action', e);
          await sendText(from, 'Hubo un error ejecutando la acción confirmada.');
          return res.status(500).json({ error: 'execution_error' });
        }
      }

      // Let the orchestrator propose an action but don't execute dangerous ops without confirmation
      try {
        const plan = await require('./agent/orchestrator').plan(text);
        const act = plan.action || plan.intent;
        // require confirmation for create_cart or update_cart
        if (act === 'create_cart' || act === 'update_cart') {
          // store plan under normalized from
          pendingActions.set(from, plan);
          await sendText(from, 'Voy a ejecutar una acción que modifica tu carrito. ¿Confirmás? Responder "sí" para confirmar.');
          return res.json({ status: 'ok', acted: 'asked_confirmation', plan });
        }

        // otherwise execute immediately
        const aiExec = await require('./agent/orchestrator').executeAction(plan);
        const reply = aiExec && aiExec.text ? aiExec.text : 'Lo siento, no pude procesar tu solicitud.';
        await sendText(from, reply);
        return res.json({ status: 'ok', acted: 'orchestrated', result: aiExec });
      } catch (err) {
        console.error('orchestrator error', err);
        try {
          await sendText(from, 'Hubo un error procesando tu pedido. Intentá de nuevo más tarde.');
        } catch (e) {
          /* ignore */
        }
        return res.status(500).json({ error: 'orchestrator_error' });
      }
    }

    if (Array.isArray(messages) && messages.length > 0) {
      const r = await handleMessage(messages[0]);
      if (r) return r;
    }

    // If no Meta-style messages, accept a simplified payload for local demos: { from, text }
    if (req.body && (req.body.from || req.body.text)) {
      const simple = { from: req.body.from || 'demo', text: { body: req.body.text || '' } };
      const r = await handleMessage(simple);
      if (r) return r;
    }
    res.json({ status: 'ok', acted: 'none' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

// Health endpoint: basic readiness check
app.get('/health', async (req, res) => {
  // lightweight check: ensure Prisma can connect and required env vars exist
  try {
    const dbOk = await prisma.$queryRaw`SELECT 1`;
    const token = process.env.WHATSAPP_TOKEN;
    const phoneId = process.env.WHATSAPP_PHONE_ID;
    const ok = !!(dbOk && token && phoneId);
    res.json({ status: ok ? 'ok' : 'failed', db: !!dbOk, whatsapp_token: !!token, whatsapp_phone_id: !!phoneId });
  } catch (err) {
    console.error('health check error', err && err.message ? err.message : err);
    res.status(500).json({ status: 'failed', error: String(err) });
  }
});
