/* ==========================================================================
   NEXUS TECH — Serviço de auditoria (Admin)
   - log() .............. best-effort (auth X1): falhas NUNCA derrubam a operação.
   - logTransaction() ... ESTRITO (v3.0-X2): deve ser chamado dentro da MESMA
     transação da mutação de produto. Se o INSERT de auditoria falhar, o erro
     PROPAGA para o chamador — que fará ROLLBACK da mutação inteira.
   ========================================================================== */

const auditRepository = require("../../repositories/admin/audit.repository");

/* eslint-disable no-console */
async function log({ adminId, action, entity = "auth", entityId = null, before = null, after = null, ip = null }) {
  try {
    await auditRepository.insert({ adminId, action, entity, entityId, before, after, ip });
  } catch (err) {
    console.error(`[auditoria] falha ao registrar '${action}': ${err.message}`);
  }
}

/* Caminho estrito/transaction-aware: usa a conexão recebida e LANÇA em falha
   (não engole erro). Chamado apenas com `conn` de uma transação aberta. */
async function logTransaction(conn, { adminId, action, entity = "product", entityId = null, before = null, after = null, ip = null }) {
  await auditRepository.insert({ adminId, action, entity, entityId, before, after, ip }, conn);
}

module.exports = { log, logTransaction };