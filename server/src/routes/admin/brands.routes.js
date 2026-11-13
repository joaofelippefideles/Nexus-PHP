/* ==========================================================================
   NEXUS TECH — Rotas admin de marcas (v3.0-X3)
   Montadas em /api/admin/brands (requireAdmin + adminApiLimiter no app.js).
   - GET    /       listagem com contagem de produtos vinculados
   - GET    /:id    detalhe
   - POST   /       criar marca
   - PUT    /:id    editar (slug ausente fica intacto)
   - DELETE /:id    hard-delete com 409 quando há produtos vinculados
   ========================================================================== */

const { Router } = require("express");
const brandsController = require("../../controllers/admin/brands.controller");

const router = Router();

router.get("/", brandsController.list);
router.get("/:id", brandsController.getById);
router.post("/", brandsController.create);
router.put("/:id", brandsController.update);
router.delete("/:id", brandsController.remove);

module.exports = router;