-- ==========================================================================
-- NEXUS TECH — Migration 003: products.is_active (soft-delete do Admin)
-- Adiciona a coluna de desativação de produto. O Admin NUNCA remove
-- fisicamente produtos; usa is_active = 0 (soft-delete).
-- Backfill: todos os produtos existentes ficam ativos (is_active = 1).
-- Banco de partida: 12 produtos (schema.sql + seed.sql) — sem perda de dados.
-- ==========================================================================

ALTER TABLE products
  ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1 AFTER is_bestseller;

-- Backfill explícito para produtos pré-existentes (garantia + documentação).
UPDATE products
  SET is_active = 1
  WHERE is_active IS NULL OR is_active = 0;