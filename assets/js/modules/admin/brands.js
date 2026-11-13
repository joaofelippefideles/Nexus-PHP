/* ==========================================================================
   NEXUS TECH — Gestão de marcas (admin) — v3.0-X3
   Lista marcas reais da API e permite exclusão com confirmação.
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
  const el = $("brands-alert");
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

function rowFor(brand) {
  const tr = document.createElement("tr");

  const tdName = document.createElement("td");
  const stack = document.createElement("div");
  stack.className = "admin-cellstack";
  const name = document.createElement("strong");
  name.textContent = brand.name;
  stack.appendChild(name);
  tdName.appendChild(stack);
  tr.appendChild(tdName);

  tr.appendChild(cell(brand.slug));

  tr.appendChild(cell(String(brand.product_count || 0), "cell-num"));

  const tdActions = document.createElement("td");
  const actions = document.createElement("div");
  actions.className = "admin-rowactions";

  const editBtn = document.createElement("a");
  editBtn.className = "admin-btn admin-btn--small";
  editBtn.href = `brand-form.html?id=${brand.id}`;
  editBtn.textContent = "Editar";
  actions.appendChild(editBtn);

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className = "admin-btn admin-btn--small admin-btn--danger";
  deleteBtn.textContent = "Excluir";
  deleteBtn.addEventListener("click", () => onDelete(brand));
  actions.appendChild(deleteBtn);

  tdActions.appendChild(actions);
  tr.appendChild(tdActions);

  return tr;
}

async function onDelete(brand) {
  const confirmed = window.confirm(
    `Excluir a marca "${brand.name}"? Esta ação é irreversível.`
  );
  if (!confirmed) return;

  try {
    await apiRequest(`/brands/${brand.id}`, { method: "DELETE" });
    showAlert(`Marca "${brand.name}" excluída com sucesso.`, "success");
    load();
  } catch (err) {
    showAlert(err.message || "Não foi possível excluir a marca.", "danger");
  }
}

function renderRows(brands) {
  setVisible("brands-empty", brands.length === 0);
  setVisible("brands-list", brands.length > 0);
  if (!brands.length) return;

  const tbody = $("brands-tbody");
  tbody.textContent = "";
  for (const brand of brands) tbody.appendChild(rowFor(brand));
}

async function load() {
  setVisible("brands-loading", true);
  setVisible("brands-error", false);
  setVisible("brands-list", false);
  setVisible("brands-empty", false);

  try {
    const payload = await apiRequest("/brands");
    const brands = (payload && payload.data) || [];
    setVisible("brands-loading", false);
    renderRows(brands);
  } catch (err) {
    setVisible("brands-loading", false);
    setVisible("brands-error", true);
    $("brands-error-msg").textContent = err.message || "Não foi possível carregar as marcas.";
  }
}

function bindEvents() {
  $("brands-retry").addEventListener("click", load);
}

function handleUrlParams() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("ok") === "1") showAlert("Operação concluída com sucesso.", "success");
}

function init() {
  const safe = document.querySelector("body[data-page='admin-brands']");
  if (!safe) return;

  bindEvents();
  handleUrlParams();

  getSession().then((session) => {
    if (session) load();
  });
}

init();