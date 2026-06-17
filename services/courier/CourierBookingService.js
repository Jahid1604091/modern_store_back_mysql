'use strict';
const SteadfastService = require('./SteadfastService');
const CourierNotConfiguredError = require('./CourierNotConfiguredError');

/**
 * Books a Steadfast shipment for an order. Never throws to the caller —
 * a missing config or a failed API call leaves the order in pending_review
 * so an admin can retry once credentials are set or the issue is resolved.
 */
async function bookOrder(order, company) {
  if (order.courier_status === 'booked' || order.courier_status === 'in_transit') {
    throw new Error(`Order is already ${order.courier_status} with the courier`);
  }

  const address = order.shipping_address || {};

  try {
    const steadfast = new SteadfastService(company);
    const result = await steadfast.createOrder({
      invoice: order.order_number,
      recipientName: address.name,
      recipientPhone: address.phone,
      recipientAddress: address.address || address.full_address,
      codAmount: order.payment_method === 'cod' ? Number(order.total) : 0,
      note: order.notes || undefined,
    });

    await order.update({
      courier_provider: 'steadfast',
      courier_consignment_id: result.consignmentId,
      courier_tracking_code: result.trackingCode,
      courier_status: 'booked',
    });

    return { booked: true };
  } catch (error) {
    const reason = error instanceof CourierNotConfiguredError
      ? 'Steadfast not configured'
      : `Steadfast booking failed: ${error.message}`;

    console.error(`Order ${order.id}: ${reason}`);
    await order.update({ courier_status: 'pending_review' });

    return { booked: false, reason };
  }
}

module.exports = { bookOrder };
