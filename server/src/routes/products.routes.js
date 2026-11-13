/* ==========================================================================
   NEXUS TECH — Rotas de produtos (montadas em /api/products)
   GET /api/products            → lista paginada com busca/filtros/ordenação
   GET /api/products/:id        → detalhe por id
   GET /api/products/slug/:slug → detalhe por slug
   As rotas /api/categories e /api/brands são montadas no nível raiz (app.js).
   ========================================================================== */

const { Router } = require("express");
const productsController = require("../controllers/products.controller");

const router = Router();

router.get("/", productsController.list);
router.get("/slug/:slug", productsController.getBySlug);
router.get("/:id", productsController.getById);

module.exports = router;
