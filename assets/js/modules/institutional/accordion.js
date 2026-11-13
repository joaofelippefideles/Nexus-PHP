/* ==========================================================================
   NEXUS TECH — Accordion reutilizável (WAI-ARIA)
   Padrão de disclosure: botões reais controlam painéis. Somente um painel
   aberto por grupo (modo "single") ou vários (modo "multiple").
   - aria-expanded / aria-controls no botão;
   - painel oculto via attribute `hidden` até ser aberto;
   - navegação por teclado: Tab, setas ↑/↓, Home e End entre os botões.
   ========================================================================== */

const ROOT_SELECTOR = "[data-accordion]";
const BTN_SELECTOR = ".faq-accordion__btn";
const PANEL_SELECTOR = ".faq-accordion__panel";

function toggleItem(item, force) {
  const btn = item.querySelector(BTN_SELECTOR);
  const panel = item.querySelector(PANEL_SELECTOR);
  if (!btn || !panel) return;

  const target = typeof force === "boolean" ? force : !item.classList.contains("is-open");
  const open = target;

  item.classList.toggle("is-open", open);
  btn.setAttribute("aria-expanded", String(open));
  panel.hidden = !open;
}

function initAccordion(root, options = {}) {
  const items = Array.from(
    root.querySelectorAll(":scope > .faq-accordion__item")
  );

  items.forEach((item, index) => {
    const btn = item.querySelector(BTN_SELECTOR);
    const panel = item.querySelector(PANEL_SELECTOR);
    if (!btn || !panel) return;

    btn.id = btn.id || `faq-btn-${index + 1}`;
    panel.id = panel.id || `faq-panel-${index + 1}`;
    btn.setAttribute("aria-controls", panel.id);
    btn.setAttribute("aria-expanded", "false");
    if (index === 0) btn.tabIndex = 0;

    btn.addEventListener("click", () => {
      if (options.single) {
        items.forEach((other) => {
          if (other !== item) toggleItem(other, false);
        });
      }
      toggleItem(item);
    });
  });

  /* Navegação por teclado (setas movem o foco entre os botões) */
  const btns = items
    .map((item) => item.querySelector(BTN_SELECTOR))
    .filter(Boolean);

  btns.forEach((btn) => {
    btn.addEventListener("keydown", (event) => {
      const current = btns.indexOf(btn);
      let next = -1;

      if (event.key === "ArrowDown") next = current + 1;
      else if (event.key === "ArrowUp") next = current - 1;
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = btns.length - 1;

      if (next < 0 || next >= btns.length) return;

      event.preventDefault();
      btns[next].focus();
    });
  });
}

function initAll(rootSelector = ROOT_SELECTOR) {
  document.querySelectorAll(rootSelector).forEach((root) => {
    const mode = root.getAttribute("data-accordion") || "single";
    initAccordion(root, { single: mode !== "multiple" });
  });
}

export { ROOT_SELECTOR, initAccordion, initAll, toggleItem };