
const express = require('express');

const {
  getUserAddresses,
  addAddress,
} = require('../controllers/addressController');

const router = express.Router();

// ============================================================
// GET USER ADDRESSES
// ============================================================

router.get(
  '/user/:userId',
  getUserAddresses
);

// ============================================================
// ADD NEW ADDRESS
// ============================================================

router.post(
  '/',
  addAddress
);

module.exports = router;