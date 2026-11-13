/* ==========================================================================
   NEXUS TECH — Serviço de produtos
   Orquestra validação → repositório → montagem da resposta padronizada
   (data + meta) no contrato da Fase 4.
   ========================================================================== */

const productsRepository = require("../repositories/products.repository");
const { parseProductQuery } = require("../validation/validateQuery");
const { HttpError } = require("../utils/http");

/* Lista paginada do catálogo com busca/filtros/ordenação/paginação. */
async function listProducts(rawQuery) {
  const options = parseProductQuery(rawQuery);

  const { rows, total } = await productsRepository.listProducts(options);

  const totalPages = Math.max(
    options.perPage > 0 ? Math.ceil(total / options.perPage) : 0,
    total > 0 ? 1 : 0
  );
  // página válida já garantida pela validação (>=1); clamp a totalPages
  const safePage = Math.min(options.page, Math.max(1, totalPages));
  const from = total === 0 ? 0 : (safePage - 1) * options.perPage + 1;
  const to = Math.min(safePage * options.perPage, total);

  const meta = {
    page: safePage,
    per_page: options.perPage,
    total,
    total_pages: totalPages,
    from,
    to,
    has_prev: safePage > 1 && totalPages > 1,
    has_next: safePage < totalPages,
  };

  return { data: rows, meta };
}

/* Produto por id — 404 se não existir. */
async function getProductById(id) {
  const productId = Number(id);
  if (!Number.isInteger(productId) || productId <= 0) {
    throw new HttpError(400, "id de produto inválido");
  }
  const product = await productsRepository.findProductById(productId);
  if (!product) {
    throw new HttpError(404, "Produto não encontrado");
  }
  return { data: product };
}

/* Produto por slug — 404 se não existir. */
async function getProductBySlug(slug) {
  if (typeof slug !== "string" || slug.trim() === "") {
    throw new HttpError(400, "slug de produto inválido");
  }
  const product = await productsRepository.findProductBySlug(slug.trim());
  if (!product) {
    throw new HttpError(404, "Produto não encontrado");
  }
  return { data: product };
}

async function listCategories() {
  const data = await productsRepository.listCategories();
  return { data };
}

async function listBrands() {
  const data = await productsRepository.listBrands();
  return { data };
}

module.exports = {
  listProducts,
  getProductById,
  getProductBySlug,
  listCategories,
  listBrands,
};
