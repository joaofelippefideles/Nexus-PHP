/* ==========================================================================
   NEXUS TECH — Controller de produtos
   Camada fina: recebe requisição, chama o serviço e devolve a resposta.
   Sem lógica de negócio aqui.
   ========================================================================== */

const productsService = require("../services/products.service");
const { ok } = require("../utils/http");

async function list(req, res) {
  const result = await productsService.listProducts(req.query);
  return ok(res, result.data, result.meta);
}

async function getById(req, res) {
  const result = await productsService.getProductById(req.params.id);
  return ok(res, result.data);
}

async function getBySlug(req, res) {
  const result = await productsService.getProductBySlug(req.params.slug);
  return ok(res, result.data);
}

async function categories(req, res) {
  const result = await productsService.listCategories();
  return ok(res, result.data);
}

async function brands(req, res) {
  const result = await productsService.listBrands();
  return ok(res, result.data);
}

module.exports = {
  list,
  getById,
  getBySlug,
  categories,
  brands,
};
