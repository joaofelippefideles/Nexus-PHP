/* ==========================================================================
   NEXUS TECH — Cliente da API do Admin (v3.0-X1)
   - SEGURANÇA: o access token vive APENAS em memória (variável da página) —
     nunca em localStorage/sessionStorage/cookie/URL (decisão nº 13).
   - O refresh token fica em cookie httpOnly (impossível de ler via JS) e é
     enviado com credentials: "include" nas rotas /api/admin/auth.
   - Ao receber 401, tenta uma rotação de sessão (/auth/refresh) e reexecuta
     a requisição original. Falhou também? Redireciona para o login.
   ========================================================================== */

const ADMIN_API_BASE = "http://127.0.0.1:4000/api/admin";

let accessToken = null; // apenas em memória
let refreshInFlight = null; // deduplica rotações concorrentes (vários módulos)
let sessionCache = null; // sessão atual por página (invalidada em logout/401)

function buildHeaders(hasBody) {
  const headers = {};
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  if (hasBody) headers["Content-Type"] = "application/json";
  return headers;
}

/* Roda UMA rotação de sessão por vez. Retorna true se um novo access token
   foi obtido. Concorrência (ex.: shell + products.js) compartilha o mesmo
   refresh — nunca revogam a rotação um do outro. */
async function tryRefresh() {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      const res = await fetch(`${ADMIN_API_BASE}/auth/refresh`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        accessToken = null;
        return false;
      }
      const data = await res.json();
      accessToken = data && data.data && data.data.accessToken ? data.data.accessToken : null;
      return Boolean(accessToken);
    } catch (err) {
      accessToken = null;
      return false;
    }
  })().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

/* Requisição autenticada às rotas administrativas. */
async function request(path, options = {}) {
  const method = options.method || "GET";
  const hasBody = options.body !== undefined;
  const isLoginPage = window.location.pathname.endsWith("login.html");

  const doFetch = () =>
    fetch(ADMIN_API_BASE + path, {
      method,
      headers: buildHeaders(hasBody),
      credentials: "include",
      body: hasBody ? JSON.stringify(options.body) : undefined,
    });

  let response = await doFetch();

  // 401: tenta uma rotação (evitando loop na página de login — lá, sem token
  // em memória, bastaríamos recarregar e queimar o rate limit do admin).
  if (response.status === 401 && (accessToken || !isLoginPage)) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      response = await doFetch();
    } else {
      sessionCache = false; // sessão realmente encerrada
      if (!isLoginPage) window.location.replace("login.html");
    }
  }

  return response;
}

/* Login real (BCrypt no servidor). NUNCA armazena o token fora de memória. */
async function login({ email, password }) {
  const res = await fetch(`${ADMIN_API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data && data.error) || "Não foi possível entrar.");
  }

  accessToken = data && data.data && data.data.accessToken ? data.data.accessToken : null;
  sessionCache = data && data.data && data.data.user ? data.data.user : false;
  return data.data ? data.data.user : null;
}

/* Logout: revoga o refresh no servidor e limpa o cookie httpOnly. */
async function logout() {
  try {
    await fetch(`${ADMIN_API_BASE}/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
  } finally {
    accessToken = null;
    sessionCache = false;
  }
}

/* Sessão atual (GET /auth/me). Cache de página: evita /me concorrentes entre
   shell.js e os módulos de gestão, que causavam rotações paralelas. */
async function getSession() {
  if (sessionCache) return sessionCache;
  const res = await request("/auth/me");
  const session = res.ok ? ((await res.json()).data || null) : null;
  sessionCache = session || false;
  return session || null;
}

/* Serializa parâmetros de query ignorando vazios/undefined (curl amigável). */
function buildQuery(params = {}) {
  const usp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) {
      for (const item of value) usp.append(key, String(item));
    } else {
      usp.append(key, String(value));
    }
  }
  const qs = usp.toString();
  return qs ? `?${qs}` : "";
}

/* Requisição autenticada que já devolve {data[, meta]} ou lança Erro.
   Usada pelas rotinas de gestão (ex.: produtos). Nunca faz cache em storage. */
async function apiRequest(path, options = {}) {
  const res = await request(path, options);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data && data.error) || "Falha na requisição");
  }
  return res.status === 204 ? null : res.json().catch(() => null);
}

export { login, logout, getSession, request, apiRequest, buildQuery };