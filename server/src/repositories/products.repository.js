/* ==========================================================================
   NEXUS TECH — Repositório de produtos
   Camada de acesso ao banco. TODAS as queries usam placeholders (?)
   parametrizados — nenhum valor de usuário é concatenado no SQL.
   ========================================================================== */

const { pool } = require("../config/db");

/* Mapeia a chave de ordenação do frontend para SQL.
   Whitelist: nada do usuário entra aqui sem passar por esta tabela. */
const SORT_SQL = {
  "price-asc": ["p.price_cents ASC", "p.id ASC"],
  "price-desc": ["p.price_cents DESC", "p.id ASC"],
  "rating-desc": ["p.rating DESC", "p.rating_count DESC", "p.id ASC"],
  newest: ["p.is_bestseller DESC", "p.is_new DESC", "p.id ASC"],
  relevance: ["p.id ASC"],
};

/* Monta o fragmento WHERE dinâmico a partir de opções já validadas.
   Retorna { where, params }. Fragmentos são SQL fixo (tags/colunas) e os
   valores entram pelos placeholders (`?`). */
function buildWhere(options) {
  const clauses = [];
  const params = [];

  // Soft-delete do Admin: a storefront só vê produtos ATIVOS (v3.0-X2).
  clauses.push("p.is_active = 1");

  if (options.q) {
    clauses.push("(p.name LIKE ? OR b.name LIKE ? OR c.name LIKE ?)");
    const like = `%${options.q}%`;
    params.push(like, like, like);
  }

  if (options.categories.length > 0) {
    const group = options.categories
      .map(() => "(c.slug = ? OR c.name = ?)")
      .join(" OR ");
    clauses.push(`(${group})`);
    for (const cat of options.categories) {
      params.push(cat, cat);
    }
  }

  if (options.minPrice !== null) {
    clauses.push("p.price_cents >= ?");
    params.push(options.minPrice);
  }
  if (options.maxPrice !== null) {
    clauses.push("p.price_cents <= ?");
    params.push(options.maxPrice);
  }

  if (options.availability === "in") {
    clauses.push("COALESCE(i.quantity, 0) > 0");
  } else if (options.availability === "out") {
    clauses.push("COALESCE(i.quantity, 0) = 0");
  }

  return {
    where: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "",
    params,
  };
}

/* Mapeia uma linha do JOIN para o shape do catálogo (compatível com o
   frontend da Fase 4: priceCents, ratingCount, isNew, etc.). */
function toProductShape(row) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    brand: row.brand,
    category: row.category,
    description: row.description,
    price_cents: row.price_cents,
    old_price_cents: row.old_price_cents,
    images: row.images ? row.images.split(",") : [],
    rating: Number(row.rating),
    rating_count: row.rating_count,
    stock: row.stock,
    is_featured: Boolean(row.is_featured),
    is_new: Boolean(row.is_new),
    is_bestseller: Boolean(row.is_bestseller),
  };
}

/* Consulta paginada do catálogo. Retorna { rows, total }. */
async function listProducts(options) {
  const { where, params } = buildWhere(options);
  const orderBy = SORT_SQL[options.sort].join(", ");
  const offset = (options.page - 1) * options.perPage;

  const countSql = `
    SELECT COUNT(*) AS total
    FROM products p
    INNER JOIN brands b ON b.id = p.brand_id
    INNER JOIN categories c ON c.id = p.category_id
    LEFT JOIN inventory i ON i.product_id = p.id
    ${where}`;

  const listSql = `
    SELECT
      p.id, p.slug, p.name, p.description,
      p.price_cents, p.old_price_cents,
      p.rating, p.rating_count,
      p.is_featured, p.is_new, p.is_bestseller,
      b.name AS brand,
      c.name AS category,
      COALESCE(i.quantity, 0) AS stock,
      (SELECT COALESCE(GROUP_CONCAT(pi.url ORDER BY pi.position SEPARATOR ','), '')
         FROM product_images pi WHERE pi.product_id = p.id) AS images
    FROM products p
    INNER JOIN brands b ON b.id = p.brand_id
    INNER JOIN categories c ON c.id = p.category_id
    LEFT JOIN inventory i ON i.product_id = p.id
    ${where}
    ORDER BY ${orderBy}
    LIMIT ? OFFSET ?`;

  const countParams = [...params];
  const listParams = [...params, options.perPage, offset];

  const [countRows] = await pool.query(countSql, countParams);
  const [listRows] = await pool.query(listSql, listParams);

  return {
    rows: listRows.map(toProductShape),
    total: Number(countRows[0].total),
  };
}

/* Mapeia uma consulta de produto único (id ou slug) para o shape completo,
   incluindo specs e imagens. Retorna null se não existir. */
function toDetailShape(row, images, specs) {
  const specObj = {};
  for (const s of specs) {
    specObj[s.label] = s.value;
  }
  return {
    ...toProductShape(row),
    images: images.map((x) => x.url),
    specs: specObj,
  };
}

async function findOneBy(column, value) {
  const safeColumn =
    column === "slug"
      ? "p.slug"
      : column === "id"
        ? "p.id"
        : null;
  if (!safeColumn) throw new Error("coluna inválida para findOneBy");

  const sql = `
    SELECT
      p.id, p.slug, p.name, p.description,
      p.price_cents, p.old_price_cents,
      p.rating, p.rating_count,
      p.is_featured, p.is_new, p.is_bestseller,
      b.name AS brand,
      c.name AS category,
      COALESCE(i.quantity, 0) AS stock
    FROM products p
    INNER JOIN brands b ON b.id = p.brand_id
    INNER JOIN categories c ON c.id = p.category_id
    LEFT JOIN inventory i ON i.product_id = p.id
    WHERE ${safeColumn} = ? AND p.is_active = 1
    LIMIT 1`;

  const [rows] = await pool.query(sql, [value]);
  if (rows.length === 0) return null;

  const row = rows[0];
  const [images] = await pool.query(
    "SELECT url, alt, position FROM product_images WHERE product_id = ? ORDER BY position ASC",
    [row.id]
  );
  const [specs] = await pool.query(
    "SELECT label, value, position FROM product_specs WHERE product_id = ? ORDER BY position ASC",
    [row.id]
  );

  return toDetailShape(row, images, specs);
}

async function findProductById(id) {
  return findOneBy("id", id);
}

async function findProductBySlug(slug) {
  return findOneBy("slug", slug);
}

/* Categorias com contagem de produtos (facetas) — só produtos ativos. */
async function listCategories() {
  const [rows] = await pool.query(`
    SELECT c.name, c.slug, COUNT(p.id) AS count
    FROM categories c
    LEFT JOIN products p ON p.category_id = c.id AND p.is_active = 1
    GROUP BY c.id, c.name, c.slug
    ORDER BY c.name ASC`);
  return rows.map((r) => ({
    name: r.name,
    slug: r.slug,
    count: Number(r.count),
  }));
}

/* Marcas com contagem de produtos — só produtos ativos. */
async function listBrands() {
  const [rows] = await pool.query(`
    SELECT b.name, COUNT(p.id) AS count
    FROM brands b
    LEFT JOIN products p ON p.brand_id = b.id AND p.is_active = 1
    GROUP BY b.id, b.name
    ORDER BY b.name ASC`);
  return rows.map((r) => ({
    name: r.name,
    count: Number(r.count),
  }));
}

module.exports = {
  listProducts,
  findProductById,
  findProductBySlug,
  listCategories,
  listBrands,
};
