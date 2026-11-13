-- ==========================================================================
-- NEXUS TECH — Migration 005: tabela user_profile
-- Perfil complementar do usuário (customer). Dados que hoje existem apenas
-- no cadastro mock do storefront (telefone/CPF) passam a ter persistência.
-- Relacionamento 1:1 -> PK = user_id (um perfil por usuário).
-- CPF UNIQUE entre todos os usuários. ON DELETE CASCADE: excluir o usuário
-- remove o perfil automaticamente (mesmo padrão de refresh_tokens).
-- name/email/password_hash continuam SOMENTE na tabela users.
-- ==========================================================================

CREATE TABLE IF NOT EXISTS user_profile (
  user_id    INT UNSIGNED NOT NULL,
  phone      VARCHAR(20)  NULL,
  cpf        VARCHAR(14)  NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
             ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  UNIQUE KEY uq_user_profile_cpf (cpf),
  CONSTRAINT fk_user_profile_user FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;