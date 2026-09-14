const express = require('express');

const {
  getPendingWorkers,
  approveWorker,
  getWorkerDetails,
  rejectWorker,
  getAllWorkers,
  getDashboardStats,
  getAllCustomers,
  getCustomerDetails,
  getCustomerBookings,
  getAllBookings,
  getBookingDetails,
  getAllServices,
  createService,
  updateService,
  toggleServiceStatus,
  getRecentActivity,
} = require('../controllers/adminController');

const {
  authenticateToken,
  requireAdmin
} = require('../middleware/authMiddleware');

const router = express.Router();

// All admin routes require authentication + admin role
router.use(authenticateToken);
router.use(requireAdmin);

router.get('/dashboard/stats', getDashboardStats);
router.get(
  '/dashboard/recent-activity',
  getRecentActivity
);

router.get('/customers', getAllCustomers);
router.get('/customers/:customerId', getCustomerDetails);
router.get(
  '/customers/:customerId/bookings',
  getCustomerBookings
);

router.get('/bookings', getAllBookings);
router.get(
  '/bookings/:bookingId',
  getBookingDetails
);

router.get('/services', getAllServices);

router.post('/services', createService);

router.put(
  '/services/:serviceId',
  updateService
);

router.patch(
  '/services/:serviceId/toggle',
  toggleServiceStatus
);

router.get(
  '/workers/pending',
  getPendingWorkers
);

router.get(
  '/workers',
  getAllWorkers
);

router.get(
  '/workers/:workerId',
  getWorkerDetails
);

router.post(
  '/workers/:workerId/approve',
  approveWorker
);

router.post(
  '/workers/:workerId/reject',
  rejectWorker
);



module.exports = router;