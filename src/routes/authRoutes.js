const express = require('express');

const {
   sendOtp,
    verifyOtp,
    registerWorker,
    msg91Login,
    msg91WorkerLogin,
    msg91WorkerRegister,
    checkCustomer,
    loginCustomer,
    registerCustomer,

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

router.post(
  '/msg91-worker-login',
  msg91WorkerLogin
);

router.post(
  '/msg91-worker-register',
  msg91WorkerRegister
);

module.exports = router;