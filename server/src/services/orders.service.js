/* ==========================================================================
   NEXUS TECH — Serviço de pedidos do storefront (POST/GET /api/orders)
   Núcleo da FASE 9-C. Recebe userId AUTENTICADO (requireUser) + payload já
   validado e executa, em UMA transação:
     1. SELECT ... FOR UPDATE  -> bloqueia products + inventory envolvidas;
     2. valida existência, is_active e estoque suficiente de TODOS os itens;
     3. IGNORA qualquer preço do cliente — preço vem de products.price_cents;
     4. recalcula subtotal / frete / total / itemCount com a MESMA regra de
        frete do checkout frontend (cart-utils.js);
     5. cria orders + order_items (snapshots de nome/preço) e decrementa o
        estoque na MESMA transação. Uma defesa em duas camadas: FOR UPDATE +
        UPDATE condicional (quantity >= ?). Se affectedRows != 1 => ROLLBACK
        com erro de estoque (nada de pedido/estoque parcial);
     6. COMMIT apenas se TUDO passar; qualquer erro antes => ROLLBACK.

   IDEMPOTÊNCIA — chave (user_id, client_idempotency_key) com UNIQUE no banco:
     - leitura prévia (fast path): replay retorna o pedido existente;
     - corrida real (ER_DUP_ENTRY no INSERT): rollback + reconsulta e retorno
       idempotente do pedido vencedor. NUNCA duplica ordem nem reduz estoque
       mais de uma vez.
   NÃO confunde code duplicado (colisão do gerador -> 409) com idempotência.
   ========================================================================== */

const crypto = require("crypto");

const { pool } = require("../config/db");
const { HttpError } = require("../utils/http");
const validateOrder = require("../validation/validateOrder");
const ordersRepository = require("../repositories/orders.repository");

/* Regras de frete REUTILIZADAS do checkout real (NÃO criar regra diferente):
   assets/js/modules/cart/cart-utils.js. */
const FREE_SHIPPING_MIN_CENTS = 50000; // R$ 500,00
const SHIPPING_CENTS = 2990; // R$ 29,90 (padrão)
const EXPRESS_CENTS = 4990; // R$ 49,90 (expressa)

const DELIVERY_LABELS = {
  standard: "Entrega padrão",
  express: "Entrega expressa",
};

const PAYMENT_LABELS = {
  credit: "Cartão de crédito",
  pix: "PIX",
  boleto: "Boleto bancário",
};

const ORDER_CODE_PREFIX = "NT-";

/* Código amigável único (NT- + 10 hex), respeitando VARCHAR(16). */
function generateOrderCode() {
  return `${ORDER_CODE_PREFIX}${crypto.randomBytes(5).toString("hex").toUpperCase()}`;
}

/* Frete: padrão grátis a partir de R$ 500; expressa é upgrade fixo. */
function shippingCents(deliveryMethod, subtotalCents) {
  if (deliveryMethod === "express") return EXPRESS_CENTS;
  return subtotalCents >= FREE_SHIPPING_MIN_CENTS ? 0 : SHIPPING_CENTS;
}

