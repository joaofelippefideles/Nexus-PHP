/* ==========================================================================
   NEXUS TECH — Runner de migrations
   Executa os arquivos de server/sql/migrations/ em ordem, controlando a
   aplicação pela tabela schema_migrations (criada neste runner).
   - Uso:  npm run migrate   (na pasta server/)
   - Pré-requisito: baseline já aplicado (mysql < server/sql/schema.sql).
   - DDL no MySQL faz commit implícito: cada arquivo é aplicado de uma vez e
     só é registrado em schema_migrations após sucesso total.
   ========================================================================== */

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

const MIGRATIONS_DIR = path.join(__dirname, "..", "..", "sql", "migrations");

const BOOTSTRAP = `
CREATE TABLE IF NOT EXISTS schema_migrations (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  filename VARCHAR(255) NOT NULL,
  applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_schema_migrations_filename (filename)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;`;

function dbConfig() {
  return {
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "nexus_tech_db",
    multipleStatements: true,
  };
}

async function main() {
  const database = process.env.DB_NAME || "nexus_tech_db";
  const conn = await mysql.createConnection(dbConfig());

  try {
    await conn.connect();
  } catch (err) {
    console.error(
      `[migrate] Não foi possível conectar ao banco '${database}': ${err.message}`
    );
    console.error(
      "[migrate] Aplique antes o baseline:  mysql -u root -p < server/sql/schema.sql"
    );
    process.exit(1);
  }

  try {
    await conn.query(BOOTSTRAP);

    const [rows] = await conn.query("SELECT filename FROM schema_migrations");
    const applied = new Set(rows.map((r) => r.filename));

    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    const pending = files.filter((f) => !applied.has(f));
    console.log(`[migrate] Banco '${database}' | aplicadas ${applied.size} | pendentes ${pending.length}`);

    for (const file of pending) {
      const filename = path.join(MIGRATIONS_DIR, file);
      const sql = fs.readFileSync(filename, "utf8");
      console.log(`[migrate] Aplicando ${file} ...`);
      await conn.query(sql);
      await conn.query("INSERT INTO schema_migrations (filename) VALUES (?)", [file]);
      console.log(`[migrate] Ok: ${file}`);
    }

    if (pending.length === 0) console.log("[migrate] Nada a aplicar. Banco em dia.");
    console.log("[migrate] Concluído.");
  } catch (err) {
    console.error("[migrate] Falha ao aplicar migrations:", err.message);
    process.exit(1);
  } finally {
    await conn.end().catch(() => {});
  }
}

main();