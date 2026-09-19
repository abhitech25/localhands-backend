const Razorpay = require("razorpay");
const crypto = require("crypto");
const pool = require("../config/database");

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Create Razorpay Order
const createOrder = async (req, res) => {
  try {
    const { amount, booking_id } = req.body;

    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid amount is required",
      });
    }

    const options = {
      amount: Math.round(Number(amount) * 100),
      currency: "INR",
      receipt: `LH_${booking_id || Date.now()}`,
    };

    const order = await razorpay.orders.create(options);

    return res.status(200).json({
      success: true,
      order,
    });
  } catch (error) {
    console.error("RAZORPAY CREATE ORDER ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to create payment order",
      error: error.message,
    });
  }
};


// Verify Razorpay Payment
const verifyPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      booking_id,
    } = req.body;

    if (
      !razorpay_order_id ||
      !razorpay_payment_id ||
      !razorpay_signature ||
      !booking_id
    ) {
      return res.status(400).json({
        success: false,
        message: "Payment details are required",
      });
    }

    const generatedSignature = crypto
      .createHmac(
        "sha256",
        process.env.RAZORPAY_KEY_SECRET
      )
      .update(
        `${razorpay_order_id}|${razorpay_payment_id}`
      )
      .digest("hex");

    if (generatedSignature !== razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: "Payment verification failed",
      });
    }

    const result = await pool.query(
      `UPDATE bookings
       SET payment_status = 'paid',
           payment_id = $1,
           razorpay_order_id = $2
       WHERE id = $3
       RETURNING id, booking_number, payment_status`,
      [
        razorpay_payment_id,
        razorpay_order_id,
        booking_id,
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Payment verified successfully",
      booking: result.rows[0],
    });

  } catch (error) {
    console.error("RAZORPAY PAYMENT VERIFY ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Payment verification failed",
      error: error.message,
    });
  }
};


module.exports = {
  createOrder,
  verifyPayment,
};