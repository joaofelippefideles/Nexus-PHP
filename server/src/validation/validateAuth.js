/* ==========================================================================
   NEXUS TECH — Validação do corpo de autenticação de usuário (Usuário)
   register / login / change-password.
   Política de senha: mínimo 8 caracteres, com letras e números (espelha a
   regra usada no cadastro do frontend). A senha NUNCA é logada nem
   persistida fora do password_hash.
   ========================================================================== */

const { HttpError } = require("../utils/http");
const { validateCpf, validatePhone } = require("./validateProfile");

const MAX_NAME = 120; // coluna do banco (users.name VARCHAR(120))
const MAX_EMAIL = 190; // coluna do banco (users.email VARCHAR(190))
const MAX_PASSWORD = 72; // máximo aceito pelo bcrypt (salt/truncation)

const EMAIL_RE = /^\S+@\S+\.\S+$/;
const PASSWORD_RE = /^(?=.*\d)(?=.*[A-Za-z]).{8,}$/;

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

function validateEmail(value) {
  const email = requireString(value, "email", MAX_EMAIL).toLowerCase();
  if (!EMAIL_RE.test(email)) throw bad("Informe um e-mail válido.");
  return email;
}

/* NUNCA retorna a senha; apenas valida e devolve-a para hash no serviço. */
function validatePassword(value) {
  const password = requireString(value, "password", MAX_PASSWORD);
  if (!PASSWORD_RE.test(password)) {
    throw bad("A senha deve ter no mínimo 8 caracteres, com letras e números.");
  }
  return password;
}

function validateConfirm(password, confirm, fieldName) {
  if (typeof confirm !== "string" || confirm !== password) {
    throw bad("As senhas não coincidem.");
  }
  return confirm;
}

/* register: NÚCLEO obrigatório name/email/password/passwordConfirm; phone e
   cpf são OPCIONAIS (persistidos em user_profile quando informados). A
   validação de CPF/telefone (FASE 5, validateProfile) é REUTILIZADA aqui —
   fonte única, sem duplicação de regra. */
function parseRegisterInput(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw bad("Corpo da requisição inválido");
  }
  const name = requireString(body.name, "name", MAX_NAME);
  const email = validateEmail(body.email);
  const password = validatePassword(body.password);
  validateConfirm(password, body.passwordConfirm, "passwordConfirm");
  const out = { name, email, password };
  if (body.phone !== undefined) out.phone = validatePhone(body.phone);
  if (body.cpf !== undefined) out.cpf = validateCpf(body.cpf);
  return out;
}

function parseLoginInput(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw bad("Corpo da requisição inválido");
  }
  const email = validateEmail(body.email);
  const password = requireString(body.password, "password", MAX_PASSWORD);
  return { email, password };
}

function parseChangePasswordInput(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw bad("Corpo da requisição inválido");
  }
  const currentPassword = requireString(body.currentPassword, "currentPassword", MAX_PASSWORD);
  const newPassword = validatePassword(body.newPassword);
  validateConfirm(newPassword, body.newPasswordConfirm, "newPasswordConfirm");
  return { currentPassword, newPassword };
}

module.exports = { parseRegisterInput, parseLoginInput, parseChangePasswordInput };