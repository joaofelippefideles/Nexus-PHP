/* ==========================================================================
   NEXUS TECH — Serviço admin de marcas (v3.0-X3)
   Orquestra: validação → regras de negócio (slug, dependências) → transação
   (mutação + auditoria) → snapshot → resposta.
   DELETE é HARD-DELETE físico, mas bloqueado com 409 quando a marca possui
   produtos vinculados (dependência garantida por query, não por FK).
   ========================================================================== */

const { pool } = require("../../config/db");
const { HttpError } = require("../../utils/http");
const brandsRepository = require("../../repositories/admin/brands.repository");
const auditService = require("./audit.service");
const {
  parseCreateInput,
  parseUpdateInput,
  slugify,
} = require("../../validation/validateBrand");

function toId(value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, "id de marca inválido");
  return n;
}

function mapDbError(err) {
  if (err instanceof HttpError) return err;
  if (err && err.code === "ER_DUP_ENTRY") {
    return new HttpError(409, "Nome ou slug já utilizado por outra marca");
  }
  return err;
}

function snapshot(row) {
  return { id: Number(row.id), name: row.name, slug: row.slug };
}

/* CREATE: slug ausente → gera a partir do nome; conflito → sufixo -2, -3... */
async function resolveSlugForCreate(data, conn) {
  if (data.slug) {
    if (await brandsRepository.slugExists(data.slug, null, conn)) {
      throw new HttpError(409, "Slug já utilizado por outra marca");
    }
    return data.slug;
  }
  const base = slugify(data.name) || "marca";
  let candidate = base;
  let n = 1;
  while (await brandsRepository.slugExists(candidate, null, conn)) {
    n += 1;
    candidate = `${base}-${n}`;
  }
  return candidate;
}

/* ---------- READS ---------- */

async function list() {
  return { data: await brandsRepository.list() };
}

async function getById(id) {
  const brandId = toId(id);
  const row = await brandsRepository.findById(brandId);
  if (!row) throw new HttpError(404, "Marca não encontrada");
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
    const brandId = await brandsRepository.insert(conn, insertData);

    await auditService.logTransaction(conn, {
      adminId: ctx.admin.id,
      action: "brand.create",
      entity: "brand",
      entityId: brandId,
      before: null,
      after: { id: brandId, name: insertData.name, slug: insertData.slug },
      ip: ctx.ip,
    });

    await conn.commit();
    const row = await brandsRepository.findById(brandId);
    return { data: row, status: 201 };
  } catch (err) {
    await conn.rollback().catch(() => {});
    throw mapDbError(err);
  } finally {
    conn.release();
  }
}

async function update(id, rawBody, ctx) {
  const brandId = toId(id);
  const data = parseUpdateInput(rawBody);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const row = await brandsRepository.findByIdRaw(brandId, { conn, lock: true });
    if (!row) throw new HttpError(404, "Marca não encontrada");

    const slug = data.slug ?? row.slug;
    if (slug !== row.slug) {
      if (await brandsRepository.slugExists(slug, brandId, conn)) {
        throw new HttpError(409, "Slug já utilizado por outra marca");
      }
    }

    const fields = {};
    if (data.name !== undefined) fields.name = data.name;
    if (data.slug !== undefined) fields.slug = data.slug;
    if (Object.keys(fields).length > 0) {
      await brandsRepository.update(conn, brandId, fields);
    }

    const after = { id: brandId, name: fields.name ?? row.name, slug: fields.slug ?? row.slug };

    await auditService.logTransaction(conn, {
      adminId: ctx.admin.id,
      action: "brand.update",
      entity: "brand",
      entityId: brandId,
      before: snapshot(row),
      after,
      ip: ctx.ip,
    });

    await conn.commit();
    const fresh = await brandsRepository.findById(brandId);
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
  const brandId = toId(id);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const row = await brandsRepository.findByIdRaw(brandId, { conn, lock: true });
    if (!row) throw new HttpError(404, "Marca não encontrada");

    const linked = await brandsRepository.countProducts(conn, brandId);
    if (linked > 0) {
      throw new HttpError(
        409,
        `Marca não pode ser excluída: existem ${linked} produto(s) vinculado(s)`
      );
    }

    await brandsRepository.remove(conn, brandId);

    await auditService.logTransaction(conn, {
      adminId: ctx.admin.id,
      action: "brand.delete",
      entity: "brand",
      entityId: brandId,
      before: snapshot(row),
      after: null,
      ip: ctx.ip,
    });

    await conn.commit();
    return { data: { id: brandId } };
  } catch (err) {
    await conn.rollback().catch(() => {});
    throw mapDbError(err);
  } finally {
    conn.release();
  }
}

module.exports = { list, getById, create, update, remove };