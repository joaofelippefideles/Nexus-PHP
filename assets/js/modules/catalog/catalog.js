/* ==========================================================================
   NEXUS TECH — Catálogo (Sprint 4)
   Orquestrador: mantém o estado da visão, monta os controles (busca, filtros,
   ordenação, paginação) e renderiza os resultados no grid.

   Arquitetura modular:
   - filter.js   → lógica pura (busca, filtros, ordenação, paginação)
   - render.js   → construção dos cards e estado vazio
   - controls.js → construção e sincronização dos controles de interface
   - catalog.js  → composição e ciclo de vida (este arquivo)

   Os controles são construídos UMA vez e apenas sincronizados nos renders,
   preservando o foco do usuário durante a digitação e a navegação por teclado.
   ========================================================================== */

import { products } from "../../data/products.js";
import { addToCart, isFavorite, toggleFavorite, syncHeaderCounts } from "../store/store.js";
import { defaultState, queryCatalog, buildFacets } from "./filter.js";
import { renderCards, renderEmptyState, renderMeta } from "./render.js";
import {
  buildFilters,
  syncFilters,
  buildSort,
  syncSort,
  buildPagination,
} from "./controls.js";

function CatalogController(container) {
  const state = defaultState();
  const facets = buildFacets(products);

  // v2.5 — busca do header chega aqui via ?q=<termo> (mesmo fluxo dos filtros).
  const queryParam = (new URLSearchParams(window.location.search).get("q") || "").trim();
  if (queryParam) {
    state.query = queryParam;
    const headerSearch = document.getElementById("search-header");
    if (headerSearch) {
      headerSearch.value = state.query;
    }
  }

  const gridEl = container.querySelector("#product-grid");
  const countEl = container.querySelector("#product-count");
  const filtersRoot = container.querySelector("#catalog-filters");
  const sortRoot = container.querySelector("#catalog-sort-root");
  const paginationRoot = container.querySelector("#catalog-pagination");

  if (!gridEl) return null;

  function byId(id) {
    return products.find((product) => String(product.id) === String(id));
  }

  /* Região de status acessível (leitura por leitores de tela). */
  function announce(message) {
    const status = document.getElementById("catalog-status") || createStatus();
    status.textContent = message;
  }

  function createStatus() {
    const status = document.createElement("p");
    status.id = "catalog-status";
    status.className = "sr-only";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    document.body.appendChild(status);
    return status;
  }

  /* Ações dos cards (Favoritar / Adicionar ao carrinho) por delegação única
     no grid: sobrevive aos re-renders de filtros/paginação sem religar
     eventos, mesmo padrão da home (v2.5). */
  function handleCardAction(event) {
    const favButton = event.target.closest(".product-card__fav");
    if (favButton) {
      const card = favButton.closest(".product-card");
      const product = byId(card && card.dataset.productId);
      if (!product) return;

      toggleFavorite(product.id);
      const fav = isFavorite(product.id);
      favButton.setAttribute("aria-pressed", String(fav));
      favButton.classList.toggle("is-faved", fav);
      syncHeaderCounts();
      announce(
        fav
          ? `${product.name} adicionado aos favoritos.`
          : `${product.name} removido dos favoritos.`,
      );
      return;
    }

    const addButton = event.target.closest("[data-add-to-cart]");
    if (addButton && !addButton.disabled) {
      const card = addButton.closest(".product-card");
      const product = byId(card && card.dataset.productId);
      if (!product) return;

      const added = addToCart(product.id, 1, product.stock);
      if (added === null) {
        announce(`Limite de estoque de ${product.name} atingido.`);
        return;
      }
      syncHeaderCounts();
      announce(`${product.name} adicionado ao carrinho.`);
    }
  }

  gridEl.addEventListener("click", handleCardAction);

  /* Estado visual inicial dos favoritos nos cards recém-renderizados. */
  function syncFavoriteStates() {
    gridEl.querySelectorAll(".product-card__fav").forEach((btn) => {
      const card = btn.closest(".product-card");
      const product = byId(card && card.dataset.productId);
      if (!product) return;

      const fav = isFavorite(product.id);
      btn.setAttribute("aria-pressed", String(fav));
      btn.classList.toggle("is-faved", fav);
    });
  }

  /* --- Construção única dos controles --- */
  let filterHandles = null;
  let sortHandle = null;

  if (filtersRoot) {
    filterHandles = buildFilters(facets, state, {
      onApply: (patch, opts) => {
        Object.assign(state, patch);
        if (opts && opts.resetPage) {
          state.page = 1;
        }
        render();
      },
      onClear: clearFilters,
    });
    filtersRoot.appendChild(filterHandles.root);
  }

  if (sortRoot) {
    sortHandle = buildSort(state, {
      onSort: (value) => {
        state.sort = value;
        state.page = 1;
        render();
      },
    });
    sortRoot.appendChild(sortHandle.root);
  }

  /* --- Renderização cíclica --- */
  function render() {
    const result = queryCatalog(products, state);
    state.page = result.page;

    if (countEl) {
      renderMeta(countEl, result.from, result.to, result.total);
    }

    if (result.items.length > 0) {
      renderCards(gridEl, result.items);
    } else {
      renderEmptyState(gridEl, state.query.trim().length > 0);
    }

    if (paginationRoot) {
      buildPagination(paginationRoot, result, state, {
        onGoPage: (page) => {
          state.page = page;
          render();
        },
      });
    }

    if (filterHandles) syncFilters(filterHandles, state);
    if (sortHandle) syncSort(sortHandle, state);
    syncFavoriteStates();
  }

  function clearFilters() {
    state.query = "";
    state.categories = [];
    state.priceRange = "all";
    state.availability = "all";
    state.sort = "relevance";
    state.page = 1;
    render();
  }

  /* Inicialização */
  render();
  return { render, clearFilters };
}

const root = document.getElementById("catalog-app");
if (root) {
  CatalogController(root);
}
