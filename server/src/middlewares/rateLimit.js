/* ==========================================================================
   NEXUS TECH — Rate limiting (Admin e Usuário)
   - loginLimiter: 5–10 tentativas / 15 min por IP+email (aplicado em /login);
   - adminApiLimiter: ~120 req/min/IP para as rotas administrativas;
   - userApiLimiter: ~120 req/min/IP para as rotas de autenticação de usuário.
   Rotas públicas do catálogo/health não são limitadas por aqui.
   ========================================================================== */

const { rateLimit, ipKeyGenerator } = require("express-rate-limit");

/* Chave por IP + email normalizado (evita bloquear todos sob um IP).
   O IP passa pelo helper ipKeyGenerator para normalizar IPv6 (subnet /56)
   conforme recomendado pela lib — preserve limits e janelas atuais. */
function loginKeyGenerator(req) {
  const ip = ipKeyGenerator(req.ip || "unknown-ip");
  const rawEmail = req.body && req.body.email ? String(req.body.email) : "";
  const email = rawEmail.trim().toLowerCase().slice(0, 100) || "none";
  return `${ip}|${email}`;
}

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: loginKeyGenerator,
  message: { error: "Muitas tentativas de login. Tente novamente mais tarde." },
  validate: { keyGeneratorIpFallback: true, trustProxy: false, xForwardedForHeader: false },
});

const adminApiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Limite de requisições atingido. Tente novamente mais tarde." },
});

const userApiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Limite de requisições atingido. Tente novamente mais tarde." },
});

module.exports = { loginLimiter, adminApiLimiter, userApiLimiter };