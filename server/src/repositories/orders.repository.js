/* ==========================================================================
   NEXUS TECH — Repositório de pedidos (orders / order_items)
   Camada de acesso ao banco. SQL 100% parametrizado (padrão do projeto).
   READS via pool; MUTATIONS recebem `conn` (transação aberta pelo service).
   Este repositório NÃO contém regra de negócio nem conceitos HTTP:
   não lança HttpError, não decide status, não confia em valor do cliente —
   apenas persiste e consulta o que o service determina.
   A única "decisão" embutida é a integridade: os UNIQUE keys de code e
   (user_id, client_idempotency_key) são do banco; quebrá-los lançará
   ER_DUP_ENTRY que o service tratará (409 em 9-C).
   ========================================================================== */

const { pool } = require("../config/db");
const inventoryRepository = require("./inventory.repository");

/* Colunas base de orders para leitura (sem password/refresh — nunca existem
   aqui; sem campos inventados). */
const ORDER_COLUMNS = `
  id, code, user_id, status,
  subtotal_cents, shipping_cents, total_cents, item_count,
  delivery_method, delivery_label, payment_method, payment_label,
  delivery_name, delivery_email,
  cep, street, number, complement, neighborhood, city, state,
  client_idempotency_key, created_at, updated_at`;

/* MUTATION (conn obrigatória): cria o pedido "pai".
   Recebe data com TODOS os campos já calculados pelo service (preço do
   produto vem de products.price_cents, nunca do cliente). Retorna insertId. */
async function createOrder(conn, data) {
  const [result] = await conn.query(
    `INSERT INTO orders
       (code, user_id, status,
        subtotal_cents, shipping_cents, total_cents, item_count,
        delivery_method, delivery_label, payment_method, payment_label,
        delivery_name, delivery_email,
        cep, street, number, complement, neighborhood, city, state,
        client_idempotency_key)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.code,
      data.userId,
      data.status,
      data.subtotalCents,
      data.shippingCents,
      data.totalCents,
      data.itemCount,
      data.deliveryMethod,
      data.deliveryLabel,
      data.paymentMethod,
      data.paymentLabel,
      data.deliveryName,
      data.deliveryEmail,
      data.cep,
      data.street,
      data.number,
      data.complement ?? null,
      data.neighborhood,
      data.city,
      data.state,
      data.clientIdempotencyKey,
    ]
  );
  return result.insertId;
}

/* MUTATION (conn obrigatória): cria um item do pedido.
   unit_price_cents vem de products.price_cents na data (service decide).
   Retorna insertId. */
async function createOrderItem(conn, data) {
  const [result] = await conn.query(
    `INSERT INTO order_items
       (order_id, product_id, product_name, unit_price_cents, quantity, total_cents)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      data.orderId,
      data.productId,
      data.productName,
      data.unitPriceCents,
      data.quantity,
      data.totalCents,
    ]
  );
  return result.insertId;
}

/* READ: pedidos de UM usuário (ownership obrigatório no WHERE).
   Ordena por criação descrescente. Sem paginação aqui — o service decide. */
async function findOrdersByUser(userId, conn = null) {
  const run = conn || pool;
  const [rows] = await run.query(
    `SELECT ${ORDER_COLUMNS}
       FROM orders
      WHERE user_id = ?
      ORDER BY created_at DESC, id DESC`,
    [userId]
  );
  return rows;
}

/* READ: pedido do usuário por id + user_id. Garante isolamento entre
   usuários — usuário B NUNCA enxerga pedido de A (retorna null). */
async function findOrderByIdAndUser(id, userId, conn = null) {
  const run = conn || pool;
  const [rows] = await run.query(
    `SELECT ${ORDER_COLUMNS}
       FROM orders
      WHERE id = ? AND user_id = ?
      LIMIT 1`,
    [id, userId]
  );
  return rows[0] || null;
}

/* READ (FASE 9-C): pedido de um usuário pela chave de idempotência.
   Usado pelo fast path de replay; o UNIQUE (user_id, client_idempotency_key)
   é a garantia real contra duplicação. Retorna null se nunca houve pedido. */
async function findByUserAndIdempotency(userId, clientIdempotencyKey, conn = null) {
  const run = conn || pool;
  const [rows] = await run.query(
    `SELECT ${ORDER_COLUMNS}
       FROM orders
      WHERE user_id = ? AND client_idempotency_key = ?
      LIMIT 1`,
    [userId, clientIdempotencyKey]
  );
  return rows[0] || null;
}

/* READ: itens de um pedido (para detalhe). */
async function findItemsByOrderId(orderId, conn = null) {
  const run = conn || pool;
  const [rows] = await run.query(
    `SELECT id, order_id, product_id, product_name, unit_price_cents,
            quantity, total_cents, created_at
       FROM order_items
      WHERE order_id = ?
      ORDER BY id ASC`,
    [orderId]
  );
  return rows;
}

/* READ: produtos necessários para montar um pedido (ids recebidos no payload).
   Retorna price_cents e is_active (source of truth do banco) + estoque atual.
   Array vazio se nenhum produto for encontrado. */
async function findProductsForOrder(productIds, conn = null) {
  const run = conn || pool;
  const ids = [...new Set(productIds.map((x) => Number(x)))].filter(
    (x) => Number.isInteger(x) && x > 0
  );
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => "?").join(", ");
  const [rows] = await run.query(
    `SELECT
       p.id, p.name, p.price_cents, p.is_active,
       COALESCE(i.quantity, 0) AS stock
     FROM products p
     LEFT JOIN inventory i ON i.product_id = p.id
     WHERE p.id IN (${placeholders})`,
    ids
  );
  return rows;
}

/* READ COM LOCK (FASE 9-C — conn OBRIGATÓRIA): produtos de um pedido com
   SELECT ... FOR UPDATE. Bloqueia as linhas de products e inventory até o
   COMMIT/ROLLBACK da transação, serializando ordens concorrentes sobre o
   mesmo item (base da defesa em duas camadas contra estoque negativo). */
async function findProductsForUpdate(conn, productIds) {
  const ids = [...new Set(productIds.map((x) => Number(x)))].filter(
    (x) => Number.isInteger(x) && x > 0
  );
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => "?").join(", ");
  const [rows] = await conn.query(
    `SELECT
       p.id, p.name, p.price_cents, p.is_active,
       COALESCE(i.quantity, 0) AS stock
     FROM products p
     LEFT JOIN inventory i ON i.product_id = p.id
     WHERE p.id IN (${placeholders})
       FOR UPDATE`,
    ids
  );
  return rows;
}

/* Re-export do decremento atômico de estoque (inventory).
   Recebe conn obrigatória; retorna affectedRows (1 = consumido, 0 = recusado). */
const decrementStock = inventoryRepository.decrementStock;

module.exports = {
  createOrder,
  createOrderItem,
  findOrdersByUser,
  findOrderByIdAndUser,
  findByUserAndIdempotency,
  findItemsByOrderId,
  findProductsForOrder,
  findProductsForUpdate,
  decrementStock,
};