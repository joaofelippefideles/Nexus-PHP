/* ==========================================================================
   NEXUS TECH — Central de Ajuda
   Filtro simples de busca por tópicos de ajuda (frontend).
   Esconde/mostra os cards conforme o termo digitado e anuncia o resultado
   via aria-live. Nenhuma chamada à API.
   ========================================================================== */

(function initHelpSearch() {
  "use strict";

  const input = document.getElementById("help-search-input");
  if (!input) return;

  const cards = Array.from(document.querySelectorAll("[data-help-card]"));
  const status = document.getElementById("help-search-status");

  function applyFilter() {
    const term = input.value.trim().toLowerCase();
    let visible = 0;

    cards.forEach((card) => {
      const haystack = card.textContent.toLowerCase();
      const show = term === "" || haystack.includes(term);
      card.hidden = !show;
      if (show) visible += 1;
    });

    if (status) {
      if (term === "") {
        status.textContent = `${cards.length} tópicos de ajuda disponíveis.`;
      } else {
        status.textContent =
          visible === 0
            ? "Nenhum tópico encontrado para esta busca."
            : `${visible} tópico${visible === 1 ? "" : "s"} encontrado${visible === 1 ? "" : "s"}.`;
      }
    }
  }

  input.addEventListener("input", applyFilter);
  applyFilter();
})();