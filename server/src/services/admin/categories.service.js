/* ==========================================================================
   NEXUS TECH — Serviço admin de categorias (v3.0-X3)
   Orquestra: validação → regras de negócio (slug, dependências) → transação
   (mutação + auditoria) → snapshot → resposta.
   DELETE é HARD-DELETE físico, mas bloqueado com 409 quando a categoria
   possui produtos vinculados.
   ========================================================================== */

const { pool } = require("../../config/db");
const { HttpError } = require("../../utils/http");
const categoriesRepository = require("../../repositories/admin/categories.repository");
const auditService = require("./audit.service");
const {
  parseCreateInput,
  parseUpdateInput,
  slugify,
} = require("../../validation/validateCategory");

function toId(value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, "id de categoria inválido");
  return n;
}

function mapDbError(err) {
  if (err instanceof HttpError) return err;
  if (err && err.code === "ER_DUP_ENTRY") {
    return new HttpError(409, "Nome ou slug já utilizado por outra categoria");
  }
  return err;
}

function snapshot(row) {
  return { id: Number(row.id), name: row.name, slug: row.slug };
}

/* CREATE: slug ausente → gera a partir do nome; conflito → sufixo -2, -3... */
async function resolveSlugForCreate(data, conn) {
  if (data.slug) {
    if (await categoriesRepository.slugExists(data.slug, null, conn)) {
      throw new HttpError(409, "Slug já utilizado por outra categoria");
    }
    return data.slug;
  }
  const base = slugify(data.name) || "categoria";
  let candidate = base;
  let n = 1;
  while (await categoriesRepository.slugExists(candidate, null, conn)) {
    n += 1;
    candidate = `${base}-${n}`;
  }
  return candidate;
}

/* ---------- READS ---------- */

async function list() {
  return { data: await categoriesRepository.list() };
}

async function getById(id) {
  const categoryId = toId(id);
  const row = await categoriesRepository.findById(categoryId);
  if (!row) throw new HttpError(404, "Categoria não encontrada");
  return { data: row };
}

/* ---------- MUTATIONS ---------- */

async function create(rawBody, ctx) {
  const data = parseCreateInput(rawBody);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const slug = await resolveSlugForCreate(data, conn);
    const insertData = { ...data, slug };
    const categoryId = await categoriesRepository.insert(conn, insertData);

    await auditService.logTransaction(conn, {
      adminId: ctx.admin.id,
      action: "category.create",
      entity: "category",
      entityId: categoryId,
      before: null,
      after: { id: categoryId, name: insertData.name, slug: insertData.slug },
      ip: ctx.ip,
    });

    await conn.commit();
    const row = await categoriesRepository.findById(categoryId);
    return { data: row, status: 201 };
  } catch (err) {
    await conn.rollback().catch(() => {});
    throw mapDbError(err);
  } finally {
    conn.release();
  }
}

async function update(id, rawBody, ctx) {
  const categoryId = toId(id);
  const data = parseUpdateInput(rawBody);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const row = await categoriesRepository.findByIdRaw(categoryId, { conn, lock: true });
    if (!row) throw new HttpError(404, "Categoria não encontrada");

    const slug = data.slug ?? row.slug;
    if (slug !== row.slug) {
      if (await categoriesRepository.slugExists(slug, categoryId, conn)) {
        throw new HttpError(409, "Slug já utilizado por outra categoria");
      }
    }

    const fields = {};
    if (data.name !== undefined) fields.name = data.name;
    if (data.slug !== undefined) fields.slug = data.slug;
    if (Object.keys(fields).length > 0) {
      await categoriesRepository.update(conn, categoryId, fields);
    }

    const after = { id: categoryId, name: fields.name ?? row.name, slug: fields.slug ?? row.slug };

    await auditService.logTransaction(conn, {
      adminId: ctx.admin.id,
      action: "category.update",
      entity: "category",
      entityId: categoryId,
      before: snapshot(row),
      after,
      ip: ctx.ip,
    });

    await conn.commit();
    const fresh = await categoriesRepository.findById(categoryId);
    return { data: fresh };
  } catch (err) {
    await conn.rollback().catch(() => {});
    throw mapDbError(err);
  } finally {
    conn.release();
  }
}

/* HARD-DELETE físico, mas com checagem de dependentes (products). */
async function remove(id, ctx) {
  const categoryId = toId(id);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const row = await categoriesRepository.findByIdRaw(categoryId, { conn, lock: true });
    if (!row) throw new HttpError(404, "Categoria não encontrada");

    const linked = await categoriesRepository.countProducts(conn, categoryId);
    if (linked > 0) {
      throw new HttpError(
        409,
        `Categoria não pode ser excluída: existem ${linked} produto(s) vinculado(s)`
      );
    }

    await categoriesRepository.remove(conn, categoryId);

    await auditService.logTransaction(conn, {
      adminId: ctx.admin.id,
      action: "category.delete",
      entity: "category",
      entityId: categoryId,
      before: snapshot(row),
      after: null,
      ip: ctx.ip,
    });

    await conn.commit();
    return { data: { id: categoryId } };
  } catch (err) {
    await conn.rollback().catch(() => {});
    throw mapDbError(err);
  } finally {
    conn.release();
  }
}

module.exports = { list, getById, create, update, remove };