'use strict';
const axios = require('axios');
const CourierNotConfiguredError = require('./CourierNotConfiguredError');

const BASE_URL = process.env.STEADFAST_BASE_URL || 'https://portal.packzy.com/api/v1';

/**
 * Thin wrapper around Steadfast Courier's merchant API, scoped to one
 * company's credentials. See https://steadfast.com.bd for merchant docs.
 */
class SteadfastService {
  constructor(company) {
    this.apiKey = company.steadfast_api_key;
    this.secretKey = company.steadfast_secret_key;
  }

  client() {
    if (!this.apiKey || !this.secretKey) {
      throw new CourierNotConfiguredError();
    }
    return axios.create({
      baseURL: BASE_URL,
      timeout: 8000,
      headers: {
        'Api-Key': this.apiKey,
        'Secret-Key': this.secretKey,
        'Content-Type': 'application/json',
      },
    });
  }

  async createOrder({ invoice, recipientName, recipientPhone, recipientAddress, codAmount, note }) {
    const { data } = await this.client().post('/create_order', {
      invoice,
      recipient_name: recipientName,
      recipient_phone: recipientPhone,
      recipient_address: recipientAddress,
      cod_amount: codAmount,
      note,
    });

    const consignment = data.consignment || {};
    return {
      consignmentId: consignment.consignment_id,
      trackingCode: consignment.tracking_code,
      status: consignment.status,
      raw: data,
    };
  }

  async getStatusByConsignmentId(consignmentId) {
    const { data } = await this.client().get(`/status_by_cid/${consignmentId}`);
    return data;
  }
}

module.exports = SteadfastService;
