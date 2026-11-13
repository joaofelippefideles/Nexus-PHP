/* ==========================================================================
   NEXUS TECH — Configuração do banco de dados
   Pool de conexões MySQL (mysql2) a partir das variáveis de ambiente.
   Todas as queries do projeto usam placeholders parametrizados (?).
   ========================================================================== */

const mysql = require("mysql2/promise");

const pool = mysql.createPool({
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "nexus_tech_db",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: "utf8mb4",
  supportBigNumbers: true,
});

/* Checa a conectividade executando um SELECT 1.
   Usado pelo health check e pelos testes de inicialização. */
async function checkConnection() {
  const conn = await pool.getConnection();
  try {
    await conn.query("SELECT 1");
  } finally {
    conn.release();
  }
}

module.exports = { pool, checkConnection };
