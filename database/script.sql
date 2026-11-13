-- ==========================================================================
-- NEXUS TECH — Banco de dados do cadastro (MySQL / MariaDB)
-- --------------------------------------------------------------------------
-- Este script cria as tabelas usadas pelo backend PHP:
--   users        → identidade do cliente (nome, e-mail, hash bcrypt)
--   user_profile → dados complementares (telefone e CPF)
--
-- Compatível com MySQL 8 e MariaDB (XAMPP). O backend Node do projeto usa
-- o esquema completo em server/sql/schema.sql (produtos, pedidos, etc.).
--
-- COMO IMPORTAR:
--   mysql -u root -p < database/script.sql
-- ou, no phpMyAdmin (XAMPP), aba "Importar" → selecione este arquivo.
--
-- SEGURANÇA:
--   - a senha NUNCA é gravada em texto puro; apenas password_hash (bcrypt);
--   - e-mail e CPF são únicos;
--   - o cadastro PHP usa consultas preparadas (PDO).
-- ==========================================================================

CREATE DATABASE IF NOT EXISTS nexus_tech_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE nexus_tech_db;

/* -------------------------------------------------------------------------- */
/* users                                                                      */
/* -------------------------------------------------------------------------- */
CREATE TABLE IF NOT EXISTS users (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name          VARCHAR(120) NOT NULL,
  email         VARCHAR(190) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          ENUM('customer', 'admin') NOT NULL DEFAULT 'customer',
  is_active     TINYINT(1) NOT NULL DEFAULT 1,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/* -------------------------------------------------------------------------- */
/* user_profile                                                               */
/* -------------------------------------------------------------------------- */
CREATE TABLE IF NOT EXISTS user_profile (
  user_id    INT UNSIGNED NOT NULL,
  phone      VARCHAR(20) NULL,
  cpf        VARCHAR(14) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
             ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  UNIQUE KEY uq_user_profile_cpf (cpf),
  CONSTRAINT fk_user_profile_user FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
