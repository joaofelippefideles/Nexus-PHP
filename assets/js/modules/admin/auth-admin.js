/* ==========================================================================
   NEXUS TECH — Login do Admin (v3.0-X1)
   Guard de sessão + autenticação real (API /api/admin/auth/login).
   Validação sem alert(); mensagens associadas aos campos (padrão do projeto).
   Em caso de sucesso redireciona para index.html do painel.
   ========================================================================== */

import { login, getSession } from "../../utils/api.js";

const VALIDATORS = {
  email: (value) => {
    const v = value.trim();
    if (v === "") return "Informe o e-mail do administrador.";
    return /^\S+@\S+\.\S+$/.test(v) || "Informe um e-mail válido.";
  },
  password: (value) => String(value || "") !== "" || "Informe a senha.",
};

function setFieldError(field, message) {
  const wrap = field.closest(".admin-auth__field");
  if (!wrap) return;
  const describedEl = wrap.querySelector(".admin-auth__error");
  wrap.classList.toggle("has-error", Boolean(message));
  if (message) {
    field.setAttribute("aria-invalid", "true");
    if (describedEl) describedEl.textContent = message;
  } else {
    field.removeAttribute("aria-invalid");
    if (describedEl) describedEl.textContent = "";
  }
}

function validateGroup(container) {
  const fields = container.querySelectorAll("[data-validate]");
  let firstError = null;
  for (const field of fields) {
    const rule = VALIDATORS[field.getAttribute("data-validate")];
    const result = rule ? rule(field.value) : "";
    const message = result === true ? "" : result;
    setFieldError(field, message);
    if (message && !firstError) firstError = field;
  }
  return firstError;
}

function setAlert(message, type) {
  const alert = document.getElementById("admin-login-alert");
  if (!alert) return;
  alert.textContent = message;
  alert.className = `admin-auth__alert admin-auth__alert--${type}`;
  alert.dataset.show = "true";
}

function clearAlert() {
  const alert = document.getElementById("admin-login-alert");
  if (alert) alert.dataset.show = "false";
}

async function handleSubmit(event) {
  event.preventDefault();

  const form = document.getElementById("admin-login-form");
  clearAlert();

  const firstError = validateGroup(form);
  if (firstError) {
    firstError.focus();
    return;
  }

  const button = document.getElementById("admin-login-submit");
  button.disabled = true;

  try {
    const user = await login({
      email: document.getElementById("admin-login-email").value.trim().toLowerCase(),
      password: document.getElementById("admin-login-password").value,
    });
    if (!user) throw new Error("Sessão não foi criada.");
    const firstName = String(user.name || "").trim().split(/\s+/)[0] || "";
    setAlert(`Bem-vindo(a)${firstName ? ", " + firstName : ""}! Entrando no painel...`, "success");
    window.setTimeout(() => window.location.replace("index.html"), 500);
  } catch (err) {
    setAlert(err.message || "Não foi possível entrar.", "warning");
    button.disabled = false;
    document.getElementById("admin-login-password").focus();
  }
}

function bindEvents() {
  const form = document.getElementById("admin-login-form");
  if (!form) return;
  form.addEventListener("submit", handleSubmit);
  form.addEventListener("input", (event) => {
    const field = event.target.closest("[data-validate]");
    if (field) setFieldError(field, "");
  });
}

async function init() {
  // Guard: com sessão (refresh cookie válido) vai direto ao painel.
  const session = await getSession();
  if (session) {
    window.location.replace("index.html");
    return;
  }
  bindEvents();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}