/* ==========================================================================
   NEXUS TECH — Serviço admin de produtos (v3.0-X2)
   Orquestra: validação → regras de negócio (slug, existência de marca/
   categoria) → transação única (mutação + auditoria) → snapshot → resposta.
   SLAUG:
   - CREATE: ausente → gerado a partir do nome (NFKD, sem acentos, '-',
     conflito resolvido com -2, -3...); explícito → validado e usado;
     conflito → 409.
   - UPDATE: slug NUNCA é regenerado; só muda se vier explicitamente no body.
   ERROS de banco mapeados: ER_DUP_ENTRY → 409; FK inexistente → 400/404.
   Nenhum segredo entra nos snapshots de auditoria.
   ========================================================================== */

const { pool } = require("../../config/db");
const { HttpError } = require("../../utils/http");
const productsRepository = require("../../repositories/admin/products.repository");
const auditService = require("./audit.service");
const {
  parseCreateInput,
  parseUpdateInput,
  slugify,
} = require("../../validation/validateProduct");
const { parseProductQuery } = require("../../validation/validateProductQuery");

const UPDATE_PRODUCT_FIELDS = [
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
];

function toProductId(value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, "id de produto inválido");
  return n;
}

function mapDbError(err) {
  if (err instanceof HttpError) return err;
  if (err && err.code === "ER_DUP_ENTRY") {
    return new HttpError(409, "Slug já utilizado por outro produto");
  }
  if (
    err &&
    (err.code === "ER_NO_REFERENCED_ROW" || err.code === "ER_NO_REFERENCED_ROW_2")
  ) {
    return new HttpError(404, "Marca ou categoria não encontrada");
  }
  return err;
}

/* Snapshot de auditoria: SOMENTE campos permitidos. Nunca segredos. */
function buildSnapshot(d) {
  return {
    id: d.id,
    name: d.name,
    slug: d.slug,
    brand_id: d.brand_id,
    category_id: d.category_id,
    price_cents: d.price_cents,
    old_price_cents: d.old_price_cents ?? null,
    stock: Number(d.stock ?? 0),
    is_active: d.is_active,
    is_featured: d.is_featured,
    is_new: d.is_new,
    is_bestseller: d.is_bestseller,
    specs: Array.isArray(d.specs)
      ? d.specs.map((s) => ({ label: s.label, value: s.value }))
      : [],
    images: Array.isArray(d.images) ? d.images.map((img) => img.url) : [],
  };
}

function snapshotFromCreateData(data, productId) {
  return {
    id: productId,
    name: data.name,
    slug: data.slug,
    brand_id: data.brand_id,
    category_id: data.category_id,
    price_cents: data.price_cents,
    old_price_cents: data.old_price_cents ?? null,
    stock: Number(data.stock ?? 0),
    is_active: data.is_active,
    is_featured: data.is_featured,
    is_new: data.is_new,
    is_bestseller: data.is_bestseller,
    specs: data.specs.map((s) => ({ label: s.label, value: s.value })),
    images: data.images.map((img) => img.url),
  };
}

async function assertReferences(conn, brandId, categoryId) {
  if (!(await productsRepository.brandExists(conn, brandId))) {
    throw new HttpError(404, "Marca não encontrada");
  }
  if (!(await productsRepository.categoryExists(conn, categoryId))) {
    throw new HttpError(404, "Categoria não encontrada");
  }
}

/* CREATE: slug ausente → gera a partir do nome; explícito → usa e valida 409. */
async function resolveSlugForCreate(data, conn) {
  if (data.slug) {
    if (await productsRepository.slugExists(data.slug, null, conn)) {
      throw new HttpError(409, "Slug já utilizado por outro produto");
    }
    return data.slug;
  }
  const base = slugify(data.name) || "produto";
  let candidate = base;
  let n = 1;
  while (await productsRepository.slugExists(candidate, null, conn)) {
    n += 1;
    candidate = `${base}-${n}`;
  }
  return candidate;
}

/* ---------- READS ---------- */

async function list(rawQuery) {
  const options = parseProductQuery(rawQuery);
  const { rows, total } = await productsRepository.list(options);

  const perPage = options.perPage;
  const totalPages = Math.max(
    perPage > 0 ? Math.ceil(total / perPage) : 0,
    total > 0 ? 1 : 0
  );
  const safePage = Math.min(options.page, Math.max(1, totalPages));
  const from = total === 0 ? 0 : (safePage - 1) * perPage + 1;
  const to = Math.min(safePage * perPage, total);

  const meta = {
    page: safePage,
    per_page: perPage,
    total,
    total_pages: totalPages,
    from,
    to,
    has_prev: safePage > 1 && totalPages > 1,
    has_next: safePage < totalPages,
  };

  return { data: rows, meta };
}

async function getById(id) {
  const productId = toProductId(id);
  const detail = await productsRepository.findDetail(productId);
  if (!detail) throw new HttpError(404, "Produto não encontrado");
  return { data: detail };
}

