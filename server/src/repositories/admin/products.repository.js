/* ==========================================================================
   NEXUS TECH — Repositório admin de produtos (v3.0-X2)
   Separação clara:
   - READS .......... via pool (conexão implícita);
   - MUTATIONS ...... recebem `conn` (conexão da transação aberta pelo service).
   Todas as queries usam placeholders (?) — nenhum valor do usuário vira SQL.
   ========================================================================== */

const { pool } = require("../../config/db");

/* Whitelist de ordenação da listagem admin — nada do usuário entra no
   ORDER BY sem passar por aqui. */
const SORT_SQL = {
  "name-asc": ["p.name ASC", "p.id ASC"],
  "name-desc": ["p.name DESC", "p.id ASC"],
  "price-asc": ["p.price_cents ASC", "p.id ASC"],
  "price-desc": ["p.price_cents DESC", "p.id DESC"],
  newest: ["p.created_at DESC", "p.id DESC"],
  updated: ["p.updated_at DESC", "p.id DESC"],
};

/* Colunas editáveis pelo UPDATE products (literais fixas de código). */
const UPDATE_COLUMNS = new Set([
  "slug",
  "name",
  "description",
  "brand_id",
  "category_id",
  "price_cents",
  "old_price_cents",
  "is_featured",
  "is_new",
  "is_bestseller",
  "is_active",
]);

function buildWhere(options) {
  const clauses = [];
  const params = [];

  if (options.q) {
    const like = `%${options.q}%`;
    clauses.push("(p.name LIKE ? OR p.slug LIKE ? OR b.name LIKE ? OR c.name LIKE ?)");
    params.push(like, like, like, like);
  }
  if (options.categoryId !== null) {
    clauses.push("p.category_id = ?");
    params.push(options.categoryId);
  }
  if (options.brandId !== null) {
    clauses.push("p.brand_id = ?");
    params.push(options.brandId);
  }
  if (options.status === "active") clauses.push("p.is_active = 1");
  else if (options.status === "inactive") clauses.push("p.is_active = 0");

  if (options.minPrice !== null) {
    clauses.push("p.price_cents >= ?");
    params.push(options.minPrice);
  }
  if (options.maxPrice !== null) {
    clauses.push("p.price_cents <= ?");
    params.push(options.maxPrice);
  }

  return {
    where: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "",
    params,
  };
}

/* ---------- READS ---------- */

/* Listagem paginada admin (inclui inativos; admin precisa ver tudo). */
async function list(options) {
  const { where, params } = buildWhere(options);
  const orderBy = SORT_SQL[options.sort].join(", ");

  const countSql = `
    SELECT COUNT(*) AS total
    FROM products p
    INNER JOIN brands b ON b.id = p.brand_id
    INNER JOIN categories c ON c.id = p.category_id
    ${where}`;

  const [countRows] = await pool.query(countSql, params);
  const total = Number(countRows[0].total);

  // Clampa a página ao range real (evita OFFSET inútil para páginas distantes).
  const totalPages = Math.max(
    total > 0 ? Math.ceil(total / options.perPage) : 0,
    total > 0 ? 1 : 0
  );
  const page = Math.min(options.page, Math.max(1, totalPages));
  const offset = (page - 1) * options.perPage;

  const listSql = `
    SELECT
      p.id, p.name, p.slug, p.description,
      p.price_cents, p.old_price_cents,
      p.rating, p.rating_count,
      p.is_featured, p.is_new, p.is_bestseller, p.is_active,
      p.created_at, p.updated_at,
      b.id AS brand_id, b.name AS brand,
      c.id AS category_id, c.name AS category,
      COALESCE(i.quantity, 0) AS stock,
      (SELECT pi.url FROM product_images pi
         WHERE pi.product_id = p.id
         ORDER BY pi.position ASC, pi.id ASC LIMIT 1) AS image
    FROM products p
    INNER JOIN brands b ON b.id = p.brand_id
    INNER JOIN categories c ON c.id = p.category_id
    LEFT JOIN inventory i ON i.product_id = p.id
    ${where}
    ORDER BY ${orderBy}
    LIMIT ? OFFSET ?`;

  const [listRows] = await pool.query(listSql, [...params, options.perPage, offset]);

  return {
    rows: listRows.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      description: r.description,
      price_cents: r.price_cents,
      old_price_cents: r.old_price_cents,
      is_featured: r.is_featured,
      is_new: r.is_new,
      is_bestseller: r.is_bestseller,
      is_active: r.is_active,
      created_at: r.created_at,
      updated_at: r.updated_at,
      brand_id: r.brand_id,
      category_id: r.category_id,
      brand: r.brand,
      category: r.category,
      stock: Number(r.stock),
      image: r.image || null,
    })),
    total: Number(countRows[0].total),
  };
}

/* Linha bruta de products (para lock/checks). `lock` -> SELECT ... FOR UPDATE. */
async function findByIdRaw(id, { conn = null, lock = false } = {}) {
  const run = conn || pool;
  const sql = `SELECT * FROM products WHERE id = ? LIMIT 1${lock ? " FOR UPDATE" : ""}`;
  const [rows] = await run.query(sql, [id]);
  return rows[0] || null;
}

/* Detalhe completo para o admin: produto + categoria + marca + imagens
   (ordenadas) + specs COMO ARRAY ordenado + estoque + flags + is_active.
   NUNCA o formato colapsado de specs da API pública. */
