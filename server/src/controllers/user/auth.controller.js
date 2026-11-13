/* ==========================================================================
   NEXUS TECH — Controller de autenticação de usuário (camada fina)
   Recebe requisição, chama o serviço e devolve resposta padronizada {data}.
   Configuração/remoção do cookie de refresh fica aqui (transporte).
   Nenhuma senha/hash aparece nas respostas (user é sempre safeUser).
   ========================================================================== */

const authService = require("../../services/user/auth.service");
const { ok } = require("../../utils/http");
const {
  USER_REFRESH_COOKIE_NAME,
  USER_REFRESH_COOKIE_PATH,
  refreshCookieOptions,
  getCookie,
} = require("../../utils/tokens");

function userCookieOptions() {
  return refreshCookieOptions({ path: USER_REFRESH_COOKIE_PATH });
}

async function register(req, res, next) {
  try {
    const result = await authService.register(req.body);
    return ok(res, result, null, 201);
  } catch (err) {
    return next(err);
  }
}

async function login(req, res, next) {
  try {
    const result = await authService.login({
      email: req.body && req.body.email,
      password: req.body && req.body.password,
    });
    res.cookie(USER_REFRESH_COOKIE_NAME, result.refreshToken, userCookieOptions());
    return ok(res, { user: result.user, accessToken: result.accessToken });
  } catch (err) {
    return next(err);
  }
}

async function refresh(req, res, next) {
  try {
    const refreshToken = getCookie(req, USER_REFRESH_COOKIE_NAME);
    const result = await authService.refresh({ refreshToken });
    res.cookie(USER_REFRESH_COOKIE_NAME, result.refreshToken, userCookieOptions());
    return ok(res, { accessToken: result.accessToken });
  } catch (err) {
    return next(err);
  }
}

async function logout(req, res, next) {
  try {
    const refreshToken = getCookie(req, USER_REFRESH_COOKIE_NAME);
    await authService.logout({ refreshToken });
    res.clearCookie(USER_REFRESH_COOKIE_NAME, userCookieOptions());
    return ok(res, { revoked: true });
  } catch (err) {
    return next(err);
  }
}

/* Pega o usuário já autenticado pelo requireUser (safe, sem password_hash). */
function me(req, res) {
  return ok(res, { user: authService.safeUser(req.user) });
}

async function changePassword(req, res, next) {
  try {
    const result = await authService.changePassword({
      userId: Number(req.user.id),
      currentPassword: req.body && req.body.currentPassword,
      newPassword: req.body && req.body.newPassword,
      newPasswordConfirm: req.body && req.body.newPasswordConfirm,
    });
    return ok(res, result);
  } catch (err) {
    return next(err);
  }
}

module.exports = { register, login, refresh, logout, me, changePassword };