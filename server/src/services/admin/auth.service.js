/* ==========================================================================
   NEXUS TECH — Serviço de autenticação Admin
   Orquestra: usuário -> bcrypt -> tokens -> repositórios -> auditoria.
   - Mensagens de login GENÉRICAS (nunca revelam se o e-mail existe);
   - access token 30min (memória do cliente);
   - refresh 7 dias em cookie httpOnly (apenas hash SHA-256 no banco);
   - refresh com rotação (revoga o anterior) e logout revoga o token.
   ========================================================================== */

const bcrypt = require("bcryptjs");
const { HttpError } = require("../../utils/http");
const usersRepository = require("../../repositories/admin/users.repository");
const refreshTokensRepository = require("../../repositories/admin/refresh-tokens.repository");
const auditService = require("./audit.service");
const {
  signAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  refreshTokenExpiresAt,
} = require("../../utils/tokens");

/* Mensagem única para toda falha de login (sem vazamento de informação). */
const GENERIC_LOGIN_ERROR = "Credenciais inválidas";

/* Usuário seguro para resposta: NUNCA inclui password_hash. */
function safeUser(user) {
  return {
    id: Number(user.id),
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.created_at,
  };
}

async function login({ email, password, ip }) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail || typeof password !== "string" || password.length === 0) {
    throw new HttpError(401, GENERIC_LOGIN_ERROR);
  }

  const user = await usersRepository.findByEmail(normalizedEmail);
  if (!user) throw new HttpError(401, GENERIC_LOGIN_ERROR);

  const passwordOk = await bcrypt.compare(password, user.password_hash);
  if (!passwordOk) throw new HttpError(401, GENERIC_LOGIN_ERROR);

  // Restrições de perfil/status com a MESMA mensagem genérica.
  if (user.role !== "admin") throw new HttpError(401, GENERIC_LOGIN_ERROR);
  if (user.is_active !== 1) throw new HttpError(401, GENERIC_LOGIN_ERROR);

  const accessToken = signAccessToken(user);
  const refreshToken = generateRefreshToken();
  await refreshTokensRepository.create({
    userId: user.id,
    tokenHash: hashRefreshToken(refreshToken),
    expiresAt: refreshTokenExpiresAt(),
  });

  await auditService.log({
    adminId: user.id,
    action: "login",
    entity: "auth",
    entityId: user.id,
    ip,
  });

  return { user: safeUser(user), accessToken, refreshToken };
}

async function refresh({ refreshToken: raw, ip }) {
  if (typeof raw !== "string" || raw.length === 0) {
    throw new HttpError(401, "Sessão inválida ou expirada");
  }

  const tokenHash = hashRefreshToken(raw);
  const stored = await refreshTokensRepository.findByTokenHash(tokenHash);
  if (!stored) throw new HttpError(401, "Sessão inválida ou expirada");
  if (stored.revoked_at) throw new HttpError(401, "Sessão inválida ou expirada");
  if (new Date(stored.expires_at).getTime() < Date.now()) {
    await refreshTokensRepository.revoke(stored.id);
    throw new HttpError(401, "Sessão inválida ou expirada");
  }

  const user = await usersRepository.findSafeById(Number(stored.user_id));
  if (!user) throw new HttpError(401, "Sessão inválida ou expirada");
  if (user.role !== "admin") throw new HttpError(403, "Acesso negado");
  if (user.is_active !== 1) throw new HttpError(403, "Acesso negado");

  // ROTAÇÃO: o token apresentado perde validade; emite-se um novo par.
  await refreshTokensRepository.revoke(stored.id);

  const nextRefresh = generateRefreshToken();
  await refreshTokensRepository.create({
    userId: user.id,
    tokenHash: hashRefreshToken(nextRefresh),
    expiresAt: refreshTokenExpiresAt(),
  });

  await auditService.log({
    adminId: user.id,
    action: "refresh",
    entity: "auth",
    entityId: user.id,
    ip,
  });

  return { accessToken: signAccessToken(user), refreshToken: nextRefresh };
}

async function logout({ refreshToken: raw, ip }) {
  if (typeof raw === "string" && raw.length > 0) {
    const tokenHash = hashRefreshToken(raw);
    const stored = await refreshTokensRepository.findByTokenHash(tokenHash);
    if (stored && !stored.revoked_at) {
      await refreshTokensRepository.revoke(stored.id);
      await auditService.log({
        adminId: Number(stored.user_id),
        action: "logout",
        entity: "auth",
        entityId: stored.user_id,
        ip,
      });
    }
  }
  return { revoked: true };
}

module.exports = { login, refresh, logout, safeUser };