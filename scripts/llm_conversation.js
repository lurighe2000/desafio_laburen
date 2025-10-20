const fetch = require('node-fetch');
const { callChatCompletion, isPlaceholderKey } = require('../src/llm/openai_adapter');
const dotenv = require('dotenv');
dotenv.config();

const API_BASE = `http://localhost:${process.env.PORT || 3000}`;

async function api(path, opts = {}) {
  const res = await fetch(API_BASE + path, opts);
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

async function runDemo() {
  const key = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY;
  if (!key || isPlaceholderKey(key)) {
    console.log('No valid LLM API key found in environment. Using enhanced scripted demo (no network cost).');
    console.log('This simulation will demonstrate the same agent actions but locally.');

    // Step 1 - list products
    console.log('\n[SIM] 1) List products');
    const p = await api('/products');
    console.log(p);

  // Step 2 - pick first product for demo operations
  console.log('\n[SIM] 2) Pick first product');
  const firstId = Array.isArray(p.body?.products) && p.body.products.length > 0 ? p.body.products[0].id : 1;
  const pd = await api(`/products/${firstId}`);
  console.log(pd);

  // Step 3 - simulate a decision flow: create cart with the first product x2
  console.log(`\n[SIM] 3) Create cart with product ${firstId} x2 (simulated decision)`);
  const createRes = await api('/carts', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ items:[{ product_id:firstId, qty:2 }] }) });
  console.log(createRes);

  // Step 4 - simulate updating cart to qty 1
  console.log('\n[SIM] 4) Update cart (set qty to 1)');
  const cartId = createRes?.body?.cart_id || 1;
  const updRes = await api(`/carts/${cartId}`, { method: 'PATCH', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ items:[{ product_id:firstId, qty:1 }] }) });
  console.log(updRes);

    // Summary
    console.log('\n[SIM] Demo finished. Summary:');
    console.log('- Products listed:', Array.isArray(p.body?.products) ? p.body.products.length : 0);
    console.log('- Created cart id:', createRes?.body?.cart_id);
    console.log('- Final cart total:', updRes?.body?.total);
    return;
  }

  // If we have a key, ask the LLM for a plan in JSON
  const system = { role: 'system', content: 'You are an agent that outputs a plan in strict JSON format. The plan is an array of steps. Each step has an action: list_products|get_product|create_cart|update_cart and params object.' };
  const user = { role: 'user', content: 'Please produce a short plan (max 4 steps) to sell one unit of product 1. Respond ONLY with JSON array.' };

  let reply;
  try {
    reply = await callChatCompletion({ messages: [system, user], max_tokens: 400 });
  } catch (err) {
    if (err.status === 401 || err.status === 403) {
      console.warn('LLM provider returned auth error; falling back to scripted demo.');
      return runDemo();
    }
    throw err;
  }

  console.log('LLM reply (raw):');
  console.log(reply);

  // Attempt to extract JSON from reply tolerant to backticks or markdown
  const jsonMatch = reply.match(/\[\s*\{[\s\S]*\}\s*\]/m);
  const jsonText = jsonMatch ? jsonMatch[0] : reply;

  let plan;
  try { plan = JSON.parse(jsonText); } catch (e) {
    console.error('Failed to parse JSON from LLM. Aborting. Received:', jsonText.slice(0, 400));
    return;
  }

  let lastCreatedCartId = null;
  for (let step of plan) {
    console.log('\nExecuting step:', step);

    // Normalize step params
    step.params = step.params || {};
    if (step.action === 'create_cart') {
      // Ensure items: [] shape
      if (!Array.isArray(step.params.items) || step.params.items.length === 0) {
        // If LLM didn't provide items, try to infer from prior steps (use product_id 1 qty 1)
        step.params.items = [{ product_id: 1, qty: 1 }];
      }
      const res = await api('/carts', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(step.params) });
      console.log(res);
      if (res && res.status === 201 && res.body && res.body.cart_id) lastCreatedCartId = res.body.cart_id;

    } else if (step.action === 'update_cart') {
      // map quantity -> qty and product_id per items array
      if (step.params.cart_id == null) step.params.cart_id = lastCreatedCartId || 1;
      // If LLM used single product_id + quantity fields, convert to items
      if (!Array.isArray(step.params.items)) {
        if (step.params.product_id && (step.params.quantity || step.params.qty)) {
          const q = step.params.quantity || step.params.qty || 1;
          step.params.items = [{ product_id: step.params.product_id, qty: q }];
        } else {
          // fallback to product 1 qty 1
          step.params.items = [{ product_id: 1, qty: 1 }];
        }
      }
      // execute
      const cartId = step.params.cart_id;
      // When sending body, only include items
      const body = { items: step.params.items };
      console.log(await api(`/carts/${cartId}`, { method: 'PATCH', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) }));

    } else if (step.action === 'list_products') {
      console.log(await api('/products'));

    } else if (step.action === 'get_product') {
      console.log(await api(`/products/${step.params.product_id}`));

    } else {
      console.warn('Unknown action', step.action);
    }
  }
}

runDemo().catch(err => { console.error(err); process.exit(1); });
