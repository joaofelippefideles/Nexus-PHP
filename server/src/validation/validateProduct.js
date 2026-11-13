/* ==========================================================================
   NEXUS TECH — Validação do corpo de produtos (Admin / v3.0-X2)
   Coage tipos, valida limites e rejeita campos desconhecidos/forbidden.
   CREATE: campos obrigatórios + defaults (is_active=1, stock=0).
   UPDATE: somente campos presentes; slug/stock/specs/images ausentes ficam
   intactos (regra de stable-slug). Nenhum valor de usuário vira SQL aqui.
   ========================================================================== */

const { HttpError } = require("../utils/http");

const MAX_NAME = 200;
const MAX_SLUG = 140;
const MAX_DESCRIPTION = 5000;
const MAX_STOCK = 1000000;
const MAX_SPECS = 40;
const MAX_SPEC_LABEL = 120;
const MAX_SPEC_VALUE = 255;
const MAX_IMAGES = 20;
const MAX_URL = 255;
const MAX_ALT = 200;

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const ALLOWED_FIELDS = new Set([
  "name",
  "slug",
  "description",
  "brand_id",
  "category_id",
  "price_cents",
  "old_price_cents",
  "is_featured",
  "is_new",
  "is_bestseller",
  "is_active",
  "stock",
  "specs",
  "images",
]);

const FORBIDDEN_FIELDS = new Set(["rating", "rating_count"]);

function bad(message, details = null) {
  return new HttpError(400, message, details);
}

/* String obrigatória, trim, 1..max. */
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

/* String opcional: null/undefined/vazio -> null. */
function optionalString(value, name, max) {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") {
    throw bad(`Campo '${name}' deve ser uma string`);
  }
  const v = value.trim();
  if (v === "") return null;
  if (v.length > max) {
    throw bad(`Campo '${name}' excede o limite de ${max} caracteres`);
  }
  return v;
}

/* Inteiro (number ou string numérica), dentro de [min, max]. */
function toInt(value, name, min, max = null) {
  let n;
  if (typeof value === "number") {
    n = value;
  } else if (typeof value === "string" && /^[+-]?\d+$/.test(value.trim())) {
    n = Number(value.trim());
  } else {
    throw bad(`Campo '${name}' deve ser um inteiro`);
  }
  if (!Number.isInteger(n)) throw bad(`Campo '${name}' deve ser um inteiro`);
  if (n < min) throw bad(`Campo '${name}' deve ser maior ou igual a ${min}`);
  if (max !== null && n > max) {
    throw bad(`Campo '${name}' deve ser menor ou igual a ${max}`);
  }
  return n;
}

/* Booleano coerçível: true/false/1/0/"1"/"0"/"true"/"false". */
function toBool(value, name) {
  if (value === true || value === 1 || value === "1" || value === "true") return 1;
  if (value === false || value === 0 || value === "0" || value === "false") return 0;
  throw bad(`Campo '${name}' deve ser um booleano`);
}

/* Slug explícito: regex, minúsculas, límite 140. */
function validateSlug(value) {
  if (typeof value !== "string") throw bad("Campo 'slug' deve ser uma string");
  const v = value.trim().toLowerCase();
  if (v === "") throw bad("Campo 'slug' não pode ser vazio");
  if (v.length > MAX_SLUG) {
    throw bad(`Campo 'slug' excede o limite de ${MAX_SLUG} caracteres`);
  }
  if (!SLUG_RE.test(v)) {
    throw bad("Campo 'slug' inválido (use letras minúsculas, números e hífens simples)");
  }
  return v;
}

/* Gera slug a partir do nome: NFKD, sem acentos, espaços->'-', limpeza. */
function slugify(name) {
  const raw = String(name)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
  return raw.slice(0, MAX_SLUG);
}

/* Specs EAV: array <=40, {label 1..120, value 1..255}, labels únicos. */
function parseSpecs(value) {
  if (!Array.isArray(value)) {
    throw bad("Campo 'specs' deve ser um array");
  }
  if (value.length > MAX_SPECS) {
    throw bad(`Campo 'specs' excede o limite de ${MAX_SPECS} itens`);
  }
  const seen = new Set();
  return value.map((item, i) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw bad(`Item 'specs[${i}]' inválido`);
    }
    const label = requireString(item.label, `specs[${i}].label`, MAX_SPEC_LABEL);
    const specValue = requireString(item.value, `specs[${i}].value`, MAX_SPEC_VALUE);
    if (seen.has(label)) {
      throw bad(`Campo 'specs' possui labels duplicados: '${label}'`);
    }
    seen.add(label);
    return { label, value: specValue };
  });
}

