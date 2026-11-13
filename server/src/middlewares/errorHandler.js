/* ==========================================================================
   NEXUS TECH — Middleware de tratamento centralizado de erros
   Captura HttpError, erros de validação e erros inesperados.
   NUNCA expõe stack trace nem detalhes internos ao cliente.
   ========================================================================== */

const { STATUS_CODES } = require("http");
const { HttpError } = require("../utils/http");

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // Erro de negócio/validação com status próprio
  if (err instanceof HttpError) {
    const body = { error: err.message };
    if (err.details) body.details = err.details;
    return res.status(err.status).json(body);
  }

  // Erro de sintaxe JSON no corpo da requisição (Body-Parser nativo do Express)
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "JSON inválido no corpo da requisição" });
  }

  // Qualquer outro erro: não vazar detalhes internos
  console.error("[erro interno]", err);
  return res.status(500).json({
    error: STATUS_CODES[500] || "Erro interno do servidor",
  });
}

module.exports = errorHandler;
