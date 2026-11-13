/* ==========================================================================
   NEXUS TECH — Rotas admin de categorias (v3.0-X3)
   Montadas em /api/admin/categories (requireAdmin + adminApiLimiter no app.js).
   - GET    /       listagem com contagem de produtos vinculados
   - GET    /:id    detalhe
   - POST   /       criar categoria
   - PUT    /:id    editar (slug ausente fica intacto)
   - DELETE /:id    hard-delete com 409 quando há produtos vinculados
   ========================================================================== */

const { Router } = require("express");
const categoriesController = require("../../controllers/admin/categories.controller");

const router = Router();

router.get("/", categoriesController.list);
router.get("/:id", categoriesController.getById);
router.post("/", categoriesController.create);
router.put("/:id", categoriesController.update);
router.delete("/:id", categoriesController.remove);

module.exports = router;