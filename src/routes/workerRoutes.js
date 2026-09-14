const express = require('express');

const {
  getWorkerServices,
  getWorkerAvailability,
  updateWorkerAvailability,
  getWorkerProfile,
  uploadWorkerProfilePhoto,
  updateWorkerProfilePhoto,
} = require('../controllers/workerController');

const router = express.Router();

router.get('/:workerId/services', getWorkerServices);

router.get('/:workerId/availability', getWorkerAvailability);

router.patch('/:workerId/availability', updateWorkerAvailability);
router.get('/:workerId/profile', getWorkerProfile);

router.post(
  '/:workerId/profile-photo',
  uploadWorkerProfilePhoto,
  updateWorkerProfilePhoto
);

module.exports = router;