/* ==========================================================================
   NEXUS TECH — Catálogo: controles (Sprint 4)
   Construção segura (sem innerHTML) dos controles de filtro, ordenação e
   paginação. Os controles são criados UMA vez (build*) e depois sincronizados
   (sync*) em cada render, preservando foco e seleção no teclado.
   Apenas DOM; toda a lógica fica em filter.js e catalog.js.
   ========================================================================== */

import {
  PRICE_RANGES,
  SORT_OPTIONS,
} from "./filter.js";

/* Determina se há filtro/busca ativos, para habilitar a opção de limpar. */
export function hasActiveFilters(state) {
  return (
    Boolean(state.query.trim()) ||
    (state.categories && state.categories.length > 0) ||
    state.priceRange !== "all" ||
    state.availability !== "all"
  );
}

function fieldset(legendText) {
  const fieldset = document.createElement("fieldset");
  fieldset.className = "filters__group";

  const legend = document.createElement("legend");
  legend.className = "filters__legend";
  legend.textContent = legendText;
  fieldset.appendChild(legend);

  return fieldset;
}

function labelFor(control, text) {
  const label = document.createElement("label");
  label.className = "filter-option";
  label.appendChild(control);
  const span = document.createElement("span");
  span.textContent = text;
  label.appendChild(span);
  return label;
}

/* --------------------------------------------------------------------------
   FILTROS (barra lateral) — constrói uma vez
-------------------------------------------------------------------------- */

export function buildFilters(facets, state, { onApply, onClear }) {
  const aside = document.createElement("aside");
  aside.className = "catalog__filters";
  aside.setAttribute("aria-label", "Filtros do catálogo");

  const head = document.createElement("div");
  head.className = "filters__head";

  const title = document.createElement("h2");
  title.className = "filters__title";
  title.textContent = "Filtros";
  head.appendChild(title);

  const clear = document.createElement("button");
  clear.type = "button";
  clear.className = "filters__clear";
  clear.textContent = "Limpar filtros";
  clear.disabled = !hasActiveFilters(state);
  clear.addEventListener("click", () => onClear());
  head.appendChild(clear);

  aside.appendChild(head);

  /* Busca do catálogo (dinâmica por nome, marca, categoria). */
  const searchRow = document.createElement("div");
  searchRow.className = "filters__search";

  const searchInput = document.createElement("input");
  searchInput.type = "search";
  searchInput.id = "catalog-search";
  searchInput.className = "filters__search-input";
  searchInput.placeholder = "Buscar por nome, marca ou categoria...";
  searchInput.value = state.query;
  searchInput.setAttribute(
    "aria-label",
    "Buscar produtos por nome, marca ou categoria"
  );
  searchInput.addEventListener("input", (event) => {
    onApply({ query: event.target.value }, { resetPage: true });
  });
  searchRow.appendChild(searchInput);

  aside.appendChild(searchRow);

  /* Categoria */
  const categoryGroup = fieldset("Categoria");
  for (const category of facets.categories) {
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.name = "categoria";
    checkbox.value = category.label;
    checkbox.id = `filtro-cat-${category.label}`;
    checkbox.checked = state.categories.includes(category.label);

    const label = labelFor(checkbox, `${category.label} (${category.count})`);
    label.htmlFor = checkbox.id;
    categoryGroup.appendChild(label);
  }
  aside.appendChild(categoryGroup);

  /* Faixa de preço */
  const priceGroup = fieldset("Faixa de preço");
  for (const range of PRICE_RANGES) {
    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "preco";
    radio.value = range.key;
    radio.id = `filtro-preco-${range.key}`;
    radio.checked = state.priceRange === range.key;

    const label = labelFor(radio, range.label);
    label.htmlFor = radio.id;
    priceGroup.appendChild(label);
  }
  aside.appendChild(priceGroup);

  /* Disponibilidade */
  const availabilityGroup = fieldset("Disponibilidade");
  const availabilityOptions = [
    { key: "all", label: "Todos" },
    { key: "in", label: "Em estoque" },
    { key: "out", label: "Esgotados" },
  ];
  for (const option of availabilityOptions) {
    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "disponibilidade";
    radio.value = option.key;
    radio.id = `filtro-disc-${option.key}`;
    radio.checked = state.availability === option.key;

    const label = labelFor(radio, option.label);
    label.htmlFor = radio.id;
    availabilityGroup.appendChild(label);
  }
  aside.appendChild(availabilityGroup);

  /* Delegação unificada para todos os inputs do painel. */
  aside.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;

    const next = { ...state };

    if (target.name === "categoria") {
      const selected = new Set(next.categories);
      if (target.checked) {
        selected.add(target.value);
      } else {
        selected.delete(target.value);
      }
      next.categories = Array.from(selected);
    } else if (target.name === "preco") {
      next.priceRange = target.value;
    } else if (target.name === "disponibilidade") {
      next.availability = target.value;
    }

    onApply(next, { resetPage: true });
  });

  return {
    root: aside,
    clearButton: clear,
    searchInput,
    categoryGroup,
    priceGroup,
    availabilityGroup,
  };
}

