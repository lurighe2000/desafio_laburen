require('dotenv').config();
const { orchestrate } = require('../src/agent/orchestrator');

async function demo() {
  if (!process.env.LLM_API_KEY) {
    console.error('LLM_API_KEY no está definido en .env. Agregar la clave y reintentar.');
    process.exit(2);
  }

  const dialogues = [
    'Hola, quiero ver los productos disponibles y luego crear un carrito con 1 unidad del producto 2',
    'Quiero comprar 2 unidades del producto 3 y confirmar mi carrito'
  ];

  for (const d of dialogues) {
    console.log('----');
    console.log('User:', d);
    const r = await orchestrate(d);
    console.log('Agent result:', r);
  }
}

demo();
