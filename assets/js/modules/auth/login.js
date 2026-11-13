/* ==========================================================================
   NEXUS TECH — Login de usuário comum (v3.2)
   Validação + sessão real (API) ou MOCK.

   MODOS (config.js — sem editar este módulo):
   - "mock" (DEFAULT): sessão vinculada ao usuário cadastrado ("nexus:user");
   - "api" : POST /api/auth/login -> cookie httpOnly + access token em
     memória; confirmação via GET /api/auth/me.

   SEGURANÇA / LIMITAÇÕES DOCUMENTADAS:
   - a senha NUNCA é gravada em localStorage, sessionStorage, cookies, URL,
     HTML ou logs;
   - no modo api o access token vive SOMENTE na memória do user-api.js;
   - o refresh token fica em cookie httpOnly (nt_user_refresh) — inacessível
     ao JavaScript;
   - no modo mock não existe senha persistida (v2.0): a sessão da aba
     ("nexus:auth") contém apenas { userId, authenticatedAt };
   - o parâmetro ?next é sanitizado (regex) e aceita somente um arquivo HTML
     local — valores externos/arbitrários são ignorados.
   ========================================================================== */

import {
  getStoredUser,
  getAuthUser,
  createSession,
  syncAuthHeader,
  authBasePath,
  authReady,
  setAuthenticatedUser,
} from "./auth.js";

import { isStorefrontAuthApiEnabled } from "../../utils/config.js";
import userApi from "../../utils/user-api.js";

const VALIDATORS = {
  email: (value) => {
    const v = value.trim();
    if (v === "") return "Informe seu e-mail.";
    return /^\S+@\S+\.\S+$/.test(v) || "Informe um e-mail válido.";
  },
  password: (value) => value !== "" || "Informe sua senha.",
};

/* --------------------------------------------------------------------------
   VALIDAÇÃO (padrão do projeto — sem alert(); mensagens associadas)
-------------------------------------------------------------------------- */

function setFieldError(field, message) {
  const wrap = field.closest(".contact-form__field");
  if (!wrap) return;
  const describedBy = (field.getAttribute("aria-describedby") || "")
    .trim()
    .split(/\s+/);
  const describedEl = describedBy
    .map((id) => document.getElementById(id))
    .find((el) => el && el.classList.contains("contact-form__error"));

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
  const result = rule(field.value);
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
  const status = document.getElementById("login-status");
  if (status) status.textContent = message;
}

function hideFeedback() {
  const feedback = document.getElementById("login-feedback");
  if (!feedback) return;
  feedback.hidden = true;
  feedback.textContent = "";
  feedback.classList.remove("alert--success", "alert--warning");
}

function showFeedback(message, type) {
  const feedback = document.getElementById("login-feedback");
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

/* Página de retorno após o login (parâmetro "?next=checkout.html", usado no
   fluxo de compra v2.3). Aceita somente um nome de página simples (ex.: um
   "checkout.html") — sem esquema, caminho ou query arbitrários; caso
   contrário retorna null e o login segue para perfil.html. */
function nextPage() {
  try {
    const next = new URL(window.location.href).searchParams.get("next") || "";
    return /^[A-Za-z0-9_\-]+\.html$/.test(next) ? next : null;
  } catch (err) {
    return null;
  }
}

/* Erros da API em mensagens amigáveis (sem revelar detalhes internos). */
function mapLoginError(err) {
  const status = err && err.status;
  if (!status || status === 0) {
    return "Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.";
  }
  if (status === 401) {
    return "E-mail ou senha inválidos.";
  }
  if (status === 429) {
    return "Muitas tentativas de login. Tente novamente mais tarde.";
  }
  if (status >= 500) {
    return "Ocorreu um erro inesperado no servidor. Tente novamente em instantes.";
  }
  if (err && typeof err.message === "string" && err.message !== "") {
    return err.message;
  }
  return "Não foi possível entrar. Revise os dados e tente novamente.";
}

function redirectAfterLogin() {
  const target = authBasePath() + (nextPage() || "perfil.html");
  window.setTimeout(() => {
    window.location.href = target;
  }, 600);
}

/* Login REAL (modo api): login -> confirma /me -> header -> redirect. */
async function submitToApi(email, password) {
  try {
    const data = await userApi.login({ email, password });
    let user = data && data.user && data.user.id ? data.user : null;

    // Confirma a sessão pelo endpoint protegido (o token fica em memória).
    try {
      const meUser = await userApi.me();
      if (meUser && meUser.id) user = meUser;
    } catch (err) {
      // login já retornou sessão válida; /me é confirmação adicional
    }
    if (!user) user = { email };

    setAuthenticatedUser(user);
    syncAuthHeader();

    const firstName = String(user.name || "").trim().split(/\s+/)[0] || "";
    showFeedback(`Bem-vindo(a)${firstName ? ", " + firstName : ""}! Entrando na sua conta...`, "success");
    announce("Login realizado com sucesso!");
    redirectAfterLogin();
  } catch (err) {
    showFeedback(mapLoginError(err), "warning");
    if (err && err.status === 401) {
      document.getElementById("login-email").focus();
    } else {
      const submit = document.getElementById("login-submit");
      if (submit) submit.focus();
    }
  }
}

async function handleSubmit(event) {
  event.preventDefault();

  const form = document.getElementById("login-form");
  const firstError = validateGroup(form);

  if (firstError) {
    firstError.focus();
    hideFeedback();
    announce("Revise os campos destacados para entrar.");
    return;
  }

  const email = document.getElementById("login-email").value.trim().toLowerCase();
  const password = document.getElementById("login-password").value;

  if (isStorefrontAuthApiEnabled()) {
    await submitToApi(email, password);
    return;
  }

  const user = getStoredUser();

  if (!user || String(user.email || "").trim().toLowerCase() !== email) {
    showFeedback("Não encontramos uma conta cadastrada com este e-mail.", "warning");
    document.getElementById("login-email").focus();
    return;
  }

  createSession(user.id);
  syncAuthHeader();

  const firstName = String(user.name || "").trim().split(/\s+/)[0] || "";
  showFeedback(`Bem-vindo(a)${firstName ? ", " + firstName : ""}! Entrando na sua conta...`, "success");
  announce("Login realizado com sucesso!");
  redirectAfterLogin();
}

/* --------------------------------------------------------------------------
   INICIALIZAÇÃO
-------------------------------------------------------------------------- */

function bindEvents() {
  const form = document.getElementById("login-form");
  if (!form) return;

  form.addEventListener("submit", handleSubmit);

  form.addEventListener("input", (event) => {
    const field = event.target.closest("[data-validate]");
    if (field) setFieldError(field, "");
  });
  form.addEventListener("change", (event) => {
    const field = event.target.closest("[data-validate]");
    if (field) setFieldError(field, "");
  });
}

/* Modo api: aguarda o boot (refresh -> /me) e, se já houver sessão, vai
   direto ao destino. Não usa o storage mock para decidir. */
async function initApi() {
  hideFeedback();
  bindEvents();

  let user = null;
  try {
    user = await authReady();
  } catch (err) {
    user = null;
  }

  if (user && user.id) {
    window.location.replace(authBasePath() + (nextPage() || "perfil.html"));
  }
}

function init() {
  if (isStorefrontAuthApiEnabled()) {
    initApi();
    return;
  }

  // Mock: já autenticado? Vai direto para o destino, sem recarregar.
  if (getAuthUser()) {
    window.location.replace(authBasePath() + (nextPage() || "perfil.html"));
    return;
  }
  hideFeedback();
  bindEvents();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}