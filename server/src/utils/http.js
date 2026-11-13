/* ==========================================================================
   NEXUS TECH — Utilitários HTTP
   Helpers para respostas padronizadas (sucesso, erro) e tratamento de
   erros conhecidos (HttpError). Mantém o contrato da API consistente.
   ========================================================================== */

const { STATUS_CODES } = require("http");

/* Erro de negócio com status HTTP próprio.
   Lancado em camadas (service/validation) e capturado pelo errorHandler. */
class HttpError extends Error {
  constructor(status, message, details = null) {
    super(message || STATUS_CODES[status] || "Erro interno");
    this.name = "HttpError";
    this.status = status;
    this.details = details;
  }
}

/* Padroniza a resposta de sucesso. */
function ok(res, data = null, meta = null, status = 200) {
  const body = { data };
  if (meta !== null) body.meta = meta;
  return res.status(status).json(body);
}

module.exports = { HttpError, ok };
