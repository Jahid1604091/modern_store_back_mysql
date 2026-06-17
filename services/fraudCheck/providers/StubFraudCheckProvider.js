'use strict';
const { CourierRiskCheck } = require('../../../models');

/**
 * No real external lookup. Reuses whatever has already been cached in
 * courier_risk_checks (seeded manually or by a prior check) so the gating
 * logic and UI can be exercised end-to-end before a real provider is wired in.
 * A phone with no cached history is reported as "unverified" (0 orders).
 */
class StubFraudCheckProvider {
  async checkPhone(phone, companyId) {
    const cached = await CourierRiskCheck.findOne({
      where: { company_id: companyId, phone },
      order: [['checked_at', 'DESC']],
    });

    if (!cached) {
      return {
        total_orders: 0,
        delivered: 0,
        cancelled: 0,
        returned: 0,
        success_rate: null,
        source: 'stub',
      };
    }

    return {
      total_orders: cached.total_orders,
      delivered: cached.delivered_orders,
      cancelled: cached.cancelled_orders,
      returned: cached.returned_orders,
      success_rate: cached.success_rate == null ? null : Number(cached.success_rate),
      source: 'stub',
    };
  }
}

module.exports = StubFraudCheckProvider;
