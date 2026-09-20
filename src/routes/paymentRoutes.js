const express = require("express");

const {
  createOrder,
  verifyPayment,
  paymentFailed,
} = require("../controllers/paymentController");

const router = express.Router();

router.post("/create-order", createOrder);
router.post("/verify", verifyPayment);
router.post('/failed', paymentFailed);

module.exports = router;