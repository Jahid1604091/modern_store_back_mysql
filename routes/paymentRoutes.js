const express = require('express');
const { manualPayment } = require('../controllers/paymentControllers.js');
const { protect, authorize, optionalAuth } = require('../middleware/authMiddleware.js');
const router = express.Router();


router.route('/manual').post(protect, manualPayment)
// router.route('/ssl-request').post(initiateSSL)
// router.route('/ssl-success').post(SSLsuccess)
// router.route('/ssl-fail').post(SSLfailure)
// router.route('/ssl-cancel').post(SSLcancel)
// router.route('/ssl-ipn').post(SSLipn)
// router.route('/ssl-validate').post(SSLsuccess, SSLvalidate)

module.exports = router