/* Imagens: array <=20, {url http(s) 1..255, alt <=200}. */
function parseImages(value) {
  if (!Array.isArray(value)) {
    throw bad("Campo 'images' deve ser um array");
  }
  if (value.length > MAX_IMAGES) {
    throw bad(`Campo 'images' excede o limite de ${MAX_IMAGES} itens`);
  }
  return value.map((item, i) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw bad(`Item 'images[${i}]' inválido`);
    }
    const url = requireString(item.url, `images[${i}].url`, MAX_URL);
    if (!/^https?:\/\//i.test(url)) {
      throw bad(`Item 'images[${i}].url' deve começar com http:// ou https://`);
    }
    let alt = null;
    if (item.alt !== undefined && item.alt !== null) {
      if (typeof item.alt !== "string") {
        throw bad(`Item 'images[${i}].alt' deve ser uma string`);
      }
      alt = item.alt.trim();
      if (alt.length > MAX_ALT) {
        throw bad(`Item 'images[${i}].alt' excede o limite de ${MAX_ALT} caracteres`);
      }
      if (alt === "") alt = null;
    }
    return { url, alt };
  });
}

function assertNoForeignKeys(body) {
  for (const key of Object.keys(body)) {
    if (FORBIDDEN_FIELDS.has(key)) {
      throw bad(`Campo '${key}' não pode ser definido pelo admin`);
    }
    if (!ALLOWED_FIELDS.has(key)) {
      throw bad(`Campo desconhecido: '${key}'`);
    }
  }
}

function checkOldPrice(oldPrice, price) {
  if (oldPrice !== null && oldPrice < price) {
    throw bad("Campo 'old_price_cents' deve ser maior ou igual a 'price_cents'");
  }
}

/* --- CREATE --- */
function parseCreateInput(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw bad("Corpo da requisição inválido");
  }
  assertNoForeignKeys(body);

  const name = requireString(body.name, "name", MAX_NAME);
  const slug = body.slug === undefined ? null : validateSlug(body.slug);
  const description = optionalString(body.description, "description", MAX_DESCRIPTION);
  const brandId = toInt(body.brand_id, "brand_id", 1);
  const categoryId = toInt(body.category_id, "category_id", 1);
  const priceCents = toInt(body.price_cents, "price_cents", 0);
  const oldPriceCents =
    body.old_price_cents === undefined || body.old_price_cents === null
      ? null
      : toInt(body.old_price_cents, "old_price_cents", 0);
  checkOldPrice(oldPriceCents, priceCents);

  return {
    name,
    slug,
    description,
    brand_id: brandId,
    category_id: categoryId,
    price_cents: priceCents,
    old_price_cents: oldPriceCents,
    is_featured: body.is_featured === undefined ? 0 : toBool(body.is_featured, "is_featured"),
    is_new: body.is_new === undefined ? 0 : toBool(body.is_new, "is_new"),
    is_bestseller:
      body.is_bestseller === undefined ? 0 : toBool(body.is_bestseller, "is_bestseller"),
    is_active: body.is_active === undefined ? 1 : toBool(body.is_active, "is_active"),
    stock: body.stock === undefined ? 0 : toInt(body.stock, "stock", 0, MAX_STOCK),
    specs: body.specs === undefined ? [] : parseSpecs(body.specs),
    images: body.images === undefined ? [] : parseImages(body.images),
  };
}

/* --- UPDATE (somente campos presentes) --- */
function parseUpdateInput(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw bad("Corpo da requisição inválido");
  }
  assertNoForeignKeys(body);

  const keys = Object.keys(body);
  const out = {};

  for (const key of keys) {
    const value = body[key];
    switch (key) {
      case "name":
        out.name = requireString(value, key, MAX_NAME);
        break;
      case "slug":
        out.slug = validateSlug(value);
        break;
      case "description":
        out.description = optionalString(value, key, MAX_DESCRIPTION);
        break;
      case "brand_id":
        out.brand_id = toInt(value, key, 1);
        break;
      case "category_id":
        out.category_id = toInt(value, key, 1);
        break;
      case "price_cents":
        out.price_cents = toInt(value, key, 0);
        break;
      case "old_price_cents":
        out.old_price_cents =
          value === undefined || value === null ? null : toInt(value, key, 0);
        break;
      case "is_featured":
      case "is_new":
      case "is_bestseller":
      case "is_active":
        out[key] = toBool(value, key);
        break;
      case "stock":
        out.stock = toInt(value, key, 0, MAX_STOCK);
        break;
      case "specs":
        out.specs = parseSpecs(value);
        break;
      case "images":
        out.images = parseImages(value);
        break;
      // assertNoForeignKeys já barra o restante (rating, rating_count, desconhecidos).
      /* istanbul ignore next */
      default:
        break;
    }
  }

  if (Object.hasOwn(out, "old_price_cents") && Object.hasOwn(out, "price_cents")) {
    checkOldPrice(out.old_price_cents, out.price_cents);
  }
  if (Object.keys(out).length === 0) {
    throw bad("Nenhum campo para atualizar");
  }
  return out;
}

module.exports = {
  parseCreateInput,
  parseUpdateInput,
  slugify,
  MAX_SLUG,
};