/* ==========================================================================
   NEXUS TECH — Cliente da API de usuário do storefront (v3.1 — FUNDAÇÃO)
   Camada de transição entre o storefront (mock) e a API real /api/auth.
   Os métodos ficam PRONTOS para consumo; nenhuma página foi integrada ainda.

   SEGURANÇA (espelha utils/api.js do admin — decisão nº 13):
   - o access token vive APENAS em memória (módulo) — nunca em
     localStorage/sessionStorage/cookie/URL;
   - o refresh token fica em cookie httpOnly (Path=/api/auth) e é enviado
     com credentials: "include"; a rotação /refresh NÃO envia Authorization
     nem o token no corpo — o servidor lê o cookie;
   - em 401, tenta UMA rotação (deduplicada entre chamadas concorrentes) e
     reexecuta a requisição original; falhou -> limpa a sessão e lança erro.
   A base da API é configurável (default "/api/auth", relativo ao mesmo
   origin em que o storefront for servido).
   ========================================================================== */

const DEFAULT_BASE = "/api/auth";

const state = {
  baseURL: DEFAULT_BASE,
  accessToken: null, // apenas em memória
  refreshInFlight: null, // deduplica rotações concorrentes
  sessionCache: null, // usuário atual por página (invalidado em logout/401)
  lastRefreshError: null,
};

class ApiError extends Error {
  constructor(message, status = 0, details = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

function join(base, path) {
  return String(base).replace(/\/+$/, "") + path;
}

function buildHeaders(hasBody) {
  const headers = {};
  if (state.accessToken) headers.Authorization = `Bearer ${state.accessToken}`;
  if (hasBody) headers["Content-Type"] = "application/json";
  return headers;
}

async function safeFetch(url, init) {
  let res;
  try {
    res = await fetch(url, init);
  } catch (err) {
    throw new ApiError("Falha de conexão com o servidor.", 0, err);
  }
  return res;
}

async function readJson(res) {
  try {
    return await res.json();
  } catch (err) {
    return {};
  }
}

function parseError(res, body) {
  const message =
    (body && body.error) || `Falha na requisição (HTTP ${res.status})`;
  return new ApiError(message, res.status, body || null);
}

function clearSession() {
  state.accessToken = null;
  state.sessionCache = null;
  state.lastRefreshError = null;
}

/* --------------------------------------------------------------------------
   REFRESH — rotação via cookie httpOnly (uma por vez)
-------------------------------------------------------------------------- */

async function doRefresh() {
  const res = await safeFetch(join(state.baseURL, "/refresh"), {
    method: "POST",
    credentials: "include",
  });
  const body = await readJson(res);

  if (!res.ok) {
    clearSession();
    state.lastRefreshError = parseError(res, body);
    throw state.lastRefreshError;
  }

  const token = body && body.data && body.data.accessToken;
  if (typeof token !== "string" || token === "") {
    clearSession();
    const err = new ApiError("Resposta de refresh inválida.", 500);
    state.lastRefreshError = err;
    throw err;
  }

  state.accessToken = token;
  state.lastRefreshError = null;
  return token;
}

/* Uma rotação por vez: chamadas concorrentes compartilham a mesma promessa. */
function tryRefresh() {
  if (state.refreshInFlight) return state.refreshInFlight;
  state.refreshInFlight = doRefresh()
    .then((token) => Boolean(token))
    .catch(() => false)
    .finally(() => {
      state.refreshInFlight = null;
    });
  return state.refreshInFlight;
}

async function refresh() {
  const refreshed = await tryRefresh();
  if (!refreshed) {
    if (state.lastRefreshError) throw state.lastRefreshError;
    throw new ApiError("Sessão inválida ou expirada.", 401);
  }
  return state.accessToken;
}

/* --------------------------------------------------------------------------
   REQUEST — núcleo com retry controlado em 401
-------------------------------------------------------------------------- */

async function request(path, options = {}) {
  const method = options.method || "GET";
  const hasBody = options.body !== undefined;
  const hadToken = Boolean(state.accessToken);
  const base = options.baseURL || state.baseURL;

  const doFetch = () =>
    safeFetch(join(base, path), {
      method,
      headers: buildHeaders(hasBody),
      credentials: "include",
      body: hasBody
        ? typeof options.body === "string"
          ? options.body
          : JSON.stringify(options.body)
        : undefined,
    });

  let response = await doFetch();

  // 401 com sessão em memória: tenta UMA rotação e reexecuta a original.
  if (response.status === 401 && hadToken) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      response = await doFetch();
    } else {
      state.sessionCache = false;
      if (state.lastRefreshError) throw state.lastRefreshError;
      throw new ApiError("Sessão inválida ou expirada.", 401);
    }
  }

  if (!response.ok) {
    const body = await readJson(response);
    throw parseError(response, body);
  }

