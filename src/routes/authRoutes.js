const express = require('express');

const {
  sendOtp,
  verifyOtp,
  registerWorker,
  checkCustomer,

  loginCustomer,
  registerCustomer,
  msg91Login

} = require('../controllers/authController');

const router = express.Router();

// Legacy / worker routes
router.post('/send-otp', sendOtp);
router.post('/verify-otp', verifyOtp);
router.post('/register-worker', registerWorker);

// Customer authentication
router.post('/check-customer', checkCustomer);
router.post('/login', loginCustomer);
router.post('/register', registerCustomer);
router.post('/msg91-login', msg91Login);

module.exports = router;