/* ==========================================================================
   NEXUS TECH — Utilitários de formatação
   Funções puras e reutilizáveis de apresentação (BRL, desconto, etc.).
   ========================================================================== */

export function formatBRL(cents) {
  if (cents === null || cents === undefined || Number.isNaN(Number(cents))) {
    return null;
  }
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

export function formatDiscount(oldCents, currentCents) {
  if (
    oldCents === null ||
    oldCents === undefined ||
    currentCents === null ||
    currentCents === undefined ||
    oldCents <= currentCents
  ) {
    return null;
  }
  return Math.round(((oldCents - currentCents) / oldCents) * 100);
}

export function formatDecimal(value) {
  return String(value).replace(".", ",");
}
