/* ==========================================================================
   NEXUS TECH — Validação do perfil de usuário (PATCH /api/auth/profile)
   - CPF ...... validado com algoritmo dos dígitos verificadores (DV); aceita
               entrada pontuada "000.000.000-00" ou só números; persistido
               SEMPRE normalizado no formato "000.000.000-00";
   - Telefone . aceita "(DD) XXXXX-XXXX", "(DD) XXXX-XXXX" ou só números
               (10–11 dígitos, DDD sem algarismo 0); persistido normalizado
               em "(DD) XXXXX-XXXX"; nada do que não seja DDD+número é aceito.
   Nenhum dado é logado; CPF/telefone transitam apenas até o repositório.
   ========================================================================== */

const { HttpError } = require("../utils/http");

const MAX_CPF = 14; // "000.000.000-00"
const MAX_PHONE = 20; // "(00) [0][00000]-[0000]" folgado

function bad(message) {
  return new HttpError(400, message);
}

function onlyDigits(value) {
  return String(value).replace(/\D/g, "");
}

/* ----------------------------------------------------------------- CPF ----- */

function isValidCpfDigits(digits) {
  if (!/^\d{11}$/.test(digits)) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false; // 000.000.000-00, 111... etc.

  let sum = 0;
  for (let i = 0; i < 9; i += 1) sum += Number(digits[i]) * (10 - i);
  let d1 = 11 - (sum % 11);
  if (d1 >= 10) d1 = 0;

  sum = 0;
  for (let i = 0; i < 10; i += 1) sum += Number(digits[i]) * (11 - i);
  let d2 = 11 - (sum % 11);
  if (d2 >= 10) d2 = 0;

  return Number(digits[9]) === d1 && Number(digits[10]) === d2;
}

function formatCpf(digits) {
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
}

function validateCpf(value) {
  if (typeof value !== "string") throw bad("Campo 'cpf' deve ser uma string");
  const trimmed = value.trim();
  if (trimmed === "") throw bad("Campo 'cpf' não pode ser vazio");
  const digits = onlyDigits(trimmed);
  if (!isValidCpfDigits(digits)) throw bad("CPF inválido.");
  return formatCpf(digits);
}

/* -------------------------------------------------------------- Telefone --- */

function isValidPhoneDigits(digits) {
  if (!/^\d{10,11}$/.test(digits)) return false;
  const ddd = digits.slice(0, 2);
  if (ddd[0] === "0" || ddd[1] === "0") return false; // DDD válido: 11–99
  return true;
}

function formatPhone(digits) {
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
}

function validatePhone(value) {
  if (typeof value !== "string") throw bad("Campo 'phone' deve ser uma string");
  const trimmed = value.trim();
  if (trimmed === "") throw bad("Campo 'phone' não pode ser vazio");
  const digits = onlyDigits(trimmed);
  if (!isValidPhoneDigits(digits)) {
    throw bad("Telefone inválido (informe DDD + número, ex.: (11) 91234-5678).");
  }
  return formatPhone(digits);
}

/* ------------------------------------------------------------ PATCH body --- */

/* PATCH aceita SOMENTE campos presentes; ao menos um de phone/cpf. */
function parseUpdateInput(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw bad("Corpo da requisição inválido");
  }
  const out = {};
  if (body.phone !== undefined) out.phone = validatePhone(body.phone);
  if (body.cpf !== undefined) out.cpf = validateCpf(body.cpf);
  if (Object.keys(out).length === 0) {
    throw bad("Envie ao menos 'phone' ou 'cpf' para atualizar o perfil.");
  }
  return out;
}

module.exports = { parseUpdateInput, validateCpf, validatePhone, isValidCpfDigits, isValidPhoneDigits };