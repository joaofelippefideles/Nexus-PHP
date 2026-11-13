/* ==========================================================================
   NEXUS TECH — Checkout completo (frontend simulado)
   Etapas: Dados > Endereço > Entrega > Pagamento > Resumo do pedido.
   Tudo mock/localStorage — nenhuma chamada à API, backend ou MySQL.

   Regras:
   - itens vêm do `nexus:cart` e são sanitizados com as mesmas regras do
     carrinho (cart-utils.js);
   - entrega padrão reusa a regra de frete do carrinho (>= R$ 500 -> grátis,
     senão R$ 29,90); entrega expressa é upgrade fixo de R$ 49,90;
   - dados financeiros (cartão/CVV) existem apenas em memória na sessão da
     página — nada é persistido em localStorage/sessionStorage;
   - confirmação simula um pedido (identificador fictício), limpa o carrinho
     e evita duplicação ao recarregar (confirmação guardada apenas na sessão);
   - DOM construído com createElement/textContent (sem innerHTML / XSS).

   v2.3 — Compra simulada vinculada ao usuário:
   - a finalização EXIGE sessão válida (sessionStorage "nexus:auth" apontando
     para um usuário existente em "nexus:user" — getAuthUser). Sem sessão: NÃO
     cria pedido, NÃO avança a sequência, NÃO limpa o carrinho; mostra mensagem
     acessível e ação para entrar (login.html?next=checkout.html);
   - o pedido mock é persistido em localStorage "nexus:orders" (array) com
     userId DERIVADO SOMENTE da sessão (nunca de inputs/URL/DOM) e uma
     fotografia dos itens (productId, nome, quantidade e preços) para que
     alterações futuras do catálogo não alterem o histórico;
   - pagamento guardado apenas como { method } (sem cartão/CVV/credenciais);
   - o botão de finalização é travado durante o processamento e a confirmação
     da sessão impede duplicação por duplo clique, Enter repetido ou reload.

   v3 — FASE 9-D (modo api):
   - quando NEXUS_STOREFRONT_AUTH="api", a confirmação chama POST /api/orders
     (user-api.js) e usa SOMENTE os valores retornados pelo backend; o payload
     leva itens, entrega, pagamento, endereço e uma chave de idempotência —
     NUNCA preço/subtotal/total/estoque;
   - a sessão é aguardada via authReady() (refresh httpOnly -> /me);
   - o carrinho/estado só são limpos após sucesso 201 (ou replay 200);
   - modo mock permanece intacto quando isStorefrontAuthApiEnabled() === false.
   ========================================================================== */

import { formatBRL } from "../../utils/format.js";
import { getAuthUser, authReady } from "../auth/auth.js";
import { clearCart, syncHeaderCounts } from "../store/store.js";
import { isStorefrontAuthApiEnabled } from "../../utils/config.js";
import userApi from "../../utils/user-api.js";
import {
  calculateSubtotal,
  EXPRESS_CENTS,
  sanitizeCart,
  standardShippingCents,
} from "../cart/cart-utils.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const SEQUENCE_KEY = "nexus:checkout:seq"; // contador simples e não sensível
const CONFIRM_KEY = "nexus:checkout:last-order"; // confirmação da sessão
const ORDERS_KEY = "nexus:orders"; // pedidos mock persistidos (array de pedidos)
const IDEM_KEY = "nexus:checkout:idem"; // chave de idempotência da confirmação (sessão)
const IDEM_PREFIX = "chk-";
const ORDER_PREFIX = "NT-";

const DELIVERY_LABELS = {
  standard: "Entrega padrão",
  express: "Entrega expressa",
};

const PAYMENT_LABELS = {
  credit: "Cartão de crédito",
  pix: "PIX",
  boleto: "Boleto bancário",
};

/* Opções de entrega simuladas. A padrão reutiliza a regra de frete do
   carrinho (consistência obrigatória); a expressa é um upgrade opcional. */
