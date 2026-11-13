/* ==========================================================================
   NEXUS TECH — Cadastro (PHP + Fetch API) v4.0
   --------------------------------------------------------------------------
   - Validação completa no navegador (espelha includes/validacao.php);
   - Máscaras de telefone e CPF;
   - Medidor de força de senha e botões mostrar/ocultar;
   - Verificação de e-mail já cadastrado via AJAX (GET ?check_email=);
   - Envio com Fetch API para pages/cadastro.php (JSON), com fallback
     automático para POST tradicional caso o JavaScript esteja desativado;
   - Mensagens de sucesso/erro acessíveis (aria-live).
   ========================================================================== */

import {
  formatCpf,
  formatPhone,
  isValidCpf,
  isValidEmail,
  isValidName,
  isValidPassword,
  isValidPhone,
  passwordStrength,
} from "../../utils/validators.js";

const EMAIL_TAKEN_MESSAGE = "Este e-mail já está cadastrado.";
const state = {
  emailTaken: "",
  emailCheckController: null,
  emailCheckTimer: null,
};

/* --------------------------------------------------------------------------
   REGRAS DE VALIDAÇÃO (mesmas do servidor)
-------------------------------------------------------------------------- */

const RULES = {
  name: (value) =>
    isValidName(value) || "Informe seu nome completo (2 a 120 caracteres).",
  email: (value) => isValidEmail(value) || "Informe um e-mail válido.",
  phone: (value) =>
    isValidPhone(value) || "Informe um telefone com DDD, ex.: (11) 91234-5678.",
  cpf: (value) => isValidCpf(value) || "Informe um CPF válido (000.000.000-00).",
  password: (value) =>
    isValidPassword(value) ||
    "A senha deve ter no mínimo 8 caracteres, com letras e números.",
  confirm: (value) => {
    if (value === "") return "Confirme sua senha.";
    const password = document.getElementById("register-password");
    return password && value === password.value
      ? true
      : "As senhas não coincidem.";
  },
  terms: (value) =>
    Boolean(value) || "Você precisa aceitar os Termos de Uso para criar a conta.",
  privacy: (value) =>
    Boolean(value) || "Você precisa aceitar a Política de Privacidade.",
};

/* --------------------------------------------------------------------------
   HELPERS DE DOM
-------------------------------------------------------------------------- */

function fields() {
  return {
    form: document.getElementById("register-form"),
    name: document.getElementById("register-name"),
    email: document.getElementById("register-email"),
    phone: document.getElementById("register-phone"),
    cpf: document.getElementById("register-cpf"),
    password: document.getElementById("register-password"),
    passwordConfirm: document.getElementById("register-password-confirm"),
    terms: document.getElementById("register-terms"),
    privacy: document.getElementById("register-privacy"),
  };
}

