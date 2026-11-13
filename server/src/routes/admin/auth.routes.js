/* ==========================================================================
   NEXUS TECH — Rotas de autenticação Admin (montadas em /api/admin/auth)
   - login  ......... POST  (com loginLimiter por IP+email)
   - refresh ........ POST  (rotação; lê cookie httpOnly)
   - logout ......... POST  (revoga refresh e limpa cookie)
   - me ............. GET   (exige access token válido -> requireAdmin)
   ========================================================================== */

const { Router } = require("express");
const authController = require("../../controllers/admin/auth.controller");
const { requireAdmin } = require("../../middlewares/requireAdmin");
const { loginLimiter } = require("../../middlewares/rateLimit");

const router = Router();

router.post("/login", loginLimiter, authController.login);
router.post("/refresh", authController.refresh);
router.post("/logout", authController.logout);
router.get("/me", requireAdmin, authController.me);

module.exports = router;