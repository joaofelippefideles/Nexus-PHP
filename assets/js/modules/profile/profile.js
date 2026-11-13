/* ==========================================================================
   NEXUS TECH — Perfil / Minha conta
   Navegação entre seções (hash-based), dados pessoais, endereços, favoritos
   e preferências. Persistência em localStorage (chaves com prefixo "nexus:").

   v2.2 — Minha Conta real do usuário:
   - quando há sessão válida (sessionStorage "nexus:auth" apontando para um
     usuário existente em "nexus:user"), os dados pessoais exibidos/gravados
     são os do usuário autenticado (nexus:user);
   - endereços passam a carregar um campo "userId"; endereços criados/editados
     com sessão são associados ao usuário da sessão (nunca pelo HTML);
   - preferências são tagueadas com "userId" quando há sessão;
   - sem sessão, o painel mantém o modo legado v1.9 (perfil local "nexus:profile",
     endereços/favoritos/preferências globais) e exibe o convite para entrar.

   v2.4 — Pedidos do usuário:
   - a seção "Meus pedidos" exibe o histórico real vindo de "nexus:orders"
     (criado pelo checkout), filtrado pelo userId da sessão validada;
   - apenas leitura: nenhum pedido é criado/alterado/duplicado aqui; pedidos
     de outros usuários permanecem intactos no storage;
   - sem sessão válida, nenhum pedido é exibido (convite para entrar);
   - detalhes do pedido com aria-expanded/aria-controls, sem innerHTML e sem
     dados sensíveis (método de entrega/pagamento apenas).
   - cards de visão geral e pedidos refletem a quantidade real do usuário.

   v2.5 — Pedidos reais (modo api):
   - no modo api, "Meus pedidos" lista GET /api/orders e o detalhe usa
     GET /api/orders/:id (mesmos userApi.listOrders/getOrder do checkout).
     NUNCA lê "nexus:orders" no modo api (nenhum mock misturado);
   - listagem com estados loading / vazio / erro (com retry) / carregada;
     o código (NT-...) é exibido; subtotal/frete/total, entrega e pagamento
     vêm do backend (nunca recalculados pelo frontend);
   - detalhe carregado sob demanda com preços HISTÓRICOS (order_items) e
     snapshot do endereço de entrega; pedido de outro usuário -> 404 -> a
     API é a autoridade e o frontend exibe "Pedido não encontrado" (sem
     consultar storage como substituto);
   - mock preservado intacto (v2.4) — apenas o modo api mudou.

   NENHUMA senha é persistida ou exibida. No modo mock, nenhuma requisição ao
   servidor (o projeto é simulado); no modo api (config.js), a identidade vem
   de /me (authReady) e phone/cpf de GET/PATCH /api/auth/profile — name/email
   somente leitura, erros mapeados sem alert().
   ========================================================================== */

import { products } from "../../data/products.js";
import { formatBRL } from "../../utils/format.js";
import { getFavorites, toggleFavorite, syncHeaderCounts } from "../store/store.js";
import { isStorefrontAuthApiEnabled } from "../../utils/config.js";
import userApi from "../../utils/user-api.js";
import { authReady, getAuthUser, getSession, updateStoredUser } from "../auth/auth.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const PROFILE_KEY = "nexus:profile";
const ADDRESSES_KEY = "nexus:addresses";
const PREFS_KEY = "nexus:prefs";
const ORDERS_KEY = "nexus:orders";

const STATUS_LABELS = {
  processing: "Em processamento",
};

const SECTIONS = [
  { id: "overview", hash: "visao-geral", label: "Visão geral" },
  { id: "dados", hash: "meus-dados", label: "Meus dados" },
  { id: "pedidos", hash: "meus-pedidos", label: "Meus pedidos" },
  { id: "enderecos", hash: "enderecos", label: "Endereços" },
  { id: "favoritos", hash: "favoritos", label: "Favoritos" },
  { id: "config", hash: "configuracoes", label: "Configurações" },
];

const VALIDATORS = {
  text: (value) =>
    value.trim().length >= 2 || "Informe seu nome (mínimo 2 letras).",
  email: (value) =>
    /^\S+@\S+\.\S+$/.test(value.trim()) || "Informe um e-mail válido.",
  phone: (value) =>
    normalizeDigits(value).length >= 8 ||
    "Informe um telefone com DDD (mínimo 8 dígitos).",
  cpf: (value) =>
    value.trim() === "" ||
    isValidCpf(value) ||
    "Informe um CPF válido (formato 000.000.000-00).",
  label: () => "",
  cep: (value) =>
    normalizeDigits(value).length === 8 || "Informe um CEP válido com 8 dígitos.",
  street: (value) => value.trim().length >= 3 || "Informe a rua.",
  number: (value) => value.trim() !== "" || "Informe o número.",
  complement: () => "",
  neighborhood: (value) => value.trim().length >= 2 || "Informe o bairro.",
  city: (value) => value.trim().length >= 2 || "Informe a cidade.",
  state: (value) => value !== "" || "Selecione o estado (UF).",
};

const state = {
  section: "overview",
  editingAddressId: null,
  apiUser: null,
  runtimeProfile: null,
  /* Pedidos (modo api): cache da lista + estados da renderização. Em mock,
     os pedidos continuam vindo de "nexus:orders" (v2.4), nunca daqui. */
  orders: null, // array do backend quando carregado; null = ainda não carregado
  ordersState: "idle", // "idle" | "loading" | "ok" | "error"
  ordersError: null, // status HTTP do erro (0 = falha de rede)
  ordersRequestId: 0, // guard contra corrida de fetches (listagem + retry)
  details: new Map(), // cache de detalhes (modo api): id -> pedido normalizado
};

/* Leitura/escrita segura no localStorage (mesmo padrão do store). */
function read(key) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    return null;
  }
}

function write(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    return false;
  }
}

