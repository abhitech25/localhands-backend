const express = require('express');

const {
  createReview,
  getBookingReview,
  getWorkerReviews
} = require('../controllers/reviewController');

const router = express.Router();


// ============================================================
// CUSTOMER - SUBMIT REVIEW
// ============================================================

router.post('/', createReview);


// ============================================================
// CUSTOMER - CHECK REVIEW FOR BOOKING
// ============================================================

router.get(
  '/booking/:booking_id',
  getBookingReview
);


// ============================================================
// GET WORKER REVIEWS
// ============================================================

router.get(
  '/worker/:worker_id',
  getWorkerReviews
);


module.exports = router;