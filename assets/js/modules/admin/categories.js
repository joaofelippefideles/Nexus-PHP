/* ==========================================================================
   NEXUS TECH — Gestão de categorias (admin) — v3.0-X3
   Lista categorias reais da API e permite exclusão com confirmação.
   DELETE é hard-delete no servidor; dependências retornam 409 (exibido
   em alerta, sem perder a listagem).
   ========================================================================== */

import { apiRequest, getSession } from "../../utils/api.js";

const $ = (id) => document.getElementById(id);

function setVisible(id, show) {
  const el = $(id);
  if (el) el.hidden = !show;
}

function showAlert(message, kind) {
  const el = $("categories-alert");
  if (!el) return;
  el.textContent = message;
  el.className = `admin-alert admin-alert--${kind || "success"}`;
  el.hidden = false;
  const t = window.setTimeout(() => {
    el.hidden = true;
    window.clearTimeout(t);
  }, 8000);
}

function cell(text, className) {
  const td = document.createElement("td");
  if (className) td.className = className;
  td.textContent = text;
  return td;
}

function rowFor(category) {
  const tr = document.createElement("tr");

  const tdName = document.createElement("td");
  const stack = document.createElement("div");
  stack.className = "admin-cellstack";
  const name = document.createElement("strong");
  name.textContent = category.name;
  stack.appendChild(name);
  tdName.appendChild(stack);
  tr.appendChild(tdName);

  tr.appendChild(cell(category.slug));

  tr.appendChild(cell(String(category.product_count || 0), "cell-num"));

  const tdActions = document.createElement("td");
  const actions = document.createElement("div");
  actions.className = "admin-rowactions";

  const editBtn = document.createElement("a");
  editBtn.className = "admin-btn admin-btn--small";
  editBtn.href = `category-form.html?id=${category.id}`;
  editBtn.textContent = "Editar";
  actions.appendChild(editBtn);

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className = "admin-btn admin-btn--small admin-btn--danger";
  deleteBtn.textContent = "Excluir";
  deleteBtn.addEventListener("click", () => onDelete(category));
  actions.appendChild(deleteBtn);

  tdActions.appendChild(actions);
  tr.appendChild(tdActions);

  return tr;
}

async function onDelete(category) {
  const confirmed = window.confirm(
    `Excluir a categoria "${category.name}"? Esta ação é irreversível.`
  );
  if (!confirmed) return;

  try {
    await apiRequest(`/categories/${category.id}`, { method: "DELETE" });
    showAlert(`Categoria "${category.name}" excluída com sucesso.`, "success");
    load();
  } catch (err) {
    showAlert(err.message || "Não foi possível excluir a categoria.", "danger");
  }
}

function renderRows(categories) {
  setVisible("categories-empty", categories.length === 0);
  setVisible("categories-list", categories.length > 0);
  if (!categories.length) return;

  const tbody = $("categories-tbody");
  tbody.textContent = "";
  for (const category of categories) tbody.appendChild(rowFor(category));
}

async function load() {
  setVisible("categories-loading", true);
  setVisible("categories-error", false);
  setVisible("categories-list", false);
  setVisible("categories-empty", false);

  try {
    const payload = await apiRequest("/categories");
    const categories = (payload && payload.data) || [];
    setVisible("categories-loading", false);
    renderRows(categories);
  } catch (err) {
    setVisible("categories-loading", false);
    setVisible("categories-error", true);
    $("categories-error-msg").textContent = err.message || "Não foi possível carregar as categorias.";
  }
}

function bindEvents() {
  $("categories-retry").addEventListener("click", load);
}

function handleUrlParams() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("ok") === "1") showAlert("Operação concluída com sucesso.", "success");
}

function init() {
  const safe = document.querySelector("body[data-page='admin-categories']");
  if (!safe) return;

  bindEvents();
  handleUrlParams();

  getSession().then((session) => {
    if (session) load();
  });
}

init();