function getProfile() {
  const data = read(PROFILE_KEY);
  return data && typeof data === "object" ? data : {};
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

/* Identidade usada para filtrar dados locais (endereços, preferências,
   pedidos): sessão mock (mock) ou apiUser.id (api — fonte de verdade). */
function currentUserId() {
  if (isStorefrontAuthApiEnabled()) {
    return state.apiUser && state.apiUser.id ? String(state.apiUser.id) : null;
  }
  const session = getSession();
  if (!session || !String(session.userId)) return null;
  return getAuthUser() ? String(session.userId) : null;
}

/* Dados exibidos: vêm do usuário da sessão quando autenticado; caso
   contrário, mantém o perfil local (v1.9) — NUNCA os dados do usuário.
   No modo api: name/email de /me, phone/cpf de /profile. */
function getDisplayProfile() {
  if (isStorefrontAuthApiEnabled()) {
    const user = state.apiUser || {};
    const profile = state.runtimeProfile || {};
    return {
      name: user.name || "",
      email: user.email || "",
      phone: profile.phone || "",
      cpf: profile.cpf || "",
      createdAt: profile.createdAt || "",
    };
  }
  const user = getAuthUser();
  if (user) {
    return {
      name: user.name || "",
      email: user.email || "",
      phone: user.phone || "",
      cpf: user.cpf || "",
      createdAt: user.createdAt || "",
    };
  }
  return getProfile();
}

function saveProfile(data) {
  return write(PROFILE_KEY, {
    name: data.name || "",
    email: normalizeEmail(data.email),
    phone: data.phone || "",
    cpf: data.cpf || "",
  });
}

/* Complemento mock: updateStoredUser preserva o cpf por design; persiste a
   alteração do cpf do usuário da sessão (apenas o campo novo deste arquivo). */
function updateStoredUserCpf(cpf) {
  try {
    const raw = window.localStorage.getItem("nexus:user");
    if (!raw) return false;
    const user = JSON.parse(raw);
    if (!user || typeof user !== "object") return false;
    if (String(user.cpf || "").replace(/\D/g, "") === String(cpf || "").replace(/\D/g, "")) {
      return false;
    }
    user.cpf = String(cpf || "").trim();
    window.localStorage.setItem("nexus:user", JSON.stringify(user));
    return true;
  } catch (err) {
    return false;
  }
}

function getAddresses() {
  const data = read(ADDRESSES_KEY);
  return Array.isArray(data) ? data : [];
}

function saveAddresses(list) {
  return write(ADDRESSES_KEY, list);
}

/* Endereços do usuário autenticado. Sem sessão retorna todos (modo v1.9).
   Com sessão, retorna apenas os do usuário + endereços legados (sem userId),
   que pertencem ao único usuário do mock — preservando dados existentes. */
function addressesForCurrentUser() {
  const userId = currentUserId();
  if (!userId) return getAddresses();
  return getAddresses().filter((a) => !a.userId || String(a.userId) === String(userId));
}

/* Um endereço está no escopo do usuário autenticado quando não tem dono
   declarado (legado) ou pertence à sessão. Fora do escopo: nunca alterar. */
function isOwnAddress(address) {
  const userId = currentUserId();
  if (!userId) return true;
  return !address.userId || String(address.userId) === String(userId);
}

function getPrefs() {
  const data = read(PREFS_KEY);
  return data && typeof data === "object"
    ? data
    : { news: false, offers: false, contact: false };
}

/* Preferências: tagueadas com "userId" quando há sessão (associação ao
   usuário); sem sessão, apenas os três pares (formato v1.9 preservado). */
function savePrefs(prefs) {
  const userId = currentUserId();
  const next = {
    news: Boolean(prefs.news),
    offers: Boolean(prefs.offers),
    contact: Boolean(prefs.contact),
  };
  if (userId) next.userId = userId;
  return write(PREFS_KEY, next);
}

function normalizeDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

/* CPF — algoritmo oficial dos dígitos verificadores (espelha o cadastro). */
function isValidCpf(value) {
  const digits = String(value).replace(/\D/g, "");
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;
  if (digits === "12345678909") return false;

  let sum = 0;
  for (let i = 0; i < 9; i += 1) sum += Number(digits[i]) * (10 - i);
  let first = 11 - (sum % 11);
  if (first >= 10) first = 0;
  if (first !== Number(digits[9])) return false;

  sum = 0;
  for (let i = 0; i < 10; i += 1) sum += Number(digits[i]) * (11 - i);
  let second = 11 - (sum % 11);
  if (second >= 10) second = 0;
  return second === Number(digits[10]);
}

function announce(message) {
  const status = document.getElementById("profile-status");
  if (status) status.textContent = message;
}

function showFeedback(id, message, type = "success") {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = message;
  el.hidden = false;
  if (type === "warning") {
    el.classList.add("alert--warning");
    el.classList.remove("alert--success");
  } else {
    el.classList.add("alert--success");
    el.classList.remove("alert--warning");
  }
  announce(message);
}

/* --------------------------------------------------------------------------
   NAVEGAÇÃO ENTRE SEÇÕES
-------------------------------------------------------------------------- */

function sectionById(id) {
  return SECTIONS.find((s) => s.id === id);
}

function sectionFromHash() {
  const hash = window.location.hash.replace(/^#/, "");
  const match = SECTIONS.find((s) => s.hash === hash);
  return match ? match.id : "overview";
}

function switchSection(section, updateHash = true) {
  const target = sectionById(section);
  if (!target) return;
  state.section = target.id;

  for (const item of SECTIONS) {
    const panel = document.querySelector(`[data-panel="${item.id}"]`);
    if (panel) panel.hidden = item.id !== target.id;
  }

  const links = document.querySelectorAll(".profile-nav__link");
  for (const link of links) {
    const active = link.dataset.section === target.id;
    link.classList.toggle("is-active", active);
    if (active) {
      link.setAttribute("aria-current", "true");
    } else {
      link.removeAttribute("aria-current");
    }
  }

  const panel = document.querySelector(`[data-panel="${target.id}"]`);
  const title = panel ? panel.querySelector("[tabindex='-1']") : null;
  if (title) title.focus({ preventScroll: true });

  if (updateHash && window.location.hash !== "#" + target.hash) {
    try {
      history.replaceState(null, "", "#" + target.hash);
    } catch (err) {
      // hash apenas cosmético — segue mesmo se indisponível
    }
  }

  renderSection(target.id);
}

function renderSection(section) {
  const renderers = {
    overview: renderOverview,
    dados: renderDados,
    pedidos: renderPedidos,
    enderecos: renderAddresses,
    favoritos: renderFavorites,
    config: renderConfig,
  };
  const render = renderers[section];
  if (render) render();
}

function handleNavClick(event) {
  const link = event.target.closest("a[data-section]");
  if (!link) return;
  event.preventDefault();
  switchSection(link.dataset.section);
}

function handleHashChange() {
  const section = sectionFromHash();
  if (section !== state.section) {
    switchSection(section, false);
  }
}

/* --------------------------------------------------------------------------
   VISÃO GERAL
-------------------------------------------------------------------------- */

function renderOverview() {
  const favorites = getFavorites();
  const addresses = addressesForCurrentUser();
  const profile = getDisplayProfile();
  const orders = ordersForCurrentUser();

  /* Modo api: o contador de pedidos só existe depois de GET /api/orders.
     Dispara o 1º carregamento aqui, mas o card NUNCA lê nexus:orders. */
  if (
    isStorefrontAuthApiEnabled() &&
    currentUserId() &&
    state.ordersState === "idle"
  ) {
    loadOrders();
  }

  const fav = document.getElementById("ov-favoritos");
  if (fav) fav.textContent = String(favorites.length);

  const end = document.getElementById("ov-enderecos");
  if (end) end.textContent = String(addresses.length);

  const pedidos = document.getElementById("ov-pedidos");
  if (pedidos) {
    // Só sessão válida conta pedidos; sem sessão, zero (nada de usuário da
    // URL/DOM). Nenhum pedido estrangeiro é contabilizado.
    pedidos.textContent = String(currentUserId() ? orders.length : 0);
  }
  const pedidosText = document.getElementById("ov-pedidos-text");
  if (pedidosText) {
    if (!currentUserId()) {
      pedidosText.textContent = "Entre na sua conta para ver seus pedidos.";
    } else if (orders.length === 1) {
      pedidosText.textContent = "1 pedido registrado.";
    } else if (orders.length > 1) {
      pedidosText.textContent = `${orders.length} pedidos registrados.`;
    } else {
      pedidosText.textContent = "Nenhum pedido registrado ainda.";
    }
  }

  const conta = document.getElementById("ov-conta");
  const contaText = document.getElementById("ov-conta-text");
  if (conta && contaText) {
    if (profile.name || profile.email) {
      conta.textContent = profile.name || profile.email;
      contaText.textContent = profile.email
        ? `${profile.email}${profile.phone ? " · " + profile.phone : ""}`
        : "E-mail ainda não informado.";
    } else {
      conta.textContent = "Não preenchidos";
      contaText.textContent = "Preencha seus dados para personalizar a experiência.";
    }
  }
}

/* --------------------------------------------------------------------------
   DADOS PESSOAIS
-------------------------------------------------------------------------- */

function renderDados() {
  const profile = getDisplayProfile();
  const field = (id) => document.getElementById(id);
  const name = field("pf-name");
  const email = field("pf-email");
  const phone = field("pf-phone");
  const cpf = field("pf-cpf");

  if (name) name.value = profile.name || "";
  if (email) email.value = profile.email || "";
  if (phone) phone.value = profile.phone || "";
  if (cpf) cpf.value = profile.cpf || "";

  // No modo api, nome/e-mail vêm da conta (/me) e não são editáveis aqui.
  const apiMode = isStorefrontAuthApiEnabled();
  const setDisabled = (el) => {
    if (!el) return;
    if (apiMode) el.setAttribute("disabled", "");
    else el.removeAttribute("disabled");
  };
  setDisabled(name);
  setDisabled(email);

  document.querySelectorAll("#profile-form [data-validate]").forEach((el) => {
    clearFieldError(el);
  });
  const feedback = document.getElementById("profile-feedback");
  if (feedback) {
    feedback.hidden = true;
    feedback.textContent = "";
    feedback.classList.remove("alert--success", "alert--warning");
  }
}

/* --------------------------------------------------------------------------
   VALIDAÇÃO (padrão do checkout — sem alert(); mensagens associadas)
-------------------------------------------------------------------------- */

function setFieldError(field, message) {
  const wrap = field.closest(".contact-form__field");
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

function clearFieldError(field) {
  setFieldError(field, "");
}

function validateField(field) {
  const rule = VALIDATORS[field.getAttribute("data-validate")];
  if (!rule) return "";
  const result = rule(field.value);
  return result === true ? "" : result;
}

function validateGroup(container) {
  const fields = container.querySelectorAll("[data-validate]");
  let firstError = null;

  for (const field of fields) {
    const message = validateField(field);
    setFieldError(field, message);
    if (message && !firstError) firstError = field;
  }

  return firstError;
}

/* --------------------------------------------------------------------------
   DADOS PESSOAIS — salvar
-------------------------------------------------------------------------- */

async function handleProfileSubmit(event) {
  event.preventDefault();

  const form = document.getElementById("profile-form");
  const firstError = validateGroup(form);
  const feedback = document.getElementById("profile-feedback");

  if (firstError) {
    firstError.focus();
    if (feedback) {
      feedback.hidden = true;
      feedback.textContent = "";
      feedback.classList.remove("alert--success", "alert--warning");
    }
    announce("Revise os campos destacados antes de salvar.");
    return;
  }

  const data = {
    name: document.getElementById("pf-name").value.trim(),
    email: normalizeEmail(document.getElementById("pf-email").value),
    phone: document.getElementById("pf-phone").value.trim(),
    cpf: document.getElementById("pf-cpf").value.trim(),
  };

  if (isStorefrontAuthApiEnabled()) {
    await submitProfileApi(data);
    return;
  }

  if (getAuthUser()) {
    // Autenticado (mock): atualiza SOMENTE o usuário da sessão (preserva id e
    // createdAt no updateStoredUser) — não cria um novo usuário nem grava um
    // perfil separado. O cpf é persistido pelo complemento deste arquivo.
    updateStoredUser(data);
    updateStoredUserCpf(data.cpf);
  } else {
    // Sem sessão: modo legado v1.9 (perfil local), que não é o usuário.
    saveProfile(data);
  }
  showFeedback("profile-feedback", "Dados salvos com sucesso!");
}

/* --------------------------------------------------------------------------
   API — PATCH envia SOMENTE phone/cpf; valores normalizados vêm do servidor
-------------------------------------------------------------------------- */

async function submitProfileApi(data) {
  const feedback = document.getElementById("profile-feedback");
  const payload = {};
  if (data.phone !== "") payload.phone = data.phone;
  if (data.cpf !== "") payload.cpf = data.cpf;

  if (Object.keys(payload).length === 0) {
    const phone = document.getElementById("pf-phone");
    if (phone) phone.focus();
    announce("Informe ao menos o telefone ou o CPF para salvar.");
    return;
  }

  const submit = document.getElementById("pf-submit");
  if (submit) submit.disabled = true;
  try {
    const profile = await userApi.updateProfile(payload);
    state.runtimeProfile = {
      phone: (profile && profile.phone) || "",
      cpf: (profile && profile.cpf) || "",
      createdAt: (state.runtimeProfile && state.runtimeProfile.createdAt) || "",
      updatedAt: (profile && profile.updatedAt) || "",
    };
    const phoneEl = document.getElementById("pf-phone");
    if (phoneEl && profile && profile.phone != null) {
      phoneEl.value = String(profile.phone);
    }
    const cpfEl = document.getElementById("pf-cpf");
    if (cpfEl && profile && profile.cpf != null) {
      cpfEl.value = String(profile.cpf);
    }
    showFeedback("profile-feedback", "Dados salvos com sucesso!");
  } catch (err) {
    showProfileError(err, feedback);
  } finally {
    if (submit) submit.disabled = false;
  }
}

/* Mapa de erros sem alert(): mensagens seguras; associa ao campo quando
   possível; 401 devolve a página ao estado "convite" (sessão expirada). */
function showProfileError(err, feedback) {
  const status = err && err.status;
  let message;
  if (!status || status === 0) {
    message = "Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.";
  } else if (status === 401) {
    message = "Sua sessão expirou. Entre novamente para continuar.";
  } else if (status === 409) {
    message = "CPF já cadastrado para outro usuário.";
  } else if (status === 429) {
    message = "Muitas tentativas. Tente novamente mais tarde.";
  } else if (status >= 500) {
    message = "Ocorreu um erro inesperado no servidor. Tente novamente em instantes.";
  } else if (err && typeof err.message === "string" && err.message !== "") {
    message = err.message;
  } else {
    message = "Não foi possível salvar os dados. Revise e tente novamente.";
  }

  if (feedback) {
    feedback.textContent = message;
    feedback.hidden = false;
    feedback.classList.add("alert--warning");
    feedback.classList.remove("alert--success");
    announce(message);
  }

  if (status === 401) {
    state.apiUser = null;
    state.runtimeProfile = null;
    applyAuthUi(null);
    return;
  }

  const lower = String(message).toLowerCase();
  const cpfField = document.getElementById("pf-cpf");
  const phoneField = document.getElementById("pf-phone");
  if (status === 409 && cpfField) {
    setFieldError(cpfField, message);
    cpfField.focus();
    return;
  }
  if (cpfField && lower.includes("cpf")) {
    setFieldError(cpfField, message);
    cpfField.focus();
    return;
  }
  if (phoneField && (lower.includes("telefone") || lower.includes("phone"))) {
    setFieldError(phoneField, message);
    phoneField.focus();
  }
}

/* --------------------------------------------------------------------------
   ENDEREÇOS
-------------------------------------------------------------------------- */

function buildAddressFromForm() {
  const val = (id) => document.getElementById(id).value.trim();
  const address = {
    id: state.editingAddressId || "addr-" + Date.now().toString(36),
    label: val("addr-label"),
    cep: val("addr-cep"),
    street: val("addr-street"),
    number: val("addr-number"),
    complement: val("addr-complement"),
    neighborhood: val("addr-neighborhood"),
    city: val("addr-city"),
    state: val("addr-state"),
  };
  // Com sessão válida, o endereço é associado ao usuário da sessão
  // (NUNCA confia em userId vindo de campos HTML).
  const userId = currentUserId();
  if (userId) address.userId = userId;
  return address;
}

function addressSummary(address) {
  const street = `${address.street}, ${address.number}${address.complement ? " — " + address.complement : ""}`;
  const region = `${address.neighborhood} · ${address.city}/${address.state}`;
  return { street, region };
}

function renderAddresses() {
  const addresses = addressesForCurrentUser();
  const list = document.getElementById("addresses-list");
  const empty = document.getElementById("addresses-empty");
  if (!list || !empty) return;

  const emptyVisible = addresses.length === 0;
  empty.hidden = !emptyVisible;
  list.hidden = emptyVisible;

  list.replaceChildren();

  for (const address of addresses) {
    const li = document.createElement("li");
    li.className = "profile-address";

    const head = document.createElement("div");
    head.className = "profile-address__head";
    const title = document.createElement("strong");
    title.textContent = address.label || "Endereço";
    head.appendChild(title);
    li.appendChild(head);

    const text = document.createElement("p");
    text.className = "profile-address__text";
    const summary = addressSummary(address);
    text.appendChild(document.createTextNode(summary.street));
    text.appendChild(document.createElement("br"));
    text.appendChild(document.createTextNode(summary.region));
    text.appendChild(document.createElement("br"));
    text.appendChild(document.createTextNode(`CEP ${address.cep}`));
    li.appendChild(text);

    const actions = document.createElement("div");
    actions.className = "profile-address__actions";

    const edit = document.createElement("button");
    edit.type = "button";
    edit.className = "btn btn--outline";
    edit.textContent = "Editar";
    edit.setAttribute("data-address-action", "edit");
    edit.setAttribute("data-address-id", address.id);
    actions.appendChild(edit);

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "btn btn--ghost";
    remove.textContent = "Remover";
    remove.setAttribute("data-address-action", "remove");
    remove.setAttribute("data-address-id", address.id);
    actions.appendChild(remove);

    li.appendChild(actions);
    list.appendChild(li);
  }
}

function showAddressForm(editingId = null) {
  state.editingAddressId = editingId ? String(editingId) : null;
  const form = document.getElementById("address-form");
  const title = document.getElementById("address-form-title");
  if (!form || !title) return;

  const editing = getAddresses().find((a) => String(a.id) === state.editingAddressId && isOwnAddress(a));
  const setVal = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.value = value || "";
  };

  setVal("addr-label", editing ? editing.label : "");
  setVal("addr-cep", editing ? editing.cep : "");
  setVal("addr-street", editing ? editing.street : "");
  setVal("addr-number", editing ? editing.number : "");
  setVal("addr-complement", editing ? editing.complement : "");
  setVal("addr-neighborhood", editing ? editing.neighborhood : "");
  setVal("addr-city", editing ? editing.city : "");
  setVal("addr-state", editing ? editing.state : "");

  form.querySelectorAll("[data-validate]").forEach(clearFieldError);
  const feedback = document.getElementById("address-feedback");
  if (feedback) {
    feedback.hidden = true;
    feedback.textContent = "";
    feedback.classList.remove("alert--success");
  }

  title.textContent = editingId ? "Editar endereço" : "Novo endereço";
  form.hidden = false;
  document.getElementById("addr-label").focus();
}

function hideAddressForm() {
  state.editingAddressId = null;
  const form = document.getElementById("address-form");
  if (form) {
    form.hidden = true;
    form.reset();
  }
}

function handleAddressSubmit(event) {
  event.preventDefault();

  const form = document.getElementById("address-form");
  const firstError = validateGroup(form);
  const feedback = document.getElementById("address-feedback");

  if (firstError) {
    firstError.focus();
    if (feedback) {
      feedback.hidden = true;
      feedback.textContent = "";
      feedback.classList.remove("alert--success");
    }
    announce("Revise os campos destacados antes de salvar o endereço.");
    return;
  }

  const address = buildAddressFromForm();
  const addresses = getAddresses();
  const index = addresses.findIndex(
    (a) => String(a.id) === String(address.id) && isOwnAddress(a),
  );
  const isEditing = index >= 0;

  if (isEditing) {
    // Preserva o dono (userId) original ao editar; nunca troca o usuário da
    // sessão por um campo do formulário.
    if (addresses[index].userId) address.userId = addresses[index].userId;
    addresses[index] = address;
  } else {
    addresses.push(address);
  }

  saveAddresses(addresses);
  hideAddressForm();
  renderAddresses();
  showFeedback("address-feedback", isEditing ? "Endereço atualizado com sucesso!" : "Endereço salvo com sucesso!");
}

function handleAddressListClick(event) {
  const button = event.target.closest("[data-address-id]");
  if (!button) return;

  const id = button.getAttribute("data-address-id");
  const action = button.getAttribute("data-address-action");

  if (action === "edit") {
    showAddressForm(id);
    return;
  }

  if (action === "remove") {
    const addresses = getAddresses().filter(
      (a) => !(String(a.id) === String(id) && isOwnAddress(a)),
    );
    saveAddresses(addresses);
    if (state.editingAddressId === String(id)) hideAddressForm();
    renderAddresses();
    showFeedback("address-feedback", "Endereço removido com sucesso.");
  }
}

/* --------------------------------------------------------------------------
   FAVORITOS
-------------------------------------------------------------------------- */

function svg(attrs) {
  const el = document.createElementNS(SVG_NS, "svg");
  for (const key of Object.keys(attrs)) {
    el.setAttribute(key, attrs[key]);
  }
  return el;
}

function favoriteImage(product) {
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

  const defs = document.createElementNS(SVG_NS, "defs");
  const grad = document.createElementNS(SVG_NS, "linearGradient");
  grad.id = "pfav" + product.id;
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

  const bg = document.createElementNS(SVG_NS, "rect");
  bg.setAttribute("width", "240");
  bg.setAttribute("height", "240");
  bg.setAttribute("fill", "url(#pfav" + product.id + ")");
  s.appendChild(bg);

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

function renderFavorites() {
  const favorites = getFavorites();
  const list = document.getElementById("favorites-list");
  const empty = document.getElementById("favorites-empty");
  if (!list || !empty) return;

  const items = favorites
    .map((id) => products.find((p) => String(p.id) === String(id)))
    .filter(Boolean);

  const emptyVisible = items.length === 0;
  empty.hidden = !emptyVisible;
  list.hidden = emptyVisible;
  list.replaceChildren();

  for (const product of items) {
    const li = document.createElement("li");
    li.className = "profile-fav__item";

    const media = document.createElement("span");
    media.className = "profile-fav__media";
    const img = favoriteImage(product);
    img.setAttribute("class", "profile-fav__img");
    media.appendChild(img);
    li.appendChild(media);

    const info = document.createElement("span");
    info.className = "profile-fav__info";

    const link = document.createElement("a");
    link.className = "profile-fav__name";
    link.href = `produto.html?slug=${product.slug}`;
    link.textContent = product.name;
    info.appendChild(link);

    const meta = document.createElement("span");
    meta.className = "profile-fav__meta";
    meta.textContent = product.brand;
    info.appendChild(meta);

    const price = document.createElement("span");
    price.className = "profile-fav__price";
    price.textContent = formatBRL(product.priceCents);
    info.appendChild(price);

    li.appendChild(info);

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "btn btn--ghost";
    remove.textContent = "Remover";
    remove.setAttribute("aria-label", `Remover ${product.name} dos favoritos`);
    remove.setAttribute("data-remove-favorite", String(product.id));
    li.appendChild(remove);

    list.appendChild(li);
  }
}

function handleFavoriteClick(event) {
  const button = event.target.closest("[data-remove-favorite]");
  if (!button) return;

  const product = products.find((p) => String(p.id) === button.getAttribute("data-remove-favorite"));
  toggleFavorite(product.id);
  renderFavorites();
  syncHeaderCounts();
  announce(`Produto removido dos favoritos.${product ? ` ${product.name}.` : ""}`);
}

/* --------------------------------------------------------------------------
   PEDIDOS — histórico do usuário autenticado
   Fonte: "nexus:orders" (array criado pelo checkout — snapshot v2.3).
   Apenas LEITURA: nenhum pedido é criado/editado/removido aqui; pedidos de
   outros usuários permanecem intactos no storage. O filtro usa EXCLUSIVAMENTE
   o userId da sessão validada (getAuthUser) — nunca HTML, input, query, URL
   ou DOM. Dados exibidos são não sensíveis (sem cartão/CVV/senha).
   Sem innerHTML: tudo é criado com createElement/textContent/setAttribute.
-------------------------------------------------------------------------- */

function readOrders() {
  const data = read(ORDERS_KEY);
  return Array.isArray(data) ? data : [];
}

/* Lista do usuário autenticado. Sem sessão válida → [] (nenhum pedido é
   exibido). Com sessão, apenas os pedidos cujo userId bate com o da sessão.
   Modo api: a lista vem EXCLUSIVAMENTE do cache de GET /api/orders — o mock
   "nexus:orders" é ignorado (nada de pedido simulado misturado com real). */
function ordersForCurrentUser() {
  const userId = currentUserId();
  if (!userId) return [];
  if (isStorefrontAuthApiEnabled()) {
    return Array.isArray(state.orders) ? state.orders : [];
  }
  return readOrders().filter(
    (order) => order && String(order.userId) === String(userId),
  );
}

/* createdAt inválido/ausente → tratado como o mais antigo (vai para o fim da
   lista, que é ordenada da mais recente para a mais antiga) e exibido como
   "Data indisponível". Documentado: pedido nunca quebra por causa disso. */
function orderTimestamp(order) {
  const time = Date.parse(String((order && order.createdAt) || ""));
  return Number.isNaN(time) ? 0 : time;
}

function orderDateText(order) {
  const time = orderTimestamp(order);
  if (time <= 0) return "Data indisponível";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(time));
}

function orderStatusText(order) {
  const raw = order && order.status;
  return STATUS_LABELS[raw] || String(raw || "Status indisponível");
}

function orderItemCount(order) {
  if (typeof order.itemCount === "number") return order.itemCount;
  if (Array.isArray(order.items)) {
    return order.items.reduce(
      (sum, item) => sum + (Number(item && item.quantity) || 0),
      0,
    );
  }
  return 0;
}

function orderTotalCents(order) {
  if (typeof order.totalCents === "number") return order.totalCents;
  if (Array.isArray(order.items)) {
    return order.items.reduce(
      (sum, item) => sum + (Number(item && item.totalCents) || 0),
      0,
    );
  }
  return null;
}

function moneyText(cents) {
  return typeof cents === "number" ? formatBRL(cents) : "—";
}

/* Método de entrega: aceita o shape mock (delivery.label) e o da API real
   (deliveryLabel no topo do pedido). Nada de dados sensíveis no texto. */
function deliveryText(order) {
  const delivery = order && order.delivery;
  if (delivery && delivery.label) return delivery.label;
  if (delivery && delivery.method) return delivery.method;
  if (order && order.deliveryLabel) return order.deliveryLabel;
  if (order && order.deliveryMethod) return order.deliveryMethod;
  return "Informação indisponível";
}

/* Método de pagamento: mesmo fallback duplo (mock => detalhe da API). */
function paymentText(order) {
  const payment = order && order.payment;
  if (payment && payment.label) return payment.label;
  if (payment && payment.method) return payment.method;
  if (order && order.paymentLabel) return order.paymentLabel;
  if (order && order.paymentMethod) return order.paymentMethod;
  return "Informação indisponível";
}

/* Código exibido no título do card. Mock: o próprio id (NT-000001, v2.4
   preservada). API: o código REAL do backend (code = NT-xxxxxxxxxx). */
function orderCodeText(order) {
  const code = order && order.code;
  return String(code || (order && order.id) || "");
}

/* ID seguro para usar em id/atributos do DOM (normaliza o id do pedido e
   prefixa "pedido-" para evitar colisões e ids inválidos). */
function orderDomId(orderId) {
  const safe = String(orderId || "").replace(/[^A-Za-z0-9_-]/g, "");
  return safe ? "pedido-" + safe : "pedido-generico";
}

function renderPedidos() {
  const list = document.getElementById("pedidos-list");
  const empty = document.getElementById("pedidos-empty");
  const authRequired = document.getElementById("pedidos-auth-required");
  const loading = document.getElementById("pedidos-loading");
  const error = document.getElementById("pedidos-error");
  if (!list || !empty || !authRequired) return;

  const userId = currentUserId();

  // Sem sessão válida: nenhum pedido é exibido; pede login.
  if (!userId) {
    // Modo api: o texto do convite é sobre a conta real (não "simulados").
    if (isStorefrontAuthApiEnabled()) {
      const authText = authRequired.querySelector(".cart-empty__text");
      if (authText) {
        authText.textContent =
          "Seus pedidos ficam vinculados à sua conta. Faça login para visualizar o histórico.";
      }
    }
    authRequired.hidden = false;
    empty.hidden = true;
    list.hidden = true;
    list.replaceChildren();
    if (loading) loading.hidden = true;
    if (error) error.hidden = true;
    return;
  }

  if (isStorefrontAuthApiEnabled()) {
    renderPedidosApi(list, empty, authRequired, loading, error);
    return;
  }

  authRequired.hidden = true;
  if (loading) loading.hidden = true;
  if (error) error.hidden = true;
  const orders = ordersForCurrentUser().sort(
    (a, b) => orderTimestamp(b) - orderTimestamp(a),
  );

  const emptyVisible = orders.length === 0;
  empty.hidden = !emptyVisible;
  list.hidden = emptyVisible;
  list.replaceChildren();

  for (const order of orders) list.appendChild(renderOrderCard(order));
}

/* Modo api — estados da listagem baseados no cache/state (a API é a única
   fonte; "nexus:orders" nunca participa aqui). */
function renderPedidosApi(list, empty, authRequired, loading, error) {
  authRequired.hidden = true;
  if (error) error.hidden = true;
  if (loading) loading.hidden = true;
  list.hidden = false;
  list.replaceChildren();

  if (state.ordersState === "ok") {
    const orders = ordersForCurrentUser();
    const emptyVisible = orders.length === 0;
    empty.hidden = !emptyVisible;
    list.hidden = emptyVisible;
    for (const order of orders) list.appendChild(renderOrderCard(order));
    return;
  }

  empty.hidden = true;
  list.hidden = true;

  if (state.ordersState === "loading") {
    if (loading) loading.hidden = false;
    return;
  }

  if (state.ordersState === "error") {
    if (error) {
      const text = document.getElementById("pedidos-error-text");
      if (text) text.textContent = ordersErrorLabel(state.ordersError);
      error.hidden = false;
    }
    return;
  }

  // "idle": primeiro carregamento (ou retry) — dispara GET /api/orders.
  state.ordersState = "loading";
  if (loading) loading.hidden = false;
  loadOrders();
}

function ordersErrorLabel(status) {
  if (status === 403) {
    return "Sua conta está inativa, por isso não foi possível carregar seus pedidos.";
  }
  return "Não foi possível carregar seus pedidos no momento.";
}

/* GET /api/orders com estados (loading/ok/error) e retry. Concorrência:
   cada chamada tem um id próprio; resposta antiga não sobrescreve a nova. */
async function loadOrders() {
  const requestId = ++state.ordersRequestId;
  try {
    const data = await userApi.listOrders();
    if (requestId !== state.ordersRequestId) return;
    state.orders = Array.isArray(data && data.orders) ? data.orders : [];
    state.ordersState = "ok";
    state.ordersError = null;
    renderPedidos();
    renderOverview();
    const count = state.orders.length;
    announce(
      count === 0
        ? "Você ainda não possui pedidos."
        : `${count} ${count === 1 ? "pedido carregado" : "pedidos carregados"}.`,
    );
  } catch (err) {
    if (requestId !== state.ordersRequestId) return;
    // 401: sessão expirada/inválida -> convite (nunca mock como substituto).
    if (err && err.status === 401) {
      state.apiUser = null;
      state.orders = [];
      state.ordersState = "ok";
      state.ordersError = null;
      applyAuthUi(null);
      renderPedidos();
      renderOverview();
      announce("Sua sessão expirou. Entre novamente para continuar.");
      return;
    }
    state.ordersState = "error";
    state.ordersError = err && typeof err.status === "number" ? err.status : 0;
    renderPedidos();
    announce("Não foi possível carregar seus pedidos no momento.");
  }
}

/* Normaliza o pedido da API para o shape interno de renderização (o mock
   v2.4 continua como está — apenas o modo api passa por aqui). */
function normalizeApiOrder(order, items) {
  return {
    id: order && order.id,
    code: order && order.code,
    status: order && order.status,
    subtotalCents: order && order.subtotalCents,
    shippingCents: order && order.shippingCents,
    totalCents: order && order.totalCents,
    itemCount: order && order.itemCount,
    delivery: {
      method: (order && order.deliveryMethod) || "",
      label: (order && order.deliveryLabel) || order && order.deliveryMethod || "",
    },
    payment: {
      method: (order && order.paymentMethod) || "",
      label: (order && order.paymentLabel) || order && order.paymentMethod || "",
    },
    deliveryName: (order && order.deliveryName) || "",
    deliveryEmail: (order && order.deliveryEmail) || "",
    address: (order && order.address) || {},
    createdAt: (order && order.createdAt) || "",
    items: Array.isArray(items)
      ? items.map((item) => ({
          name: (item && item.productName) || "Produto",
          quantity: Number(item && item.quantity) || 0,
          unitPriceCents: item && item.unitPriceCents,
          totalCents: item && item.totalCents,
        }))
      : [],
  };
}

/* Detalhe sob demanda (modo api). Endereço snapshot + preços HISTÓRICOS de
   order_items vêm exclusivamente de GET /api/orders/:id. */
async function openOrderDetailsApi(id, details, toggle) {
  details.replaceChildren();
  const statusEl = document.createElement("p");
  statusEl.className = "pedido-details__status";
  statusEl.setAttribute("role", "status");
  statusEl.textContent = "Carregando detalhes...";
  details.appendChild(statusEl);
  details.hidden = false;
  toggle.setAttribute("aria-expanded", "true");
  announce(`Carregando detalhes do pedido ${id}.`);

  try {
    if (!state.details.has(String(id))) {
      const data = await userApi.getOrder(id);
      state.details.set(
        String(id),
        normalizeApiOrder(data && data.order, data && data.items),
      );
    }
    if (!isOrderDetailsOpen(id)) return;
    details.replaceChildren();
    appendOrderDetails(details, state.details.get(String(id)), {
      withAddress: true,
    });
    announce(`Detalhes do pedido ${id} abertos.`);
  } catch (err) {
    if (!isOrderDetailsOpen(id)) return;
    details.replaceChildren();
    const msg = document.createElement("p");
    msg.className = "pedido-details__status";
    if (err && err.status === 404) {
      // A API é a autoridade: pedido inexistente/alheio nunca é substituído
      // por dados locais ("nexus:orders" não é consultado).
      msg.textContent = "Pedido não encontrado.";
      announce("Pedido não encontrado.");
    } else {
      msg.textContent =
        "Não foi possível carregar os detalhes do pedido. Tente novamente.";
      announce("Não foi possível carregar os detalhes do pedido.");
    }
    details.appendChild(msg);
  }
}

function isOrderDetailsOpen(id) {
  const btn = document.getElementById(orderDomId(id) + "-btn");
  return Boolean(btn) && btn.getAttribute("aria-expanded") === "true";
}

function renderOrderCard(order) {
  const li = document.createElement("li");
  li.className = "pedido";

  const head = document.createElement("div");
  head.className = "pedido__head";

  const title = document.createElement("h3");
  title.className = "pedido__number";
  title.textContent = `Pedido ${orderCodeText(order)}`;

  const status = document.createElement("span");
  status.className = "pedido__status";
  status.textContent = orderStatusText(order);

  head.appendChild(title);
  head.appendChild(status);

  const count = orderItemCount(order);
  const meta = document.createElement("p");
  meta.className = "pedido__meta";
  if (isStorefrontAuthApiEnabled()) {
    // Listagem vinda da API: subtotal/frete/total, entrega e pagamento são os
    // valores do backend — nunca recalculados com o carrinho atual.
    meta.textContent =
      `${orderDateText(order)} · ${count} ${count === 1 ? "item" : "itens"}` +
      ` · Subtotal ${moneyText(order.subtotalCents)}` +
      ` · Frete ${moneyText(order.shippingCents)}` +
      ` · Total ${moneyText(orderTotalCents(order))}` +
      ` · ${deliveryText(order)} · ${paymentText(order)}`;
  } else {
    // Mock v2.4 preservado byte a byte.
    meta.textContent =
      `${orderDateText(order)} · ${count} ${count === 1 ? "item" : "itens"}` +
      ` · ${moneyText(orderTotalCents(order))} · ${deliveryText(order)}`;
  }

  const domId = orderDomId(order.id);
  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "btn btn--outline pedido__toggle";
  toggle.id = domId + "-btn";
  toggle.textContent = "Ver detalhes";
  toggle.setAttribute("aria-label", `Ver detalhes do pedido ${order.id}`);
  toggle.setAttribute("aria-expanded", "false");
  toggle.setAttribute("aria-controls", domId + "-details");
  toggle.setAttribute("data-order-toggle", String(order.id));

  const details = document.createElement("div");
  details.className = "pedido-details";
  details.id = domId + "-details";
  details.hidden = true;
  details.setAttribute("role", "region");
  details.setAttribute("aria-labelledby", domId + "-btn");
  // Modo api: os detalhes (itens + endereço snapshot) são buscados sob
  // demanda em GET /api/orders/:id — não há itens no pedido da listagem.
  if (!isStorefrontAuthApiEnabled()) {
    appendOrderDetails(details, order);
  }

  li.appendChild(head);
  li.appendChild(meta);
  li.appendChild(toggle);
  li.appendChild(details);
  return li;
}

function appendOrderDetails(details, order, opts = {}) {
  const itemsTitle = document.createElement("h4");
  itemsTitle.textContent = "Itens do pedido";
  details.appendChild(itemsTitle);

  const items = document.createElement("ul");
  items.className = "pedido-items";
  for (const item of Array.isArray(order.items) ? order.items : []) {
    if (!item) continue;
    const row = document.createElement("li");
    row.className = "pedido-item";

    const main = document.createElement("div");
    main.className = "pedido-item__main";
    const name = document.createElement("strong");
    name.textContent = item.name || "Produto";
    const unit = document.createElement("span");
    unit.className = "pedido-item__meta";
    unit.textContent =
      `${Number(item.quantity) || 0} × ${moneyText(item.unitPriceCents)}`;
    main.appendChild(name);
    main.appendChild(unit);

    const total = document.createElement("span");
    total.className = "pedido-item__total";
    total.textContent = moneyText(item.totalCents);

    row.appendChild(main);
    row.appendChild(total);
    items.appendChild(row);
  }
  details.appendChild(items);

  const cols = document.createElement("div");
  cols.className = "pedido-details__cols";

  const summaryTitle = document.createElement("h4");
  summaryTitle.textContent = "Resumo";
  cols.appendChild(summaryTitle);
  cols.appendChild(
    buildSummary([
      { label: "Subtotal", value: moneyText(order.subtotalCents) },
      { label: "Frete", value: moneyText(order.shippingCents) },
      { label: "Total", value: moneyText(orderTotalCents(order)), total: true },
    ]),
  );

  const infoTitle = document.createElement("h4");
  infoTitle.textContent = "Entrega e pagamento";
  cols.appendChild(infoTitle);
  cols.appendChild(
    buildSummary([
      { label: "Entrega", value: deliveryText(order) },
      { label: "Pagamento", value: paymentText(order) },
    ]),
  );

  // Snapshot do endereço de ENTREGA gravado no pedido (modo api). Vem do
  // banco — nunca do localStorage nem de um endereço salvo atual.
  if (opts.withAddress && order && order.address) {
    const addr = order.address || {};
    const rows = [];
    if (order.deliveryName) rows.push({ label: "Nome", value: order.deliveryName });
    if (order.deliveryEmail) rows.push({ label: "E-mail", value: order.deliveryEmail });
    if (addr.street) {
      rows.push({ label: "Endereço", value: `${addr.street}, ${addr.number || ""}`.trim() });
    }
    if (addr.complement) rows.push({ label: "Complemento", value: addr.complement });
    if (addr.neighborhood) rows.push({ label: "Bairro", value: addr.neighborhood });
    if (addr.city && addr.state) rows.push({ label: "Cidade/UF", value: `${addr.city}/${addr.state}` });
    if (addr.cep) rows.push({ label: "CEP", value: String(addr.cep) });

    const addrTitle = document.createElement("h4");
    addrTitle.textContent = "Endereço de entrega";
    cols.appendChild(addrTitle);
    cols.appendChild(buildSummary(rows));
  }

  details.appendChild(cols);
}

function buildSummary(rows) {
  const list = document.createElement("dl");
  list.className = "pedido-summary";
  for (const row of rows) {
    const item = document.createElement("div");
    if (row.total) item.className = "pedido-summary__total";
    const dt = document.createElement("dt");
    dt.textContent = row.label;
    const dd = document.createElement("dd");
    dd.textContent = row.value;
    item.appendChild(dt);
    item.appendChild(dd);
    list.appendChild(item);
  }
  return list;
}

/* SEGURANÇA: o pedido só abre se pertencer ao usuário da sessão. A busca é
   feita SEMPRE na lista filtrada (id + userId), nunca no storage global e
   nunca com userId vindo do cliente — id forjado simplesmente não encontra
   nada. Este é o único ponto de acesso aos detalhes. */
function handlePedidosClick(event) {
  const toggle = event.target.closest("[data-order-toggle]");
  if (!toggle) return;

  const id = String(toggle.getAttribute("data-order-toggle"));
  const order = ordersForCurrentUser().find((o) => String(o.id) === id);
  if (!order) return;

  const details = document.getElementById(orderDomId(order.id) + "-details");
  if (!details) return;

  // Modo api: detalhes sob demanda (GET /api/orders/:id). O pedido vem da
  // lista autorizada; o backend refaz o ownership (404 p/ pedido alheio).
  if (isStorefrontAuthApiEnabled()) {
    if (details.hidden) {
      openOrderDetailsApi(id, details, toggle);
    } else {
      details.hidden = true;
      toggle.setAttribute("aria-expanded", "false");
      announce(`Detalhes do pedido ${id} fechados.`);
    }
    return;
  }

  const willOpen = details.hidden;
  details.hidden = !willOpen;
  toggle.setAttribute("aria-expanded", String(willOpen));
  announce(
    willOpen
      ? `Detalhes do pedido ${order.id} abertos.`
      : `Detalhes do pedido ${order.id} fechados.`,
  );
}

/* --------------------------------------------------------------------------
   CONFIGURAÇÕES — preferências
-------------------------------------------------------------------------- */

function renderConfig() {
  const prefs = getPrefs();
  const setChecked = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.checked = Boolean(value);
  };

  setChecked("pref-news", prefs.news);
  setChecked("pref-offers", prefs.offers);
  setChecked("pref-contact", prefs.contact);

  const feedback = document.getElementById("prefs-feedback");
  if (feedback) {
    feedback.hidden = true;
    feedback.textContent = "";
    feedback.classList.remove("alert--success");
  }
}

function handlePrefChange(event) {
  const form = event.target.closest("#prefs-form");
  if (!form) return;
  savePrefs({
    news: document.getElementById("pref-news").checked,
    offers: document.getElementById("pref-offers").checked,
    contact: document.getElementById("pref-contact").checked,
  });
  showFeedback("prefs-feedback", "Preferências salvas com sucesso!");
}

/* --------------------------------------------------------------------------
   INICIALIZAÇÃO
-------------------------------------------------------------------------- */

function bindEvents() {
  document.addEventListener("click", handleNavClick);

  const profileForm = document.getElementById("profile-form");
  if (profileForm) profileForm.addEventListener("submit", handleProfileSubmit);

  const btnAdd = document.getElementById("btn-add-address");
  const btnAddEmpty = document.getElementById("btn-add-address-empty");
  const btnCancel = document.getElementById("addr-cancel");
  const addressForm = document.getElementById("address-form");

  if (btnAdd) {
    btnAdd.addEventListener("click", () => {
      if (addressForm && addressForm.hidden) {
        showAddressForm(null);
      } else {
        hideAddressForm();
      }
    });
  }
  if (btnAddEmpty) {
    btnAddEmpty.addEventListener("click", () => showAddressForm(null));
  }
  if (btnCancel) {
    btnCancel.addEventListener("click", hideAddressForm);
  }
  if (addressForm) {
    addressForm.addEventListener("submit", handleAddressSubmit);
  }

  const addressList = document.getElementById("addresses-list");
  if (addressList) addressList.addEventListener("click", handleAddressListClick);

  const favoritesList = document.getElementById("favorites-list");
  if (favoritesList) favoritesList.addEventListener("click", handleFavoriteClick);

  const pedidosList = document.getElementById("pedidos-list");
  if (pedidosList) pedidosList.addEventListener("click", handlePedidosClick);

  const pedidosRetry = document.getElementById("pedidos-retry");
  if (pedidosRetry) {
    pedidosRetry.addEventListener("click", () => {
      state.ordersState = "idle";
      renderPedidos();
    });
  }

  const prefsForm = document.getElementById("prefs-form");
  if (prefsForm) prefsForm.addEventListener("change", handlePrefChange);

  window.addEventListener("hashchange", handleHashChange);
}

/* Saudação + convite: usuário da sessão mock ou apiUser (api). */
function applyAuthUi(user) {
  const greeting = document.getElementById("profile-greeting");
  const authBox = document.getElementById("profile-auth");
  if (user && user.id) {
    const firstName = String(user.name || "").trim().split(/\s+/)[0] || "";
    if (greeting) greeting.textContent = firstName;
    if (authBox) authBox.hidden = true;
  } else {
    if (greeting) greeting.textContent = "visitante";
    if (authBox) authBox.hidden = false;
  }
}

/* API: identidade real vem do auth.js (authReady + /me); o perfil (phone/cpf)
   vem de /profile. getAuthUser() NÃO é usado no modo api. */
async function bootApi() {
  const user = await authReady().catch(() => null);
  state.apiUser = user && user.id ? user : null;
  applyAuthUi(state.apiUser);

  if (state.apiUser) {
    try {
      state.runtimeProfile = await userApi.getProfile();
    } catch (err) {
      state.runtimeProfile = null;
      if (err && err.status === 401) {
        state.apiUser = null;
        applyAuthUi(null);
      }
    }
  }
}

async function init() {
  const section = sectionFromHash();
  state.section = section;

  if (isStorefrontAuthApiEnabled()) {
    await bootApi();
  } else {
    applyAuthUi(getAuthUser());
  }

  for (const item of SECTIONS) {
    const panel = document.querySelector(`[data-panel="${item.id}"]`);
    if (panel) panel.hidden = item.id !== section;
  }

  const links = document.querySelectorAll(".profile-nav__link");
  for (const link of links) {
    const active = link.dataset.section === section;
    link.classList.toggle("is-active", active);
    if (active) link.setAttribute("aria-current", "true");
  }

  syncHeaderCounts();
  renderSection(section);
  bindEvents();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}