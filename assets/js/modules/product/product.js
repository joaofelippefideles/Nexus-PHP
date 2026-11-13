/* ==========================================================================
   NEXUS TECH — Página do Produto
   Lê o slug da URL (?slug=...), localiza no mock data (products.js) e
   renderiza a página de detalhe: galeria, informações, quantidade,
   carrinho/favorito (localStorage) e produtos relacionados.

   Segue a arquitetura do catálogo: DOM construído de forma segura
   (createElement + textContent, sem innerHTML / XSS) e nenhuma chamada à API.
   ========================================================================== */

import { products } from "../../data/products.js";
import {
  formatBRL,
  formatDiscount,
  formatDecimal,
} from "../../utils/format.js";
import {
  addToCart,
  isFavorite,
  toggleFavorite,
  getCart,
  syncHeaderCounts,
} from "../store/store.js";

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

/* Placeholder ilustrativo da imagem (mesmo padrão do catálogo). `variant`
   gera vistas alternativas (frente/lateral/detalhe) para a galeria. */
function productImage(product, variant = 0) {
  const palette = [
    ["#0e7490", "#6d28d9"],
    ["#155e75", "#0891b2"],
    ["#6d28d9", "#f59e0b"],
  ];
  const colors = palette[variant % palette.length];

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
  bg.setAttribute("fill", "url(#v" + product.id + "-" + variant + ")");
  s.appendChild(bg);

  const defs = document.createElementNS(SVG_NS, "defs");
  const grad = document.createElementNS(SVG_NS, "linearGradient");
  grad.id = "v" + product.id + "-" + variant;
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

/* --------------------------------------------------------------------------
   GALERIA (imagem principal + miniaturas)
-------------------------------------------------------------------------- */

function buildGallery(product, onViewChange) {
  const root = document.createElement("div");
  root.className = "product-gallery";

  const views = [0, 1, 2]; // vistas ilustrativas (frente/lateral/detalhe)
  const labels = ["Frente", "Lateral", "Detalhe"];

  const thumbs = document.createElement("div");
  thumbs.className = "product-gallery__thumbs";
  thumbs.setAttribute("aria-label", "Miniaturas do produto");

  const main = document.createElement("div");
  main.className = "product-gallery__main";
  main.setAttribute("role", "group");
  main.setAttribute(
    "aria-label",
    `Imagem principal de ${product.name}`
  );
  main.appendChild(productImage(product, 0));

  const status = document.createElement("span");
  status.className = "product-gallery__status";
  status.setAttribute("aria-live", "polite");
  status.textContent = `${labels[0]} — 1 de ${views.length}`;
  main.appendChild(status);

  function select(index) {
    index = Math.max(0, Math.min(views.length - 1, index));
    main.replaceChildren();
    main.appendChild(productImage(product, index));
    main.appendChild(status);
    status.textContent = `${labels[index]} — ${index + 1} de ${views.length}`;

    const btns = thumbs.querySelectorAll(".product-gallery__thumb");
    btns.forEach((btn, i) => {
      const active = i === index;
      btn.setAttribute("aria-pressed", String(active));
      btn.classList.toggle("is-active", active);
    });

    if (onViewChange) onViewChange(index, labels[index]);
  }

  for (let i = 0; i < views.length; i += 1) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "product-gallery__thumb";
    btn.setAttribute("aria-label", `Ver vista ${labels[i]}`);
    btn.setAttribute("aria-pressed", i === 0 ? "true" : "false");
    btn.appendChild(productImage(product, i));
    btn.addEventListener("click", () => select(i));
    thumbs.appendChild(btn);
  }

  root.appendChild(thumbs);
  root.appendChild(main);

  /* Suporte a teclado: setas navegam pelas vistas. */
  main.tabIndex = 0;
  main.setAttribute("role", "group");
  main.addEventListener("keydown", (event) => {
    let current = 0;
    const btns = Array.from(thumbs.querySelectorAll(".product-gallery__thumb"));
    btns.forEach((btn, i) => {
      if (btn.getAttribute("aria-pressed") === "true") current = i;
    });
    if (event.key === "ArrowRight") {
      select(current + 1);
      event.preventDefault();
    } else if (event.key === "ArrowLeft") {
      select(current - 1);
      event.preventDefault();
    }
  });

  return { root, select };
}

