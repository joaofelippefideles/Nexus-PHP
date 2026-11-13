/* ==========================================================================
   NEXUS TECH — Rota de health check
   GET /api/health — valida o servidor e a conexão com o banco (SELECT 1).
   Banco OK  → HTTP 200 { status: "ok", db: "up" }
   Banco fora → HTTP 503 { status: "degraded", db: "down" }
   NUNCA expõe senha nem detalhes internos.
   ========================================================================== */

const { Router } = require("express");
const { checkConnection } = require("../config/db");

const router = Router();

router.get("/", async (req, res) => {
  try {
    await checkConnection();
    return res.status(200).json({
      status: "ok",
      db: "up",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[health] banco indisponível:", err.message);
    return res.status(503).json({
      status: "degraded",
      db: "down",
      timestamp: new Date().toISOString(),
    });
  }
});

module.exports = router;
