/* ==========================================================================
   NEXUS TECH — Rotas admin de produtos (v3.0-X2)
   Montadas em /api/admin/products (requireAdmin + adminApiLimiter no app.js).
   - GET    /                 listagem admin (inclui inativos)
   - GET    /:id              detalhe completo
   - POST   /                 criar produto (validação + transação)
   - PUT    /:id              editar (slug apenas se explícito)
   - DELETE /:id              soft-delete (is_active = 0, nunca DELETE físico)
   - PATCH  /:id/activate     reativação
   - PATCH  /:id/deactivate   desativação
   ========================================================================== */

const { Router } = require("express");
const productsController = require("../../controllers/admin/products.controller");

const router = Router();

router.get("/", productsController.list);
router.get("/:id", productsController.getById);
router.post("/", productsController.create);
router.put("/:id", productsController.update);
router.delete("/:id", productsController.remove);
router.patch("/:id/activate", productsController.activate);
router.patch("/:id/deactivate", productsController.deactivate);

module.exports = router;