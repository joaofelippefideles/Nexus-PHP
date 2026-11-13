/* ==========================================================================
   NEXUS TECH — Utilitários de token (autenticação Admin e Usuário)
   - Access token:  JWT HS256, expiração 30min, claims mínimos { sub, role }.
   - Refresh token: aleatório criptograficamente seguro; persistido somente
     como hash SHA-256; expiração 7 dias, cookie httpOnly + SameSite=Strict
     e Path restrito ao domínio de autenticação usado (admin/usuário).
     Rotação/revogação no lado do serviço.
   Nenhum secret é hardcoded aqui — vêm de variáveis de ambiente.
   ========================================================================== */

const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const ACCESS_TOKEN_TTL = "30m"; // expiração do access token
const REFRESH_TOKEN_TTL_DAYS = 7; // expiração do refresh token
const ACCESS_TOKEN_TTL_SECONDS = 30 * 60;

const REFRESH_COOKIE_NAME = "nt_admin_refresh";
const REFRESH_COOKIE_PATH = "/api/admin/auth";

const USER_REFRESH_COOKIE_NAME = "nt_user_refresh";
const USER_REFRESH_COOKIE_PATH = "/api/auth";

/* Lê um secret obrigatório do ambiente. Lança se ausente/vazio. */
function requireSecret(name) {
  const value = process.env[name];
  if (!value || String(value).trim() === "") {
    throw new Error(`Variável de ambiente obrigatória ausente ou vazia: ${name}`);
  }
  return String(value).trim();
}

/* Assina o access token (claims mínimos: sub + role). */
function signAccessToken(user) {
  const payload = { sub: String(user.id), role: user.role };
  return jwt.sign(payload, requireSecret("ADMIN_JWT_SECRET"), {
    algorithm: "HS256",
    expiresIn: ACCESS_TOKEN_TTL,
  });
}

/* Verifica e decodifica o access token. Lança jwt.JsonWebTokenError se inválido. */
function verifyAccessToken(token) {
  return jwt.verify(token, requireSecret("ADMIN_JWT_SECRET"), {
    algorithms: ["HS256"],
  });
}

/* Refresh token cru, aleatório e criptograficamente seguro. */
function generateRefreshToken() {
  return crypto.randomBytes(48).toString("hex");
}

/* Hash SHA-256 do refresh token — único formato persistido no banco. */
function hashRefreshToken(raw) {
  return crypto.createHash("sha256").update(String(raw)).digest("hex");
}

/* Data de expiração do refresh token (7 dias a partir de agora). */
function refreshTokenExpiresAt() {
  return new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
}

/* Atributos do cookie de refresh (dev local http -> secure: false).
   aceita override de name/path p/ distinguir admin (/api/admin/auth)
   de usuário (/api/auth). */
function refreshCookieOptions(overrides = {}) {
  return {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production", // TLS em produção
    path: overrides.path || REFRESH_COOKIE_PATH,
    maxAge: REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
  };
}

/* Lê um cookie do header sem dependência de cookie-parser. */
function getCookie(req, name) {
  const header = req.headers.cookie || "";
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === name) {
      return decodeURIComponent(part.slice(idx + 1).trim());
    }
  }
  return null;
}

module.exports = {
  ACCESS_TOKEN_TTL,
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_DAYS,
  REFRESH_COOKIE_NAME,
  REFRESH_COOKIE_PATH,
  USER_REFRESH_COOKIE_NAME,
  USER_REFRESH_COOKIE_PATH,
  requireSecret,
  signAccessToken,
  verifyAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  refreshTokenExpiresAt,
  refreshCookieOptions,
  getCookie,
};