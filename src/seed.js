require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

async function main() {
  const filePath = path.join(process.cwd(), 'products.xlsx');
  let products = [];
  if (fs.existsSync(filePath)) {
    console.log('Found products.xlsx - loading');
    const wb = xlsx.readFile(filePath);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const data = xlsx.utils.sheet_to_json(sheet);
    // Expect rows with name, description, price, stock
    products = data.map((r) => ({
      name: String(r.name || r.Name || r.nombre || ''),
      description: String(r.description || r.Description || r.descripcion || ''),
      price: parseFloat(r.price || r.Price || r.precio || 0) || 0,
      stock: parseInt(r.stock || r.Stock || r.stock_qty || 0, 10) || 0,
    }));
  } else {
    console.log('No products.xlsx found - inserting sample products');
    products = [
      { name: 'Camiseta Azul', description: '100% algodón', price: 19.9, stock: 10 },
      { name: 'Gorra Negra', description: 'Un tamaño', price: 9.5, stock: 20 },
      { name: 'Taza Logo', description: 'Cerámica 350ml', price: 7.0, stock: 15 },
    ];
  }

  // Delete dependent records first to avoid foreign key constraint errors
  await prisma.$transaction([
    prisma.cartItem.deleteMany(),
    prisma.cart.deleteMany(),
    prisma.product.deleteMany(),
  ]);

  for (const p of products) {
    await prisma.product.create({ data: p });
  }

  console.log('Seed finished. Total products:', products.length);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
