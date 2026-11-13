/* ==========================================================================
   NEXUS TECH — Serviço admin de dashboard (v3.0-X3)
   Monta o resumo em tempo real do painel: contagens + estoque zerado
   + últimas ações de auditoria. Somente leitura.
   ========================================================================== */

const dashboardRepository = require("../../repositories/admin/dashboard.repository");

async function get() {
  const [products, brands, categories, outOfStock, recentActions] = await Promise.all([
    dashboardRepository.countProducts(),
    dashboardRepository.countBrands(),
    dashboardRepository.countCategories(),
    dashboardRepository.countOutOfStock(),
    dashboardRepository.recentAudit(5),
  ]);

  return {
    data: {
      products,
      brands,
      categories,
      out_of_stock: outOfStock,
      recent_actions: recentActions.map((a) => ({
        id: a.id,
        action: a.action,
        entity: a.entity,
        entity_id: a.entity_id,
        admin_name: a.admin_name,
        ip: a.ip,
        created_at: a.created_at,
      })),
    },
  };
}

module.exports = { get };