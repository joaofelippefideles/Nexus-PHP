-- ==========================================================================
-- NEXUS TECH — Esquema do banco de dados
-- Banco: nexus_tech_db | Charset/Colação: utf8mb4 / utf8mb4_0900_ai_ci
--
-- Tabelas:
--   brands          → marcas (ex.: Nexus)
--   categories      → categorias do catálogo (ex.: Notebooks, Mouses, ...)
--   products        → produtos (preços em CENTAVOS, nunca float/double)
--   product_images  → múltiplas imagens por produto (1:N)
--   product_specs   → especificações EAV label/value por produto (1:N)
--   inventory       → estoque por produto (1:1)
--
-- Relacionamentos (ON DELETE/UPDATE CASCADE nos filhos de products):
--   products.brand_id      → brands.id
--   products.category_id   → categories.id
--   product_images.product_id → products.id
--   product_specs.product_id  → products.id
--   inventory.product_id      → products.id
--
-- USO:  mysql -u root -p < schema.sql  (cria o banco e as tabelas)
-- ==========================================================================

CREATE DATABASE IF NOT EXISTS nexus_tech_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

USE nexus_tech_db;

/* -------------------------------------------------------------------------- */
/* brands                                                                     */
/* -------------------------------------------------------------------------- */
CREATE TABLE IF NOT EXISTS brands (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name       VARCHAR(100) NOT NULL,
  slug       VARCHAR(120) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
             ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_brands_name (name),
  UNIQUE KEY uq_brands_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

/* -------------------------------------------------------------------------- */
/* categories                                                                 */
/* -------------------------------------------------------------------------- */
CREATE TABLE IF NOT EXISTS categories (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name       VARCHAR(100) NOT NULL,
  slug       VARCHAR(120) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
             ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_categories_name (name),
  UNIQUE KEY uq_categories_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

/* -------------------------------------------------------------------------- */
/* products                                                                    */
/* -------------------------------------------------------------------------- */
CREATE TABLE IF NOT EXISTS products (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  slug            VARCHAR(140) NOT NULL,
  name            VARCHAR(200) NOT NULL,
  description     TEXT NULL,
  brand_id        INT UNSIGNED NOT NULL,
  category_id     INT UNSIGNED NOT NULL,
  price_cents     INT NOT NULL COMMENT 'Preço em centavos (nunca float/double)',
  old_price_cents INT NULL COMMENT 'Preço antigo em centavos (para promoção)',
  rating          DECIMAL(2,1) NOT NULL DEFAULT 0.0,
  rating_count    INT UNSIGNED NOT NULL DEFAULT 0,
  is_featured     TINYINT(1) NOT NULL DEFAULT 0,
  is_new          TINYINT(1) NOT NULL DEFAULT 0,
  is_bestseller   TINYINT(1) NOT NULL DEFAULT 0,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                  ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_products_slug (slug),
  KEY idx_products_brand_id (brand_id),
  KEY idx_products_category_id (category_id),
  KEY idx_products_price_cents (price_cents),
  KEY idx_products_rating (rating),
  CONSTRAINT fk_products_brand FOREIGN KEY (brand_id)
    REFERENCES brands (id) ON UPDATE CASCADE,
  CONSTRAINT fk_products_category FOREIGN KEY (category_id)
    REFERENCES categories (id) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

/* -------------------------------------------------------------------------- */
/* product_images                                                              */
/* -------------------------------------------------------------------------- */
CREATE TABLE IF NOT EXISTS product_images (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  product_id INT UNSIGNED NOT NULL,
  url        VARCHAR(255) NOT NULL,
  alt        VARCHAR(200) NULL,
  position   INT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_product_images_product_id (product_id),
  CONSTRAINT fk_product_images_product FOREIGN KEY (product_id)
    REFERENCES products (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

/* -------------------------------------------------------------------------- */
/* product_specs (armazenamento EAV: label/value por produto)                 */
/* -------------------------------------------------------------------------- */
CREATE TABLE IF NOT EXISTS product_specs (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  product_id INT UNSIGNED NOT NULL,
  label      VARCHAR(120) NOT NULL,
  value      VARCHAR(255) NOT NULL,
  position   INT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_product_specs_product_id (product_id),
  CONSTRAINT fk_product_specs_product FOREIGN KEY (product_id)
    REFERENCES products (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

/* -------------------------------------------------------------------------- */
/* inventory                                                                   */
/* -------------------------------------------------------------------------- */
CREATE TABLE IF NOT EXISTS inventory (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  product_id INT UNSIGNED NOT NULL,
  quantity   INT NOT NULL DEFAULT 0 COMMENT 'Estoque em unidades',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
             ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_inventory_product_id (product_id),
  CONSTRAINT fk_inventory_product FOREIGN KEY (product_id)
    REFERENCES products (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
