/* ==========================================================================
   NEXUS TECH — Busca do header
   Encaminha o termo digitado para o catálogo existente via parâmetro "q"
   (pages/produtos.html?q=...), que o catalog.js já sabe interpretar — sem
   API nem solução paralela. O formulário vive no header compartilhado.
   ========================================================================== */

(function initSearch() {
  "use strict";

  const form = document.querySelector("form.site-header__search");
  if (!form) return;

  form.addEventListener("submit", function (event) {
    event.preventDefault();

    const input = document.getElementById("search-header");
    const term = input ? input.value.trim() : "";
    const inPages = /\/pages\//.test(window.location.pathname);
    const base = inPages ? "" : "pages/";
    const target = term
      ? `${base}produtos.html?q=${encodeURIComponent(term)}`
      : `${base}produtos.html`;

    window.location.href = target;
  });
})();