const express = require('express');

const {
  createBooking,
  getMyBookings,
  getBookingById,
  cancelBooking,
  getWorkerBookings,
  acceptBooking,
  rejectBooking,
  updateWorkerBookingStatus,
  startBooking
} = require('../controllers/bookingController');

const router = express.Router();


// ============================================================
// CUSTOMER BOOKINGS
// ============================================================

router.post('/', createBooking);

router.get('/my', getMyBookings);


// ============================================================
// WORKER BOOKINGS
// ============================================================

// Available jobs for workers
router.get('/worker', getWorkerBookings);

// Worker accepts booking
router.patch('/:id/accept', acceptBooking);
router.patch('/:id/reject', rejectBooking);
router.patch('/:id/status', updateWorkerBookingStatus);
router.patch('/:id/start', startBooking);


// ============================================================
// BOOKING DETAILS
// ============================================================

router.get('/:id', getBookingById);


// ============================================================
// CUSTOMER CANCEL BOOKING
// ============================================================

router.patch(
  '/:id/cancel',
  cancelBooking
);


module.exports = router;