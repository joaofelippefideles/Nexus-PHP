/* ==========================================================================
   NEXUS TECH — Catálogo: filtragem (Sprint 4)
   Funções puras de lógica de negócio: busca, filtros, ordenação e paginação.

   Mantidas PURAS (sem DOM) para serem testáveis isoladamente no Node e
   reutilizáveis na futura integração com API/backend.

   Estado esperado (view/state):
   {
     query: string,
     categories: string[],      // categorias selecionadas
     priceRange: string,        // chave da faixa de preço ("all", "0-100", ...)
     availability: string,      // "all" | "in" | "out"
     sort: string,              // "relevance" | "price-asc" | ...
     page: number,              // 1-based
     perPage: number
   }
   ========================================================================== */

export const PRICE_RANGES = [
  { key: "all", label: "Todos os preços", min: null, max: null },
  { key: "0-100", label: "Até R$ 100", min: 0, max: 10000 },
  { key: "100-300", label: "R$ 100 – R$ 300", min: 10000, max: 30000 },
  { key: "300-1000", label: "R$ 300 – R$ 1.000", min: 30000, max: 100000 },
  { key: "1000-5000", label: "R$ 1.000 – R$ 5.000", min: 100000, max: 500000 },
  { key: "5000+", label: "Acima de R$ 5.000", min: 500000, max: null },
];

export const SORT_OPTIONS = [
  { key: "relevance", label: "Relevância" },
  { key: "price-asc", label: "Menor preço" },
  { key: "price-desc", label: "Maior preço" },
  { key: "rating-desc", label: "Melhor avaliação" },
  { key: "newest", label: "Novidades" },
];

export const DEFAULT_STATE = Object.freeze({
  query: "",
  categories: [],
  priceRange: "all",
  availability: "all",
  sort: "relevance",
  page: 1,
  perPage: 8,
});

export function defaultState() {
  return { ...DEFAULT_STATE, categories: [] };
}

/* Normaliza o termo de busca: minúsculo e sem acentuação, evitando
   diferenciação indevida de maiúsculas/minúsculas e acentos. */
function normalize(value) {
  return String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function matchesSearch(product, query) {
  const q = normalize(query).trim();
  if (!q) return true;

  const haystack = normalize(
    [product.name, product.brand, product.category].join(" ")
  );
  return haystack.includes(q);
}

export function applySearch(products, query) {
  return products.filter((product) => matchesSearch(product, query));
}

export function applyFilters(products, state) {
  const activeCategories = new Set(state.categories || []);

  return products.filter((product) => {
    if (activeCategories.size > 0 && !activeCategories.has(product.category)) {
      return false;
    }

    const range = PRICE_RANGES.find((r) => r.key === state.priceRange) ||
      PRICE_RANGES[0];
    if (range.min !== null && product.priceCents < range.min) return false;
    if (range.max !== null && product.priceCents >= range.max) return false;

    if (state.availability === "in" && product.stock <= 0) return false;
    if (state.availability === "out" && product.stock > 0) return false;

    return true;
  });
}

function compareBy(key, direction = 1) {
  return (a, b) => {
    if (a[key] < b[key]) return -1 * direction;
    if (a[key] > b[key]) return 1 * direction;
    return 0;
  };
}

export function applySort(products, sortKey) {
  const list = products.slice();

  switch (sortKey) {
    case "price-asc":
      return list.sort(compareBy("priceCents", 1));
    case "price-desc":
      return list.sort(compareBy("priceCents", -1));
    case "rating-desc":
      return list
        .sort(compareBy("ratingCount", -1))
        .sort(compareBy("rating", -1));
    case "newest":
      return list
        .sort(compareBy("isBestseller", -1))
        .sort(compareBy("isNew", -1));
    case "relevance":
    default:
      return list;
  }
}

export function paginate(list, page, perPage) {
  const safeTotal = Math.max(0, list.length);
  const safePerPage = Math.max(1, perPage);
  const totalPages = Math.max(1, Math.ceil(safeTotal / safePerPage));
  const safePage = Math.min(Math.max(1, page), totalPages);

  const start = (safePage - 1) * safePerPage;
  const items = list.slice(start, start + safePerPage);

  return {
    items,
    page: safePage,
    perPage: safePerPage,
    total: safeTotal,
    totalPages,
    hasPrev: safePage > 1,
    hasNext: safePage < totalPages,
    from: safeTotal === 0 ? 0 : start + 1,
    to: Math.min(start + safePerPage, safeTotal),
  };
}

/* Orquestra toda a cadeia: busca → filtros → ordenação → paginação. */
export function queryCatalog(products, state) {
  const searched = applySearch(products, state.query);
  const filtered = applyFilters(searched, state);
  const sorted = applySort(filtered, state.sort);
  return paginate(sorted, state.page, state.perPage);
}

/* Metadados derivados dos dados brutos, para montar os controles:
   categorias distintas com contagem. */
export function buildFacets(products) {
  const categoryMap = new Map();
  for (const product of products) {
    categoryMap.set(
      product.category,
      (categoryMap.get(product.category) || 0) + 1
    );
  }
  const categories = Array.from(categoryMap, ([label, count]) => ({
    label,
    count,
  })).sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));

  return { categories, count: products.length };
}
