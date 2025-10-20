# API Specification (EndPoints y Ejemplos)

## Stack recomendado
- Node.js >= 18
- Express
- Prisma ORM
- PostgreSQL

## Endpoints

### GET /products
- Descripción: Lista productos. Filtro opcional `q` para búsqueda por nombre o descripción.
- Query params: `q`, `limit` (default 20), `offset` (default 0)
- Response 200:
```json
{ "products": [ {"id":<id>, "name":"<nombre_producto>", "description":"<descripción>", "price":<precio>, "stock":<stock>} ] }
```
- Error 500:
```json
{ "error": "internal server error" }
```

---

### GET /products/:id
- Response 200:
```json
{ "id": <id>, "name": "<nombre_producto>", "description": "<descripción>", "price": <precio>, "stock": <stock> }
```
- 404:
```json
{ "error": "product not found" }
```

---

### POST /carts
- Body JSON:
```json
{ "items": [ { "product_id": 1, "qty": 2 }, { "product_id": 5, "qty": 1 } ] }
```
- Behavior: valida que cada `product_id` existe y que `qty` <= stock. Si falla, responde 404 con detalle.
- Success 201:
```json
{ "cart_id": <id>,
  "items": [ { "product_id": <id>, "qty": <qty>, "unit_price": <precio> } ],
  "total": <total>
}
```
- 404 example (product missing):
```json
{ "error": "product not found", "product_id": <id> }
```

---

### PATCH /carts/:id
- Body JSON same que POST
- Behavior: Si qty=0 → elimina el item; si qty>0 → actualiza. Recalcula totales.
- 200 success:
```json
{ "cart_id": <id>, "items": [ { "product_id": <id>, "qty": <qty>, "unit_price": <precio> } ], "total": <total> }
```
- 404 cart not found:
```json
{ "error": "cart not found" }
```

---

## Errors y códigos de respuesta
- 200 OK: recurso retornado.
- 201 Created: carrito creado.
- 400 Bad Request: payload inválido.
- 404 Not Found: producto o carrito no encontrado.
- 500 Internal Server Error: fallo inesperado.

## Notas de implementación
- Usar transacción para crear carrito + items para mantener consistencia de stock.
- No se decremente stock al crear carrito (a menos que se decida reservar), pero se valida disponibilidad al crear/editar.
- `.env` variables: DATABASE_URL, PORT, WHATSAPP_TOKEN, LLM_API_KEY

## Ejemplos rápidos (curl)
- Listar productos:
```bash
curl "http://localhost:3000/products?q=<termino_de_busqueda>"
```
- Crear carrito:
```bash
curl -X POST http://localhost:3000/carts -H "Content-Type: application/json" -d '{"items":[{"product_id":<id>,"qty":<qty>}]}'
```
