/* ==========================================================================
   NEXUS TECH — Rotas de autenticação de usuário (montadas em /api/auth)
   - register ........ POST (cadastro real com hash bcrypt no backend)
   - login ............ POST (com loginLimiter por IP+email)
   - refresh ......... POST  (rotação; lê cookie httpOnly)
   - logout .......... POST  (revoga refresh e limpa cookie)
   - me ............... GET   (exige access token válido -> requireUser)
   - change-password .. POST  (exige access token válido -> requireUser)
   - profile .......... GET/PATCH (perfil real: phone/cpf; requireUser)
   O storefront (mock) não foi religado a estes endpoints, preservando
   todas as páginas existentes.
   ========================================================================== */

const { Router } = require("express");
const authController = require("../../controllers/user/auth.controller");
const profileController = require("../../controllers/user/profile.controller");
const { requireUser } = require("../../middlewares/requireUser");
const { loginLimiter } = require("../../middlewares/rateLimit");

const router = Router();

router.post("/register", authController.register);
router.post("/login", loginLimiter, authController.login);
router.post("/refresh", authController.refresh);
router.post("/logout", authController.logout);
router.get("/me", requireUser, authController.me);
router.post("/change-password", requireUser, authController.changePassword);
router.get("/profile", requireUser, profileController.getProfile);
router.patch("/profile", requireUser, profileController.updateProfile);

module.exports = router;