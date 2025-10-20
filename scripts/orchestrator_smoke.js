const { orchestrate } = require('../src/agent/orchestrator');

async function run() {
  const tests = [
    'Quiero ver el listado de productos',
    'Mostrar producto 1',
    'Quiero comprar',
    'Actualizar carrito 1 con 2 unidades del producto 1'
  ];

  for (const t of tests) {
    console.log('---');
    console.log('Input:', t);
    try {
      const r = await orchestrate(t);
      console.log('Result:', r);
    } catch (e) {
      console.error('Error:', e);
    }
  }
}

run();
