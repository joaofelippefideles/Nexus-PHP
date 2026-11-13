/* ==========================================================================
   NEXUS TECH — Controller de pedidos do storefront (camada fina)
   Recebe a requisição, valida o payload (validação PURA, sem banco), chama o
   serviço e devolve a resposta padronizada {data}.
   - POST    /api/orders      -> 201 (novo) ou 200 (replay idempotente);
   - GET     /api/orders      -> somente pedidos do usuário autenticado;
   - GET     /api/orders/:id  -> detalhe apenas SE for do próprio usuário
                                 (outro usuário recebe 404).
   O userId usado é SEMPRE req.user.id (requireUser) — nunca vem do body/rota.
   Este arquivo NÃO contém SQL, regra de estoque nem cálculo de preço.
   ========================================================================== */

const ordersService = require("../services/orders.service");
const validateOrder = require("../validation/validateOrder");
const { ok, HttpError } = require("../utils/http");

async function create(req, res, next) {
  try {
    const data = validateOrder.parseCreateInput(req.body);
    const result = await ordersService.createOrder(Number(req.user.id), data);
    return ok(res, result, null, result.created ? 201 : 200);
  } catch (err) {
    return next(err);
  }
}

async function list(req, res, next) {
  try {
    const result = await ordersService.listOrders(Number(req.user.id));
    return ok(res, result);
  } catch (err) {
    return next(err);
  }
}

async function getById(req, res, next) {
  try {
    const raw = String(req.params.id || "");
    if (!/^\d+$/.test(raw)) {
      return next(new HttpError(404, "Pedido não encontrado"));
    }
    const result = await ordersService.getOrder(Number(req.user.id), Number(raw));
    return ok(res, result);
  } catch (err) {
    return next(err);
  }
}

module.exports = { create, list, getById };