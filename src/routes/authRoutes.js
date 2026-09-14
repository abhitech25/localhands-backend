const express = require('express');

const {
  sendOtp,
  verifyOtp,
  registerWorker
} = require('../controllers/authController');

const router = express.Router();

router.post('/send-otp', sendOtp);

router.post('/verify-otp', verifyOtp);
router.post('/register-worker', registerWorker);


module.exports = router;