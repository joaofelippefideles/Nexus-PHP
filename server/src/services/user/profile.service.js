/* ==========================================================================
   NEXUS TECH — Serviço do perfil de usuário (user_profile)
   GET /api/auth/profile  -> retorna perfil existente ou esqueleto vazio
   PATCH /api/auth/profile -> valida, faz upsert, registra auditoria,
                               transação atômica; mapeia ER_DUP_ENTRY
                               (CPF usado por outro usuário) -> 409 seguro.
   Nenhum hash/senha/token é incluído em respostas.
   ========================================================================== */

const { pool } = require("../../config/db");
const { HttpError } = require("../../utils/http");
const profileRepository = require("../../repositories/user/profile.repository");
const auditService = require("../admin/audit.service");
const { parseUpdateInput } = require("../../validation/validateProfile");

function mapDbError(err) {
  if (err instanceof HttpError) return err;
  if (err && err.code === "ER_DUP_ENTRY") {
    return new HttpError(409, "CPF já cadastrado para outro usuário.");
  }
  return err;
}

function toSafeProfile(row) {
  if (!row) return null;
  return {
    userId: Number(row.user_id),
    phone: row.phone,
    cpf: row.cpf,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/* ---------------------------------------------------------------- GET ----- */

async function getProfile(userId) {
  const row = await profileRepository.findProfileById(userId);
  if (!row) return { data: { userId, phone: null, cpf: null } };
  return { data: toSafeProfile(row) };
}

/* ------------------------------------------------------------ PATCH ------ */

async function updateProfile(userId, rawBody, ctx) {
  const data = parseUpdateInput(rawBody);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const existing = await profileRepository.findProfileById(userId, conn);

    let action;
    if (!existing) {
      await profileRepository.insert(conn, userId, {
        phone: data.phone ?? null,
        cpf: data.cpf ?? null,
      });
      action = "profile.create";
    } else {
      const fields = {};
      if (data.phone !== undefined) fields.phone = data.phone;
      if (data.cpf !== undefined) fields.cpf = data.cpf;
      await profileRepository.update(conn, userId, fields);
      action = "profile.update";
    }

    const before = existing
      ? { phone: existing.phone, cpf: existing.cpf }
      : null;
    const after = {
      phone: data.phone ?? existing?.phone ?? null,
      cpf: data.cpf ?? existing?.cpf ?? null,
    };

    await auditService.logTransaction(conn, {
      adminId: userId,
      action,
      entity: "profile",
      entityId: userId,
      before,
      after,
      ip: ctx.ip,
    });

    await conn.commit();
    const fresh = await profileRepository.findProfileById(userId);
    return { data: toSafeProfile(fresh) };
  } catch (err) {
    await conn.rollback().catch(() => {});
    throw mapDbError(err);
  } finally {
    conn.release();
  }
}

module.exports = { getProfile, updateProfile };