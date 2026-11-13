/* ==========================================================================
   NEXUS TECH — Página do Carrinho
   Lê `nexus:cart` (localStorage via store.js), sanitiza itens contra o mock
   data (estoque, ids inválidos), renderiza lista + resumo (subtotal, frete
   mock e total) e mantém o header sincronizado.

   Regras:
   - quantidade mínima = 1 e máxima = estoque do produto;
   - itens com produto inexistente, estoque 0 ou quantidade inválida (<= 0)
     são removidos; quantidades acima do estoque são ajustadas na carga;
   - frete mock: subtotal >= R$ 500 -> grátis; senão R$ 29,90;
   - DOM construído com createElement/textContent (sem innerHTML / XSS);
   - nenhuma chamada à API nesta etapa.
   ========================================================================== */

import { formatBRL } from "../../utils/format.js";
import {
  removeFromCart,
  setCartQuantity,
  syncHeaderCounts,
} from "../store/store.js";
import {
  calculateSubtotal,
  FREE_SHIPPING_MIN_CENTS,
  sanitizeCart,
  standardShippingCents,
} from "./cart-utils.js";

const SVG_NS = "http://www.w3.org/2000/svg";

/* Estado em memória: itens sanitizados { id -> { product, qty } } */
const current = {
  items: new Map(),
  removed: 0,
  fixed: 0,
};

function svg(attrs) {
  const el = document.createElementNS(SVG_NS, "svg");
  for (const key of Object.keys(attrs)) {
    el.setAttribute(key, attrs[key]);
  }
  return el;
}

function iconPath(d, attrs) {
  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("d", d);
  for (const key of Object.keys(attrs || {})) {
    path.setAttribute(key, attrs[key]);
  }
  return path;
}

/* --------------------------------------------------------------------------
   IMAGEM ILUSTRATIVA (mesmo padrão visual do catálogo / produto)
-------------------------------------------------------------------------- */

function cartImage(product) {
  const palette = [
    ["#0e7490", "#6d28d9"],
    ["#155e75", "#0891b2"],
    ["#6d28d9", "#f59e0b"],
  ];
  const colors = palette[product.id % palette.length];

  const s = svg({
    viewBox: "0 0 240 240",
    role: "img",
    "aria-label": `Imagem ilustrativa de ${product.name}`,
  });

  const caption = document.createElementNS(SVG_NS, "title");
  caption.textContent = `Imagem ilustrativa de ${product.name}`;
  s.appendChild(caption);

  const bg = document.createElementNS(SVG_NS, "rect");
  bg.setAttribute("width", "240");
  bg.setAttribute("height", "240");
  bg.setAttribute("fill", "url(#c" + product.id + ")");
  s.appendChild(bg);

  const defs = document.createElementNS(SVG_NS, "defs");
  const grad = document.createElementNS(SVG_NS, "linearGradient");
  grad.id = "c" + product.id;
  grad.setAttribute("x1", "0");
  grad.setAttribute("y1", "0");
  grad.setAttribute("x2", "1");
  grad.setAttribute("y2", "1");
  const stopA = document.createElementNS(SVG_NS, "stop");
  stopA.setAttribute("offset", "0%");
  stopA.setAttribute("stop-color", colors[0]);
  const stopB = document.createElementNS(SVG_NS, "stop");
  stopB.setAttribute("offset", "100%");
  stopB.setAttribute("stop-color", colors[1]);
  grad.appendChild(stopA);
  grad.appendChild(stopB);
  defs.appendChild(grad);
  s.appendChild(defs);

  const letter = document.createElementNS(SVG_NS, "text");
  letter.setAttribute("x", "50%");
  letter.setAttribute("y", "55%");
  letter.setAttribute("text-anchor", "middle");
  letter.setAttribute("dominant-baseline", "middle");
  letter.setAttribute("font-size", "88");
  letter.setAttribute("font-weight", "900");
  letter.setAttribute("font-family", "Rajdhani, sans-serif");
  letter.setAttribute("fill", "rgba(255,255,255,0.95)");
  letter.textContent = product.category.charAt(0).toUpperCase();
  s.appendChild(letter);

  return s;
}

/* --------------------------------------------------------------------------
   CARREGAMENTO + SANITIZAÇÃO (regras em cart-utils.js — compartilhado
   com o checkout)
-------------------------------------------------------------------------- */

/* --------------------------------------------------------------------------
   RENDERIZAÇÃO — ITEM
-------------------------------------------------------------------------- */

