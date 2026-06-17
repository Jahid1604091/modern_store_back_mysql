'use strict';
const StubFraudCheckProvider = require('./providers/StubFraudCheckProvider');
const FraudBdProvider = require('./providers/FraudBdProvider');

const PROVIDERS = {
  stub: StubFraudCheckProvider,
  fraudbd: FraudBdProvider,
};

function getProvider() {
  const name = process.env.FRAUD_CHECK_PROVIDER || 'stub';
  const Provider = PROVIDERS[name] || StubFraudCheckProvider;
  return new Provider();
}

/**
 * Checks a customer's delivery history for the given phone number.
 * Returns {total_orders, delivered, cancelled, returned, success_rate, source}.
 */
async function checkPhone(phone, companyId) {
  const provider = getProvider();
  return provider.checkPhone(phone, companyId);
}

module.exports = { checkPhone };
