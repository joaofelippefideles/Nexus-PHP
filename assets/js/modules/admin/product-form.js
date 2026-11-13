/* ==========================================================================
   NEXUS TECH — Formulário de produto (admin) — v3.0-X2
   Cria (POST), edita (PUT) e exibe (view) produtos via API real.
   - slug: no CREATE é opcional (auto-gerado se vazio); no EDIT só muda se
     o usuário alterar o campo e é sempre o valor enviado (explicito).
   - Sem cache em storage; sem innerHTML com dados do usuário.
   ========================================================================== */

import { apiRequest, getSession } from "../../utils/api.js";

const params = new URLSearchParams(window.location.search);
const productId = params.get("id");
const viewMode = params.get("view") === "1";

const $ = (id) => document.getElementById(id);

const centsToBrl = (cents) => ((cents || 0) / 100).toFixed(2);

function setVisible(id, show) {
  const el = $(id);
  if (el) el.hidden = !show;
}

function setAlert(message, kind) {
  const el = $("product-alert");
  if (!el) return;
  el.textContent = message;
  el.className = `admin-alert admin-alert--${kind || "warning"}`;
  el.hidden = false;
}

function fillSelect(id, items) {
  const select = $(id);
  if (!select) return;
  const current = select.value; // preserva seleção (ex.: valor vindo de loadProduct)
  select.textContent = "";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Selecione...";
  select.appendChild(placeholder);
  for (const item of items) {
    const option = document.createElement("option");
    option.value = String(item.id);
    option.textContent = item.name;
    select.appendChild(option);
  }
  if (current) select.value = current;
}

async function loadReferences() {
  const [brands, categories] = await Promise.all([
    apiRequest("/brands"),
    apiRequest("/categories"),
  ]);
  fillSelect("field-brand", brands.data || []);
  fillSelect("field-category", categories.data || []);
}

function makeSpecRow(label = "", value = "") {
  const row = document.createElement("div");
  row.className = "admin-repeater__row";

  const labelInput = document.createElement("input");
  labelInput.type = "text";
  labelInput.className = "admin-input";
  labelInput.maxLength = "120";
  labelInput.value = label;
  labelInput.setAttribute("aria-label", "Nome da especificação");

  const valueInput = document.createElement("input");
  valueInput.type = "text";
  valueInput.className = "admin-input";
  valueInput.maxLength = "255";
  valueInput.value = value;
  valueInput.setAttribute("aria-label", "Valor da especificação");

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "admin-btn admin-btn--small admin-btn--danger";
  removeBtn.textContent = "Remover";
  removeBtn.setAttribute("aria-label", "Remover especificação");
  removeBtn.addEventListener("click", () => row.remove());

  row.append(labelInput, valueInput, removeBtn);
  $("specs-container").appendChild(row);
}

function makeImageRow(url = "", alt = "") {
  const row = document.createElement("div");
  row.className = "admin-repeater__row";

  const urlInput = document.createElement("input");
  urlInput.type = "url";
  urlInput.className = "admin-input";
  urlInput.maxLength = "255";
  urlInput.value = url;
  urlInput.setAttribute("aria-label", "URL da imagem");
  urlInput.placeholder = "https://...";

  const altInput = document.createElement("input");
  altInput.type = "text";
  altInput.className = "admin-input";
  altInput.maxLength = "200";
  altInput.value = alt;
  altInput.setAttribute("aria-label", "Texto alternativo da imagem");

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "admin-btn admin-btn--small admin-btn--danger";
  removeBtn.textContent = "Remover";
  removeBtn.setAttribute("aria-label", "Remover imagem");
  removeBtn.addEventListener("click", () => row.remove());

  row.append(urlInput, altInput, removeBtn);
  $("images-container").appendChild(row);
}

function readRepeaterRows(containerId) {
  const rows = $(containerId).querySelectorAll(".admin-repeater__row");
  const isSpec = containerId === "specs-container";
  const out = [];
  for (const row of rows) {
    const [a, b] = row.querySelectorAll("input");
    const first = a.value.trim();
    const second = b.value.trim();
    if (!first) continue;
    out.push(isSpec ? { label: first, value: second } : { url: first, alt: second });
  }
  return out;
}

