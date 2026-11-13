/* ==========================================================================
   NEXUS TECH — Gestão de produtos (admin) — v3.0-X2
   Lista/filtra/pagina e alterna ativação consumindo a API real.
   Sem cache em storage; sem innerHTML com dados do usuário (usa DOM APIs).
   ========================================================================== */

import { apiRequest, buildQuery, getSession } from "../../utils/api.js";

const state = {
  q: "",
  categoryId: "",
  brandId: "",
  status: "all",
  page: 1,
  perPage: 10,
  totalPages: 0,
};

const $ = (id) => document.getElementById(id);

const brl = (cents) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    (cents || 0) / 100,
  );

function setVisible(id, show) {
  const el = $(id);
  if (el) el.hidden = !show;
}

function showAlert(message) {
  const el = $("products-alert");
  if (!el) return;
  el.textContent = message;
  el.hidden = false;
  const t = window.setTimeout(() => {
    el.hidden = true;
    window.clearTimeout(t);
  }, 8000);
}

function fillSelect(id, items, labelOf) {
  const select = $(id);
  if (!select) return;
  const current = select.value;
  select.textContent = "";
  for (const item of items) {
    const option = document.createElement("option");
    option.value = String(item.id);
    option.textContent = labelOf(item);
    select.appendChild(option);
  }
  if (current) select.value = current;
}

async function loadOptions() {
  try {
    const [brands, categories] = await Promise.all([
      apiRequest("/brands"),
      apiRequest("/categories"),
    ]);
    fillSelect("filter-brand", brands.data || [], (b) => b.name);
    fillSelect("filter-category", categories.data || [], (c) => c.name);
  } catch (err) {
    // Filtros ficam vazios; a listagem continua independente deles.
  }
}

function renderRows(products) {
  setVisible("products-empty", products.length === 0);
  setVisible("products-list", products.length > 0);
  if (!products.length) return;

  const tbody = $("products-tbody");
  tbody.textContent = "";
  for (const p of products) tbody.appendChild(rowFor(p));
}

function rowFor(p) {
  const tr = document.createElement("tr");

  const tdProduct = document.createElement("td");
  const stack = document.createElement("div");
  stack.className = "admin-cellstack";

  const thumb = document.createElement("img");
  thumb.className = "admin-cellstack__thumb";
  thumb.alt = "";
  thumb.loading = "lazy";
  if (p.image) {
    thumb.src = p.image;
  } else {
    thumb.classList.add("admin-cellstack__thumb--empty");
    thumb.hidden = true;
  }
  const inner = document.createElement("div");
  const name = document.createElement("strong");
  name.textContent = p.name;
  const slug = document.createElement("span");
  slug.className = "admin-muted";
  slug.textContent = p.slug;
  inner.append(name, slug);
  stack.append(thumb, inner);
  tdProduct.appendChild(stack);
  tr.appendChild(tdProduct);

  const tdCategory = cell(p.category || "—");
  tr.appendChild(tdCategory);

  const tdBrand = cell(p.brand || "—");
  tr.appendChild(tdBrand);

  const tdPrice = cell(brl(p.price_cents), "cell-num");
  tr.appendChild(tdPrice);

  const tdStock = cell(String(p.stock), "cell-num");
  tr.appendChild(tdStock);

  const tdStatus = document.createElement("td");
  const badge = document.createElement("span");
  badge.className = p.is_active ? "admin-badge admin-badge--active" : "admin-badge admin-badge--inactive";
  badge.textContent = p.is_active ? "Ativo" : "Inativo";
  tdStatus.appendChild(badge);
  tr.appendChild(tdStatus);

  const tdActions = document.createElement("td");
  const actions = document.createElement("div");
  actions.className = "admin-rowactions";

  const viewBtn = document.createElement("a");
  viewBtn.className = "admin-btn admin-btn--small";
  viewBtn.href = `product-form.html?id=${p.id}&view=1`;
  viewBtn.textContent = "Ver";
  actions.appendChild(viewBtn);

  const editBtn = document.createElement("a");
  editBtn.className = "admin-btn admin-btn--small";
  editBtn.href = `product-form.html?id=${p.id}`;
  editBtn.textContent = "Editar";
  actions.appendChild(editBtn);

  const toggleBtn = document.createElement("button");
  toggleBtn.type = "button";
  toggleBtn.className = p.is_active
    ? "admin-btn admin-btn--small admin-btn--danger"
    : "admin-btn admin-btn--small";
  toggleBtn.textContent = p.is_active ? "Desativar" : "Ativar";
  toggleBtn.setAttribute("data-id", String(p.id));
  toggleBtn.setAttribute("data-action", p.is_active ? "deactivate" : "activate");
  toggleBtn.addEventListener("click", onToggle);
  actions.appendChild(toggleBtn);

  tdActions.appendChild(actions);
  tr.appendChild(tdActions);

  return tr;
}

