const express = require("express");
const router = express.Router();

const { handleSteadfastWebhook } = require("../controllers/webhookController");

router.post("/steadfast/:company_id", handleSteadfastWebhook);

module.exports = router;
