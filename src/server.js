require('dotenv').config();
const express = require('express');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// GET /products?q=&limit=&offset=
app.get('/products', async (req, res) => {
  try {
    const q = req.query.q || '';
    const limit = parseInt(req.query.limit || '20', 10);
    const offset = parseInt(req.query.offset || '0', 10);

    const where = q
      ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {};

    const products = await prisma.product.findMany({ where, take: limit, skip: offset });
    res.json({ products });
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

// Webhook placeholder for WhatsApp messages (POST)
app.post('/webhook/messages', async (req, res) => {
  // Demo webhook: detect simple customer intents and act locally
  try {
    console.log('incoming webhook', req.body);
    const text = (req.body.text || '').toLowerCase();
    if (text.includes('comprar') || text.includes('quiero comprar') || text.includes('compraría')) {
      // create a cart with product 1 x1 (demo)
      const result = await prisma.$transaction(async (tx) => {
        const cart = await tx.cart.create({ data: {} });
        const p = await tx.product.findUnique({ where: { id: 1 } });
        if (!p) throw new Error('no product 1');
        await tx.cartItem.create({ data: { cartId: cart.id, productId: p.id, qty: 1, unitPrice: p.price } });
        return { cart_id: cart.id };
      });
      return res.json({ status: 'ok', acted: 'created_cart', result });
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
