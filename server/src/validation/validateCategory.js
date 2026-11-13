/* ==========================================================================
   NEXUS TECH — Validação do corpo de categorias (Admin / v3.0-X3)
   CREATE: nome obrigatório, slug opcional (auto-gerado se vazio).
   UPDATE: somente campos presentes; slug ausente fica intacto.
   ========================================================================== */

const { HttpError } = require("../utils/http");

const MAX_NAME = 100;
const MAX_SLUG = 120; // coluna do banco (categories.slug VARCHAR(120))
const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function bad(message) {
  return new HttpError(400, message);
}

function requireString(value, name, max) {
  if (typeof value !== "string") throw bad(`Campo '${name}' deve ser uma string`);
  const v = value.trim();
  if (v === "") throw bad(`Campo '${name}' não pode ser vazio`);
  if (v.length > max) throw bad(`Campo '${name}' excede o limite de ${max} caracteres`);
  return v;
}

function validateSlug(value) {
  if (typeof value !== "string") throw bad("Campo 'slug' deve ser uma string");
  const v = value.trim().toLowerCase();
  if (v === "") throw bad("Campo 'slug' não pode ser vazio");
  if (v.length > MAX_SLUG) throw bad(`Campo 'slug' excede o limite de ${MAX_SLUG} caracteres`);
  if (!SLUG_RE.test(v)) {
    throw bad("Campo 'slug' inválido (use letras minúsculas, números e hífens simples)");
  }
  return v;
}

function slugify(name) {
  const raw = String(name)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
  return raw.slice(0, MAX_SLUG);
}

function parseCreateInput(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw bad("Corpo da requisição inválido");
  }
  const name = requireString(body.name, "name", MAX_NAME);
  const slug = body.slug === undefined ? null : validateSlug(body.slug);
  return { name, slug };
}

function parseUpdateInput(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw bad("Corpo da requisição inválido");
  }
  const out = {};
  if (body.name !== undefined) out.name = requireString(body.name, "name", MAX_NAME);
  if (body.slug !== undefined) out.slug = validateSlug(body.slug);
  if (Object.keys(out).length === 0) throw bad("Nenhum campo para atualizar");
  return out;
}

module.exports = { parseCreateInput, parseUpdateInput, slugify, MAX_SLUG };