  return response;
}

/* Requisição que já devolve o payload {data} ou lança ApiError. */
async function apiRequest(path, options = {}) {
  const res = await request(path, options);
  const body = await readJson(res);
  return body && typeof body === "object" && "data" in body ? body.data : body;
}

/* --------------------------------------------------------------------------
   MÉTODOS DE AUTENTICAÇÃO (prontos — não integrados às páginas ainda)
-------------------------------------------------------------------------- */

async function register(payload = {}) {
  const res = await safeFetch(join(state.baseURL, "/register"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  const body = await readJson(res);
  if (!res.ok) throw parseError(res, body);
  return body && body.data ? body.data : {};
}

async function login({ email, password } = {}) {
  const res = await safeFetch(join(state.baseURL, "/login"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password }),
  });
  const body = await readJson(res);
  if (!res.ok) throw parseError(res, body);

  const data = body && body.data ? body.data : {};
  if (typeof data.accessToken !== "string" || data.accessToken === "") {
    clearSession();
    throw new ApiError("Resposta de login inválida.", 500);
  }

  state.accessToken = data.accessToken;
  state.sessionCache = data.user || false;
  return data;
}

async function me() {
  const data = await apiRequest("/me");
  state.sessionCache = data && data.user ? data.user : false;
  return (data && data.user) || null;
}

async function logout() {
  try {
    await safeFetch(join(state.baseURL, "/logout"), {
      method: "POST",
      credentials: "include",
    });
  } catch (err) {
    // mesmo com falha de rede, a sessão local é sempre limpa
  } finally {
    clearSession();
  }
  return true;
}

async function changePassword({ currentPassword, newPassword, newPasswordConfirm } = {}) {
  const data = await apiRequest("/change-password", {
    method: "POST",
    body: { currentPassword, newPassword, newPasswordConfirm },
  });
  return data || {};
}

/* --------------------------------------------------------------------------
   PERFIL — dados reais do usuário (phone/cpf)
   userId vem SEMPRE do token/backend — o cliente nunca envia id/email/name.
-------------------------------------------------------------------------- */

async function getProfile() {
  const data = await apiRequest("/profile");
  return data || {};
}

async function updateProfile({ phone, cpf } = {}) {
  const payload = {};
  if (phone !== undefined) payload.phone = phone;
  if (cpf !== undefined) payload.cpf = cpf;
  if (Object.keys(payload).length === 0) {
    throw new ApiError("Envie ao menos 'phone' ou 'cpf' para atualizar o perfil.", 400);
  }
  const data = await apiRequest("/profile", {
    method: "PATCH",
    body: payload,
  });
  return data || {};
}

/* --------------------------------------------------------------------------
   PEDIDOS — consumidor da FASE 9-C (POST/GET /api/orders)
   Reutiliza o MESMO núcleo `request` de autenticação: access token em memória
   + retry em 401 com rotação de refresh + credentials include. Nenhum dado de
   cartão/CVV, estoque ou valor calculado no frontend é enviado ou armazenado.
   A authority (preço, frete, subtotal, total) é sempre o backend.
-------------------------------------------------------------------------- */

const ORDERS_BASE = "/api/orders";

async function createOrder(payload = {}) {
  const data = await apiRequest("", {
    baseURL: ORDERS_BASE,
    method: "POST",
    body: payload,
  });
  return data || {};
}

async function listOrders() {
  const data = await apiRequest("", { baseURL: ORDERS_BASE });
  return data || {};
}

async function getOrder(id) {
  const data = await apiRequest("/" + String(id), { baseURL: ORDERS_BASE });
  return data || {};
}

/* --------------------------------------------------------------------------
   CONFIGURAÇÃO / ESTADO
-------------------------------------------------------------------------- */

function configure(options = {}) {
  if (
    options &&
    typeof options.baseURL === "string" &&
    options.baseURL !== ""
  ) {
    state.baseURL = options.baseURL.replace(/\/+$/, "");
  }
  return { baseURL: state.baseURL };
}

function getAccessToken() {
  return state.accessToken;
}

function isAuthenticated() {
  return Boolean(state.accessToken);
}

function currentUser() {
  return state.sessionCache || null;
}

const userApi = {
  configure,
  getAccessToken,
  isAuthenticated,
  currentUser,
  clearSession,
  register,
  login,
  refresh,
  me,
  logout,
  changePassword,
  getProfile,
  updateProfile,
  createOrder,
  listOrders,
  getOrder,
};

export {
  configure,
  getAccessToken,
  isAuthenticated,
  currentUser,
  clearSession,
  register,
  login,
  refresh,
  me,
  logout,
  changePassword,
  getProfile,
  updateProfile,
  createOrder,
  listOrders,
  getOrder,
  ApiError,
};

export default userApi;