/* ==========================================================================
   NEXUS TECH — Validação da query da listagem admin de produtos (v3.0-X2)
   Coage tipos, valida enums (status/sort), define padrões e devolve um objeto
   seguro para o repository (ORDER BY sempre via whitelist; valores via ?).
   ========================================================================== */

const { HttpError } = require("../utils/http");

const DEFAULT_PER_PAGE = 10;
const MAX_PER_PAGE = 100;

const STATUS_KEYS = new Set(["all", "active", "inactive"]);
const SORT_KEYS = new Set([
  "name-asc",
  "name-desc",
  "price-asc",
  "price-desc",
  "newest",
  "updated",
]);

function parseIntClamped(value, fallback, min, max, name) {
  if (value === undefined || value === null || value === "") return fallback;
  let n;
  if (typeof value === "number") n = value;
  else if (typeof value === "string" && /^[+-]?\d+$/.test(value.trim())) n = Number(value.trim());
  else throw new HttpError(400, `Parâmetro '${name}' inválido`);
  if (!Number.isInteger(n) || n < min || (max !== null && n > max)) {
    throw new HttpError(400, `Parâmetro '${name}' inválido`);
  }
  return n;
}

function optionalInt(query, raw, name, min) {
  if (query[raw] === undefined || query[raw] === null || query[raw] === "") return null;
  const n = parseIntClamped(query[raw], null, min, null, name);
  return n;
}

/* Interpreta e valida os query params, produzindo um objeto "options". */
function parseProductQuery(query) {
  const q = typeof query.q === "string" ? query.q.trim() : "";
  if (q.length > 100) {
    throw new HttpError(400, "Parâmetro 'q' excede o limite de 100 caracteres");
  }

  const categoryId = optionalInt(query, "category_id", "category_id", 1);
  const brandId = optionalInt(query, "brand_id", "brand_id", 1);

  const status =
    query.status !== undefined && query.status !== "" ? query.status : "all";
  if (!STATUS_KEYS.has(status)) {
    throw new HttpError(400, "Parâmetro 'status' inválido (use all, active ou inactive)");
  }

  const minPrice =
    query.min_price === undefined || query.min_price === ""
      ? null
      : parseIntClamped(query.min_price, null, 0, null, "min_price");
  const maxPrice =
    query.max_price === undefined || query.max_price === ""
      ? null
      : parseIntClamped(query.max_price, null, 0, null, "max_price");
  if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) {
    throw new HttpError(400, "min_price deve ser menor ou igual a max_price");
  }

  const sort = query.sort !== undefined && query.sort !== "" ? query.sort : "newest";
  if (!SORT_KEYS.has(sort)) {
    throw new HttpError(
      400,
      "Parâmetro 'sort' inválido (use name-asc, name-desc, price-asc, price-desc, newest ou updated)"
    );
  }

  const page = parseIntClamped(query.page, 1, 1, null, "page");
  const perPage = parseIntClamped(query.per_page, DEFAULT_PER_PAGE, 1, MAX_PER_PAGE, "per_page");

  return { q, categoryId, brandId, status, minPrice, maxPrice, sort, page, perPage };
}

module.exports = { parseProductQuery, DEFAULT_PER_PAGE, MAX_PER_PAGE };