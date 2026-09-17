const express = require('express');

const {
  sendOtp,
  verifyOtp,
  registerWorker,
  msg91Login
} = require('../controllers/authController');

const router = express.Router();

router.post('/send-otp', sendOtp);

router.post('/verify-otp', verifyOtp);

router.post('/msg91-login', msg91Login);

router.post('/register-worker', registerWorker);

module.exports = router;