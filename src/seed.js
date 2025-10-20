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
    console.error('products.xlsx not found in project root. Aborting seed to avoid using embedded sample data.');
    process.exit(1);
  }

  // Upsert products by case-insensitive name to make seed idempotent and
  // avoid deleting carts/cart_items. This preserves carts created in development
  // while updating product data from the spreadsheet.
  for (const p of products) {
    const name = (p.name || '').trim();
    if (!name) continue;
    // find existing product by name (case-insensitive)
    const existing = await prisma.product.findFirst({ where: { name: { equals: name, mode: 'insensitive' } } });
    if (existing) {
      await prisma.product.update({ where: { id: existing.id }, data: { description: p.description, price: p.price, stock: p.stock } });
    } else {
      await prisma.product.create({ data: p });
    }
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
