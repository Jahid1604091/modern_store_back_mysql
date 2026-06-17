'use strict';
const axios = require('axios');

/**
 * Real lookup against fraudbd.com's courier history API. Inactive until
 * FRAUD_CHECK_PROVIDER=fraudbd and FRAUDBD_API_KEY are set — wired now so
 * switching providers later is a one-line env change, not a rewrite.
 */
class FraudBdProvider {
  async checkPhone(phone) {
    const apiKey = process.env.FRAUDBD_API_KEY;
    if (!apiKey) {
      throw new Error('FRAUDBD_API_KEY is not configured');
    }

    const { data } = await axios.get('https://fraudbd.com/api/courier-check', {
      params: { phone },
      headers: { Authorization: `Bearer ${apiKey}` },
      timeout: 5000,
    });

    const totalOrders = Number(data.total_orders) || 0;
    const delivered = Number(data.delivered) || 0;
    const cancelled = Number(data.cancelled) || 0;
    const returned = Number(data.returned) || 0;

    return {
      total_orders: totalOrders,
      delivered,
      cancelled,
      returned,
      success_rate: totalOrders > 0 ? delivered / totalOrders : null,
      source: 'fraudbd',
    };
  }
}

module.exports = FraudBdProvider;
