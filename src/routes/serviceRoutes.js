const express = require('express');

const {
  getServices,
  getServiceById,
  getServiceOptions,
} = require('../controllers/serviceController');

const router = express.Router();

router.get('/', getServices);

router.get('/:id/options', getServiceOptions);

router.get('/:id', getServiceById);

module.exports = router;