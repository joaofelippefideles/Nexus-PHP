/* ==========================================================================
   NEXUS TECH — Ponto de entrada do servidor
   Lê o ambiente, inicia o servidor HTTP Express e trata erros de boot.
   ========================================================================== */

require("dotenv").config();

const app = require("./app");

const port = Number(process.env.PORT) || 4000;

const server = app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Nexus Tech API ouvindo em http://127.0.0.1:${port}`);
});

/* Encerramento limpo da aplicação. */
function shutdown(signal) {
  // eslint-disable-next-line no-console
  console.log(`\n${signal} recebido — encerrando...`);
  server.close(() => {
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

/* Erros não capturados: logar sem vazar stack para o cliente. */
process.on("unhandledRejection", (reason) => {
  // eslint-disable-next-line no-console
  console.error("[unhandledRejection]", reason);
});
process.on("uncaughtException", (err) => {
  // eslint-disable-next-line no-console
  console.error("[uncaughtException]", err);
});
