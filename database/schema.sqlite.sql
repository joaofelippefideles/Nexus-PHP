-- ==========================================================================
-- NEXUS TECH — Esquema SQLite (fallback local do backend PHP)
-- --------------------------------------------------------------------------
-- Criado automaticamente por includes/conexao.php quando o MySQL não está
-- disponível (ou quando DB_DRIVER=sqlite). Mantém as MESMAS regras do
-- esquema MySQL: e-mail único, CPF único, hash bcrypt e FK com CASCADE.
-- ==========================================================================

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'admin')),
  is_active     INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_users_email ON users (email);

CREATE TABLE IF NOT EXISTS user_profile (
  user_id    INTEGER NOT NULL PRIMARY KEY,
  phone      TEXT NULL,
  cpf        TEXT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  CONSTRAINT fk_user_profile_user FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_user_profile_cpf ON user_profile (cpf);
