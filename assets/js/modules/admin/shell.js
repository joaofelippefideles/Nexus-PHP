/* ==========================================================================
   NEXUS TECH — Shell do painel Admin (v3.0-X1)
   Guard de sessão (GET /auth/me), renderização do admin autenticado e
   logout real (revoga refresh + limpa cookie). SEM dados fictícios:
   o painel exibe apenas a fundação e a identidade do usuário logado.
   ========================================================================== */

import { getSession, logout } from "../../utils/api.js";

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function bindLogout() {
  const button = document.getElementById("admin-logout");
  if (!button) return;
  button.addEventListener("click", async () => {
    button.disabled = true;
    await logout();
    window.location.replace("login.html");
  });
}

async function init() {
  const session = await getSession();
  if (!session) {
    window.location.replace("login.html");
    return;
  }

  const firstName = String(session.name || "").trim().split(/\s+/)[0] || "";
  setText("admin-greeting-name", firstName);
  setText("admin-topbar-name", session.name || "");
  setText("admin-topbar-email", session.email || "");

  const loading = document.getElementById("admin-loading");
  if (loading) loading.hidden = true;

  const panel = document.getElementById("admin-panel");
  if (panel) panel.hidden = false;

  bindLogout();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}