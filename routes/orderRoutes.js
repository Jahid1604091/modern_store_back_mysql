const express = require("express");
const router = express.Router();

const {
  createOrder,
  getAllOrders,
  getMyOrders,
  getMyOrder,
  updateOrderToPaid,
  generateInvoice,
  updateToDelivered,
  getOrder,
  getOrdersOverview,
  createOrderForPOS,
  generateInvoiceForPOS,
} = require("../controllers/orderController");

const { protect, authorize } = require("../middleware/authMiddleware");

// ------------------ USER ROUTES ------------------
router.post("/", protect, createOrder);
router.post("/pos", protect, createOrderForPOS);
router.get("/myorders", protect, getMyOrders);
router.get("/myorders/:id", protect, getMyOrder);
router.put("/myorders/:id/pay", protect, updateOrderToPaid);
router.get("/myorders/:id/invoice",protect,  generateInvoice);

// ------------------ ADMIN ROUTES ------------------
router.get("/overview", protect, authorize("admin"), getOrdersOverview);
router.get("/", protect, authorize("admin"), getAllOrders);
router.get("/:id", protect, authorize("admin"), getOrder);
router.put("/:id/change-to-delivered", protect, authorize("admin"), updateToDelivered);
router.get("/pos/:id/invoice",  generateInvoiceForPOS);

module.exports = router;
