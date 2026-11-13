/* ==========================================================================
   NEXUS TECH — Controller do perfil de usuário (camada fina)
   Só encaminha para o serviço; requireUser já garantiu autenticação e o
   id usado é SEMPRE o do token (req.user.id) — nunca vem do body/rota.
   ========================================================================== */

const profileService = require("../../services/user/profile.service");
const { ok } = require("../../utils/http");

async function getProfile(req, res, next) {
  try {
    const result = await profileService.getProfile(Number(req.user.id));
    return ok(res, result.data);
  } catch (err) {
    return next(err);
  }
}

async function updateProfile(req, res, next) {
  try {
    const result = await profileService.updateProfile(
      Number(req.user.id),
      req.body,
      { ip: req.ip || null }
    );
    return ok(res, result.data);
  } catch (err) {
    return next(err);
  }
}

module.exports = { getProfile, updateProfile };