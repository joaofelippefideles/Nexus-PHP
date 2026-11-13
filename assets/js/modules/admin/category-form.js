/* ==========================================================================
   NEXUS TECH — Formulário de categoria (admin) — v3.0-X3
   Cria (POST) ou edita (PUT) categorias via API real.
   - slug: no CREATE é opcional (auto-gerado se vazio); no EDIT só muda se
     o usuário alterar o campo (valor explícito).
   ========================================================================== */

import { apiRequest, getSession } from "../../utils/api.js";

const params = new URLSearchParams(window.location.search);
const categoryId = params.get("id");

const $ = (id) => document.getElementById(id);

function setAlert(message, kind) {
  const el = $("category-alert");
  if (!el) return;
  el.textContent = message;
  el.className = `admin-alert admin-alert--${kind || "warning"}`;
  el.hidden = false;
}

async function loadCategory() {
  try {
    const payload = await apiRequest(`/categories/${categoryId}`);
    const category = payload.data;
    $("form-title").textContent = "Editar categoria";
    $("field-name").value = category.name;
    $("field-slug").value = category.slug;
    $("field-slug").dataset.touched = "true"; // slug já é explícito na edição
  } catch (err) {
    setAlert(err.message || "Não foi possível carregar a categoria.", "danger");
    $("form-submit").hidden = true;
  }
}

function validate() {
  const name = $("field-name").value.trim();
  if (!name) return "Informe o nome da categoria.";

  const slug = $("field-slug").value.trim();
  if (slug && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
    return "Slug inválido: use apenas letras minúsculas, números e hífens.";
  }

  return null;
}

function buildPayload() {
  const slug = $("field-slug").value.trim();
  const payload = { name: $("field-name").value.trim() };
  if (slug) payload.slug = slug;
  return payload;
}

async function handleSubmit(event) {
  event.preventDefault();

  const error = validate();
  if (error) {
    setAlert(error, "warning");
    return;
  }

  const submitBtn = $("form-submit");
  submitBtn.disabled = true;
  try {
    if (categoryId) {
      await apiRequest(`/categories/${categoryId}`, {
        method: "PUT",
        body: buildPayload(),
      });
    } else {
      await apiRequest("/categories", {
        method: "POST",
        body: buildPayload(),
      });
    }
    window.location.replace("categories.html?ok=1");
  } catch (err) {
    setAlert(err.message || "Não foi possível salvar a categoria.", "danger");
    submitBtn.disabled = false;
  }
}

/* Mesma regra servidor-side: NFKD, sem acentos, minúsculas, hífen. */
function normalizeSlug(value) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function bindEvents() {
  $("category-form").addEventListener("submit", handleSubmit);
  $("form-cancel").addEventListener("click", () => {
    window.location.replace("categories.html");
  });

  $("field-name").addEventListener("input", () => {
    if ($("field-slug").dataset.touched !== "true") {
      $("field-slug").value = normalizeSlug($("field-name").value);
    }
  });
  $("field-slug").addEventListener("input", () => {
    $("field-slug").dataset.touched = "true";
  });
}

function init() {
  const safe = document.querySelector("body[data-page='admin-categories']");
  if (!safe) return;

  bindEvents();

  getSession().then((session) => {
    if (!session) return;
    if (categoryId) {
      loadCategory();
    } else {
      $("form-title").textContent = "Nova categoria";
    }
  });
}

init();