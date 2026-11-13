/* ==========================================================================
   NEXUS TECH — Configuração explícita do storefront (v3.1)
   Define o modo de autenticação do storefront SEM editar os módulos:
   - "mock": comportamento atual (localStorage/sessionStorage) — DEFAULT;
   - "api" : preparado para consumir /api/auth através do user-api.js.
   A ativação de "api" nos testes é feita definindo
   window.NEXUS_STOREFRONT_AUTH = "api" ANTES do carregamento dos scripts
   (ex.: page.evaluateOnNewDocument), sem tocar em nenhum módulo.
   Nenhum segredo ou token é armazenado aqui.
   ========================================================================== */

const MODE_KEY = "NEXUS_STOREFRONT_AUTH";
const DEFAULT_MODE = "mock";

export function storefrontAuthMode() {
  const value =
    typeof window !== "undefined" && typeof window[MODE_KEY] === "string"
      ? window[MODE_KEY].trim()
      : "";
  return value === "api" ? "api" : DEFAULT_MODE;
}

export function isStorefrontAuthApiEnabled() {
  return storefrontAuthMode() === "api";
}

const config = { storefrontAuthMode, isStorefrontAuthApiEnabled };
export default config;