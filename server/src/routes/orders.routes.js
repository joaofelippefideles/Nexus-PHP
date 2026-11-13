/* ==========================================================================
   NEXUS TECH — Rotas de pedidos do storefront (montadas em /api/orders)
   Todas as rotas exigem requireUser (só usuários autenticados e ativos).
   O userApiLimiter é aplicado no app.js no momento da montagem (mesmo padrão
   de /api/auth), evitando duplicação de middleware aqui.
   - POST /        -> cria pedido (201) ou devolve replay idempotente (200);
   - GET  /        -> lista SOMENTE os pedidos do usuário autenticado;
   - GET  /:id     -> detalhe de um pedido PRÓPRIO (404 p/ pedido alheio).
   Nenhum endpoint público: quem não passa por requireUser recebe 401/403.
   ========================================================================== */

const { Router } = require("express");

const ordersController = require("../controllers/orders.controller");
const { requireUser } = require("../middlewares/requireUser");

const router = Router();

router.post("/", requireUser, ordersController.create);
router.get("/", requireUser, ordersController.list);
router.get("/:id", requireUser, ordersController.getById);

module.exports = router;