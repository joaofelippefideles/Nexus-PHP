/* ==========================================================================
   NEXUS TECH — Validação do corpo de PEDIDOS (POST /api/orders)
   Validação PURA (sem banco, sem rede): coage tipos, valida limites e rejeita
   campos desconhecidos. NENHUM preço enviado pelo cliente é aceito — itens
   carregam apenas `productId` e `quantity`; preço/total são SEMPRE calculados
   no backend a partir do banco (products.price_cents).

   Contrato (alinhado à migration 006):
     items: [{ productId: int>=1, quantity: int>=1 }]  (não-vazio, sem duplicados)
     deliveryMethod: "standard" | "express"
     paymentMethod:  "credit" | "pix" | "boleto"
     address: { name, email, cep, street, number, complement?, neighborhood,
                city, state }
     idempotencyKey: string 1..64
   Limites de tamanho respeitam as colunas VARCHAR da migration 006.
   Lança HttpError(400) — capturado pelo errorHandler central.
   ========================================================================== */

const { HttpError } = require("../utils/http");

const DELIVERY_METHODS = new Set(["standard", "express"]);
const PAYMENT_METHODS = new Set(["credit", "pix", "boleto"]);

const MAX_ITEMS = 50;
const MAX_QUANTITY = 10000;

const MAX_DELIVERY_NAME = 120;
const MAX_EMAIL = 190;
const MAX_CEP = 9;
const MAX_STREET = 120;
const MAX_NUMBER = 20;
const MAX_COMPLEMENT = 120;
const MAX_NEIGHBORHOOD = 120;
const MAX_CITY = 120;
const MAX_STATE = 2;
const MAX_IDEMPOTENCY_KEY = 64;

const TOP_LEVEL_FIELDS = new Set([
  "items",
  "deliveryMethod",
  "paymentMethod",
  "address",
  "idempotencyKey",
]);
const ITEM_FIELDS = new Set(["productId", "quantity"]);
const ADDRESS_FIELDS = new Set([
  "name",
  "email",
  "cep",
  "street",
  "number",
  "complement",
  "neighborhood",
  "city",
  "state",
]);

function bad(message, details = null) {
  return new HttpError(400, message, details);
}

/* String obrigatória: trim, não-vazia, 1..max (mesmo helper de validateProduct). */
function requireString(value, name, max) {
  if (typeof value !== "string") {
    throw bad(`Campo '${name}' deve ser uma string`);
  }
  const v = value.trim();
  if (v === "") throw bad(`Campo '${name}' não pode ser vazio`);
  if (v.length > max) {
    throw bad(`Campo '${name}' excede o limite de ${max} caracteres`);
  }
  return v;
}

/* Inteiro positivo (number ou string numérica inteira). Rejeita 0, negativos,
   decimais e inválidos — mesmo padrão de toInt do validateProduct. */
function toPositiveInt(value, name, max = null) {
  let n;
  if (typeof value === "number") {
    n = value;
  } else if (typeof value === "string" && /^[+-]?\d+$/.test(value.trim())) {
    n = Number(value.trim());
  } else {
    throw bad(`Campo '${name}' deve ser um inteiro`);
  }
  if (!Number.isInteger(n)) throw bad(`Campo '${name}' deve ser um inteiro`);
  if (n < 1) throw bad(`Campo '${name}' deve ser maior ou igual a 1`);
  if (max !== null && n > max) {
    throw bad(`Campo '${name}' deve ser menor ou igual a ${max}`);
  }
  return n;
}

function parseEnum(value, name, allowed) {
  if (typeof value !== "string") {
    throw bad(`Campo '${name}' deve ser uma string`);
  }
  if (!allowed.has(value)) {
    throw bad(`Campo '${name}' inválido`);
  }
  return value;
}

/* Itens: array não-vazio, sem productId duplicado, campos apenas productId/quantity. */
function parseItems(value) {
  if (!Array.isArray(value)) {
    throw bad("Campo 'items' deve ser um array");
  }
  if (value.length === 0) {
    throw bad("Campo 'items' não pode ser vazio");
  }
  if (value.length > MAX_ITEMS) {
    throw bad(`Campo 'items' excede o limite de ${MAX_ITEMS} itens`);
  }

  const seen = new Set();
  return value.map((item, i) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw bad(`Item 'items[${i}]' inválido`);
    }
    for (const key of Object.keys(item)) {
      if (!ITEM_FIELDS.has(key)) {
        throw bad(`Campo desconhecido em 'items[${i}]': '${key}'`);
      }
    }
    const productId = toPositiveInt(item.productId, `items[${i}].productId`);
    const quantity = toPositiveInt(item.quantity, `items[${i}].quantity`, MAX_QUANTITY);
    if (seen.has(productId)) {
      throw bad(`Item duplicado no pedido: 'productId' ${productId}`);
    }
    seen.add(productId);
    return { productId, quantity };
  });
}

/* Endereço: campos essenciais obrigatórios + complement opcional (null vazio). */
function parseAddress(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw bad("Campo 'address' deve ser um objeto");
  }
  for (const key of Object.keys(value)) {
    if (!ADDRESS_FIELDS.has(key)) {
      throw bad(`Campo desconhecido em 'address': '${key}'`);
    }
  }

  const name = requireString(value.name, "address.name", MAX_DELIVERY_NAME);
  const email = requireString(value.email, "address.email", MAX_EMAIL);
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    throw bad("Campo 'address.email' deve ser um e-mail válido");
  }

  const cep = requireString(value.cep, "address.cep", MAX_CEP);
  if (cep.length < 8) {
    throw bad("Campo 'address.cep' deve ter no mínimo 8 caracteres");
  }

  const street = requireString(value.street, "address.street", MAX_STREET);
  const number = requireString(value.number, "address.number", MAX_NUMBER);
  const complement =
    value.complement === undefined || value.complement === null
      ? null
      : requireString(value.complement, "address.complement", MAX_COMPLEMENT);
  const neighborhood = requireString(value.neighborhood, "address.neighborhood", MAX_NEIGHBORHOOD);
  const city = requireString(value.city, "address.city", MAX_CITY);
  const state = requireString(value.state, "address.state", MAX_STATE).toUpperCase();
  if (!/^[A-Z]{2}$/.test(state)) {
    throw bad("Campo 'address.state' inválido (informe a UF, ex.: SP)");
  }

  return { name, email, cep, street, number, complement, neighborhood, city, state };
}

/* Corpo completo: campos permitidos apenas no topo. Retorna payload NORMALIZADO. */
function parseCreateInput(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw bad("Corpo da requisição inválido");
  }
  for (const key of Object.keys(body)) {
    if (!TOP_LEVEL_FIELDS.has(key)) {
      throw bad(`Campo desconhecido: '${key}'`);
    }
  }

  const items = parseItems(body.items);
  const deliveryMethod = parseEnum(body.deliveryMethod, "deliveryMethod", DELIVERY_METHODS);
  const paymentMethod = parseEnum(body.paymentMethod, "paymentMethod", PAYMENT_METHODS);
  const address = parseAddress(body.address);
  const idempotencyKey = requireString(
    body.idempotencyKey,
    "idempotencyKey",
    MAX_IDEMPOTENCY_KEY
  );

  return { items, deliveryMethod, paymentMethod, address, idempotencyKey };
}

module.exports = { parseCreateInput };