async function listBrands() {
  return { data: await productsRepository.listBrands() };
}

async function listCategories() {
  return { data: await productsRepository.listCategories() };
}

/* ---------- MUTATIONS ---------- */

async function create(rawBody, ctx) {
  const data = parseCreateInput(rawBody);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await assertReferences(conn, data.brand_id, data.category_id);
    const slug = await resolveSlugForCreate(data, conn);
    const insertData = { ...data, slug };
    const productId = await productsRepository.insertProduct(conn, insertData);
    await productsRepository.upsertInventory(conn, productId, insertData.stock);
    if (insertData.specs.length) {
      await productsRepository.replaceSpecs(conn, productId, insertData.specs);
    }
    if (insertData.images.length) {
      await productsRepository.replaceImages(conn, productId, insertData.images);
    }

    await auditService.logTransaction(conn, {
      adminId: ctx.admin.id,
      action: "product.create",
      entity: "product",
      entityId: productId,
      before: null,
      after: snapshotFromCreateData(insertData, productId),
      ip: ctx.ip,
    });

    await conn.commit();
    const detail = await productsRepository.findDetail(productId);
    return { data: detail, status: 201 };
  } catch (err) {
    await conn.rollback().catch(() => {});
    throw mapDbError(err);
  } finally {
    conn.release();
  }
}

async function update(id, rawBody, ctx) {
  const productId = toProductId(id);
  const data = parseUpdateInput(rawBody);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const row = await productsRepository.findByIdRaw(productId, { conn, lock: true });
    if (!row) throw new HttpError(404, "Produto não encontrado");

    if (data.brand_id) await assertReferences(conn, data.brand_id, row.category_id);
    if (data.category_id) await assertReferences(conn, row.brand_id, data.category_id);

    // SlUG só muda se enviado explicitamente; nunca regenerado.
    if (data.slug !== undefined) {
      if (await productsRepository.slugExists(data.slug, productId, conn)) {
        throw new HttpError(409, "Slug já utilizado por outro produto");
      }
    }

    const before = await productsRepository.findDetail(productId, conn);

    const fields = {};
    for (const key of UPDATE_PRODUCT_FIELDS) {
      if (Object.hasOwn(data, key)) fields[key] = data[key];
    }
    if (Object.keys(fields).length > 0) {
      await productsRepository.updateProduct(conn, productId, fields);
    }
    if (Object.hasOwn(data, "stock")) {
      await productsRepository.upsertInventory(conn, productId, data.stock);
    }
    if (Object.hasOwn(data, "specs")) {
      await productsRepository.replaceSpecs(conn, productId, data.specs);
    }
    if (Object.hasOwn(data, "images")) {
      await productsRepository.replaceImages(conn, productId, data.images);
    }

    const after = await productsRepository.findDetail(productId, conn);

    await auditService.logTransaction(conn, {
      adminId: ctx.admin.id,
      action: "product.update",
      entity: "product",
      entityId: productId,
      before: buildSnapshot(before),
      after: buildSnapshot(after),
      ip: ctx.ip,
    });

    await conn.commit();
    return { data: after };
  } catch (err) {
    await conn.rollback().catch(() => {});
    throw mapDbError(err);
  } finally {
    conn.release();
  }
}

/* Soft-delete / reativação: is_active 0/1. DELETE nunca remove fisicamente. */
async function setActiveStatus(id, active, action, conflictMessage, ctx) {
  const productId = toProductId(id);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const row = await productsRepository.findByIdRaw(productId, { conn, lock: true });
    if (!row) throw new HttpError(404, "Produto não encontrado");
    if (row.is_active === active) throw new HttpError(409, conflictMessage);

    const before = await productsRepository.findDetail(productId, conn);
    await productsRepository.setActive(conn, productId, active);
    const after = { ...before, is_active: Boolean(active) };

    await auditService.logTransaction(conn, {
      adminId: ctx.admin.id,
      action,
      entity: "product",
      entityId: productId,
      before: buildSnapshot(before),
      after: buildSnapshot(after),
      ip: ctx.ip,
    });

    await conn.commit();
    return { data: after };
  } catch (err) {
    await conn.rollback().catch(() => {});
    throw mapDbError(err);
  } finally {
    conn.release();
  }
}

async function remove(id, ctx) {
  return setActiveStatus(id, 0, "product.deactivate", "Produto já está desativado", ctx);
}

async function activate(id, ctx) {
  return setActiveStatus(id, 1, "product.reactivate", "Produto já está ativo", ctx);
}

async function deactivate(id, ctx) {
  return setActiveStatus(id, 0, "product.deactivate", "Produto já está desativado", ctx);
}

module.exports = {
  list,
  getById,
  create,
  update,
  remove,
  activate,
  deactivate,
  listBrands,
  listCategories,
};