/* --------------------------------------------------------------------------
   QUANTIDADE (stepper com limite por estoque)
-------------------------------------------------------------------------- */

function buildQuantity(product, { onChange, onAdd }) {
  const stock = Number(product.stock || 0);
  const disabled = stock <= 0;

  const wrap = document.createElement("div");
  wrap.className = "product-buy__qty";

  const label = document.createElement("span");
  label.className = "product-buy__qty-label";
  label.id = "qty-label";
  label.textContent = "Quantidade";
  wrap.appendChild(label);

  const stepper = document.createElement("div");
  stepper.className = "qty-stepper";

  const minus = document.createElement("button");
  minus.type = "button";
  minus.className = "qty-stepper__btn";
  minus.setAttribute("aria-label", "Diminuir quantidade");
  minus.textContent = "−";
  minus.disabled = true;

  const input = document.createElement("input");
  input.type = "number";
  input.inputMode = "numeric";
  input.className = "qty-stepper__input";
  input.id = "qty-input";
  input.min = "1";
  input.max = String(stock || 1);
  input.value = "1";
  input.setAttribute("aria-label", "Quantidade");
  input.setAttribute("aria-describedby", "qty-hint");
  if (disabled) input.disabled = true;

  const plus = document.createElement("button");
  plus.type = "button";
  plus.className = "qty-stepper__btn";
  plus.setAttribute("aria-label", "Aumentar quantidade");
  plus.textContent = "+";
  plus.disabled = disabled;

  function clamp(value) {
    const parsed = parseInt(value, 10);
    if (Number.isNaN(parsed)) return 1;
    return Math.min(stock, Math.max(1, parsed));
  }

  function setQty(value) {
    const next = clamp(value);
    input.value = String(next);
    minus.disabled = next <= 1;
    plus.disabled = next >= stock;
    if (onChange) onChange(next);
  }

  minus.addEventListener("click", () => setQty(Number(input.value) - 1));
  plus.addEventListener("click", () => setQty(Number(input.value) + 1));
  input.addEventListener("change", () => setQty(input.value));

  stepper.appendChild(minus);
  stepper.appendChild(input);
  stepper.appendChild(plus);
  wrap.appendChild(stepper);

  const hint = document.createElement("p");
  hint.className = "product-buy__hint";
  hint.id = "qty-hint";
  hint.textContent = disabled
    ? "Produto esgotado"
    : `Máximo ${stock} unidade${stock === 1 ? "" : "s"} por pedido`;
  wrap.appendChild(hint);

  return { wrap, setQty, getQty: () => Number(input.value), disabled };
}

/* --------------------------------------------------------------------------
   RENDERIZAÇÃO DO PRODUTO
-------------------------------------------------------------------------- */

