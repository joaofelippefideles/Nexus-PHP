/* ==========================================================================
   NEXUS TECH — Utilidades compartilhadas do carrinho
   Sanitização do `nexus:cart` contra o mock data e regras de frete.
   Usado pela página do carrinho e pelo checkout — regras únicas no projeto.
   - quantidade mínima = 1 e máxima = estoque do produto;
   - itens com produto inexistente, estoque 0 ou quantidade inválida (<= 0)
     são removidos; quantidades acima do estoque são ajustadas na carga;
   - frete padrão: subtotal >= R$ 500 -> grátis; senão R$ 29,90.
   ========================================================================== */

import { products } from "../../data/products.js";
import {
  getCart,
  removeFromCart,
  setCartQuantity,
} from "../store/store.js";

export const FREE_SHIPPING_MIN_CENTS = 50000; // R$ 500,00
export const SHIPPING_CENTS = 2990; // R$ 29,90 (entrega padrão)
export const EXPRESS_CENTS = 4990; // R$ 49,90 (entrega expressa)

export function productById(id) {
  return products.find((p) => p.id === id) || null;
}

/* Lê o localStorage, remove itens inválidos e ajusta quantidades ao estoque.
   Retorna { items, removed, fixed }, com `items` sendo um Map de
   id (String) -> { product, qty }. */
export function sanitizeCart() {
  const cart = getCart();
  const items = new Map();
  let removed = 0;
  let fixed = 0;

  for (const [rawId, rawQty] of Object.entries(cart)) {
    const id = Number(rawId);

    if (!Number.isInteger(id) || id <= 0) {
      removeFromCart(rawId);
      removed++;
      continue;
    }

    const product = productById(id);
    if (!product) {
      removeFromCart(rawId);
      removed++;
      continue;
    }

    const stock = Number(product.stock || 0);
    if (stock <= 0) {
      removeFromCart(rawId);
      removed++;
      continue;
    }

    const parsed = Number(rawQty);
    const qty =
      Number.isFinite(parsed) && parsed > 0
        ? Math.min(stock, Math.max(1, Math.floor(parsed)))
        : 1;

    if (Number(rawQty) !== qty) {
      fixed++;
      setCartQuantity(String(id), qty, stock);
    }

    items.set(String(id), { product, qty });
  }

  return { items, removed, fixed };
}

export function calculateSubtotal(items) {
  let sum = 0;
  for (const { product, qty } of items.values()) {
    sum += Number(product.priceCents) * qty;
  }
  return sum;
}

/* Regra única de frete da entrega padrão (mesma usada no resumo do carrinho). */
export function standardShippingCents(subtotalCents) {
  return subtotalCents >= FREE_SHIPPING_MIN_CENTS ? 0 : SHIPPING_CENTS;
}