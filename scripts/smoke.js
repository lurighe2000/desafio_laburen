const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function run(){
  try{
    console.log('--- GET /products ---');
    let r = await fetch('http://localhost:3000/products');
    console.log('status', r.status);
    console.log(await r.json());

  console.log('\n--- GET /products/:first ---');
  // fetch first product id dynamically
  let all = await (await fetch('http://localhost:3000/products')).json();
  const firstId = all?.products && all.products.length > 0 ? all.products[0].id : 1;
  r = await fetch(`http://localhost:3000/products/${firstId}`);
  console.log('status', r.status);
  console.log(await r.json());

    console.log('\n--- POST /carts (valid) ---');
  r = await fetch('http://localhost:3000/carts', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ items: [{ product_id:firstId, qty:2 }] }) });
    console.log('status', r.status);
    const cart = await r.json();
    console.log(cart);

    console.log('\n--- PATCH /carts/:id (update qty to 1) ---');
  r = await fetch(`http://localhost:3000/carts/${cart.cart_id}`, { method: 'PATCH', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ items: [{ product_id:firstId, qty:1 }] }) });
    console.log('status', r.status);
    console.log(await r.json());

    console.log('\n--- POST /carts (invalid product) ---');
    r = await fetch('http://localhost:3000/carts', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ items: [{ product_id:999, qty:1 }] }) });
    console.log('status', r.status);
    console.log(await r.text());

  } catch (e){
    console.error('Error during smoke tests', e);
    process.exit(1);
  }
}

run();
