/* ==========================================================================
   NEXUS TECH — Validação dos parâmetros de query de /api/products
   Coage tipos, valida enums e define valores padrão. Nenhum valor do
   usuário entra direto no SQL: aqui apenas validação/interpretação.
   ========================================================================== */

const { HttpError } = require("../utils/http");

const DEFAULT_PER_PAGE = 8;
const MAX_PER_PAGE = 100;

const AVAILABILITY = new Set(["all", "in", "out"]);
const SORT_KEYS = new Set([
  "relevance",
  "price-asc",
  "price-desc",
  "rating-desc",
  "newest",
]);

/* Converte um valor para inteiro positivo, ou retorna `fallback`.
   Retorna null se o valor for inválido (fora da faixa permitida). */
function parseIntClamped(value, fallback, min, max, name, reqRes = null) {
  if (value === undefined || value === null || value === "") return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || (max !== null && n > max)) {
    throw new HttpError(400, `Parâmetro '${name}' inválido`);
  }
  return n;
}

/* Interpreta e valida os query params, produzindo um objeto "options"
   seguro para o serviço/repositório consumir. */
function parseProductQuery(query) {
  const q = typeof query.q === "string" ? query.q.trim() : "";

  // category pode vir repetida (?category=a&category=b) -> array, ou única
  let categories = [];
  if (query.category !== undefined && query.category !== "") {
    categories = Array.isArray(query.category)
      ? query.category
      : [query.category];
    categories = categories
      .map((c) => (typeof c === "string" ? c.trim() : ""))
      .filter(Boolean);
    if (categories.length === 0) {
      throw new HttpError(400, "Parâmetro 'category' inválido");
    }
  }

  let minPrice = null;
  let maxPrice = null;
  if (query.min_price !== undefined && query.min_price !== "") {
    const n = Number(query.min_price);
    if (!Number.isInteger(n) || n < 0) {
      throw new HttpError(400, "Parâmetro 'min_price' inválido (use centavos inteiros)");
    }
    minPrice = n;
  }
  if (query.max_price !== undefined && query.max_price !== "") {
    const n = Number(query.max_price);
    if (!Number.isInteger(n) || n < 0) {
      throw new HttpError(400, "Parâmetro 'max_price' inválido (use centavos inteiros)");
    }
    maxPrice = n;
  }
  if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) {
    throw new HttpError(400, "min_price deve ser menor ou igual a max_price");
  }

  const availability = query.availability !== undefined && query.availability !== ""
    ? query.availability
    : "all";
  if (!AVAILABILITY.has(availability)) {
    throw new HttpError(400, "Parâmetro 'availability' inválido (use all, in ou out)");
  }

  const sort = query.sort !== undefined && query.sort !== "" ? query.sort : "relevance";
  if (!SORT_KEYS.has(sort)) {
    throw new HttpError(
      400,
      "Parâmetro 'sort' inválido (use relevance, price-asc, price-desc, rating-desc ou newest)"
    );
  }

  const page = parseIntClamped(query.page, 1, 1, null, "page");
  const perPage = parseIntClamped(query.per_page, DEFAULT_PER_PAGE, 1, MAX_PER_PAGE, "per_page");

  return {
    q,
    categories,
    minPrice,
    maxPrice,
    availability,
    sort,
    page,
    perPage,
  };
}

module.exports = {
  parseProductQuery,
  DEFAULT_PER_PAGE,
  MAX_PER_PAGE,
};
