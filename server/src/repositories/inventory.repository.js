/* ==========================================================================
   NEXUS TECH — Repositório de estoque (inventory)
   SQL 100% parametrizado (padrão do projeto). READS via pool; MUTATIONS
   recebem conn (transação), mesmo padrão de brands/categories/products.
   Nenhuma regra de negócio aqui: affectedRows === 0 apenas sinaliza que o
   estoque NÃO foi consumido. A tradução para erro de negócio é do service.
   ========================================================================== */

const { pool } = require("../config/db");

/* READ: quantidade atual de um produto (null se não houver registro). */
async function findQuantityByProductId(productId, conn = null) {
  const run = conn || pool;
  const [rows] = await run.query(
    "SELECT product_id, quantity FROM inventory WHERE product_id = ? LIMIT 1",
    [productId]
  );
  return rows[0] || null;
}

/* MUTATION (conn obrigatória): decremento ATÔMICO e CONDICIONAL de estoque.
   Só decrementa se houver quantidade suficiente. Retorna affectedRows
   (1 = consumido; 0 = sem estoque). NUNCA deixa quantity negativa:
   a guarda `quantity >= ?` impede o UPDATE; e o CHECK da migration 006
   (quantity >= 0) é a última linha de defesa no banco. */
async function decrementStock(conn, productId, quantity) {
  const [result] = await conn.query(
    `UPDATE inventory
        SET quantity = quantity - ?,
            updated_at = CURRENT_TIMESTAMP
      WHERE product_id = ?
        AND quantity >= ?`,
    [quantity, productId, quantity]
  );
  return result.affectedRows;
}

module.exports = { findQuantityByProductId, decrementStock };