const SHIPPING_METHODS = [
  {
    id: "standard",
    label: "Entrega padrão",
    deadline: "5–8 dias úteis",
    price: standardShippingCents,
  },
  {
    id: "express",
    label: "Entrega expressa",
    deadline: "2–4 dias úteis",
    price: () => EXPRESS_CENTS,
  },
];

const VALIDATORS = {
  name: (value) =>
    value.trim().length >= 2 || "Informe seu nome completo (mínimo 2 letras).",
  email: (value) =>
    /^\S+@\S+\.\S+$/.test(value.trim()) || "Informe um e-mail válido.",
  phone: (value) =>
    normalizeDigits(value).length >= 8 ||
    "Informe um telefone com DDD (mínimo 8 dígitos).",
  cep: (value) =>
    normalizeDigits(value).length === 8 ||
    "Informe um CEP válido com 8 dígitos.",
  street: (value) => value.trim().length >= 3 || "Informe a rua.",
  number: (value) => value.trim() !== "" || "Informe o número.",
  complement: () => "",
  neighborhood: (value) => value.trim().length >= 2 || "Informe o bairro.",
  city: (value) => value.trim().length >= 2 || "Informe a cidade.",
  state: (value) => value !== "" || "Selecione o estado (UF).",
  cardNumber: (value) => {
    const digits = normalizeDigits(value);
    return (
      (digits.length >= 13 && digits.length <= 19) ||
      "Informe um número de cartão válido (13 a 19 dígitos)."
    );
  },
  cardName: (value) =>
    value.trim().length >= 2 || "Informe o nome impresso no cartão.",
  cardExpiry: (value) =>
    /^(0[1-9]|1[0-2])\/\d{2}$/.test(value.trim()) ||
    "Informe a validade no formato MM/AA.",
  cardCvv: (value) => {
    const digits = normalizeDigits(value);
    return (
      (digits.length >= 3 && digits.length <= 4) ||
      "Informe o CVV (3 ou 4 dígitos)."
    );
  },
  installments: (value) => value !== "" || "Selecione o número de parcelas.",
};

/* Estado em memória (nada sensível é persistido) */
const state = {
  items: new Map(), // id (String) -> { product, qty } — sanitizado
  delivery: "standard",
  payment: "credit",
  locked: false, // proteção contra duplicação de pedido
};

/* --------------------------------------------------------------------------
   SVG ILUSTRATIVO (resumo) — mesmo padrão visual do catálogo / produto
-------------------------------------------------------------------------- */

function svg(attrs) {
  const el = document.createElementNS(SVG_NS, "svg");
  for (const key of Object.keys(attrs)) {
    el.setAttribute(key, attrs[key]);
  }
  return el;
}