function renderProduct(root, product) {
  root.replaceChildren();

  /* Breadcrumb */
  const breadcrumb = document.createElement("nav");
  breadcrumb.className = "breadcrumb";
  breadcrumb.setAttribute("aria-label", "Trilha de navegação");
  const list = document.createElement("ol");
  list.className = "breadcrumb__list";

  const homeItem = document.createElement("li");
  homeItem.className = "breadcrumb__item";
  const homeLink = document.createElement("a");
  homeLink.className = "breadcrumb__link";
  homeLink.href = "../index.html";
  homeLink.textContent = "Home";
  const sep1 = document.createElement("span");
  sep1.className = "breadcrumb__separator";
  sep1.setAttribute("aria-hidden", "true");
  sep1.textContent = "/";
  homeItem.appendChild(homeLink);
  homeItem.appendChild(sep1);

  const catItem = document.createElement("li");
  catItem.className = "breadcrumb__item";
  const catLink = document.createElement("a");
  catLink.className = "breadcrumb__link";
  catLink.href = "produtos.html";
  catLink.textContent = "Produtos";
  const sep2 = document.createElement("span");
  sep2.className = "breadcrumb__separator";
  sep2.setAttribute("aria-hidden", "true");
  sep2.textContent = "/";
  catItem.appendChild(catLink);
  catItem.appendChild(sep2);

  const curItem = document.createElement("li");
  curItem.className = "breadcrumb__item";
  const current = document.createElement("span");
  current.className = "breadcrumb__current";
  current.setAttribute("aria-current", "page");
  current.textContent = product.name;
  curItem.appendChild(current);

  list.appendChild(homeItem);
  list.appendChild(catItem);
  list.appendChild(curItem);
  breadcrumb.appendChild(list);

  const title = document.createElement("h1");
  title.className = "product__title";
  title.id = "product-title";
  title.textContent = product.name;
  title.setAttribute("tabindex", "-1");

  root.appendChild(breadcrumb);
  root.appendChild(title);

  const layout = document.createElement("div");
  layout.className = "product__layout";

  const gallery = buildGallery(product, () => {});
  layout.appendChild(gallery.root);

  const info = document.createElement("div");
  info.className = "product-info";
  info.setAttribute("aria-labelledby", "product-title");

  const brand = document.createElement("span");
  brand.className = "product-info__brand";
  brand.textContent = product.brand;
  info.appendChild(brand);

  const badgeBox = document.createElement("div");
  badgeBox.className = "product-info__badges";
  for (const badge of badgesFor(product)) {
    const b = document.createElement("span");
    b.className = `badge badge--${badge.kind}`;
    b.textContent = badge.text;
    badgeBox.appendChild(b);
  }
  info.appendChild(badgeBox);

  const ratingWrap = document.createElement("div");
  ratingWrap.className = "product-info__rating";
  ratingWrap.appendChild(ratingStars(product.rating));
  const ratingValue = document.createElement("span");
  ratingValue.className = "product-info__rating-value";
  ratingValue.textContent = formatDecimal(product.rating);
  const ratingCount = document.createElement("span");
  ratingCount.className = "product-info__rating-count";
  ratingCount.textContent = `(${product.ratingCount} avaliações)`;
  ratingWrap.appendChild(ratingValue);
  ratingWrap.appendChild(ratingCount);
  info.appendChild(ratingWrap);

  const priceBox = document.createElement("div");
  priceBox.className = "product-info__price";

  if (product.oldPriceCents) {
    const old = document.createElement("span");
    old.className = "product-info__price-old";
    old.textContent = formatBRL(product.oldPriceCents);
    priceBox.appendChild(old);
  }

  const currentPrice = document.createElement("span");
  currentPrice.className = "product-info__price-current";
  currentPrice.textContent = formatBRL(product.priceCents);
  priceBox.appendChild(currentPrice);

  const savings = formatDiscount(product.oldPriceCents, product.priceCents);
  if (savings !== null) {
    const save = document.createElement("span");
    save.className = "product-info__savings";
    save.textContent = `Economize ${savings}%`;
    priceBox.appendChild(save);
  }
  info.appendChild(priceBox);

  const stockEl = document.createElement("p");
  stockEl.className =
    "product-info__stock " +
    (product.stock > 0 ? "product-info__stock--ok" : "product-info__stock--out");
  stockEl.textContent = product.stock > 0 ? "Em estoque" : "Esgotado";
  info.appendChild(stockEl);

  const description = document.createElement("p");
  description.className = "product-info__description";
  description.textContent = product.description;
  info.appendChild(description);

  const buy = document.createElement("div");
  buy.className = "product-buy";

  const qty = buildQuantity(product, {});
  buy.appendChild(qty.wrap);

  const actions = document.createElement("div");
  actions.className = "product-buy__actions";

  const cartBtn = document.createElement("button");
  cartBtn.type = "button";
  cartBtn.className = "btn btn--primary product-buy__cart-btn";
  cartBtn.textContent = "Adicionar ao carrinho";
  cartBtn.setAttribute("aria-label", `Adicionar ${product.name} ao carrinho`);
  if (product.stock <= 0) cartBtn.disabled = true;

  const favBtn = document.createElement("button");
  favBtn.type = "button";
  favBtn.className = "product-buy__fav";
  favBtn.setAttribute("aria-pressed", String(isFavorite(product.id)));
  favBtn.textContent = "Favoritar";
  favBtn.appendChild(heartIcon());
  if (isFavorite(product.id)) favBtn.classList.add("is-faved");

  const feedback = document.createElement("p");
  feedback.className = "product-buy__feedback";
  feedback.setAttribute("role", "status");
  feedback.setAttribute("aria-live", "polite");
  feedback.hidden = true;

  cartBtn.addEventListener("click", () => {
    const qtyValue = qty.getQty();
    const result = addToCart(product.id, qtyValue, product.stock);
    if (result === null) {
      feedback.textContent = "Quantidade excede o estoque disponível.";
      feedback.classList.remove("product-buy__feedback--danger");
      feedback.hidden = false;
      return;
    }
    feedback.hidden = false;
    feedback.textContent = `Adicionado! ${qtyValue} × ${product.name} no carrinho.`;
    syncHeaderCounts();
  });

  favBtn.addEventListener("click", () => {
    const nowFaved = toggleFavorite(product.id);
    favBtn.setAttribute("aria-pressed", String(nowFaved));
    favBtn.classList.toggle("is-faved", nowFaved);
    favBtn.textContent = nowFaved ? "Favoritado" : "Favoritar";
    favBtn.appendChild(heartIcon());
    syncHeaderCounts();
  });

  actions.appendChild(cartBtn);
  actions.appendChild(favBtn);
  buy.appendChild(actions);
  buy.appendChild(feedback);
  info.appendChild(buy);

  layout.appendChild(info);
  root.appendChild(layout);

  /* Especificações */
  const specs = document.createElement("section");
  specs.className = "product-specs";
  specs.setAttribute("aria-labelledby", "specs-title");
  const specsTitle = document.createElement("h2");
  specsTitle.className = "product-specs__title";
  specsTitle.id = "specs-title";
  specsTitle.textContent = "Especificações";
  specs.appendChild(specsTitle);

  const table = document.createElement("dl");
  table.className = "product-specs__table";
  for (const key of Object.keys(product.specs)) {
    const row = document.createElement("div");
    row.className = "product-specs__row";
    const dt = document.createElement("dt");
    dt.className = "product-specs__label";
    dt.textContent = key;
    const dd = document.createElement("dd");
    dd.className = "product-specs__value";
    dd.textContent = product.specs[key];
    row.appendChild(dt);
    row.appendChild(dd);
    table.appendChild(row);
  }
  specs.appendChild(table);
  root.appendChild(specs);

  root.appendChild(renderRelated(product));
}

