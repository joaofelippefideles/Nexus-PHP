/* ==========================================================================
   NEXUS TECH — Repositório do perfil de usuário (user_profile)
   SQL 100% parametrizado (padrão do projeto). READS via pool; MUTATIONS
   recebem conn (transação), mesmo padrão de brands/categories.
   Nenhum dado sensível (senha/hash/token) transita aqui.
   ========================================================================== */

const { pool } = require("../../config/db");

const SAFE_COLUMNS = "user_id, phone, cpf, created_at, updated_at";

async function findProfileById(userId, conn = null) {
  const run = conn || pool;
  const [rows] = await run.query(
    `SELECT ${SAFE_COLUMNS} FROM user_profile WHERE user_id = ? LIMIT 1`,
    [userId]
  );
  return rows[0] || null;
}

/* MUTATION (conn obrigatória): cria o perfil de um usuário. */
async function insert(conn, userId, { phone, cpf }) {
  const [result] = await conn.query(
    "INSERT INTO user_profile (user_id, phone, cpf) VALUES (?, ?, ?)",
    [userId, phone || null, cpf || null]
  );
  return result.affectedRows > 0;
}

/* MUTATION (conn obrigatória): atualiza SOMENTE os campos informados. */
async function update(conn, userId, fields) {
  const sets = [];
  const params = [];
  for (const key of Object.keys(fields)) {
    sets.push(`${key} = ?`);
    params.push(fields[key] === undefined ? null : fields[key]);
  }
  if (sets.length === 0) return false;
  params.push(userId);
  const [result] = await conn.query(
    `UPDATE user_profile SET ${sets.join(", ")} WHERE user_id = ?`,
    params
  );
  return result.affectedRows > 0;
}

module.exports = { findProfileById, insert, update };