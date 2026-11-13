/* ==========================================================================
   NEXUS TECH — Dashboard do admin (v3.0-X3)
   Carrega /api/admin/dashboard e renderiza os indicadores em tempo real
   (produtos, marcas, categorias, produtos sem estoque) e as últimas 5
   ações de auditoria. Sem dados fictícios.
   ========================================================================== */

import { getSession, apiRequest } from "../../utils/api.js";

const $ = (id) => document.getElementById(id);

function setText(id, value) {
  const el = $(id);
  if (el) el.textContent = value;
}

function setVisible(id, show) {
  const el = $(id);
  if (el) el.hidden = !show;
}

const ACTION_LABELS = {
  "login": "Login",
  "refresh": "Renovação de sessão",
  "logout": "Logout",
  "product.create": "Criou produto",
  "product.update": "Editou produto",
  "product.deactivate": "Desativou produto",
  "product.reactivate": "Reativou produto",
  "brand.create": "Criou marca",
  "brand.update": "Editou marca",
  "brand.delete": "Excluiu marca",
  "category.create": "Criou categoria",
  "category.update": "Editou categoria",
  "category.delete": "Excluiu categoria",
};

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function renderStats(data) {
  setText("db-products-active", String(data.products.active));
  setText("db-products-inactive", String(data.products.inactive));
  setText("db-brands", String(data.brands));
  setText("db-categories", String(data.categories));
  setText("db-out-stock", String(data.out_of_stock));
}

function renderRecentActions(actions) {
  const tbody = $("db-audit-tbody");
  if (!tbody) return;

  if (!actions.length) {
    setVisible("db-audit-empty", true);
    setVisible("db-audit-rows", false);
    setText("db-audit-total", "0 ações registradas");
    return;
  }

  setVisible("db-audit-empty", false);
  setVisible("db-audit-rows", true);
  setText("db-audit-total", `${actions.length} ações mais recentes`);
  tbody.textContent = "";

  for (const action of actions) {
    const tr = document.createElement("tr");

    const tdAction = document.createElement("td");
    const strong = document.createElement("strong");
    const label = ACTION_LABELS[action.action] || action.action;
    strong.textContent = label;
    const slug = document.createElement("span");
    slug.className = "admin-muted";
    slug.textContent = `${action.entity} #${action.entity_id ?? "—"}`;
    const stack = document.createElement("div");
    stack.className = "admin-cellstack";
    const inner = document.createElement("div");
    inner.append(strong, slug);
    stack.appendChild(inner);
    tdAction.appendChild(stack);
    tr.appendChild(tdAction);

    const tdWho = document.createElement("td");
    tdWho.textContent = action.admin_name || `Admin #${action.entity_id ?? ""}`;
    tr.appendChild(tdWho);

    const tdWhen = document.createElement("td");
    tdWhen.textContent = formatDate(action.created_at);
    tr.appendChild(tdWhen);

    tbody.appendChild(tr);
  }
}

function render(data) {
  renderStats(data);
  renderRecentActions(data.recent_actions || []);
}

async function load() {
  setVisible("admin-loading", true);
  try {
    const payload = await apiRequest("/dashboard");
    const data = (payload && payload.data) || {};
    setVisible("admin-loading", false);
    render(data);
  } catch (err) {
    setVisible("admin-loading", false);
    const error = $("db-error");
    if (error) {
      error.hidden = false;
      $("db-error-msg").textContent = err.message || "Não foi possível carregar o dashboard.";
    }
  }
}

function init() {
  const safe = document.getElementById("admin-panel");
  if (!safe) return;

  getSession().then((session) => {
    if (session) load();
  });
}

init();