function toOrder(row) {
  return {
    id: Number(row.id),
    code: row.code,
    status: row.status,
    subtotalCents: Number(row.subtotal_cents),
    shippingCents: Number(row.shipping_cents),
    totalCents: Number(row.total_cents),
    itemCount: Number(row.item_count),
    deliveryMethod: row.delivery_method,
    deliveryLabel: row.delivery_label,
    paymentMethod: row.payment_method,
    paymentLabel: row.payment_label,
    deliveryName: row.delivery_name,
    deliveryEmail: row.delivery_email,
    address: {
      cep: row.cep,
      street: row.street,
      number: row.number,
      complement: row.complement,
      neighborhood: row.neighborhood,
      city: row.city,
      state: row.state,
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toItem(row) {
  return {
    id: Number(row.id),
    orderId: Number(row.order_id),
    productId: Number(row.product_id),
    productName: row.product_name,
    unitPriceCents: Number(row.unit_price_cents),
    quantity: Number(row.quantity),
    totalCents: Number(row.total_cents),
  };
}

function isIdempotencyDup(err) {
  const msg = String((err && err.sqlMessage) || (err && err.message) || "");
  return /user_idempotency|uq_orders_user_idempotency/i.test(msg);
}

/* ------------------------------------------------------------------ POST --- */

async function createOrder(userId, rawPayload) {
  const data = validateOrder.parseCreateInput(rawPayload);

  /* Fast path: chave já usada por este usuário => replay idempotente. */
  const existing = await ordersRepository.findByUserAndIdempotency(userId, data.idempotencyKey);
  if (existing) {
    const items = await ordersRepository.findItemsByOrderId(existing.id);
    return { order: toOrder(existing), items: items.map(toItem), created: false };
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    /* Bloqueia as linhas relevantes: transactions concorrentes sobre o MESMO
       produto serializam aqui (SELECT ... FOR UPDATE + lock no inventory). */
    const productIds = data.items.map((item) => item.productId);
    const products = await ordersRepository.findProductsForUpdate(conn, productIds);
    const byId = new Map(products.map((p) => [Number(p.id), p]));

    const lines = [];
    let subtotalCents = 0;
    let itemCount = 0;

    for (const item of data.items) {
      const product = byId.get(item.productId);
      if (!product) {
        throw new HttpError(400, `Produto não encontrado: ${item.productId}`);
      }
      if (Number(product.is_active) !== 1) {
        throw new HttpError(400, `O produto '${product.name}' está indisponível.`);
      }
      if (Number(product.stock) < item.quantity) {
        throw new HttpError(409, `Estoque insuficiente para '${product.name}'.`);
      }
      lines.push({ ...item, product });
      subtotalCents += Number(product.price_cents) * item.quantity;
      itemCount += item.quantity;
    }

    const shipping = shippingCents(data.deliveryMethod, subtotalCents);
    const totalCents = subtotalCents + shipping;

    const orderId = await ordersRepository.createOrder(conn, {
      code: generateOrderCode(),
      userId,
      status: "processing",
      subtotalCents,
      shippingCents: shipping,
      totalCents,
      itemCount,
      deliveryMethod: data.deliveryMethod,
      deliveryLabel: DELIVERY_LABELS[data.deliveryMethod],
      paymentMethod: data.paymentMethod,
      paymentLabel: PAYMENT_LABELS[data.paymentMethod],
      deliveryName: data.address.name,
      deliveryEmail: data.address.email,
      cep: data.address.cep,
      street: data.address.street,
      number: data.address.number,
      complement: data.address.complement,
      neighborhood: data.address.neighborhood,
      city: data.address.city,
      state: data.address.state,
      clientIdempotencyKey: data.idempotencyKey,
    });

    /* Itens + decremento na MESMA transação. Defesa dupla: o FOR UPDATE já
       garantiu leitura consistente; o UPDATE condicional valida de novo. */
    for (const line of lines) {
      const unitPriceCents = Number(line.product.price_cents);
      await ordersRepository.createOrderItem(conn, {
        orderId,
        productId: line.productId,
        productName: line.product.name,
        unitPriceCents,
        quantity: line.quantity,
        totalCents: unitPriceCents * line.quantity,
      });
      const affected = await ordersRepository.decrementStock(
        conn,
        line.productId,
        line.quantity
      );
      if (affected !== 1) {
        throw new HttpError(409, `Estoque insuficiente para '${line.product.name}'.`);
      }
    }

    await conn.commit();

    const order = await ordersRepository.findOrderByIdAndUser(orderId, userId);
    const items = await ordersRepository.findItemsByOrderId(orderId);
    return { order: toOrder(order), items: items.map(toItem), created: true };
  } catch (err) {
    await conn.rollback().catch(() => {});
    /* Corrida de idempotência: outra requisição idêntica já confirmou.
       Rollback feito; devolve o pedido vencedor como replay (created: false). */
    if (isIdempotencyDup(err)) {
      const replay = await ordersRepository.findByUserAndIdempotency(
        userId,
        data.idempotencyKey
      );
      if (replay) {
        const items = await ordersRepository.findItemsByOrderId(replay.id);
        return { order: toOrder(replay), items: items.map(toItem), created: false };
      }
    }
    throw mapDbError(err);
  } finally {
    conn.release();
  }
}

/* ------------------------------------------------------------------ GET --- */

async function listOrders(userId) {
  const rows = await ordersRepository.findOrdersByUser(userId);
  return { orders: rows.map(toOrder) };
}

/* Detalhe SEMPRE com ownership: id + user_id no WHERE. Pedido de outro
   usuário => null => 404 (nunca vaza dados alheios). */
async function getOrder(userId, orderId) {
  const row = await ordersRepository.findOrderByIdAndUser(orderId, userId);
  if (!row) throw new HttpError(404, "Pedido não encontrado");
  const items = await ordersRepository.findItemsByOrderId(row.id);
  return { order: toOrder(row), items: items.map(toItem) };
}

/* ER_DUP_ENTRY que não seja idempotência: colisão de `code` do gerador. */
function mapDbError(err) {
  if (err instanceof HttpError) return err;
  if (err && err.code === "ER_DUP_ENTRY") {
    const msg = String(err.sqlMessage || err.message || "");
    if (/orders_code|uq_orders_code/i.test(msg)) {
      return new HttpError(409, "Erro ao gerar o código do pedido. Tente novamente.");
    }
  }
  return err;
}

module.exports = { createOrder, listOrders, getOrder };