function buildItem(item) {
  const { product, qty } = item;
  const id = String(product.id);
  const stock = Number(product.stock || 0);
  const atMax = qty >= stock;

  const el = document.createElement("article");
  el.className = "cart-item";
  el.setAttribute("aria-label", product.name);

  const media = document.createElement("a");
  media.className = "cart-item__media";
  media.href = `produto.html?slug=${encodeURIComponent(product.slug)}`;
  media.setAttribute("aria-label", `Ver ${product.name}`);
  const img = cartImage(product);
  img.setAttribute("class", "cart-item__img");
  media.appendChild(img);
  el.appendChild(media);

  const info = document.createElement("div");
  info.className = "cart-item__info";

  const brand = document.createElement("span");
  brand.className = "cart-item__brand";
  brand.textContent = product.brand;
  info.appendChild(brand);

  const name = document.createElement("a");
  name.className = "cart-item__name";
  name.href = `produto.html?slug=${encodeURIComponent(product.slug)}`;
  name.textContent = product.name;
  info.appendChild(name);

  const unit = document.createElement("p");
  unit.className = "cart-item__unit";
  unit.textContent = `Unidade: ${formatBRL(product.priceCents)}`;
  info.appendChild(unit);

  const hint = document.createElement("p");
  hint.className = "cart-item__hint";
  hint.textContent =
    atMax
      ? `Máximo em estoque: ${stock} unidade${stock === 1 ? "" : "s"}`
      : `Restam ${stock} unidade${stock === 1 ? "" : "s"} em estoque`;
  info.appendChild(hint);
  el.appendChild(info);

  const controls = document.createElement("div");
  controls.className = "cart-item__controls";

  const stepper = document.createElement("div");
  stepper.className = "qty-stepper";

  const minus = document.createElement("button");
  minus.type = "button";
  minus.className = "qty-stepper__btn";
  minus.setAttribute("data-act", "minus");
  minus.setAttribute("data-id", id);
  minus.setAttribute(
    "aria-label",
    `Diminuir quantidade de ${product.name}`
  );
  minus.textContent = "−";
  minus.disabled = qty <= 1;
  stepper.appendChild(minus);

  const input = document.createElement("input");
  input.type = "number";
  input.inputMode = "numeric";
  input.className = "qty-stepper__input";
  input.setAttribute("data-act", "qty");
  input.setAttribute("data-id", id);
  input.min = "1";
  input.max = String(stock);
  input.value = String(qty);
  input.setAttribute("aria-label", `Quantidade de ${product.name}`);
  stepper.appendChild(input);

  const plus = document.createElement("button");
  plus.type = "button";
  plus.className = "qty-stepper__btn";
  plus.setAttribute("data-act", "plus");
  plus.setAttribute("data-id", id);
  plus.setAttribute(
    "aria-label",
    `Aumentar quantidade de ${product.name}`
  );
  plus.textContent = "+";
  plus.disabled = atMax;
  stepper.appendChild(plus);

  controls.appendChild(stepper);

  const subtotal = document.createElement("div");
  subtotal.className = "cart-item__subtotal";
  subtotal.setAttribute("aria-label", `Subtotal de ${product.name}`);
  const subtotalText = document.createElement("span");
  subtotalText.textContent = formatBRL(product.priceCents * qty);
  subtotal.appendChild(subtotalText);
  controls.appendChild(subtotal);

  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "cart-item__remove";
  remove.setAttribute("data-act", "remove");
  remove.setAttribute("data-id", id);
  remove.setAttribute("aria-label", `Remover ${product.name} do carrinho`);
  const trash = svg({
    class: "icon",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    "stroke-width": "2",
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
    "aria-hidden": "true",
  });
  trash.appendChild(
    iconPath(
      "M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z"
    )
  );
  const removeText = document.createElement("span");
  removeText.textContent = "Remover";
  remove.appendChild(trash);
  remove.appendChild(removeText);
  controls.appendChild(remove);

  el.appendChild(controls);

  return el;
}

/* --------------------------------------------------------------------------
   RENDERIZAÇÃO — RESUMO
-------------------------------------------------------------------------- */