function findErrorElement(field) {
  const described = (field.getAttribute("aria-describedby") || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  const byDescription = described
    .map((id) => document.getElementById(id))
    .find((element) => element && element.classList.contains("contact-form__error"));

  if (byDescription) return byDescription;

  return document.getElementById(`register-${field.name}-err`);
}

function setFieldError(field, message) {
  if (!field) return;
  const wrap = field.closest(".contact-form__field");
  const errorElement = findErrorElement(field);
  const hasError = Boolean(message);

  if (wrap) wrap.classList.toggle("has-error", hasError);

  if (hasError) {
    field.setAttribute("aria-invalid", "true");
    if (errorElement) errorElement.textContent = message;
  } else {
    field.removeAttribute("aria-invalid");
    if (errorElement) errorElement.textContent = "";
  }
}

function clearErrors(form) {
  form.querySelectorAll("[data-validate]").forEach((field) => setFieldError(field, ""));
}

function announce(message) {
  const status = document.getElementById("register-status");
  if (status) status.textContent = message;
}

function hideFeedback() {
  const feedback = document.getElementById("register-feedback");
  if (!feedback) return;
  feedback.hidden = true;
  feedback.textContent = "";
  feedback.classList.remove("alert--success", "alert--warning", "alert--danger");
}

function showFeedback(message, type = "warning") {
  const feedback = document.getElementById("register-feedback");
  if (!feedback) return;
  feedback.textContent = message;
  feedback.hidden = false;
  feedback.classList.toggle("alert--success", type === "success");
  feedback.classList.toggle("alert--warning", type === "warning");
  feedback.classList.toggle("alert--danger", type === "danger");
  announce(message);
}

/* --------------------------------------------------------------------------
   VALIDAÇÃO
-------------------------------------------------------------------------- */

function validateField(field) {
  const rule = RULES[field.getAttribute("data-validate")];
  if (!rule) return "";

  const value = field.type === "checkbox" ? field.checked : field.value;
  const result = rule(value);
  return result === true ? "" : result;
}

function validateGroup(form) {
  const all = form.querySelectorAll("[data-validate]");
  let firstError = null;

  all.forEach((field) => {
    let message = validateField(field);

    if (
      !message &&
      field.name === "email" &&
      state.emailTaken !== "" &&
      field.value.trim().toLowerCase() === state.emailTaken
    ) {
      message = EMAIL_TAKEN_MESSAGE;
    }

    setFieldError(field, message);
    if (message && !firstError) firstError = field;
  });

  return firstError;
}

/* --------------------------------------------------------------------------
   MÁSCARAS E FEEDBACK EM TEMPO REAL
-------------------------------------------------------------------------- */

function bindMasks(form) {
  const phone = form.elements.namedItem("phone");
  const cpf = form.elements.namedItem("cpf");

  if (phone) {
    phone.addEventListener("input", () => {
      phone.value = formatPhone(phone.value);
    });
  }

  if (cpf) {
    cpf.addEventListener("input", () => {
      cpf.value = formatCpf(cpf.value);
    });
  }
}

function bindPasswordStrength(form) {
  const password = form.elements.namedItem("password");
  const confirm = form.elements.namedItem("passwordConfirm");
  const meter = document.getElementById("register-strength");
  const text = document.getElementById("register-strength-text");

  if (!password || !meter || !text) return;

  const update = () => {
    const { score, label } = passwordStrength(password.value);
    meter.hidden = password.value === "";
    meter.dataset.score = String(score);
    text.textContent = password.value === "" ? "" : `Força da senha: ${label}`;

    if (confirm && confirm.value !== "") {
      setFieldError(
        confirm,
        confirm.value === password.value ? "" : "As senhas não coincidem."
      );
    }
  };

  password.addEventListener("input", update);
  update();
}

function bindPasswordToggles(form) {
  form.querySelectorAll("[data-toggle-password]").forEach((button) => {
    button.addEventListener("click", () => {
      const target = document.getElementById(button.dataset.togglePassword);
      if (!target) return;

      const show = target.type === "password";
      target.type = show ? "text" : "password";
      button.setAttribute("aria-pressed", String(show));
      button.textContent = show ? "Ocultar" : "Mostrar";
    });
  });
}

/* --------------------------------------------------------------------------
   VERIFICAÇÃO DE E-MAIL (AJAX)
-------------------------------------------------------------------------- */

function bindEmailAvailability(form) {
  const email = form.elements.namedItem("email");
  const status = document.getElementById("register-email-status");
  if (!email || !status) return;

  const setStatus = (message, kind = "") => {
    status.textContent = message;
    status.dataset.state = kind;
  };

  const check = async () => {
    const value = email.value.trim().toLowerCase();
    state.emailTaken = "";

    if (value === "" || !isValidEmail(value)) {
      setStatus("");
      return;
    }

    if (state.emailCheckController) state.emailCheckController.abort();
    state.emailCheckController = new AbortController();

    setStatus("Verificando disponibilidade...", "loading");

    try {
      const response = await fetch(
        `${form.getAttribute("action")}?check_email=${encodeURIComponent(value)}`,
        {
          headers: { Accept: "application/json" },
          credentials: "same-origin",
          signal: state.emailCheckController.signal,
        }
      );

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload.ok !== true) {
        setStatus("");
        return;
      }

      if (payload.available === false) {
        state.emailTaken = value;
        setStatus(EMAIL_TAKEN_MESSAGE, "taken");
        setFieldError(email, EMAIL_TAKEN_MESSAGE);
      } else {
        setStatus("E-mail disponível.", "available");
        setFieldError(email, "");
      }
    } catch (error) {
      if (error && error.name === "AbortError") return;
      setStatus("");
    }
  };

  email.addEventListener("blur", check);
  email.addEventListener("input", () => {
    if (state.emailCheckTimer) window.clearTimeout(state.emailCheckTimer);
    state.emailCheckTimer = window.setTimeout(check, 600);
  });
}

