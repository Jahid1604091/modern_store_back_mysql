/**
 * Central subscription plan configuration.
 * Imported by authController (registration), subscription update,
 * and any feature-gate middleware.
 */
const PLANS = {
  trial: {
    label: 'Free Trial',
    max_users: 3,
    max_products: 50,
    features: {
      pos: true,
      barcode_scanner: false,
      excel_export: false,
      multi_payment: false,
      invoice_pdf: true,
      api_access: false,
      custom_domain: false,
    },
    price_monthly: 0,
  },
  starter: {
    label: 'Starter',
    max_users: 10,
    max_products: 500,
    features: {
      pos: true,
      barcode_scanner: true,
      excel_export: true,
      multi_payment: true,
      invoice_pdf: true,
      api_access: false,
      custom_domain: false,
    },
    price_monthly: 999, // in BDT (or your currency unit)
  },
  professional: {
    label: 'Professional',
    max_users: 50,
    max_products: 5000,
    features: {
      pos: true,
      barcode_scanner: true,
      excel_export: true,
      multi_payment: true,
      invoice_pdf: true,
      api_access: true,
      custom_domain: false,
    },
    price_monthly: 2999,
  },
  enterprise: {
    label: 'Enterprise',
    max_users: 999,
    max_products: 99999,
    features: {
      pos: true,
      barcode_scanner: true,
      excel_export: true,
      multi_payment: true,
      invoice_pdf: true,
      api_access: true,
      custom_domain: true,
    },
    price_monthly: 9999,
  },
};

module.exports = PLANS;
