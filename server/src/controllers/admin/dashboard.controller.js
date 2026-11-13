/* ==========================================================================
   NEXUS TECH — Controller admin de dashboard (v3.0-X3 — camada fina)
   ========================================================================== */

const dashboardService = require("../../services/admin/dashboard.service");
const { ok } = require("../../utils/http");

async function get(req, res, next) {
  try {
    const result = await dashboardService.get();
    return ok(res, result.data);
  } catch (err) {
    return next(err);
  }
}

module.exports = { get };