/* --------------------------------------------------------------------------
   ENVIO (Fetch API) + TRATAMENTO DE RESPOSTA
-------------------------------------------------------------------------- */

function setLoading(loading) {
  const submit = document.getElementById("register-submit");
  if (!submit) return;

  if (loading) {
    submit.dataset.originalText = submit.textContent;
    submit.textContent = "Criando conta...";
    submit.disabled = true;
    submit.setAttribute("aria-busy", "true");
  } else {
    submit.textContent = submit.dataset.originalText || "Criar conta";
    submit.disabled = false;
    submit.removeAttribute("aria-busy");
  }
}

function focusFirstServerError(form, errors) {
  const order = ["name", "email", "phone", "cpf", "password", "passwordConfirm", "terms", "privacy"];
  for (const key of order) {
    if (!errors[key]) continue;
    const field = form.elements.namedItem(key);
    if (field && typeof field.focus === "function") {
      field.focus();
      return;
    }
  }
}

function handleServerError(form, payload, status) {
  const errors = payload && typeof payload.errors === "object" ? payload.errors : {};

  Object.entries(errors).forEach(([key, message]) => {
    const field = form.elements.namedItem(key);
    if (field) setFieldError(field, String(message));
  });

  const message =
    (payload && typeof payload.message === "string" && payload.message) ||
    (status === 409
      ? "Já existe uma conta com os dados informados."
      : "Revise os campos destacados e tente novamente.");

  showFeedback(message, status === 409 ? "warning" : "danger");
  focusFirstServerError(form, errors);
}

function showSuccess(name) {
  const form = document.getElementById("register-form");
  const success = document.getElementById("register-success");
  const meta = document.getElementById("register-success-meta");
  const title = document.getElementById("register-success-title");

  if (form) form.hidden = true;
  if (!success) return;

  if (meta) {
    const firstName = String(name || "").trim().split(/\s+/)[0] || "";
    meta.textContent = `Bem-vindo(a)${firstName ? ", " + firstName : ""}! Sua conta foi criada com sucesso.`;
  }

  success.hidden = false;
  if (title) title.focus();
  success.scrollIntoView({ behavior: "smooth", block: "center" });
  announce("Conta criada com sucesso!");
}

async function handleSubmit(event) {
  event.preventDefault();

  const form = event.currentTarget;
  hideFeedback();

  const firstError = validateGroup(form);
  if (firstError) {
    firstError.focus();
    announce("Revise os campos destacados antes de criar sua conta.");
    return;
  }

  const confirmed = window.confirm(
    "Confirma a criação da conta com os dados informados?"
  );
  if (!confirmed) {
    announce("Cadastro cancelado pelo usuário.");
    return;
  }

  setLoading(true);

  try {
    const response = await fetch(form.getAttribute("action"), {
      method: "POST",
      headers: {
        Accept: "application/json",
        "X-Requested-With": "XMLHttpRequest",
      },
      body: new FormData(form),
      credentials: "same-origin",
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok || payload.ok !== true) {
      handleServerError(form, payload, response.status);
      return;
    }

    const user = payload.user && typeof payload.user === "object" ? payload.user : {};
    showSuccess(user.name || form.elements.namedItem("name")?.value || "");
  } catch (error) {
    showFeedback(
      "Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.",
      "danger"
    );
  } finally {
    setLoading(false);
  }
}

/* --------------------------------------------------------------------------
   INICIALIZAÇÃO
-------------------------------------------------------------------------- */

function init() {
  const form = document.getElementById("register-form");
  if (!form) return;

  // A mensagem vinda do servidor (POST sem JavaScript) deve permanecer
  // visível; ela só é limpa quando o usuário envia o formulário novamente.
  bindMasks(form);
  bindPasswordStrength(form);
  bindPasswordToggles(form);
  bindEmailAvailability(form);

  form.addEventListener("submit", handleSubmit);

  form.addEventListener("input", (event) => {
    const field = event.target.closest("[data-validate]");
    if (!field) return;

    if (field.name === "email") {
      state.emailTaken = "";
    }

    setFieldError(field, "");
  });

  form.addEventListener("change", (event) => {
    const field = event.target.closest("[data-validate]");
    if (field) setFieldError(field, "");
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
