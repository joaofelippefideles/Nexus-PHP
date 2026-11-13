/* ==========================================================================
   NEXUS TECH — Repositório de auditoria (admin_actions)
   Registra quem, o quê, quando e os estados antes/depois de cada ação.
   NUNCA registra senha, hash, token ou refresh token (o chamador controla).

   Suporte a transação (v3.0-X2): o INSERT pode rodar na MESMA conexão/transação
   da mutação de produto (parâmetro `conn`). Quando usado, a falha do INSERT
   propaga — permitindo ROLLBACK da mutação. Sem `conn`, mantém o comportamento
   original X1 (pool / auto-commit).
   ========================================================================== */

const { pool } = require("../../config/db");

const MAX_PAYLOAD = 12000; // proteção contra JSON gigante na coluna

function toJson(value) {
  if (value === null || value === undefined) return null;
  let str = null;
  try {
    str = JSON.stringify(value);
  } catch (err) {
    str = null;
  }
  if (str && str.length > MAX_PAYLOAD) str = str.slice(0, MAX_PAYLOAD);
  return str;
}

async function insert({ adminId, action, entity, entityId = null, before = null, after = null, ip = null }, conn = null) {
  const run = conn || pool;
  const [result] = await run.query(
    `INSERT INTO admin_actions
       (admin_id, action, entity, entity_id, before_data, after_data, ip)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      adminId,
      action,
      entity,
      entityId || null,
      toJson(before),
      toJson(after),
      ip || null,
    ]
  );
  return result.insertId;
}

module.exports = { insert };