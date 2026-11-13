/* ==========================================================================
   NEXUS TECH — Rota admin de dashboard (v3.0-X3)
   Montada em /api/admin/dashboard (requireAdmin + adminApiLimiter no app.js).
   - GET /  resumo do painel (somente leitura)
   ========================================================================== */

const { Router } = require("express");
const dashboardController = require("../../controllers/admin/dashboard.controller");

const router = Router();

router.get("/", dashboardController.get);

module.exports = router;