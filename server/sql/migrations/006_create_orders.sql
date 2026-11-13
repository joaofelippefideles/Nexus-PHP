-- ==========================================================================
-- NEXUS TECH — Migration 006: pedidos reais do storefront (orders + order_items)
-- Base de persistência dos pedidos criados pelo checkout real (FASE 9).
-- Registro do owner, totais, entrega, pagamento SÓ por método/label e
-- snapshot completo de endereço + nome/email de entrega (o checkout atual coleta
-- e valida esses dados; eles passam a ser persistidos por pedido).
--
-- Decisões de modelagem (alinhadas ao padrão do schema existente):
--   - ENUM para status/delivery_method/payment_method (padrão de users.role);
--   - Preços em INT (mesma convenção de products.price_cents, nunca float);
--   - orders.user_id ON DELETE CASCADE (padrão de refresh_tokens/user_profile);
--   - order_items.product_id sem ON DELETE (RESTRICT): preserva o histórico de
--     vendas — produtos usam soft-delete (is_active), nunca remoção física;
--   - UNIQUE (user_id, client_idempotency_key): impede replay/duplicação do
--     mesmo pedido pelo mesmo usuário (idempotência em nível de banco);
--   - code UNIQUE: código amigável gerado pelo service (ex.: NT-000001).
--
-- Proteção de estoque: CHECK (quantity >= 0) em inventory (MySQL 8 enforce).
--
-- NENHUM dado sensível é persistido: cartão, CVV, senha, access/refresh token.
-- ==========================================================================

CREATE TABLE IF NOT EXISTS orders (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(16) NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  status ENUM('processing','paid','shipped','cancelled') NOT NULL DEFAULT 'processing',
  subtotal_cents INT NOT NULL,
  shipping_cents INT NOT NULL DEFAULT 0,
  total_cents INT NOT NULL,
  item_count INT UNSIGNED NOT NULL,
  delivery_method ENUM('standard','express') NOT NULL,
  delivery_label VARCHAR(40) NOT NULL,
  payment_method ENUM('credit','pix','boleto') NOT NULL,
  payment_label VARCHAR(40) NOT NULL,
  delivery_name VARCHAR(120) NOT NULL,
  delivery_email VARCHAR(190) NOT NULL,
  cep VARCHAR(9) NOT NULL,
  street VARCHAR(120) NOT NULL,
  number VARCHAR(20) NOT NULL,
  complement VARCHAR(120) NULL,
  neighborhood VARCHAR(120) NOT NULL,
  city VARCHAR(120) NOT NULL,
  state VARCHAR(2) NOT NULL,
  client_idempotency_key VARCHAR(64) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
             ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_orders_code (code),
  UNIQUE KEY uq_orders_user_idempotency (user_id, client_idempotency_key),
  KEY idx_orders_user_created (user_id, created_at),
  CONSTRAINT fk_orders_user FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS order_items (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id INT UNSIGNED NOT NULL,
  product_id INT UNSIGNED NOT NULL,
  product_name VARCHAR(200) NOT NULL,
  unit_price_cents INT NOT NULL,
  quantity INT UNSIGNED NOT NULL,
  total_cents INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_order_items_order_id (order_id),
  KEY idx_order_items_product_id (product_id),
  CONSTRAINT fk_order_items_order FOREIGN KEY (order_id)
    REFERENCES orders (id) ON DELETE CASCADE,
  CONSTRAINT fk_order_items_product FOREIGN KEY (product_id)
    REFERENCES products (id) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Proteção contra estoque negativo (MySQL 8.0.16+ passa a aplicá-la).
-- Os valores existentes (seed: 24, 12, 0, ...) já atendem quantity >= 0.
ALTER TABLE inventory
  ADD CONSTRAINT chk_inventory_quantity_non_negative
  CHECK (quantity >= 0);