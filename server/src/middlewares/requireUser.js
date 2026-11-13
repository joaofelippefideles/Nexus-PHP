/* ==========================================================================
   NEXUS TECH — requireUser
   Middleware de autenticação das rotas de usuário. Valida:
   - header Authorization = Bearer <token>;
   - assinatura HS256 e expiração do access token;
   - claims mínimos (sub);
   - usuário existente no banco e is_active = 1 (qualquer role).
   401 -> autenticação ausente/inválida/expirada.
   403 -> autenticado, porém inativo.
   Anexa o usuário seguro em req.user (sem password_hash).
   ========================================================================== */

const { verifyAccessToken } = require("../utils/tokens");
const usersRepository = require("../repositories/admin/users.repository");

async function requireUser(req, res, next) {
  try {
    const header = String(req.headers.authorization || "");
    const parts = header.split(" ");
    const scheme = parts[0] || "";
    const token = parts[1] || "";

    if (scheme !== "Bearer" || !token) {
      return res.status(401).json({ error: "Autenticação necessária" });
    }

    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch (err) {
      return res.status(401).json({ error: "Sessão inválida ou expirada" });
    }

    if (!payload || !payload.sub) {
      return res.status(401).json({ error: "Sessão inválida ou expirada" });
    }

    const user = await usersRepository.findSafeById(Number(payload.sub));
    if (!user) {
      return res.status(401).json({ error: "Sessão inválida ou expirada" });
    }

    if (user.is_active !== 1) {
      return res.status(403).json({ error: "Acesso negado" });
    }

    req.user = user;
    return next();
  } catch (err) {
    return next(err);
  }
}

module.exports = { requireUser };