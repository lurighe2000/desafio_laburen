const fetch = require('node-fetch');

async function listProducts(q=''){
  const res = await fetch(`http://localhost:3000/products?q=${encodeURIComponent(q)}`);
  return res.json();
}

async function getProduct(id){
  const res = await fetch(`http://localhost:3000/products/${id}`);
  return res.json();
}

async function createCart(items){
  const res = await fetch('http://localhost:3000/carts', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ items }) });
  return { status: res.status, body: await res.json() };
}

async function updateCart(cartId, items){
  const res = await fetch(`http://localhost:3000/carts/${cartId}`, { method: 'PATCH', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ items }) });
  return { status: res.status, body: await res.json() };
}

async function demo(){
  console.log('Agent demo: list products');
  console.log(await listProducts());
  // pick first product dynamically
  const listing = await listProducts();
  const firstId = listing?.products && listing.products.length > 0 ? listing.products[0].id : 1;

  console.log('Agent demo: get first product');
  console.log(await getProduct(firstId));

  console.log(`Agent demo: create cart with product ${firstId} x2`);
  const cart = await createCart([{ product_id:firstId, qty:2 }]);
  console.log(cart);

  if (cart.body && cart.body.cart_id){
    console.log('Agent demo: update cart qty to 1');
    const patched = await updateCart(cart.body.cart_id, [{ product_id:firstId, qty:1 }]);
    console.log(patched);
  }
}

demo().catch(e => console.error(e));
