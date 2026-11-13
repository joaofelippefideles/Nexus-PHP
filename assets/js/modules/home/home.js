/* ==========================================================================
   NEXUS TECH — Home (cards de produto e newsletter)
   Liga os botões dos cards estáticos da home à infraestrutura existente
   (store.js: carrinho e favoritos) e dá feedback local à newsletter.
   Os cards identificam o produto via `data-product-id` (produto do mock),
   evitando duplicar a lógica de carrinho/favoritos.
   ========================================================================== */

import { products } from "../../data/products.js";
import { addToCart, isFavorite, toggleFavorite, syncHeaderCounts } from "../store/store.js";

/* Região de status acessível (lida por leitores de tela, visível p/ quem
   usa navegação por teclado via foco). */
function announce(message) {
  const status = document.getElementById("home-status") || createStatus();
  status.textContent = message;
}

function createStatus() {
  const status = document.createElement("p");
  status.id = "home-status";
  status.className = "sr-only";
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  document.body.appendChild(status);
  return status;
}

function byId(id) {
  return products.find((product) => String(product.id) === String(id));
}

/* Liga Favoritar + Adicionar ao carrinho de um card da home. */
function wireCard(card) {
  const product = byId(card.dataset.productId);
  if (!product) return;

  const favButton = card.querySelector(".product-card__fav");
  if (favButton) {
    favButton.setAttribute("aria-pressed", String(isFavorite(product.id)));
    favButton.classList.toggle("is-faved", isFavorite(product.id));

    favButton.addEventListener("click", () => {
      toggleFavorite(product.id);
      favButton.setAttribute("aria-pressed", String(isFavorite(product.id)));
      favButton.classList.toggle("is-faved", isFavorite(product.id));
      syncHeaderCounts();
      announce(
        isFavorite(product.id)
          ? `${product.name} adicionado aos favoritos.`
          : `${product.name} removido dos favoritos.`,
      );
    });
  }

  const addButton = card.querySelector(".product-card__actions .btn");
  if (addButton) {
    if (Number(product.stock) <= 0) {
      addButton.disabled = true;
      addButton.textContent = "Esgotado";
      return;
    }

    addButton.addEventListener("click", () => {
      const added = addToCart(product.id, 1, product.stock);
      if (added === null) {
        announce(`Limite de estoque de ${product.name} atingido.`);
        return;
      }
      syncHeaderCounts();
      announce(`${product.name} adicionado ao carrinho.`);
    });
  }
}

/* Newsletter: feedback local honesto, sem persistência. A persistência
   real chega com a API (v3.0); este bloco já aponta onde integrar. */
function wireNewsletter() {
  const form = document.getElementById("newsletter-form");
  const feedback = document.getElementById("newsletter-feedback");
  if (!form || !feedback) return;

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const email = form.querySelector("#newsletter-email");
    if (!email || !email.value.trim()) return;

    feedback.textContent =
      "Cadastro de novidades registrado nesta sessão (simulação local — nenhum dado foi enviado). " +
      "A integração real chega com a v3.0.";
    feedback.hidden = false;
    form.reset();
  });
}

function initHome() {
  document
    .querySelectorAll(".product-card[data-product-id]")
    .forEach(wireCard);
  wireNewsletter();
  syncHeaderCounts();
}

initHome();