/* --------------------------------------------------------------------------
   PRODUTOS RELACIONADOS (mesma categoria, depois mesma marca)
-------------------------------------------------------------------------- */

function renderRelated(current) {
  const section = document.createElement("section");
  section.className = "product-related";
  section.setAttribute("aria-labelledby", "related-title");

  const title = document.createElement("h2");
  title.className = "product-related__title";
  title.id = "related-title";
  title.textContent = "Produtos relacionados";
  section.appendChild(title);

  const grid = document.createElement("div");
  grid.className = "product-related__grid";

  const sameCategory = products.filter(
    (p) => p.id !== current.id && p.category === current.category
  );
  const sameBrand = products.filter(
    (p) => p.id !== current.id && p.brand === current.brand
  );

  const bucket = [];
  const seen = new Set();
  for (const p of sameCategory.concat(sameBrand)) {
    if (!seen.has(p.id)) {
      seen.add(p.id);
      bucket.push(p);
    }
    if (bucket.length === 4) break;
  }

  if (bucket.length === 0) {
    section.remove();
    return section;
  }

  for (const p of bucket) {
    const card = document.createElement("article");
    card.className = "product-card";
    card.setAttribute("aria-label", p.name);

    const link = document.createElement("a");
    link.className = "product-card__media-link";
    link.href = `produto.html?slug=${encodeURIComponent(p.slug)}`;
    link.setAttribute("aria-label", `Ver ${p.name}`);

    const media = document.createElement("div");
    media.className = "product-card__media";
    const img = productImage(p, 0);
    img.setAttribute("class", "product-card__img");
    media.appendChild(img);
    link.appendChild(media);
    card.appendChild(link);

    const body = document.createElement("div");
    body.className = "product-card__body";

    const pbrand = document.createElement("span");
    pbrand.className = "product-card__brand";
    pbrand.textContent = p.brand;
    body.appendChild(pbrand);

    const name = document.createElement("h3");
    name.className = "product-card__name";
    name.textContent = p.name;
    body.appendChild(name);

    const rating = document.createElement("div");
    rating.className = "rating";
    rating.appendChild(ratingStars(p.rating));
    const value = document.createElement("span");
    value.className = "rating__value";
    value.textContent = formatDecimal(p.rating);
    rating.appendChild(value);
    body.appendChild(rating);

    const price = document.createElement("div");
    price.className = "product-card__price";
    const current = document.createElement("span");
    current.className = "product-card__price-current";
    current.textContent = formatBRL(p.priceCents);
    price.appendChild(current);
    body.appendChild(price);

    const stock = document.createElement("p");
    stock.className =
      "product-card__stock " +
      (p.stock > 0 ? "product-card__stock--ok" : "product-card__stock--out");
    stock.textContent = p.stock > 0 ? "Em estoque" : "Esgotado";
    body.appendChild(stock);

    card.appendChild(body);
    grid.appendChild(card);
  }

  section.appendChild(grid);
  return section;
}