async function loadProduct() {
  try {
    const payload = await apiRequest(`/products/${productId}`);
    const p = payload.data;

    $("form-title").textContent = viewMode ? "Ver produto" : "Editar produto";
    $("field-name").value = p.name;
    $("field-slug").value = p.slug;
    $("field-slug").dataset.touched = "true"; // slug já é explícito na edição
    $("field-price").value = centsToBrl(p.price_cents);
    $("field-old-price").value = p.old_price_cents ? centsToBrl(p.old_price_cents) : "";
    $("field-stock").value = String(p.stock);
    $("field-description").value = p.description || "";
    $("field-brand").value = p.brand_id ? String(p.brand_id) : "";
    $("field-category").value = p.category_id ? String(p.category_id) : "";
    $("field-active").checked = p.is_active;
    $("field-featured").checked = p.is_featured;
    $("field-new").checked = p.is_new;
    $("field-bestseller").checked = p.is_bestseller;

    for (const spec of p.specs || []) makeSpecRow(spec.label, spec.value);
    for (const img of p.images || []) makeImageRow(img.url, img.alt || "");

    if (viewMode) disableForm();
  } catch (err) {
    setAlert(err.message || "Não foi possível carregar o produto.", "danger");
    setVisible("form-submit", false);
  }
}

function disableForm() {
  const form = $("product-form");
  for (const input of form.querySelectorAll("input, select, textarea, button")) {
    input.disabled = true;
  }
  $("form-cancel").className = "admin-btn admin-btn--ghost";
  $("form-cancel").textContent = "Voltar para produtos";
  setVisible("form-submit", false);
}

function validate() {
  const name = $("field-name").value.trim();
  if (!name) return "Informe o nome do produto.";

  if (!$("field-brand").value) return "Selecione a marca do produto.";
  if (!$("field-category").value) return "Selecione a categoria do produto.";

  const price = Number.parseFloat($("field-price").value);
  if ($("field-price").value === "" || Number.isNaN(price) || price < 0) {
    return "Informe um preço válido (maior ou igual a 0).";
  }

  const stock = $("field-stock").value;
  if (stock !== "" && (Number.isNaN(Number(stock)) || Number(stock) < 0 || !Number.isInteger(Number(stock)))) {
    return "O estoque deve ser um número inteiro maior ou igual a 0.";
  }

  const old = $("field-old-price").value;
  if (old !== "" && Number.parseFloat(old) < price) {
    return "O preço anterior não pode ser menor que o preço atual.";
  }

  const slug = $("field-slug").value.trim();
  if (slug && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
    return "Slug inválido: use apenas letras minúsculas, números e hífens.";
  }

  return null;
}

function buildPayload() {
  const slug = $("field-slug").value.trim();
  const oldPrice = $("field-old-price").value;

  const payload = {
    name: $("field-name").value.trim(),
    description: $("field-description").value.trim(),
    price_cents: Math.round(Number.parseFloat($("field-price").value) * 100),
    old_price_cents: oldPrice === "" ? null : Math.round(Number.parseFloat(oldPrice) * 100),
    brand_id: Number($("field-brand").value),
    category_id: Number($("field-category").value),
    stock: $("field-stock").value === "" ? undefined : Number($("field-stock").value),
    is_active: $("field-active").checked,
    is_featured: $("field-featured").checked,
    is_new: $("field-new").checked,
    is_bestseller: $("field-bestseller").checked,
    specs: readRepeaterRows("specs-container"),
    images: readRepeaterRows("images-container"),
  };

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
    if (productId) {
      await apiRequest(`/products/${productId}`, {
        method: "PUT",
        body: buildPayload(),
      });
    } else {
      await apiRequest("/products", {
        method: "POST",
        body: buildPayload(),
      });
    }
    window.location.replace("products.html?ok=1");
  } catch (err) {
    setAlert(err.message || "Não foi possível salvar o produto.", "danger");
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
  $("product-form").addEventListener("submit", handleSubmit);
  $("form-cancel").addEventListener("click", () => {
    window.location.replace("products.html");
  });
  $("specs-add").addEventListener("click", () => makeSpecRow());
  $("images-add").addEventListener("click", () => makeImageRow());

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
  const safe = document.querySelector("body[data-page='admin-products']");
  if (!safe) return;

  bindEvents();

  getSession().then(async (session) => {
    if (!session) return;
    // Referências (marca/categoria) primeiro: os selects precisam das opções
    // antes de restaurar a seleção do produto na edição.
    await loadReferences().catch(() => {
      setAlert("Não foi possível carregar marcas e categorias.", "warning");
    });
    if (productId) {
      loadProduct();
    } else {
      $("form-title").textContent = "Novo produto";
      makeSpecRow();
      makeImageRow();
    }
  });
}

init();