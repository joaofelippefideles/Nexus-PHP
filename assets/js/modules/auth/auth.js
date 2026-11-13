/* ==========================================================================
   NEXUS TECH — Autenticação compartilhada (v3.2)
   Sessão de usuário comum com dados NÃO sensíveis.

   DOIS MODOS (config.js — sem editar este arquivo):
   - "mock" (DEFAULT): comportamento HISTÓRICO, 100% síncrono — sessão da aba
     em sessionStorage ("nexus:auth") vinculada ao usuário de "nexus:user".
   - "api" : sessão real — o access token vive SOMENTE na memória do
     user-api.js (nunca em localStorage/sessionStorage/cookie/URL); o refresh
     fica em cookie httpOnly (nt_user_refresh) enviado com credentials:"include".
     Boot: refresh() -> /me -> authenticated | unauthenticated.

   ESTADOS (document.documentElement.dataset.authState):
   - "loading"          : boot em andamento (só no modo api);
   - "authenticated"    : sessão válida;
   - "unauthenticated"  : sem sessão / refresh inválido / erro de rede.

   IMPORTANTE:
   - getAuthUser()/createSession()/logout()/syncAuthHeader() continuam
     SÍNCRONOS e com o contrato do modo mock intacto (consumidores legados:
     profile.js, checkout.js e as suítes storefront);
   - no modo api, getAuthUser() NÃO é a fonte de verdade (ela lê o storage
     mock); o estado real fica em memória neste módulo + user-api.js.
   ========================================================================== */

import { isStorefrontAuthApiEnabled } from "../../utils/config.js";
import userApi from "../../utils/user-api.js";

const SESSION_KEY = "nexus:auth";
const USER_KEY = "nexus:user";

const AUTH_STATE = {
  LOADING: "loading",
  AUTHENTICATED: "authenticated",
  UNAUTHENTICATED: "unauthenticated",
};

/* Usuário autenticado da API — SOMENTE em memória desta página. */
let apiUser = null;
/* Boot único por página (deduplica refresh/me entre header.js e login.js). */
let bootPromise = null;

/* --------------------------------------------------------------------------
   STORAGE MOCK (dados não sensíveis) — inalterado
-------------------------------------------------------------------------- */

function load(key, store) {
  try {
    const raw = store.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    return null;
  }
}

function save(key, value, store) {
  try {
    store.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    return false;
  }
}

/* Sessão da aba: { userId, authenticatedAt } — vinculada ao usuário. */
export function getSession() {
  const data = load(SESSION_KEY, window.sessionStorage);
  return data && typeof data === "object" && data.userId ? data : null;
}

export function getStoredUser() {
  const data = load(USER_KEY, window.localStorage);
  return data && typeof data === "object" ? data : null;
}

/* Usuário autenticado (mock): a sessão precisa apontar para um usuário. */
export function getAuthUser() {
  const session = getSession();
  const user = getStoredUser();
  if (!session || !user) return null;
  return String(user.id) === String(session.userId) ? user : null;
}

export function createSession(userId) {
  return save(
    SESSION_KEY,
    { userId: String(userId), authenticatedAt: new Date().toISOString() },
    window.sessionStorage,
  );
}

export function logout() {
  try {
    window.sessionStorage.removeItem(SESSION_KEY);
    return true;
  } catch (err) {
    return false;
  }
}

/* Prefixo relativo para alcançar outra página a partir da página atual. */
export function authBasePath() {
  return /\/pages\//.test(window.location.pathname) ||
    /pages\/[^/]+\.html/.test(window.location.pathname)
    ? ""
    : "pages/";
}

/* Atualiza apenas campos NÃO sensíveis do usuário cadastrado (mock). */
export function updateStoredUser(fields) {
  const user = getStoredUser();
  if (!user) return false;
  return save(
    USER_KEY,
    {
      id: user.id,
      name: fields.name !== undefined ? fields.name : user.name,
      email: fields.email !== undefined ? fields.email : user.email,
      phone: fields.phone !== undefined ? fields.phone : user.phone,
      cpf: user.cpf || "",
      createdAt: user.createdAt || new Date().toISOString(),
    },
    window.localStorage,
  );
}

/* --------------------------------------------------------------------------
   ESTADO / HEADER
-------------------------------------------------------------------------- */

function setAuthState(state) {
  if (typeof document !== "undefined" && document.documentElement) {
    document.documentElement.dataset.authState = state;
  }
}

function setHeaderBusy(busy) {
  const actions = document.querySelector(".site-header__actions");
  if (!actions) return;
  if (busy) actions.setAttribute("aria-busy", "true");
  else actions.removeAttribute("aria-busy");
}

