/* ==========================================================================
   NEXUS TECH — Repositório admin de dashboard (v3.0-X3)
   Somente queries de leitura para o painel do admin.
   ========================================================================== */

const { pool } = require("../../config/db");

async function countProducts() {
  const [rows] = await pool.query(
    "SELECT COUNT(*) AS total, SUM(is_active = 1) AS active, SUM(is_active = 0) AS inactive FROM products"
  );
  const r = rows[0];
  return { total: Number(r.total), active: Number(r.active), inactive: Number(r.inactive) };
}

async function countBrands() {
  const [rows] = await pool.query("SELECT COUNT(*) AS total FROM brands");
  return Number(rows[0].total);
}

async function countCategories() {
  const [rows] = await pool.query("SELECT COUNT(*) AS total FROM categories");
  return Number(rows[0].total);
}

async function countOutOfStock() {
  const [rows] = await pool.query(
    "SELECT COUNT(*) AS total FROM inventory WHERE quantity = 0"
  );
  return Number(rows[0].total);
}

async function recentAudit(limit = 5) {
  const [rows] = await pool.query(
    `SELECT a.id, a.action, a.entity, a.entity_id, a.ip, a.created_at,
            u.name AS admin_name
     FROM admin_actions a
     LEFT JOIN users u ON u.id = a.admin_id
     ORDER BY a.created_at DESC
     LIMIT ?`,
    [limit]
  );
  return rows;
}

module.exports = { countProducts, countBrands, countCategories, countOutOfStock, recentAudit };
