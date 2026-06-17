'use strict';
const FraudCheckService = require('../fraudCheck/FraudCheckService');
const { CourierRiskCheck } = require('../../models');

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function classify(history, thresholds) {
  if (history.total_orders === 0) return 'unverified';
  if (history.total_orders < thresholds.auto_book_min_orders) return 'medium';
  if (history.success_rate >= thresholds.auto_book_min_success_rate) return 'low';
  if (history.success_rate <= thresholds.high_risk_max_success_rate) return 'high';
  return 'medium';
}

/**
 * Looks up a customer's delivery history and decides whether their order is
 * safe to auto-book with the courier or should wait for a manual confirmation
 * call. Never throws — a fraud-check outage degrades to "medium" risk rather
 * than blocking checkout.
 */
async function evaluate(order, company, { skipCache = false } = {}) {
  const phone = order.shipping_address && order.shipping_address.phone;
  const thresholds = company.getCourierSettings();

  let history;
  try {
    if (!skipCache) {
      const cached = await CourierRiskCheck.findOne({
        where: { company_id: company.id, phone },
        order: [['checked_at', 'DESC']],
      });
      if (cached && !cached.isExpired()) {
        history = {
          total_orders: cached.total_orders,
          delivered: cached.delivered_orders,
          cancelled: cached.cancelled_orders,
          returned: cached.returned_orders,
          success_rate: cached.success_rate == null ? null : Number(cached.success_rate),
          source: cached.provider,
        };
      }
    }

    if (!history) {
      history = await FraudCheckService.checkPhone(phone, company.id);
      await CourierRiskCheck.create({
        company_id: company.id,
        phone,
        provider: history.source,
        total_orders: history.total_orders,
        delivered_orders: history.delivered,
        cancelled_orders: history.cancelled,
        returned_orders: history.returned,
        success_rate: history.success_rate,
        raw_response: history,
        checked_at: new Date(),
        expires_at: new Date(Date.now() + CACHE_TTL_MS),
      });
    }
  } catch (error) {
    console.error('Fraud check failed, defaulting to medium risk:', error.message);
    const riskLevel = 'medium';
    await order.update({ risk_level: riskLevel, risk_score: null, risk_checked_at: new Date() });
    return { risk_level: riskLevel, should_auto_book: false };
  }

  const riskLevel = classify(history, thresholds);
  const riskScore = history.success_rate == null ? null : Math.round(history.success_rate * 100);

  await order.update({ risk_level: riskLevel, risk_score: riskScore, risk_checked_at: new Date() });

  const shouldAutoBook = riskLevel === 'low' && thresholds.auto_book_enabled !== false;

  return { risk_level: riskLevel, should_auto_book: shouldAutoBook };
}

module.exports = { evaluate };