function firstNameOf(name) {
  const parts = String(name || "").trim().split(/\s+/);
  return parts.length ? parts[0] : "";
}

function accountLink() {
  return document.querySelector(".icon-btn__label--account");
}

/* Fonte de verdade do header: memória (api) ou sessão da aba (mock). */
function currentUser() {
  return isStorefrontAuthApiEnabled() ? apiUser : getAuthUser();
}

/* Renderiza o header para o usuário informado (ou deslogado).
   Modifica somente o DOM, sem recarregar a página. */
function renderHeader(user) {
  const actions = document.querySelector(".site-header__actions");
  const account = accountLink();
  if (!actions) return;

  const isAccountPage = document.body && document.body.dataset.page === "perfil";
  const base = authBasePath();

  if (account) {
    account.hidden = false;
    account.href = base + (user ? "perfil.html" : "login.html");
    if (user && isAccountPage) {
      account.setAttribute("aria-current", "page");
    } else {
      account.removeAttribute("aria-current");
    }
  }

  const existing = actions.querySelector(".account-session");
  if (existing) existing.remove();

  if (!user) return;

  const chip = document.createElement("div");
  chip.className = "account-session";

  const name = document.createElement("span");
  name.className = "account-session__name";
  name.textContent = "Olá, " + firstNameOf(user.name);

  const sair = document.createElement("button");
  sair.type = "button";
  sair.className = "account-session__logout";
  sair.textContent = "Sair";
  sair.setAttribute("aria-label", "Sair da conta");
  sair.addEventListener("click", () => onLogoutClick(base));

  chip.appendChild(name);
  chip.appendChild(sair);
  actions.appendChild(chip);
}

/* "Sair": mock é síncrono (contrato preservado); api é assíncrono. */
function onLogoutClick(base) {
  if (isStorefrontAuthApiEnabled()) {
    logoutApi(base);
    return;
  }
  logout();
  syncAuthHeader();
  window.location.href = base + "login.html";
}

async function logoutApi(base) {
  await userApi.logout(); // revoga no servidor e limpa a memória
  apiUser = null;
  setAuthState(AUTH_STATE.UNAUTHENTICATED);
  renderHeader(null);
  window.location.href = base + "login.html";
}

/* Exportada e SÍNCRONA — usada pelos consumidores legados e pelo modo mock. */
export function syncAuthHeader() {
  renderHeader(currentUser());
}

/* --------------------------------------------------------------------------
   BOOT API — refresh (cookie httpOnly) -> /me -> estado
-------------------------------------------------------------------------- */

async function bootApiAuth() {
  setAuthState(AUTH_STATE.LOADING);
  setHeaderBusy(true);
  const account = accountLink();
  if (account) account.hidden = true; // não exibir "Entrar" durante o loading

  try {
    await userApi.refresh(); // troca o cookie por access token em memória
    const user = await userApi.me();
    apiUser = user && user.id ? user : null;
  } catch (err) {
    // 401, refresh inválido/revogado, rede ou 5xx -> NÃO autenticar
    apiUser = null;
  } finally {
    setAuthState(apiUser ? AUTH_STATE.AUTHENTICATED : AUTH_STATE.UNAUTHENTICATED);
    renderHeader(apiUser);
    setHeaderBusy(false);
  }
  return apiUser;
}

function ensureBoot() {
  if (!bootPromise) {
    bootPromise = isStorefrontAuthApiEnabled()
      ? bootApiAuth()
      : Promise.resolve(getAuthUser());
  }
  return bootPromise;
}

/* login.js aguarda o boot (api) para decidir redirect de "já autenticado". */
export function authReady() {
  return ensureBoot();
}

/* login.js aplica o usuário logo após o login (api), sem novo refresh. */
export function setAuthenticatedUser(user) {
  if (!isStorefrontAuthApiEnabled()) return false;
  apiUser = user && user.id ? user : null;
  setAuthState(apiUser ? AUTH_STATE.AUTHENTICATED : AUTH_STATE.UNAUTHENTICATED);
  renderHeader(apiUser);
  return Boolean(apiUser);
}

/* --------------------------------------------------------------------------
   INICIALIZAÇÃO
-------------------------------------------------------------------------- */

function init() {
  if (isStorefrontAuthApiEnabled()) {
    ensureBoot();
    return;
  }
  // mock: síncrono, imediatamente após o carregamento (contrato atual)
  setAuthState(getAuthUser() ? AUTH_STATE.AUTHENTICATED : AUTH_STATE.UNAUTHENTICATED);
  syncAuthHeader();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
