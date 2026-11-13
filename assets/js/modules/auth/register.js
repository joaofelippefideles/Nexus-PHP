/* ==========================================================================
   NEXUS TECH — Cadastro de usuário (v2.1)
   Validação completa no frontend + persistência MOCK de dados NÃO sensíveis
   em localStorage (chave "nexus:user") OU cadastro real via API.

   MODOS (config.js — sem editar os módulos):
   - "mock" (DEFAULT): comportamento atual, nada vai a /api;
   - "api" : POST /api/auth/register via user-api.js (user_profile criado).

   SEGURANÇA DA SENHA:
   - a senha/confirmação transitam SOMENTE em memória/corpo do POST;
   - NUNCA são gravadas em localStorage, sessionStorage, cookies ou URL;
   - o cadastro real NÃO gera/armazena access token (sessão segue mock);
   - erros da API mapeados sem revelar detalhes internos (5xx genérico).
   ========================================================================== */

import { isStorefrontAuthApiEnabled } from "../../utils/config.js";
import userApi from "../../utils/user-api.js";

const USER_KEY = "nexus:user";

const VALIDATORS = {
  name: (value) =>
    value.trim().length >= 2 || "Informe seu nome completo (mínimo 2 letras).",
  email: (value) =>
    /^\S+@\S+\.\S+$/.test(value.trim()) || "Informe um e-mail válido.",
  phone: (value) =>
    normalizeDigits(value).length >= 8 ||
    "Informe um telefone com DDD (mínimo 8 dígitos).",
  cpf: (value) =>
    isValidCpf(value.trim()) ||
    "Informe um CPF válido (formato 000.000.000-00).",
  password: (value) =>
    /^(?=.*\d)(?=.*[A-Za-z]).{8,}$/.test(value) ||
    "A senha deve ter no mínimo 8 caracteres, com letras e números.",
  confirm: (value) => {
    if (value === "") return "Confirme sua senha.";
    const password = document.getElementById("register-password");
    const match = password && value === password.value;
    return match ? true : "As senhas não coincidem.";
  },
  terms: (value) =>
    Boolean(value) || "Você precisa aceitar os Termos de Uso para criar a conta.",
  privacy: (value) =>
    Boolean(value) || "Você precisa aceitar a Política de Privacidade.",
};

/* --------------------------------------------------------------------------
   STORAGE MOCK (apenas dados não sensíveis)
-------------------------------------------------------------------------- */

function read(key) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    return null;
  }
}

function write(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    return false;
  }
}

function getStoredUser() {
  const data = read(USER_KEY);
  return data && typeof data === "object" ? data : null;
}

/* NUNCA recebe a senha — apenas os dados não sensíveis do cadastro. */
function saveUser(user) {
  return write(USER_KEY, {
    id: user.id || "user-" + Date.now().toString(36),
    name: user.name || "",
    email: user.email || "",
    phone: user.phone || "",
    cpf: user.cpf || "",
    createdAt: user.createdAt || new Date().toISOString(),
  });
}

/* --------------------------------------------------------------------------
   CPF — algoritmo oficial de dígitos verificadores
-------------------------------------------------------------------------- */

function isValidCpf(value) {
  const digits = String(value).replace(/\D/g, "");
  if (digits.length !== 11) return false;
  // Rejeita sequências óbvias (todos os dígitos iguais, progressão conhecida)
  if (/^(\d)\1{10}$/.test(digits)) return false;
  if (digits === "12345678909") return false;

  let sum = 0;
  for (let i = 0; i < 9; i += 1) {
    sum += Number(digits[i]) * (10 - i);
  }
  let first = 11 - (sum % 11);
  if (first >= 10) first = 0;
  if (first !== Number(digits[9])) return false;

  sum = 0;
  for (let i = 0; i < 10; i += 1) {
    sum += Number(digits[i]) * (11 - i);
  }
  let second = 11 - (sum % 11);
  if (second >= 10) second = 0;
  return second === Number(digits[10]);
}

function normalizeDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

/* --------------------------------------------------------------------------
   VALIDAÇÃO (padrão do projeto — sem alert(); mensagens associadas)
-------------------------------------------------------------------------- */

function setFieldError(field, message) {
  const wrap = field.closest(".contact-form__field");
  if (!wrap) return;
  const described = field.getAttribute("aria-describedby")
    ? field.getAttribute("aria-describedby").trim().split(/\s+/)
    : [];
  const describedEl =
    described
      .map((id) => document.getElementById(id))
      .find((el) => el && el.classList.contains("contact-form__error")) ||
    described
      .map((id) => document.getElementById(id))
      .find(Boolean) ||
    null;

  wrap.classList.toggle("has-error", Boolean(message));
  if (message) {
    field.setAttribute("aria-invalid", "true");
    if (describedEl) describedEl.textContent = message;
  } else {
    field.removeAttribute("aria-invalid");
    if (describedEl) describedEl.textContent = "";
  }
}

function validateField(field) {
  const rule = VALIDATORS[field.getAttribute("data-validate")];
  if (!rule) return "";
  const value = field.type === "checkbox" ? field.checked : field.value;
  const result = rule(value, field);
  return result === true ? "" : result;
}

