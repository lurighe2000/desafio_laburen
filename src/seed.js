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
    // Map the spreadsheet columns (example provided by user). Build a stable
    // product name from ID + TIPO_PRENDA + TALLA + COLOR so we can upsert by name.
    products = data.map((r) => {
      const idRaw = String(r.ID || r.Id || r.id || '').trim();
      const idNum = idRaw ? parseInt(idRaw, 10) : NaN;
      const tipo = String(r.TIPO_PRENDA || r.Tipo || r.tipo || r['TIPO_PRENDA'] || '').trim();
      const talla = String(r.TALLA || r.Talla || r.talla || '').trim();
      const color = String(r.COLOR || r.Color || r.color || '').trim();
      const cantidad = parseInt(r.CANTIDAD_DISPONIBLE || r.Cantidad || r.cantidad || r.CANTIDAD || 0, 10) || 0;
      const precio50 = parseFloat(r.PRECIO_50_U || r.PRECIO || r.Precio || r.precio || 0) || 0;
      const disponible = String(r.DISPONIBLE || r.Disponible || r.disponible || '').toLowerCase();
      const categoria = String(r['CATEGORÍA'] || r.CATEGORIA || r.Categoria || r.categoria || '').trim();
      const descripcion = String(r.DESCRIPCIÓN || r.DESCRIPCION || r.Descripcion || r.descripcion || r.DESCRIPTION || r.Description || r.description || '').trim();

      // Build human-friendly name: "Pantalón - XXL - Verde" (keep ID in description)
      const paddedId = idRaw || (Number.isFinite(idNum) ? String(idNum).padStart(3, '0') : '');
      const nameParts = [];
      if (tipo) nameParts.push(tipo);
      if (talla) nameParts.push(talla);
      if (color) nameParts.push(color);
      const name = nameParts.join(' - ') || `product-${Math.random().toString(36).slice(2, 8)}`;

      const descParts = [];
      if (descripcion) descParts.push(descripcion);
      if (categoria) descParts.push(`Categoria: ${categoria}`);
      if (paddedId) descParts.push(`ID: ${paddedId}`);

      return {
        name,
        description: descParts.join(' | '),
        price: precio50 || parseFloat(r.PRECIO_100_U || r.PRECIO_200_U || 0) || 0,
        stock: Math.max(1, cantidad || 1),
        externalId: paddedId || null,
      };
    });
  } else {
    console.error('products.xlsx not found in project root. Aborting seed to avoid using embedded sample data.');
    process.exit(1);
  }

  // mapped rows prepared from spreadsheet

  // Upsert products by case-insensitive name to make seed idempotent and
  // avoid deleting carts/cart_items. This preserves carts created in development
  // while updating product data from the spreadsheet.
  // Note: avoid deleting rows that may be referenced by CartItems (foreign key constraints),
  // instead rely on upsert/update behavior above. If you need hard cleanup, run a migration
  // or a manual script when safe.

  let created = 0;
  let updated = 0;

  // First, try to fill existing placeholder products (those with empty name or price 0)
  // This preserves existing ids and any FK relations (CartItems) that may point to them.
  const placeholders = await prisma.product.findMany({ where: { OR: [{ name: '' }, { price: 0 }] }, orderBy: { id: 'asc' } });
  // We'll assign spreadsheet rows to placeholders in order until we exhaust placeholders
  for (let i = 0; i < Math.min(placeholders.length, products.length); i++) {
    const dbp = placeholders[i];
    const p = products[i];
    try {
      await prisma.product.update({ where: { id: dbp.id }, data: { name: p.name, description: p.description, price: p.price, stock: Math.max(1, p.stock), externalId: p.externalId } });
      updated++;
      // mark this product as consumed by setting a sentinel so later upsert doesn't create duplicate
      p._consumedByPlaceholder = true;
    } catch (e) {
      console.warn('Could not update placeholder product id=' + dbp.id + ':', e && e.message ? e.message : e);
    }
  }

  // Now handle remaining rows: update existing (by name) or create new entries
  for (const p of products) {
    if (p._consumedByPlaceholder) continue;
    const name = (p.name || '').trim();
    if (!name) {
      console.log('Skipping product with empty generated name (row ignored)');
      continue;
    }
    // try to find by externalId first
    let existing = null;
    if (p.externalId) existing = await prisma.product.findFirst({ where: { externalId: p.externalId } });
    if (!existing) existing = await prisma.product.findFirst({ where: { name: { equals: name, mode: 'insensitive' } } });
    if (existing) {
      await prisma.product.update({ where: { id: existing.id }, data: { name: p.name, description: p.description, price: p.price, stock: Math.max(1, p.stock), externalId: p.externalId } });
      updated++;
    } else {
      await prisma.product.create({ data: { ...p, stock: Math.max(1, p.stock) } });
      created++;
    }
  }

  console.log('Seed finished. Total rows in spreadsheet:', products.length, 'created:', created, 'updated:', updated);

  // seed complete
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