function cell(text, className) {
  const td = document.createElement("td");
  if (className) td.className = className;
  td.textContent = text;
  return td;
}

async function onToggle(event) {
  const btn = event.currentTarget;
  const id = btn.getAttribute("data-id");
  const action = btn.getAttribute("data-action");
  btn.disabled = true;
  try {
    await apiRequest(`/products/${id}/${action}`, { method: "PATCH" });
    await load();
  } catch (err) {
    showAlert(err.message || "Falha ao atualizar o status.");
    btn.disabled = false;
  }
}

function renderPagination() {
  setVisible("products-pagination", state.totalPages > 0);
  if (!state.totalPages) return;
  $("products-pageinfo").textContent = `Página ${state.page} de ${state.totalPages}`;
  $("page-prev").disabled = state.page <= 1;
  $("page-next").disabled = state.page >= state.totalPages;
}

async function load() {
  setVisible("products-loading", true);
  setVisible("products-error", false);
  setVisible("products-list", false);
  setVisible("products-empty", false);
  setVisible("products-pagination", false);

  const query = buildQuery({
    q: state.q || undefined,
    category_id: state.categoryId || undefined,
    brand_id: state.brandId || undefined,
    status: state.status === "all" ? undefined : state.status,
    page: state.page,
    per_page: state.perPage,
  });

  try {
    const payload = await apiRequest(`/products${query}`);
    const products = (payload && payload.data) || [];
    const meta = (payload && payload.meta) || {};
    state.totalPages = meta.total_pages || 0;
    setVisible("products-loading", false);
    renderRows(products);
    renderPagination();
  } catch (err) {
    setVisible("products-loading", false);
    setVisible("products-error", true);
    $("products-error-msg").textContent = err.message || "Não foi possível carregar os produtos.";
  }
}

function bindEvents() {
  $("filter-search").addEventListener("click", () => {
    state.q = $("filter-q").value.trim();
    state.page = 1;
    load();
  });
  $("filter-q").addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      state.q = $("filter-q").value.trim();
      state.page = 1;
      load();
    }
  });
  $("filter-status").addEventListener("change", (event) => {
    state.status = event.target.value;
    state.page = 1;
    load();
  });
  $("filter-category").addEventListener("change", (event) => {
    state.categoryId = event.target.value;
    state.page = 1;
    load();
  });
  $("filter-brand").addEventListener("change", (event) => {
    state.brandId = event.target.value;
    state.page = 1;
    load();
  });
  $("page-prev").addEventListener("click", () => {
    if (state.page > 1) {
      state.page -= 1;
      load();
    }
  });
  $("page-next").addEventListener("click", () => {
    if (state.page < state.totalPages) {
      state.page += 1;
      load();
    }
  });
  $("products-retry").addEventListener("click", load);
}

function handleUrlParams() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("ok") === "1") showAlert("Operação concluída com sucesso.");
}

function init() {
  const safe = document.querySelector("body[data-page='admin-products']");
  if (!safe) return;

  bindEvents();
  handleUrlParams();

  getSession().then((session) => {
    if (session) {
      loadOptions();
      load();
    }
  });
}

init();