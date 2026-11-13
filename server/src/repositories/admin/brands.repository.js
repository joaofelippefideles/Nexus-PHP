/* ==========================================================================
   NEXUS TECH — Repositório admin de marcas (v3.0-X3)
   READS via pool; MUTATIONS recebem conn (transação).
   ========================================================================== */

const { pool } = require("../../config/db");

/* ---------- READS ---------- */

async function list() {
  const [rows] = await pool.query(
    `SELECT b.id, b.name, b.slug, b.created_at,
            (SELECT COUNT(*) FROM products p WHERE p.brand_id = b.id) AS product_count
     FROM brands b ORDER BY b.name ASC`
  );
  return rows;
}

async function findById(id) {
  const [rows] = await pool.query(
    `SELECT b.id, b.name, b.slug, b.created_at,
            (SELECT COUNT(*) FROM products p WHERE p.brand_id = b.id) AS product_count
     FROM brands b WHERE b.id = ? LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

async function findByIdRaw(id, { conn = null, lock = false } = {}) {
  const run = conn || pool;
  const sql = `SELECT * FROM brands WHERE id = ? LIMIT 1${lock ? " FOR UPDATE" : ""}`;
  const [rows] = await run.query(sql, [id]);
  return rows[0] || null;
}

async function slugExists(slug, excludeId = null, conn = null) {
  const run = conn || pool;
  const params = [slug];
  let sql = "SELECT id FROM brands WHERE slug = ?";
  if (excludeId !== null) {
    sql += " AND id <> ?";
    params.push(excludeId);
  }
  sql += " LIMIT 1";
  const [rows] = await run.query(sql, params);
  return rows.length > 0;
}

async function countProducts(conn, brandId) {
  const [rows] = await conn.query(
    "SELECT COUNT(*) AS total FROM products WHERE brand_id = ?",
    [brandId]
  );
  return Number(rows[0].total);
}

/* ---------- MUTATIONS (conn obrigatória) ---------- */

async function insert(conn, fields) {
  const [result] = await conn.query(
    "INSERT INTO brands (name, slug) VALUES (?, ?)",
    [fields.name, fields.slug]
  );
  return result.insertId;
}

async function update(conn, id, fields) {
  const sets = [];
  const params = [];
  for (const key of Object.keys(fields)) {
    sets.push(`${key} = ?`);
    params.push(fields[key]);
  }
  if (sets.length === 0) return 0;
  params.push(id);
  const [result] = await conn.query(`UPDATE brands SET ${sets.join(", ")} WHERE id = ?`, params);
  return result.affectedRows;
}

async function remove(conn, id) {
  const [result] = await conn.query("DELETE FROM brands WHERE id = ?", [id]);
  return result.affectedRows;
}

module.exports = { list, findById, findByIdRaw, slugExists, countProducts, insert, update, remove };
