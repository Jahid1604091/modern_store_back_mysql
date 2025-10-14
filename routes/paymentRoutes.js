import express from 'express';
import { initiateSSL, SSLsuccess, SSLcancel, SSLipn, SSLfailure, SSLvalidate } from '../controllers/paymentControllers.js';
const router = express.Router();


router.route('/ssl-request').post(initiateSSL)
router.route('/ssl-success').post(SSLsuccess)
router.route('/ssl-fail').post(SSLfailure)
router.route('/ssl-cancel').post(SSLcancel)
router.route('/ssl-ipn').post(SSLipn)
router.route('/ssl-validate').post(SSLsuccess,SSLvalidate)
 
export default router;