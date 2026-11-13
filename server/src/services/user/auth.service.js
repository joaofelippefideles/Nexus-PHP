/* ==========================================================================
   NEXUS TECH — Serviço de autenticação de usuário (customer/admin)
   Orquestra: cadastro/login/alteração de senha -> bcrypt -> tokens.
   - Cadastro GERA o hash bcrypt (custo 12); apenas password_hash é persistido;
   - login via bcrypt.compare com mensagem genérica (não revela o e-mail);
   - alteração de senha exige confirmação da senha atual (bcrypt.compare) e
     gera um NOVO hash;
   - access 30min / refresh 7d em cookie httpOnly (apenas hash SHA-256 no banco);
   - refresh com rotação (revoga o anterior); logout revoga o token.
   ========================================================================== */

const bcrypt = require("bcryptjs");
const { HttpError } = require("../../utils/http");
const { pool } = require("../../config/db");
const validateAuth = require("../../validation/validateAuth");
const usersRepository = require("../../repositories/admin/users.repository");
const profileRepository = require("../../repositories/user/profile.repository");
const refreshTokensRepository = require("../../repositories/admin/refresh-tokens.repository");
const {
  signAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  refreshTokenExpiresAt,
} = require("../../utils/tokens");

const BCRYPT_COST = 12;
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

/* Cadastro em UMA transação: linha em users + linha em user_profile quando
   phone/cpf vierem. ER_DUP_ENTRY é desambiguado: uq_users_email -> 409 de
   e-mail; uq_user_profile_cpf -> 409 de CPF. Só o hash bcrypt é persistido. */
async function register(input) {
  const data = validateAuth.parseRegisterInput(input);
  const passwordHash = await bcrypt.hash(data.password, BCRYPT_COST);

  const conn = await pool.getConnection();
  let id;
  try {
    await conn.beginTransaction();
    id = await usersRepository.createCustomer(
      { name: data.name, email: data.email, passwordHash },
      conn
    );
    if (data.phone !== undefined || data.cpf !== undefined) {
      await profileRepository.insert(conn, id, {
        phone: data.phone ?? null,
        cpf: data.cpf ?? null,
      });
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback().catch(() => {});
    if (err && err.code === "ER_DUP_ENTRY") {
      if (/user_profile|uq_user_profile_cpf/i.test(String(err.sqlMessage || ""))) {
        throw new HttpError(409, "CPF já cadastrado para outro usuário.");
      }
      throw new HttpError(409, "E-mail já cadastrado.");
    }
    throw err;
  } finally {
    conn.release();
  }

  const user = await usersRepository.findSafeById(id);
  return { user: safeUser(user) };
}

async function login({ email, password }) {
  const data = validateAuth.parseLoginInput({ email, password });

  const user = await usersRepository.findByEmail(data.email);
  if (!user) throw new HttpError(401, GENERIC_LOGIN_ERROR);

  const passwordOk = await bcrypt.compare(data.password, user.password_hash);
  if (!passwordOk) throw new HttpError(401, GENERIC_LOGIN_ERROR);

  // Restrições de status com a MESMA mensagem genérica.
  if (user.is_active !== 1) throw new HttpError(401, GENERIC_LOGIN_ERROR);

  const accessToken = signAccessToken(user);
  const refreshToken = generateRefreshToken();
  await refreshTokensRepository.create({
    userId: user.id,
    tokenHash: hashRefreshToken(refreshToken),
    expiresAt: refreshTokenExpiresAt(),
  });

  return { user: safeUser(user), accessToken, refreshToken };
}

async function refresh({ refreshToken: raw }) {
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
  if (user.is_active !== 1) throw new HttpError(403, "Acesso negado");

  // ROTAÇÃO: o token apresentado perde validade; emite-se um novo par.
  await refreshTokensRepository.revoke(stored.id);

  const nextRefresh = generateRefreshToken();
  await refreshTokensRepository.create({
    userId: user.id,
    tokenHash: hashRefreshToken(nextRefresh),
    expiresAt: refreshTokenExpiresAt(),
  });

  return { accessToken: signAccessToken(user), refreshToken: nextRefresh };
}

async function logout({ refreshToken: raw }) {
  if (typeof raw === "string" && raw.length > 0) {
    const tokenHash = hashRefreshToken(raw);
    const stored = await refreshTokensRepository.findByTokenHash(tokenHash);
    if (stored && !stored.revoked_at) {
      await refreshTokensRepository.revoke(stored.id);
    }
  }
  return { revoked: true };
}

/* Alterar senha: exige a senha atual, confere (bcrypt.compare) e gera novo hash. */
async function changePassword({ userId, currentPassword, newPassword, newPasswordConfirm }) {
  const data = validateAuth.parseChangePasswordInput({
    currentPassword,
    newPassword,
    newPasswordConfirm,
  });

  const stored = await usersRepository.findPasswordHashById(userId);
  if (!stored) throw new HttpError(401, "Usuário não encontrado");

  const passwordOk = await bcrypt.compare(data.currentPassword, stored.password_hash);
  if (!passwordOk) throw new HttpError(403, "Senha atual incorreta.");

  if (await bcrypt.compare(data.newPassword, stored.password_hash)) {
    throw new HttpError(400, "A nova senha deve ser diferente da atual.");
  }

  const passwordHash = await bcrypt.hash(data.newPassword, BCRYPT_COST);
  await usersRepository.updatePassword({ id: userId, passwordHash });
  return { updated: true };
}

module.exports = { register, login, refresh, logout, changePassword, safeUser };