function buildSummary() {
  const summary = document.createElement("aside");
  summary.className = "cart-summary";
  summary.setAttribute("aria-label", "Resumo do pedido");

  const title = document.createElement("h2");
  title.className = "cart-summary__title";
  title.textContent = "Resumo do pedido";
  summary.appendChild(title);

  const subtotalCents = calculateSubtotal(current.items);
  const shipping = standardShippingCents(subtotalCents);
  const totalCents = subtotalCents + shipping;

  const subtotalRow = document.createElement("div");
  subtotalRow.className = "cart-summary__row";
  const subtotalLabel = document.createElement("span");
  subtotalLabel.className = "cart-summary__label";
  subtotalLabel.textContent = "Subtotal";
  const subtotalValue = document.createElement("span");
  subtotalValue.className = "cart-summary__value";
  subtotalValue.textContent = formatBRL(subtotalCents);
  subtotalRow.appendChild(subtotalLabel);
  subtotalRow.appendChild(subtotalValue);
  summary.appendChild(subtotalRow);

  const shippingRow = document.createElement("div");
  shippingRow.className = "cart-summary__row";
  const shippingLabel = document.createElement("span");
  shippingLabel.className = "cart-summary__label";
  shippingLabel.textContent = "Frete";
  const shippingValue = document.createElement("span");
  shippingValue.className =
    "cart-summary__value" +
    (shipping === 0 ? " cart-summary__value--free" : "");
  shippingValue.textContent = shipping === 0 ? "Grátis" : formatBRL(shipping);
  shippingRow.appendChild(shippingLabel);
  shippingRow.appendChild(shippingValue);
  summary.appendChild(shippingRow);

  if (shipping > 0) {
    const tip = document.createElement("p");
    tip.className = "cart-summary__tip";
    tip.textContent = `Faltam ${formatBRL(
      FREE_SHIPPING_MIN_CENTS - subtotalCents
    )} para ganhar frete grátis.`;
    summary.appendChild(tip);
  } else {
    const tip = document.createElement("p");
    tip.className = "cart-summary__tip";
    tip.textContent = "Você ganhou frete grátis nesta compra!";
    summary.appendChild(tip);
  }

  const totalRow = document.createElement("div");
  totalRow.className = "cart-summary__row cart-summary__row--total";
  const totalLabel = document.createElement("span");
  totalLabel.className = "cart-summary__label";
  totalLabel.textContent = "Total";
  const totalValue = document.createElement("span");
  totalValue.className = "cart-summary__value cart-summary__value--total";
  totalValue.textContent = formatBRL(totalCents);
  totalRow.appendChild(totalLabel);
  totalRow.appendChild(totalValue);
  summary.appendChild(totalRow);

  const actions = document.createElement("div");
  actions.className = "cart-summary__actions";

  const checkout = document.createElement("a");
  checkout.className = "btn btn--primary btn--block";
  checkout.href = "checkout.html";
  checkout.textContent = "Ir para checkout";
  actions.appendChild(checkout);

  const continueBtn = document.createElement("a");
  continueBtn.className = "btn btn--outline btn--block";
  continueBtn.href = "produtos.html";
  continueBtn.textContent = "Continuar comprando";
  actions.appendChild(continueBtn);

  summary.appendChild(actions);

  return summary;
}

/* --------------------------------------------------------------------------
   RENDERIZAÇÃO — VAZIO
-------------------------------------------------------------------------- */

function buildEmpty() {
  const empty = document.createElement("div");
  empty.className = "cart-empty";
  empty.setAttribute("role", "status");

  const icon = svg({
    class: "cart-empty__icon",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    "stroke-width": "1.5",
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
    "aria-hidden": "true",
  });
  icon.appendChild(
    iconPath(
      "M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.29 2.29c-.63.63-.19 1.71.7 1.71H17M9 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm8 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"
    )
  );
  empty.appendChild(icon);

  const title = document.createElement("p");
  title.className = "cart-empty__title";
  title.textContent = "Seu carrinho está vazio";
  empty.appendChild(title);

  const text = document.createElement("p");
  text.className = "cart-empty__text";
  text.textContent =
    "Você ainda não adicionou nenhum produto. Aproveite o catálogo e monte seu pedido!";
  empty.appendChild(text);

  const actions = document.createElement("div");
  actions.className = "cart-empty__actions";

  const catalog = document.createElement("a");
  catalog.className = "btn btn--primary";
  catalog.href = "produtos.html";
  catalog.textContent = "Continuar comprando";
  actions.appendChild(catalog);

  const link = document.createElement("a");
  link.className = "btn btn--ghost";
  link.href = "produtos.html";
  link.textContent = "Página de produtos";
  actions.appendChild(link);

  empty.appendChild(actions);
  return empty;
}

/* --------------------------------------------------------------------------
   RENDER
-------------------------------------------------------------------------- */

