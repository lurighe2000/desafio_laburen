const fetch = require('node-fetch');
const OpenAI = require('openai');
const Ajv = require('ajv');
const ajv = new Ajv();
const API_BASE = process.env.API_BASE || 'http://localhost:3000';

function simpleIntent(text) {
  const t = text.toLowerCase();
  if (t.includes('listar') || t.includes('lista') || t.includes('productos')) return { intent: 'list_products' };
  if (t.match(/producto\s+\d+/)) return { intent: 'get_product', id: parseInt(t.match(/producto\s+(\d+)/)[1], 10) };
  if (t.includes('comprar') || t.includes('agregar')) return { intent: 'create_cart' };
  return { intent: 'smalltalk' };
}

async function callInternal(path, method = 'GET', body) {
  const url = `${API_BASE}${path}`;
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  const json = await res.json().catch(() => null);
  return { status: res.status, body: json };
}

async function runWithOpenAI(text) {
  const key = process.env.LLM_API_KEY;
  if (!key) return null;
  const client = new OpenAI({ apiKey: key });
  // For simplicity: ask model to return JSON with {action, params}
  const prompt = `Eres un agente que actúa sobre una API interna. Recibe: "${text}". ` +
    'Devuelve estrictamente JSON con { "action": string, "params": object } donde action puede ser "list_products", "get_product", "create_cart", "update_cart", "reply". NO añadas texto adicional fuera del JSON. Si respondes texto en "reply", ponlo en params.reply.' +
    '\n\nEjemplos de salida JSON válidos:\n' +
    '{"action":"list_products","params":{}}\n' +
    '{"action":"get_product","params":{"id":3}}\n' +
    '{"action":"create_cart","params":{"items":[{"product_id":3,"qty":2}]}}\n' +
    '{"action":"reply","params":{"reply":"Gracias, tu pedido fue procesado."}}\n' +
    '\nSi no corresponde a ninguna acción conocida, devuelve {"action":"reply","params":{"reply":"No entendí."}}';

  try {
    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 300,
    });
    const content = completion.choices && completion.choices[0] && completion.choices[0].message && completion.choices[0].message.content;
    try {
      const parsed = JSON.parse(content);
      // validate shape
      const schema = {
        type: 'object',
        properties: {
          action: { type: 'string' },
          params: { type: 'object' }
        },
        required: ['action'],
        additionalProperties: false
      };
      const valid = ajv.validate(schema, parsed);
      if (!valid) return null;
      return parsed;
    } catch (e) {
      return null;
    }
  } catch (err) {
    return null;
  }
}

async function executeAction(actionObj) {
  const act = actionObj.action || actionObj.intent;
  const params = actionObj.params || {};
  switch (act) {
    case 'list_products': {
      const r = await callInternal('/products');
      const products = (r.body && r.body.products) || [];
      const sample = products.slice(0, 3).map((p) => p.name && p.name.trim() ? p.name : `Producto #${p.id}`);
      return { text: `Hay ${products.length} productos. Ej: ${sample.join(', ')}`, meta: r };
    }
    case 'get_product': {
      const id = params.id || actionObj.id;
      const r = await callInternal(`/products/${id}`);
      if (r.status === 200) return { text: `Producto: ${r.body.name} - ${r.body.description} - $${r.body.price}`, meta: r };
      return { text: `No encontré el producto ${id}.`, meta: r };
    }
    case 'create_cart': {
      let payload = params.items;
      if (!Array.isArray(payload) || payload.length === 0) {
        const pr = await callInternal('/products');
        const products = (pr.body && pr.body.products) || [];
        const first = products.find(p => p && typeof p.id !== 'undefined');
        const pid = first ? first.id : 1;
        payload = [{ product_id: pid, qty: 1 }];
      }
      const r = await callInternal('/carts', 'POST', { items: payload });
      if (r.status === 201) return { text: `Tu carrito fue creado con id ${r.body.cart_id}. Total: ${r.body.total}`, meta: r };
      return { text: `No pude crear el carrito: ${JSON.stringify(r.body)}`, meta: r };
    }
    case 'update_cart': {
      const cartId = params.cart_id;
      if (!cartId) return { text: 'Falta el id del carrito para actualizar.' };
      const r = await callInternal(`/carts/${cartId}`, 'PATCH', { items: params.items || [] });
      if (r.status === 200) return { text: `Carrito ${cartId} actualizado. Total: ${r.body.total}`, meta: r };
      return { text: `Error actualizando carrito: ${JSON.stringify(r.body)}`, meta: r };
    }
    default:
      return { text: 'Lo siento, no entendí. Podés pedirme "listar productos", "ver producto <id>", o "crear carrito".' };
  }
}

async function orchestrate(text) {
  // Try LLM first
  const ai = await runWithOpenAI(text);
  let actionObj = ai;
  if (!actionObj) {
    // fallback rule-based
    actionObj = simpleIntent(text);
  }
  // execute
  return executeAction(actionObj);
}

module.exports = { orchestrate };

// plan: only return the intended action (without executing it)
async function plan(text) {
  const ai = await runWithOpenAI(text);
  if (ai) return ai;
  // fallback
  return simpleIntent(text);
}

module.exports = { orchestrate, executeAction, plan };
