/* ==========================================================================
   NEXUS TECH — Controller admin de marcas (v3.0-X3 — camada fina)
   Recebe a requisição, chama o serviço e devolve a resposta padrão {data}.
   ========================================================================== */

const brandsService = require("../../services/admin/brands.service");
const { ok } = require("../../utils/http");

function contextFrom(req) {
  return { admin: req.admin, ip: req.ip };
}

async function list(req, res, next) {
  try {
    const result = await brandsService.list();
    return ok(res, result.data);
  } catch (err) {
    return next(err);
  }
}

async function getById(req, res, next) {
  try {
    const result = await brandsService.getById(req.params.id);
    return ok(res, result.data);
  } catch (err) {
    return next(err);
  }
}

async function create(req, res, next) {
  try {
    const result = await brandsService.create(req.body, contextFrom(req));
    return ok(res, result.data, null, result.status || 201);
  } catch (err) {
    return next(err);
  }
}

async function update(req, res, next) {
  try {
    const result = await brandsService.update(req.params.id, req.body, contextFrom(req));
    return ok(res, result.data);
  } catch (err) {
    return next(err);
  }
}

async function remove(req, res, next) {
  try {
    const result = await brandsService.remove(req.params.id, contextFrom(req));
    return ok(res, result.data);
  } catch (err) {
    return next(err);
  }
}

module.exports = { list, getById, create, update, remove };