function render(opts = {}) {
  const loaded = sanitizeCart();
  current.items = loaded.items;
  current.removed = loaded.removed;
  current.fixed = loaded.fixed;

  const content = document.getElementById("cart-content");
  if (!content) return;

  content.replaceChildren();

  if (current.items.size === 0) {
    content.appendChild(buildEmpty());
  } else {
    const layout = document.createElement("div");
    layout.className = "cart__layout";

    const list = document.createElement("ul");
    list.className = "cart-items";
    for (const item of current.items.values()) {
      const li = document.createElement("li");
      li.appendChild(buildItem(item));
      list.appendChild(li);
    }
    layout.appendChild(list);
    layout.appendChild(buildSummary());
    content.appendChild(layout);
  }

  renderNote();
  renderNotice();

  syncHeaderCounts();

  if (opts.focus) {
    const target = content.querySelector(opts.focus);
    if (target) {
      target.focus();
      return;
    }
  }
  if (opts.focusTitle) {
    const title = document.getElementById("cart-title");
    if (title) title.focus();
  }
}

function renderNote() {
  const note = document.getElementById("cart-note");
  if (!note) return;
  const count = current.items.size;
  note.textContent =
    count === 0
      ? "Seu carrinho está vazio"
      : `${count} produto${count === 1 ? "" : "s"} no carrinho`;
}

function renderNotice() {
  const notice = document.getElementById("cart-notice");
  if (!notice) return;

  const { removed, fixed } = current;
  if (removed === 0 && fixed === 0) {
    notice.replaceChildren();
    return;
  }

  const alert = document.createElement("div");
  alert.className = "alert alert--info";
  alert.setAttribute("role", "status");
  alert.setAttribute("aria-live", "polite");

  const text = document.createElement("p");
  const parts = [];
  if (removed > 0) {
    parts.push(`${removed} item${removed === 1 ? "" : "s"} indisponível${
      removed === 1 ? "" : "is"
    } removido${removed === 1 ? "" : "s"}.`);
  }
  if (fixed > 0) {
    parts.push(`Quantidade${fixed === 1 ? "" : "s"} ajustada${fixed === 1 ? "" : "s"} ao estoque.`);
  }
  text.textContent = "Atualizamos seu carrinho: " + parts.join(" ");
  alert.appendChild(text);
  notice.replaceChildren(alert);
}

/* --------------------------------------------------------------------------
   AÇÕES
-------------------------------------------------------------------------- */

function announce(message) {
  const status = document.getElementById("cart-status");
  if (status) status.textContent = message;
}

function changeQty(id, delta) {
  const entry = current.items.get(id);
  if (!entry) return;

  const stock = Number(entry.product.stock || 0);
  const next = Math.min(stock, Math.max(1, entry.qty + delta));
  if (next === entry.qty) return;

  if (setCartQuantity(id, next, stock) === null) return;
  syncHeaderCounts();
  announce(`Quantidade atualizada para ${next}.`);
  render({ focus: `[data-act="${delta > 0 ? "plus" : "minus"}"][data-id="${id}"]` });
}

function commitInputQty(input) {
  const id = input.getAttribute("data-id");
  const entry = current.items.get(id);
  if (!entry) return;

  const stock = Number(entry.product.stock || 0);
  const parsed = Number(input.value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    input.value = String(entry.qty);
    return;
  }

  const next = Math.min(stock, Math.floor(parsed));
  if (next === entry.qty) {
    input.value = String(entry.qty);
    return;
  }

  if (setCartQuantity(id, next, stock) === null) return;
  syncHeaderCounts();
  announce(`Quantidade atualizada para ${next}.`);
  render({ focus: `[data-act="qty"][data-id="${id}"]` });
}

function removeItem(id) {
  removeFromCart(id);
  syncHeaderCounts();
  announce("Produto removido do carrinho.");
  render({ focusTitle: true });
}

function wireEvents() {
  const content = document.getElementById("cart-content");
  if (!content) return;

  content.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-act]");
    if (!btn) return;
    const id = btn.getAttribute("data-id");
    const act = btn.getAttribute("data-act");

    if (act === "minus") changeQty(id, -1);
    else if (act === "plus") changeQty(id, +1);
    else if (act === "remove") removeItem(id);
  });

  content.addEventListener("change", (event) => {
    if (event.target.matches('[data-act="qty"]')) {
      commitInputQty(event.target);
    }
  });

  content.addEventListener("keydown", (event) => {
    if (event.target.matches('[data-act="qty"]') && event.key === "Enter") {
      event.preventDefault();
      commitInputQty(event.target);
    }
  });
}

function init() {
  if (!document.getElementById("cart-app")) return;
  wireEvents();
  render();
}

init();