/* --------------------------------------------------------------------------
   PRODUTO NÃO ENCONTRADO
-------------------------------------------------------------------------- */

function renderNotFound(root) {
  root.replaceChildren();

  const empty = document.createElement("div");
  empty.className = "product-empty";
  empty.setAttribute("role", "status");

  const icon = svg({
    class: "product-empty__icon",
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
  title.className = "product-empty__title";
  title.textContent = "Produto não encontrado";
  empty.appendChild(title);

  const text = document.createElement("p");
  text.className = "product-empty__text";
  text.textContent =
    "O produto que você procura não existe ou não está mais disponível.";
  empty.appendChild(text);

  const link = document.createElement("a");
  link.className = "btn btn--primary";
  link.href = "produtos.html";
  link.textContent = "Voltar ao catálogo";
  empty.appendChild(link);

  root.appendChild(empty);
}

/* --------------------------------------------------------------------------
   INICIALIZAÇÃO
-------------------------------------------------------------------------- */

function getSlugFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return (params.get("slug") || "").trim();
}

function init() {
  const root = document.getElementById("product-app");
  if (!root) return;

  const slug = getSlugFromUrl();
  const product = products.find((p) => p.slug === slug);

  syncHeaderCounts();

  if (!product) {
    renderNotFound(root);
    return;
  }

  renderProduct(root, product);

  const title = document.getElementById("product-title");
  document.title = `${product.name} — Nexus Tech`;
  if (title) title.focus({ preventScroll: true });
}

init();
