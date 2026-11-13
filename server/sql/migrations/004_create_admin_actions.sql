-- ==========================================================================
-- NEXUS TECH — Migration 004: tabela admin_actions
-- Auditoria mínima das ações administrativas (login/logout/mutações).
-- NUNCA registrar senha, token, password_hash ou refresh token.
-- ==========================================================================

CREATE TABLE IF NOT EXISTS admin_actions (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  admin_id INT UNSIGNED NOT NULL,
  action VARCHAR(40) NOT NULL,
  entity VARCHAR(40) NOT NULL,
  entity_id INT UNSIGNED NULL,
  before_data JSON NULL,
  after_data JSON NULL,
  ip VARCHAR(45) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_admin_actions_admin (admin_id),
  KEY idx_admin_actions_entity (entity, entity_id),
  CONSTRAINT fk_admin_actions_admin FOREIGN KEY (admin_id)
    REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;