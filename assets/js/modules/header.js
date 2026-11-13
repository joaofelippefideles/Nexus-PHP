/* ==========================================================================
   NEXUS TECH — Header
   Interação visual mínima (Sprint 2):
   - Menu hamburguer (abrir/fechar no mobile);
   - Ano do rodapé.
   V2.1 — estado de sessão: carrega o módulo compartilhado de autenticação
   que re-aponta "Minha conta" (login/perfil), injeta o chip do usuário e
   disponibiliza "Sair" sem recarregar a página. Nenhuma lógica de negócio
   (carrinho, favoritos, busca) entra aqui.
   V2.5 — atalhos do header: Carrinho e Favoritos (eram botões inertes)
   viram links e os módulos compartilhados de contador e busca são
   carregados on demand, pelos mesmos padrões do auth.js.
   ========================================================================== */

(function initHeader() {
  "use strict";

  const header = document.getElementById("site-header");
  const toggle = document.getElementById("nav-toggle");

  if (header && toggle) {
    toggle.addEventListener("click", function () {
      const isOpen = header.classList.toggle("nav-open");
      toggle.setAttribute("aria-expanded", String(isOpen));
    });

    // Fechar o menu ao pressionar Esc (acessibilidade)
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && header.classList.contains("nav-open")) {
        header.classList.remove("nav-open");
        toggle.setAttribute("aria-expanded", "false");
        toggle.focus();
      }
    });
  }

  // Ano do rodapé
  const yearEl = document.getElementById("footer-year");
  if (yearEl) {
    yearEl.textContent = String(new Date().getFullYear());
  }

  // V2.5 — atalhos "Carrinho" e "Favoritos" viram links reais. Favoritos
  // aponta para a seção já funcional de Minha Conta (perfil.html#favoritos)
  // em vez de criar uma página paralela — a estrutura atual de nexus:favorites
  // é reutilizada por product.js, perfil e catálogo.
  linkHeaderShortcuts();

  // V2.5 — busca compartilhada (header) e sincronização dos contadores,
  // carregadas on demand com os mesmos padrões de fallback do auth.js.
  try {
    import("/assets/js/modules/store/store.js")
      .then(function (store) {
        store.syncHeaderCounts();
      })
      .catch(function () {
        // header segue funcional sem contadores
      });
  } catch (err) {
    // sem contadores neste navegador
  }

  try {
    import("/assets/js/modules/search/search.js").catch(function () {
      // busca segue funcional como navegação pura (o formulário existe)
    });
  } catch (err) {
    // sem busca neste navegador
  }

  // Sessão mock no header — o auth.js se auto-inicializa ao ser importado.
  // Usa um comportamento dinâmico de import() com fallback silencioso:
  // o caminho absoluto ("/assets/...") resolve contra a origem do site de
  // forma determinística na raiz, em pages/ e em qualquer contexto.
  try {
    import("/assets/js/modules/auth/auth.js").catch(function () {
      // header segue funcional mesmo sem o estado de sessão
    });
  } catch (err) {
    // sem estado de sessão neste navegador
  }
})();

/* Converte os botões-ícone do header em âncoras com destino relativo,
   preservando conteúdo (contadores), classe e rótulo acessível. */
function linkHeaderShortcuts() {
  const inPages = /\/pages\//.test(window.location.pathname);
  const base = inPages ? "" : "pages/";
  const targets = {
    "Favoritos": `${base}perfil.html#favoritos`,
    "Carrinho de compras": `${base}carrinho.html`,
  };

  document.querySelectorAll("button.icon-btn").forEach(function (btn) {
    const href = targets[btn.getAttribute("aria-label")];
    if (!href) return;

    const anchor = document.createElement("a");
    anchor.className = btn.className;
    anchor.setAttribute("aria-label", btn.getAttribute("aria-label"));
    anchor.href = href;
    while (btn.firstChild) {
      anchor.appendChild(btn.firstChild);
    }
    btn.replaceWith(anchor);
  });
}
