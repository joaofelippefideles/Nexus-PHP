/* ==========================================================================
   NEXUS TECH — Catálogo: renderização (Sprint 4)
   Construção dos cards de produto no DOM (segura, sem innerHTML / XSS),
   estado vazio e metadados de resultados.
   ========================================================================== */

import {
  formatBRL,
  formatDiscount,
  formatDecimal,
} from "../../utils/format.js";

const SVG_NS = "http://www.w3.org/2000/svg";

function svg(attrs) {
  const el = document.createElementNS(SVG_NS, "svg");
  for (const key of Object.keys(attrs)) {
    el.setAttribute(key, attrs[key]);
  }
  return el;
}

function svgPath(d) {
  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("d", d);
  return path;
}

function heartIcon() {
  const s = svg({
    class: "icon",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    "stroke-width": "2",
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
    "aria-hidden": "true",
  });
  s.appendChild(
    svgPath(
      "M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
    )
  );
  return s;
}

/* Placeholder determinístico em SVG inline. Quando a API de imagens existir,
   bastará apontar `product.image` para a URL real — o render não muda. */
function productImage(product) {
  const s = svg({
    viewBox: "0 0 240 240",
    role: "img",
    "aria-label": `Imagem ilustrativa de ${product.name}`,
    class: "product-card__img",
  });

  const caption = document.createElementNS(SVG_NS, "title");
  caption.textContent = `Imagem ilustrativa de ${product.name}`;
  s.appendChild(caption);

  const bg = document.createElementNS(SVG_NS, "rect");
  bg.setAttribute("x", "0");
  bg.setAttribute("y", "0");
  bg.setAttribute("width", "240");
  bg.setAttribute("height", "240");
  bg.setAttribute("fill", "url(#g" + product.id + ")");
  s.appendChild(bg);

  const defs = document.createElementNS(SVG_NS, "defs");
  const grad = document.createElementNS(SVG_NS, "linearGradient");
  grad.id = "g" + product.id;
  grad.setAttribute("x1", "0");
  grad.setAttribute("y1", "0");
  grad.setAttribute("x2", "1");
  grad.setAttribute("y2", "1");

  const stopA = document.createElementNS(SVG_NS, "stop");
  stopA.setAttribute("offset", "0%");
  stopA.setAttribute("stop-color", "#0e7490");
  const stopB = document.createElementNS(SVG_NS, "stop");
  stopB.setAttribute("offset", "100%");
  stopB.setAttribute("stop-color", "#6d28d9");
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

function ratingStars(value) {
  const full = Math.round(value);
  const r = document.createElement("span");
  r.className = "rating__stars";
  r.setAttribute("aria-hidden", "true");
  r.textContent = "★".repeat(full) + "☆".repeat(5 - full);
  return r;
}

function badgesFor(product) {
  const badges = [];

  const discount = formatDiscount(product.oldPriceCents, product.priceCents);
  if (discount !== null) {
    badges.push({ text: `-${discount}%`, kind: "discount" });
  }
  if (product.isNew) {
    badges.push({ text: "Novo", kind: "new" });
  }
  if (product.isBestseller) {
    badges.push({ text: "Mais vendido", kind: "bestseller" });
  }

  return badges;
}

export function createCard(product) {
  const card = document.createElement("article");
  card.className = "product-card";
  card.setAttribute("aria-label", product.name);
  card.dataset.productId = String(product.id);

  /* Media (imagem + badges + favorito) */
  const media = document.createElement("div");
  media.className = "product-card__media";

  const badgeBox = document.createElement("div");
  badgeBox.className = "product-card__badges";
  for (const badge of badgesFor(product)) {
    const b = document.createElement("span");
    b.className = `badge badge--${badge.kind}`;
    b.textContent = badge.text;
    badgeBox.appendChild(b);
  }
  if (badgeBox.childElementCount > 0) {
    media.appendChild(badgeBox);
  }

  const fav = document.createElement("button");
  fav.type = "button";
  fav.className = "product-card__fav";
  fav.setAttribute("aria-label", `Favoritar ${product.name}`);
  fav.appendChild(heartIcon());
  media.appendChild(fav);

  media.appendChild(productImage(product));
  card.appendChild(media);

  /* Corpo: marca, nome, avaliação, preço, ações */
  const body = document.createElement("div");
  body.className = "product-card__body";

  const brand = document.createElement("span");
  brand.className = "product-card__brand";
  brand.textContent = product.brand;
  body.appendChild(brand);

  const name = document.createElement("h3");
  name.className = "product-card__name";
  name.textContent = product.name;
  body.appendChild(name);

  const rating = document.createElement("div");
  rating.className = "rating";
  const stars = ratingStars(product.rating);
  const value = document.createElement("span");
  value.className = "rating__value";
  value.textContent = formatDecimal(product.rating);
  const count = document.createElement("span");
  count.className = "rating__count";
  count.textContent = `(${product.ratingCount})`;
  rating.appendChild(stars);
  rating.appendChild(value);
  rating.appendChild(count);
  body.appendChild(rating);

  const price = document.createElement("div");
  price.className = "product-card__price";
  if (product.oldPriceCents) {
    const old = document.createElement("span");
    old.className = "product-card__price-old";
    old.textContent = formatBRL(product.oldPriceCents);
    price.appendChild(old);
  }
  const current = document.createElement("span");
  current.className = "product-card__price-current";
  current.textContent = formatBRL(product.priceCents);
  price.appendChild(current);
  body.appendChild(price);

  const stock = document.createElement("p");
  stock.className =
    "product-card__stock " +
    (product.stock > 0 ? "product-card__stock--ok" : "product-card__stock--out");
  stock.textContent =
    product.stock > 0 ? `Em estoque` : "Esgotado";
  body.appendChild(stock);

  const actions = document.createElement("div");
  actions.className = "product-card__actions product-card__actions--split";

  const viewBtn = document.createElement("a");
  viewBtn.className = "btn btn--outline";
  viewBtn.href = `./produto.html?slug=${encodeURIComponent(product.slug)}`;
  viewBtn.textContent = "Ver produto";
  actions.appendChild(viewBtn);

  /* Botão de adicionar ao carrinho — ação delegada no grid (catalog.js). */
  const cartBtn = document.createElement("button");
  cartBtn.type = "button";
  cartBtn.className = "btn btn--primary";
  cartBtn.dataset.addToCart = String(product.id);
  if (Number(product.stock) <= 0) {
    cartBtn.disabled = true;
    cartBtn.textContent = "Esgotado";
  } else {
    cartBtn.setAttribute("aria-label", `Adicionar ${product.name} ao carrinho`);
    cartBtn.textContent = "Adicionar";
  }
  actions.appendChild(cartBtn);

  body.appendChild(actions);
  card.appendChild(body);

  return card;
}

export function renderCards(container, products) {
  container.replaceChildren();
  const fragment = document.createDocumentFragment();
  for (const product of products) {
    fragment.appendChild(createCard(product));
  }
  container.appendChild(fragment);
}

export function renderEmptyState(container, hasQuery) {
  container.replaceChildren();

  const empty = document.createElement("div");
  empty.className = "catalog__empty";
  empty.setAttribute("role", "status");

  const icon = svg({
    class: "catalog__empty-icon",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    "stroke-width": "1.5",
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
    "aria-hidden": "true",
  });
  icon.appendChild(
    svgPath("M21 21l-4.35-4.35M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z")
  );
  empty.appendChild(icon);

  const title = document.createElement("p");
  title.className = "catalog__empty-title";
  title.textContent = hasQuery
    ? "Nenhum produto encontrado para sua busca"
    : "Nenhum produto encontrado";
  empty.appendChild(title);

  const text = document.createElement("p");
  text.className = "catalog__empty-text";
  text.textContent =
    "Tente ajustar a pesquisa ou limpar os filtros para ver mais resultados.";
  empty.appendChild(text);

  container.appendChild(empty);
}

export function renderMeta(countEl, from, to, total) {
  if (!countEl) return;
  countEl.textContent = `${total} produto${total === 1 ? "" : "s"}`;
}