/* Sincroniza o estado visual dos filtros (após cada render) sem recriá-los,
   preservando o foco do usuário durante a digitação. */
export function syncFilters(handles, state) {
  const { clearButton, searchInput, categoryGroup, priceGroup, availabilityGroup } = handles;

  clearButton.disabled = !hasActiveFilters(state);

  if (document.activeElement !== searchInput) {
    searchInput.value = state.query;
  }

  for (const input of categoryGroup.querySelectorAll('input[name="categoria"]')) {
    input.checked = state.categories.includes(input.value);
  }
  for (const input of priceGroup.querySelectorAll('input[name="preco"]')) {
    input.checked = input.value === state.priceRange;
  }
  for (const input of availabilityGroup.querySelectorAll('input[name="disponibilidade"]')) {
    input.checked = input.value === state.availability;
  }
}

/* --------------------------------------------------------------------------
   ORDENAÇÃO — constrói uma vez
-------------------------------------------------------------------------- */

export function buildSort(state, { onSort }) {
  const wrap = document.createElement("div");
  wrap.className = "catalog__sort";

  const label = document.createElement("label");
  label.className = "catalog__sort-label";
  label.htmlFor = "catalog-sort";
  label.textContent = "Ordenar por";
  wrap.appendChild(label);

  const select = document.createElement("select");
  select.id = "catalog-sort";
  select.className = "catalog__sort-select";

  for (const option of SORT_OPTIONS) {
    const opt = document.createElement("option");
    opt.value = option.key;
    opt.textContent = option.label;
    if (option.key === state.sort) {
      opt.selected = true;
    }
    select.appendChild(opt);
  }

  select.addEventListener("change", (event) => {
    onSort(event.target.value);
  });

  wrap.appendChild(select);
  return { root: wrap, select };
}

export function syncSort(handle, state) {
  if (handle && document.activeElement !== handle.select) {
    handle.select.value = state.sort;
  }
}

/* --------------------------------------------------------------------------
   PAGINAÇÃO — reconstrói a cada render (pequena e pontual)
-------------------------------------------------------------------------- */

export function buildPagination(rootEl, pagination, state, { onGoPage }) {
  rootEl.replaceChildren();

  if (pagination.totalPages <= 1) {
    return; /* sem necessidade de paginação visual */
  }

  const nav = document.createElement("nav");
  nav.className = "pagination";
  nav.setAttribute("aria-label", "Paginação do catálogo");

  const list = document.createElement("ul");
  list.className = "pagination__list";

  const prevItem = document.createElement("li");
  const prevBtn = document.createElement("button");
  prevBtn.type = "button";
  prevBtn.className = "pagination__btn pagination__btn--nav";
  prevBtn.textContent = "Anterior";
  prevBtn.disabled = !pagination.hasPrev;
  prevBtn.setAttribute("aria-label", "Página anterior");
  if (pagination.hasPrev) {
    prevBtn.addEventListener("click", () => onGoPage(state.page - 1));
  }
  prevItem.appendChild(prevBtn);
  list.appendChild(prevItem);

  for (let page = 1; page <= pagination.totalPages; page += 1) {
    const item = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "pagination__btn pagination__btn--page";
    btn.textContent = String(page);
    btn.setAttribute("aria-label", `Página ${page}`);

    if (page === pagination.page) {
      btn.classList.add("is-current");
      btn.setAttribute("aria-current", "page");
      btn.disabled = true;
    } else {
      btn.addEventListener("click", () => onGoPage(page));
    }

    item.appendChild(btn);
    list.appendChild(item);
  }

  const nextItem = document.createElement("li");
  const nextBtn = document.createElement("button");
  nextBtn.type = "button";
  nextBtn.className = "pagination__btn pagination__btn--nav";
  nextBtn.textContent = "Próxima";
  nextBtn.disabled = !pagination.hasNext;
  nextBtn.setAttribute("aria-label", "Próxima página");
  if (pagination.hasNext) {
    nextBtn.addEventListener("click", () => onGoPage(state.page + 1));
  }
  nextItem.appendChild(nextBtn);
  list.appendChild(nextItem);

  nav.appendChild(list);
  rootEl.appendChild(nav);
}