function checkoutImage(product) {
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
  bg.setAttribute("fill", "url(#chk" + product.id + ")");
  s.appendChild(bg);

  const defs = document.createElementNS(SVG_NS, "defs");
  const grad = document.createElementNS(SVG_NS, "linearGradient");
  grad.id = "chk" + product.id;
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
   HELPERS
-------------------------------------------------------------------------- */

function normalizeDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function deliveryMethod(id) {
  return SHIPPING_METHODS.find((m) => m.id === id) || SHIPPING_METHODS[0];
}

function calcTotals() {
  const subtotal = calculateSubtotal(state.items);
  const shipping = deliveryMethod(state.delivery).price(subtotal);
  return { subtotal, shipping, total: subtotal + shipping };
}

function announce(message) {
  const status = document.getElementById("checkout-status");
  if (status) status.textContent = message;
}

/* --------------------------------------------------------------------------
   RENDER — RESUMO DO PEDIDO
-------------------------------------------------------------------------- */

function renderSummary() {
  const list = document.getElementById("summary-items");
  const subtotalValue = document.getElementById("summary-subtotal");
  const freightValue = document.getElementById("summary-freight");
  const totalValue = document.getElementById("summary-total");
  const standardPrice = document.getElementById("delivery-standard-price");
  const expressPrice = document.getElementById("delivery-express-price");

  // v2.5 — guarda única para todos os elementos usados a seguir; o guard
  // anterior (só `list`) podia prosseguir com campos nulos.
  if (!list || !subtotalValue || !freightValue || !totalValue) return;

  list.replaceChildren();
  for (const { product, qty } of state.items.values()) {
    const li = document.createElement("li");
    li.className = "checkout-summary__item";

    const media = document.createElement("span");
    media.className = "checkout-summary__media";
    const img = checkoutImage(product);
    img.setAttribute("class", "checkout-summary__img");
    media.appendChild(img);
    li.appendChild(media);

    const info = document.createElement("span");
    info.className = "checkout-summary__item-info";
    const name = document.createElement("span");
    name.className = "checkout-summary__item-name";
    name.textContent = product.name;
    const meta = document.createElement("span");
    meta.className = "checkout-summary__item-meta";
    meta.textContent = `${qty} × ${formatBRL(product.priceCents)}`;
    info.appendChild(name);
    info.appendChild(meta);
    li.appendChild(info);

    const sub = document.createElement("span");
    sub.className = "checkout-summary__item-sub";
    sub.textContent = formatBRL(product.priceCents * qty);
    li.appendChild(sub);

    list.appendChild(li);
  }

  const { subtotal, shipping, total } = calcTotals();
  subtotalValue.textContent = formatBRL(subtotal);

  const method = deliveryMethod(state.delivery);
  freightValue.textContent =
    shipping === 0 ? `${method.label} — Grátis` : `${method.label} — ${formatBRL(shipping)}`;
  freightValue.classList.toggle("is-free", shipping === 0);

  totalValue.textContent = formatBRL(total);

  // Preços exibidos nas opções de entrega
  const standardCents = standardShippingCents(subtotal);
  standardPrice.textContent = standardCents === 0 ? "Grátis" : formatBRL(standardCents);
  expressPrice.textContent = formatBRL(EXPRESS_CENTS);

  if (state.payment === "credit") {
    renderInstallments(total);
  }
}

function renderInstallments(totalCents) {
  const select = document.getElementById("co-card-installments");
  if (!select) return;

  // v2.5 — preserva a parcela escolhida ao re-renderizar (troca de frete/
  // método de pagamento); antes o select era sempre resetado para 1x.
  const previous = Number(select.value) || 1;
  select.replaceChildren();

  for (let i = 1; i <= 12; i++) {
    const option = document.createElement("option");
    option.value = String(i);
    option.textContent = `${i}x de ${formatBRL(Math.ceil(totalCents / i))} sem juros`;
    select.appendChild(option);
  }

  select.value = String(previous >= 1 && previous <= 12 ? previous : 1);
}

/* --------------------------------------------------------------------------
   RETORNO VISUAL DAS OPÇÕES SELECIONADAS
-------------------------------------------------------------------------- */

function refreshSelectionHighlights() {
  document.querySelectorAll(".checkout-opt").forEach((opt) => {
    const input = opt.querySelector("input[type='radio']");
    opt.classList.toggle("is-selected", !!(input && input.checked));
  });
}

function togglePaymentPanels() {
  const credit = document.getElementById("co-credit-panel");
  const pix = document.getElementById("co-pix-panel");
  const boleto = document.getElementById("co-boleto-panel");
  if (credit) credit.hidden = state.payment !== "credit";
  if (pix) pix.hidden = state.payment !== "pix";
  if (boleto) boleto.hidden = state.payment !== "boleto";
}

/* --------------------------------------------------------------------------
   VALIDAÇÃO (frontend — sem alert(); mensagens associadas aos campos)
-------------------------------------------------------------------------- */

function setFieldError(field, message) {
  const wrap = field.closest(".checkout-form__field");
  if (!wrap) return;
  const described = field.getAttribute("aria-describedby")
    ? document.getElementById(field.getAttribute("aria-describedby"))
    : null;

  wrap.classList.toggle("has-error", Boolean(message));
  if (message) {
    field.setAttribute("aria-invalid", "true");
    if (described) described.textContent = message;
  } else {
    field.removeAttribute("aria-invalid");
    if (described) described.textContent = "";
  }
}

function validateField(field) {
  const rule = VALIDATORS[field.getAttribute("data-validate")];
  if (!rule) return "";
  const result = rule(field.value);
  return result === true ? "" : result; // regra válida retorna true -> mensagem vazia
}

function handleSubmit(event) {
  event.preventDefault();

  const form = document.getElementById("checkout-form");
  const fields = form.querySelectorAll("[data-validate]");
  let firstError = null;

  for (const field of fields) {
    if (field.closest("[hidden]")) continue; // ignora painéis ocultos (PIX/boleto)
    const message = validateField(field);
    setFieldError(field, message);
    if (message && !firstError) firstError = field;
  }

  if (firstError) {
    firstError.focus();
    announce("Revise os campos destacados antes de finalizar o pedido.");
    return;
  }

  finishOrder();
}

/* --------------------------------------------------------------------------
   FINALIZAÇÃO SIMULADA
-------------------------------------------------------------------------- */

function nextSequence() {
  let sequence = 0;
  try {
    sequence = Number(window.localStorage.getItem(SEQUENCE_KEY) || 0) || 0;
  } catch (err) {
    // storage indisponível — segue com 0
  }
  sequence += 1;
  try {
    window.localStorage.setItem(SEQUENCE_KEY, String(sequence));
  } catch (err) {
    // storage indisponível — segue com o id em memória
  }
  return sequence;
}

/* Leitura/escrita segura (localStorage/sessionStorage). */
function readJSON(key, store) {
  try {
    const raw = store.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    return null;
  }
}

function writeJSON(key, value, store) {
  try {
    store.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    return false;
  }
}

/* Banco de pedidos mock: array persistido em "nexus:orders". Cada pedido
   carrega seu userId; a v2.4 filtrará por usuário para o histórico. */
function readOrders() {
  const list = readJSON(ORDERS_KEY, window.localStorage);
  return Array.isArray(list) ? list : [];
}

function saveOrders(list) {
  return writeJSON(ORDERS_KEY, list, window.localStorage);
}

function readConfirm() {
  try {
    const raw = sessionStorage.getItem(CONFIRM_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return data && typeof data.id === "string" ? data : null;
  } catch (err) {
    return null;
  }
}

/* Fotografia da compra no momento da finalização. userId vem EXCLUSIVAMENTE
   da sessão validada (getAuthUser) — nunca de inputs, URL ou DOM. */
function buildOrder(user) {
  const totals = calcTotals();
  const items = [];
  for (const { product, qty } of state.items.values()) {
    items.push({
      productId: product.id,
      name: product.name,
      quantity: qty,
      unitPriceCents: product.priceCents,
      totalCents: product.priceCents * qty,
    });
  }

  const nameField = document.getElementById("co-name");
  const emailField = document.getElementById("co-email");

  return {
    id: ORDER_PREFIX + String(nextSequence()).padStart(6, "0"),
    userId: String(user.id),
    createdAt: new Date().toISOString(),
    status: "processing",
    items,
    subtotalCents: totals.subtotal,
    shippingCents: totals.shipping,
    totalCents: totals.total,
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    delivery: {
      method: state.delivery,
      label: DELIVERY_LABELS[state.delivery] || state.delivery,
    },
    // Apenas o método — nenhum dado de cartão/CVV/credencial é persistido.
    payment: {
      method: state.payment,
      label: PAYMENT_LABELS[state.payment] || state.payment,
    },
    // Fotografia não sensível do comprador (dados validados do formulário);
    // o vínculo principal continua sendo o userId da sessão.
    customer: {
      name: (nameField && nameField.value || "").trim(),
      email: (emailField && emailField.value || "").trim().toLowerCase(),
    },
  };
}

/* --------------------------------------------------------------------------
   IDEMPOTÊNCIA (modo api) — UMA chave por tentativa lógica de confirmação
   A chave nasce da "impressão digital" do pedido (itens + entrega + forma de
   pagamento + endereço). Repetir a MESMA confirmação (erro de rede, reload,
   duplo submit) reutiliza a MESMA chave; o backend (UNIQUE user+key) devolve
   replay 200 com o pedido original em vez de duplicar. Pedidos diferentes
   (carrinho/opções alteradas) geram chaves distintas, e a chave é limpa após
   o sucesso (nova compra => nova chave). A chave nunca contém dados
   sensíveis; a garantia definitiva é a UNIQUE do MySQL, não o storage.
-------------------------------------------------------------------------- */

function getCheckoutField(id) {
  const el = document.getElementById(id);
  return el ? String(el.value || "").trim() : "";
}

/* Foto não sensível do pedido para decidir entre reutilizar ou gerar chave. */
function checkoutFingerprint() {
  const items = [...state.items.entries()]
    .map(([id, { qty }]) => `${id}:${qty}`)
    .sort()
    .join(",");
  return [
    items,
    state.delivery,
    state.payment,
    getCheckoutField("co-name").toLowerCase(),
    getCheckoutField("co-email").toLowerCase(),
    getCheckoutField("co-cep"),
    getCheckoutField("co-street").toLowerCase(),
    getCheckoutField("co-number"),
    getCheckoutField("co-complement").toLowerCase(),
    getCheckoutField("co-neighborhood").toLowerCase(),
    getCheckoutField("co-city").toLowerCase(),
    getCheckoutField("co-state"),
  ].join("||");
}

function readIdemEntry() {
  return readJSON(IDEM_KEY, window.sessionStorage);
}

function saveIdemEntry(entry) {
  return writeJSON(IDEM_KEY, entry, window.sessionStorage);
}

function generateIdempotencyKey() {
  const nonce =
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 10) +
    Math.random().toString(36).slice(2, 10);
  return (IDEM_PREFIX + nonce).slice(0, 64);
}

function idempotencyKey() {
  const fp = checkoutFingerprint();
  const entry = readIdemEntry();
  if (
    entry &&
    entry.fp === fp &&
    typeof entry.key === "string" &&
    entry.key !== "" &&
    entry.key.length <= 64
  ) {
    return entry.key; // mesma tentativa em andamento -> mesma chave
  }
  const key = generateIdempotencyKey();
  saveIdemEntry({ fp, key });
  return key;
}

/* Payload real (modo api): SOMENTE ids e quantidades. Preço, subtotal, total e
   estoque NÃO são enviados — o backend é a autoridade. */
function buildCreateOrderPayload() {
  const items = [...state.items.entries()].map(([id, { qty }]) => ({
    productId: Number(id),
    quantity: Number(qty),
  }));

  return {
    items,
    deliveryMethod: state.delivery,
    paymentMethod: state.payment,
    address: {
      name: getCheckoutField("co-name"),
      email: getCheckoutField("co-email").toLowerCase(),
      cep: getCheckoutField("co-cep"),
      street: getCheckoutField("co-street"),
      number: getCheckoutField("co-number"),
      complement: getCheckoutField("co-complement") || null,
      neighborhood: getCheckoutField("co-neighborhood"),
      city: getCheckoutField("co-city"),
      state: getCheckoutField("co-state"),
    },
    idempotencyKey: idempotencyKey(),
  };
}

/* Sem sessão válida: NÃO cria pedido, NÃO avança a sequência e NÃO limpa o
   carrinho. Mensagem acessível () e ação para entrar em login.html. */
function showAuthRequired() {
  const block = document.getElementById("checkout-auth-required");
  if (block) block.hidden = false;
  announce(
    "Para finalizar o pedido, entre na sua conta. Seu carrinho foi preservado.",
  );
  const link = block ? block.querySelector("a") : null;
  if (link) link.focus({ preventScroll: true });
}

function finishOrder() {
  if (state.locked) return; // duplo clique / Enter repetido / handler repetido

  if (isStorefrontAuthApiEnabled()) {
    finishOrderApi();
    return;
  }
  finishOrderMock();
}

function finishOrderMock() {
  if (state.locked) return;

  const user = getAuthUser();
  if (!user) {
    showAuthRequired();
    return;
  }

  // Trava ANTES de criar o pedido: qualquer novo submit é ignorado.
  state.locked = true;
  const submitBtn = document.getElementById("co-submit");
  if (submitBtn) submitBtn.disabled = true;

  const order = buildOrder(user);

  const orders = readOrders();
  orders.push(order);
  if (!saveOrders(orders)) {
    state.locked = false;
    if (submitBtn) submitBtn.disabled = false;
    announce("Não foi possível registrar o pedido. Tente novamente.");
    return;
  }

  const confirm = {
    id: order.id,
    createdAt: order.createdAt,
    totalCents: order.totalCents,
    itemCount: order.itemCount,
    delivery: order.delivery,
    payment: order.payment,
  };

  try {
    sessionStorage.setItem(CONFIRM_KEY, JSON.stringify(confirm));
  } catch (err) {
    // sessão indisponível — confirmação apenas em memória
  }

  clearCart(); // só limpa após o pedido ser registrado com sucesso
  syncHeaderCounts();
  showSuccess(confirm);
}

/* Confirmação REAL (modo api). A ordem de operações é rígida: aguarda a
   sessão (authReady), monta o payload SEM preços, envia, usa os valores do
   backend, e só então limpa o carrinho/estado — nunca antes do sucesso. */
async function finishOrderApi() {
  let user = null;
  try {
    user = await authReady(); // refresh httpOnly -> /me (nunca o storage mock)
  } catch (err) {
    user = null;
  }
  if (!user || !user.id) {
    showAuthRequired();
    return;
  }
  if (state.locked) return; // outra tentativa já iniciada enquanto aguardávamos

  state.locked = true;
  const submitBtn = document.getElementById("co-submit");
  if (submitBtn) submitBtn.disabled = true;

  try {
    const payload = buildCreateOrderPayload();
    const data = await userApi.createOrder(payload);
    const order = data && data.order;
    if (
      !order ||
      typeof order.code !== "string" ||
      order.code === "" ||
      typeof order.totalCents !== "number"
    ) {
      throw new Error("Resposta de pedido inválida.");
    }

    const confirm = {
      id: order.code, // código REAL do backend (NT-...) exibido ao cliente
      createdAt: order.createdAt || new Date().toISOString(),
      totalCents: order.totalCents,
      itemCount: Number(order.itemCount) || 0,
      delivery: {
        method: order.deliveryMethod,
        label: order.deliveryLabel || order.deliveryMethod,
      },
      payment: {
        method: order.paymentMethod,
        label: order.paymentLabel || order.paymentMethod,
      },
      api: true,
    };

    try {
      sessionStorage.setItem(CONFIRM_KEY, JSON.stringify(confirm));
    } catch (err) {
      // sessão indisponível — confirmação apenas em memória
    }
    try {
      sessionStorage.removeItem(IDEM_KEY); // pedido concluído -> nova compra gera nova chave
    } catch (err) {
      // storage indisponível — segue normalmente
    }

    clearCart(); // SÓ após sucesso confirmado no servidor (201 ou replay 200)
    syncHeaderCounts();
    showSuccess(confirm);
  } catch (err) {
    state.locked = false;
    if (submitBtn) submitBtn.disabled = false;
    handleApiOrderError(err);
  }
}

/* Erros da API em mensagens amigáveis (nunca SQL/stack). NENHUM caminho
   limpa o carrinho aqui — o pedido só é concluído com resposta 200/201. */
function handleApiOrderError(err) {
  const status = err && err.status ? Number(err.status) : 0;
  const message = (err && String(err.message)) || "";

  if (status === 401) {
    showAuthRequired();
    announce(
      "Sua sessão expirou. Entre novamente para concluir o pedido. Seu carrinho foi preservado.",
    );
    return;
  }
  if (status === 403) {
    announce("Não foi possível concluir o pedido: sua conta está inativa.");
    return;
  }
  if (status === 409) {
    announce(
      /estoque/i.test(message)
        ? "Um ou mais produtos ficaram sem estoque. Seu carrinho foi preservado para revisão."
        : "Não foi possível concluir o pedido. Tente novamente.",
    );
    return;
  }
  if (status === 400) {
    announce("Não foi possível validar o pedido. Revise os dados informados.");
    return;
  }
  if (status === 0) {
    announce("Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.");
    return;
  }
  announce("Ocorreu um erro inesperado ao finalizar o pedido. Tente novamente em instantes.");
}

function showSuccess(saved) {
  toggleViews("success");
  document.getElementById("success-order").textContent = saved.id;
  const meta = document.getElementById("success-meta");
  if (meta) {
    const count = Number(saved.itemCount || 0);
    let text = `${count} ${count === 1 ? "item" : "itens"} no pedido — Total ${formatBRL(
      saved.totalCents,
    )}`;
    if (saved.payment && saved.payment.label) text += ` · ${saved.payment.label}`;
    if (saved.delivery && saved.delivery.label) text += ` · ${saved.delivery.label}`;
    text += saved.api
      ? " · Pedido real confirmado e registrado na sua conta."
      : ". Simulação: nenhum pedido real foi criado.";
    meta.textContent = text;
  }
  document.getElementById("success-title").focus();
  announce("Pedido realizado com sucesso.");

  // Após a confirmação, os dados do cartão (apenas em memória) são limpos do
  // formulário — nada sensível permanece no DOM.
  ["co-card-number", "co-card-name", "co-card-expiry", "co-card-cvv"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
}

/* --------------------------------------------------------------------------
   VIEWS (formulário / vazio / sucesso)
-------------------------------------------------------------------------- */

function toggleViews(mode) {
  document.getElementById("checkout-layout").hidden = mode !== "form";
  document.getElementById("checkout-empty").hidden = mode !== "empty";
  document.getElementById("checkout-success").hidden = mode !== "success";
}

function bindEvents() {
  const form = document.getElementById("checkout-form");

  form.addEventListener("submit", handleSubmit);

  // Limpa o estado de erro enquanto o usuário digita
  form.addEventListener("input", (event) => {
    const field = event.target.closest("[data-validate]");
    if (field) setFieldError(field, "");
  });

  form.addEventListener("change", (event) => {
    if (event.target.name === "co-delivery") {
      state.delivery = event.target.value;
      refreshSelectionHighlights();
      renderSummary();
    } else if (event.target.name === "co-payment") {
      state.payment = event.target.value;
      refreshSelectionHighlights();
      togglePaymentPanels();
      if (state.payment === "credit") renderSummary();
    }
  });
}

/* --------------------------------------------------------------------------
   INIT — prioridade: itens no carrinho > confirmação da sessão > vazio
-------------------------------------------------------------------------- */

function init() {
  const app = document.getElementById("checkout-app");
  const form = document.getElementById("checkout-form");
  if (!app || !form) return;

  const loaded = sanitizeCart();
  state.items = loaded.items;
  syncHeaderCounts();

  if (state.items.size > 0) {
    const delivery = document.querySelector('input[name="co-delivery"]:checked');
    const payment = document.querySelector('input[name="co-payment"]:checked');
    state.delivery = (delivery && delivery.value) || "standard";
    state.payment = (payment && payment.value) || "credit";

    toggleViews("form");
    bindEvents();
    refreshSelectionHighlights();
    togglePaymentPanels();
    renderSummary();
    return;
  }

  const saved = readConfirm();
  if (saved) {
    toggleViews("success");
    showSuccess(saved);
    return;
  }

  toggleViews("empty");
}

init();