async function findDetail(id, conn = null) {
  const run = conn || pool;
  const [rows] = await run.query(
    `SELECT
       p.id, p.slug, p.name, p.description,
       p.price_cents, p.old_price_cents,
       p.rating, p.rating_count,
       p.is_featured, p.is_new, p.is_bestseller, p.is_active,
       p.created_at, p.updated_at,
       b.id AS brand_id, b.name AS brand_name, b.slug AS brand_slug,
       c.id AS category_id, c.name AS category_name, c.slug AS category_slug,
       COALESCE(i.quantity, 0) AS stock
     FROM products p
     INNER JOIN brands b ON b.id = p.brand_id
     INNER JOIN categories c ON c.id = p.category_id
     LEFT JOIN inventory i ON i.product_id = p.id
     WHERE p.id = ?
     LIMIT 1`,
    [id]
  );
  if (rows.length === 0) return null;

  const row = rows[0];
  const [images] = await run.query(
    "SELECT id, url, alt, position FROM product_images WHERE product_id = ? ORDER BY position ASC, id ASC",
    [id]
  );
  const [specs] = await run.query(
    "SELECT id, label, value, position FROM product_specs WHERE product_id = ? ORDER BY position ASC, id ASC",
    [id]
  );

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    brand_id: row.brand_id,
    category_id: row.category_id,
    brand: { id: row.brand_id, name: row.brand_name, slug: row.brand_slug },
    category: { id: row.category_id, name: row.category_name, slug: row.category_slug },
    price_cents: row.price_cents,
    old_price_cents: row.old_price_cents,
    rating: Number(row.rating),
    rating_count: row.rating_count,
    is_featured: Boolean(row.is_featured),
    is_new: Boolean(row.is_new),
    is_bestseller: Boolean(row.is_bestseller),
    is_active: Boolean(row.is_active),
    stock: Number(row.stock),
    images,
    specs,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/* Existe slug? (excludeId para update excluir o próprio produto). */
async function slugExists(slug, excludeId = null, conn = null) {
  const run = conn || pool;
  const params = [slug];
  let sql = "SELECT id FROM products WHERE slug = ?";
  if (excludeId !== null) {
    sql += " AND id <> ?";
    params.push(excludeId);
  }
  sql += " LIMIT 1";
  const [rows] = await run.query(sql, params);
  return rows.length > 0;
}

async function brandExists(conn, id) {
  const [rows] = await conn.query("SELECT 1 FROM brands WHERE id = ? LIMIT 1", [id]);
  return rows.length > 0;
}

async function categoryExists(conn, id) {
  const [rows] = await conn.query("SELECT 1 FROM categories WHERE id = ? LIMIT 1", [id]);
  return rows.length > 0;
}

/* Marcas/categorias para os SELECTs do formulário (com id — a API pública não traz). */
async function listBrands() {
  const [rows] = await pool.query("SELECT id, name, slug FROM brands ORDER BY name ASC");
  return rows;
}

async function listCategories() {
  const [rows] = await pool.query("SELECT id, name, slug FROM categories ORDER BY name ASC");
  return rows;
}

/* ---------- MUTATIONS (conn obrigatória) ---------- */

async function insertProduct(conn, fields) {
  const [result] = await conn.query(
    `INSERT INTO products
       (slug, name, description, brand_id, category_id, price_cents, old_price_cents,
        is_featured, is_new, is_bestseller, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      fields.slug,
      fields.name,
      fields.description,
      fields.brand_id,
      fields.category_id,
      fields.price_cents,
      fields.old_price_cents,
      fields.is_featured,
      fields.is_new,
      fields.is_bestseller,
      fields.is_active,
    ]
  );
  return result.insertId;
}

async function updateProduct(conn, id, fields) {
  const sets = [];
  const params = [];
  for (const key of Object.keys(fields)) {
    if (!UPDATE_COLUMNS.has(key)) continue;
    sets.push(`${key} = ?`);
    params.push(fields[key]);
  }
  if (sets.length === 0) return 0;
  params.push(id);
  const [result] = await conn.query(`UPDATE products SET ${sets.join(", ")} WHERE id = ?`, params);
  return result.affectedRows;
}

async function setActive(conn, id, active) {
  const [result] = await conn.query("UPDATE products SET is_active = ? WHERE id = ?", [active, id]);
  return result.affectedRows;
}

async function replaceSpecs(conn, productId, specs) {
  await conn.query("DELETE FROM product_specs WHERE product_id = ?", [productId]);
  if (specs.length === 0) return;
  const values = specs.map((s, i) => [productId, s.label, s.value, i]);
  await conn.query(
    "INSERT INTO product_specs (product_id, label, value, position) VALUES ?",
    [values]
  );
}

async function replaceImages(conn, productId, images) {
  await conn.query("DELETE FROM product_images WHERE product_id = ?", [productId]);
  if (images.length === 0) return;
  const values = images.map((img, i) => [productId, img.url, img.alt || null, i]);
  await conn.query(
    "INSERT INTO product_images (product_id, url, alt, position) VALUES ?",
    [values]
  );
}

async function upsertInventory(conn, productId, quantity) {
  await conn.query(
    `INSERT INTO inventory (product_id, quantity) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE quantity = VALUES(quantity), updated_at = CURRENT_TIMESTAMP`,
    [productId, quantity]
  );
}

module.exports = {
  list,
  findByIdRaw,
  findDetail,
  slugExists,
  brandExists,
  categoryExists,
  listBrands,
  listCategories,
  insertProduct,
  updateProduct,
  setActive,
  replaceSpecs,
  replaceImages,
  upsertInventory,
};