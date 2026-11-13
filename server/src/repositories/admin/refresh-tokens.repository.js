/* ==========================================================================
   NEXUS TECH — Repositório de refresh tokens (Admin)
   Apenas o hash SHA-256 do token é persistido; o token cru nunca vai ao banco.
   ========================================================================== */

const { pool } = require("../../config/db");

async function create({ userId, tokenHash, expiresAt }) {
  const [result] = await pool.query(
    "INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)",
    [userId, tokenHash, expiresAt]
  );
  return result.insertId;
}

async function findByTokenHash(tokenHash) {
  const [rows] = await pool.query(
    "SELECT id, user_id, token_hash, expires_at, revoked_at FROM refresh_tokens WHERE token_hash = ? LIMIT 1",
    [tokenHash]
  );
  return rows[0] || null;
}

/* Marca como revogado (rotinas de rotação e logout). Idempotente. */
async function revoke(id) {
  const [result] = await pool.query(
    "UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE id = ? AND revoked_at IS NULL",
    [id]
  );
  return result.affectedRows > 0;
}

module.exports = { create, findByTokenHash, revoke };