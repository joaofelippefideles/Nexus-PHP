/* ==========================================================================
   NEXUS TECH — Controller de autenticação Admin (camada fina)
   Recebe requisição, chama o serviço e devolve resposta padronizada {data}.
   Configuração/remoção do cookie de refresh fica aqui (transporte).
   ========================================================================== */

const authService = require("../../services/admin/auth.service");
const { ok } = require("../../utils/http");
const { REFRESH_COOKIE_NAME, refreshCookieOptions, getCookie } = require("../../utils/tokens");

async function login(req, res, next) {
  try {
    const result = await authService.login({
      email: req.body && req.body.email,
      password: req.body && req.body.password,
      ip: req.ip,
    });
    res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, refreshCookieOptions());
    return ok(res, { user: result.user, accessToken: result.accessToken });
  } catch (err) {
    return next(err);
  }
}

async function refresh(req, res, next) {
  try {
    const refreshToken = getCookie(req, REFRESH_COOKIE_NAME);
    const result = await authService.refresh({ refreshToken, ip: req.ip });
    res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, refreshCookieOptions());
    return ok(res, { accessToken: result.accessToken });
  } catch (err) {
    return next(err);
  }
}

async function logout(req, res, next) {
  try {
    const refreshToken = getCookie(req, REFRESH_COOKIE_NAME);
    await authService.logout({ refreshToken, ip: req.ip });
    res.clearCookie(REFRESH_COOKIE_NAME, refreshCookieOptions());
    return ok(res, { revoked: true });
  } catch (err) {
    return next(err);
  }
}

/* Pega o usuário já autenticado pelo requireAdmin (safe, sem password_hash). */
function me(req, res) {
  return ok(res, req.admin);
}

module.exports = { login, refresh, logout, me };