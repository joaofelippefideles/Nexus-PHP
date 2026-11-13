/* ==========================================================================
   NEXUS TECH — Controller admin de produtos (v3.0-X2 — camada fina)
   Recebe a requisição, chama o serviço e devolve a resposta padrão {data}.
   Nenhuma regra de negócio aqui.
   ========================================================================== */

const productsService = require("../../services/admin/products.service");
const { ok } = require("../../utils/http");

function contextFrom(req) {
  return { admin: req.admin, ip: req.ip };
}

async function list(req, res, next) {
  try {
    const result = await productsService.list(req.query);
    return ok(res, result.data, result.meta);
  } catch (err) {
    return next(err);
  }
}

async function getById(req, res, next) {
  try {
    const result = await productsService.getById(req.params.id);
    return ok(res, result.data);
  } catch (err) {
    return next(err);
  }
}

async function create(req, res, next) {
  try {
    const result = await productsService.create(req.body, contextFrom(req));
    return ok(res, result.data, null, result.status || 201);
  } catch (err) {
    return next(err);
  }
}

async function update(req, res, next) {
  try {
    const result = await productsService.update(req.params.id, req.body, contextFrom(req));
    return ok(res, result.data);
  } catch (err) {
    return next(err);
  }
}

async function remove(req, res, next) {
  try {
    const result = await productsService.remove(req.params.id, contextFrom(req));
    return ok(res, result.data);
  } catch (err) {
    return next(err);
  }
}

async function activate(req, res, next) {
  try {
    const result = await productsService.activate(req.params.id, contextFrom(req));
    return ok(res, result.data);
  } catch (err) {
    return next(err);
  }
}

async function deactivate(req, res, next) {
  try {
    const result = await productsService.deactivate(req.params.id, contextFrom(req));
    return ok(res, result.data);
  } catch (err) {
    return next(err);
  }
}

async function brands(req, res, next) {
  try {
    const result = await productsService.listBrands();
    return ok(res, result.data);
  } catch (err) {
    return next(err);
  }
}

async function categories(req, res, next) {
  try {
    const result = await productsService.listCategories();
    return ok(res, result.data);
  } catch (err) {
    return next(err);
  }
}

module.exports = { list, getById, create, update, remove, activate, deactivate, brands, categories };