function validateGroup(container) {
  const fields = container.querySelectorAll("[data-validate]");
  let firstError = null;

  for (const field of fields) {
    const message = validateField(field);
    setFieldError(field, message);
    if (message && !firstError) firstError = field;
  }

  return firstError;
}

/* --------------------------------------------------------------------------
   MENSAGENS ACESSÍVEIS
-------------------------------------------------------------------------- */

function announce(message) {
  const status = document.getElementById("register-status");
  if (status) status.textContent = message;
}

function hideFeedback() {
  const feedback = document.getElementById("register-feedback");
  if (!feedback) return;
  feedback.hidden = true;
  feedback.textContent = "";
  feedback.classList.remove("alert--success", "alert--warning");
}

function showFeedback(message, type) {
  const feedback = document.getElementById("register-feedback");
  if (!feedback) return;
  feedback.textContent = message;
  feedback.hidden = false;
  feedback.classList.toggle("alert--success", type === "success");
  feedback.classList.toggle("alert--warning", type === "warning");
  announce(message);
}

/* --------------------------------------------------------------------------
   SUBMIT
-------------------------------------------------------------------------- */

function readNonSensitive() {
  return {
    name: document.getElementById("register-name").value.trim(),
    email: document.getElementById("register-email").value.trim().toLowerCase(),
    phone: document.getElementById("register-phone").value.trim(),
    cpf: document.getElementById("register-cpf").value.trim(),
  };
}

/* Error mapping da API — sem revelar detalhes internos nem senha. */
function mapRegisterError(err) {
  const status = err && err.status;
  if (!status || status === 0) {
    return "Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.";
  }
  if (status >= 500) {
    return "Ocorreu um erro inesperado no servidor. Tente novamente em instantes.";
  }
  if (err && typeof err.message === "string" && err.message !== "") {
    return err.message; // 400 (dados inválidos) e 409 (e-mail/CPF) — mensagem do servidor
  }
  return "Não foi possível criar a conta. Revise os dados e tente novamente.";
}

/* Cadastro REAL (modo api). Persiste APENAS dados não sensíveis; o access
   token NÃO existe no cadastro (sessão segue mock). Resposta 201 = sucesso. */
async function submitToApi(user) {
  const password = document.getElementById("register-password").value;
  const passwordConfirm = document.getElementById("register-password-confirm").value;

  try {
    const data = await userApi.register({
      name: user.name,
      email: user.email,
      phone: user.phone,
      cpf: user.cpf,
      password,
      passwordConfirm,
    });

    const serverUser =
      data && data.user && typeof data.user === "object" ? data.user : {};
    saveUser({
      id: serverUser.id || undefined,
      name: serverUser.name || user.name,
      email: serverUser.email || user.email,
      phone: user.phone,
      cpf: user.cpf,
      createdAt: serverUser.createdAt || undefined,
    });
    showSuccess({ name: serverUser.name || user.name });
  } catch (err) {
    showFeedback(mapRegisterError(err), "warning");
    if (err && err.status === 409) {
      document.getElementById("register-email").focus();
    } else {
      const submit = document.getElementById("register-submit");
      if (submit) submit.focus();
    }
  }
}

async function handleSubmit(event) {
  event.preventDefault();

  const form = document.getElementById("register-form");
  const firstError = validateGroup(form);

  if (firstError) {
    firstError.focus();
    hideFeedback();
    announce("Revise os campos destacados antes de criar sua conta.");
    return;
  }

  const user = readNonSensitive();

  if (isStorefrontAuthApiEnabled()) {
    await submitToApi(user);
    return;
  }

  const stored = getStoredUser();
  if (stored && stored.email === user.email) {
    showFeedback("Já existe uma conta cadastrada com este e-mail.", "warning");
    document.getElementById("register-email").focus();
    return;
  }

  saveUser(user);
  showSuccess(user);
}

/* --------------------------------------------------------------------------
   SUCESSO (mock e api — nenhum token/sessão real é criado nesta fase)
-------------------------------------------------------------------------- */

function showSuccess(user) {
  const form = document.getElementById("register-form");
  const success = document.getElementById("register-success");

  if (form) form.hidden = true;
  if (!success) return;

  const meta = document.getElementById("register-success-meta");
  if (meta) {
    const firstName = user.name.trim().split(/\s+/)[0] || "";
    meta.textContent = `Bem-vindo(a)${firstName ? ", " + firstName : ""}!`;
  }

  success.hidden = false;
  const title = document.getElementById("register-success-title");
  if (title) title.focus();
  announce("Conta criada com sucesso!");
}

/* --------------------------------------------------------------------------
   INICIALIZAÇÃO
-------------------------------------------------------------------------- */

function bindEvents() {
  const form = document.getElementById("register-form");
  if (!form) return;

  form.addEventListener("submit", handleSubmit);

  // Limpa o erro enquanto o usuário digita/seleciona
  form.addEventListener("input", (event) => {
    const field = event.target.closest("[data-validate]");
    if (field) setFieldError(field, "");
  });
  form.addEventListener("change", (event) => {
    const field = event.target.closest("[data-validate]");
    if (field) setFieldError(field, "");
  });
}

function init() {
  hideFeedback();
  bindEvents();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}