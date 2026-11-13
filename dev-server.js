/* ==========================================================================
   NEXUS TECH — Dev server do frontend (v1.0)
   Servidor estático da raiz + proxy de /api/* para o backend real (4000).
   Necessário porque o storefront usa base RELATIVA (/api/auth, /api/orders);
   o admin usa URL absoluta http://127.0.0.1:4000/api/admin (CORS liberado).

   Uso:
     node dev-server.js            -> http://127.0.0.1:8123 (proxy p/ 4000)
     node dev-server.js 9000       -> porta 9000
     API_PORT=4000 node dev-server.js
   ========================================================================== */

const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const PORT = Number(process.argv[2]) || Number(process.env.FRONTEND_PORT) || 8123;
const API_PORT = Number(process.env.API_PORT) || 4000;
const HOST = "127.0.0.1";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};

/* Encaminha a requisição /api/* para o backend real (127.0.0.1:API_PORT). */
function proxy(req, res) {
  const upstream = http.request(
    {
      hostname: "127.0.0.1",
      port: API_PORT,
      path: req.url,
      method: req.method,
      headers: { ...req.headers },
    },
    (ures) => {
      res.writeHead(ures.statusCode, ures.headers);
      ures.pipe(res);
    }
  );
  upstream.on("error", () => {
    if (!res.headersSent) res.writeHead(502, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Backend indisponível em 127.0.0.1:" + API_PORT }));
  });
  req.pipe(upstream);
}

function sendFile(file, res) {
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("404 - Arquivo não encontrado");
      return;
    }
    res.writeHead(200, { "Content-Type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream" });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  if (req.url.startsWith("/api/")) {
    proxy(req, res);
    return;
  }

  let urlPath = decodeURIComponent(req.url.split("#")[0].split("?")[0]);
  if (urlPath === "/") urlPath = "/index.html";
  const file = path.join(ROOT, urlPath);
  if (!file.startsWith(ROOT)) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("403 - Acesso negado");
    return;
  }
  sendFile(file, res);
});

server.listen(PORT, HOST, () => {
  console.log(`Nexus Tech Frontend (dev) em http://${HOST}:${PORT}`);
  console.log(`Proxy /api/* -> http://127.0.0.1:${API_PORT}`);
});

function shutdown() {
  server.close(() => process.exit(0));
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);