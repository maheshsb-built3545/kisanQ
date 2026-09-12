const express = require('express');
const router = express.Router();
const farmerController = require('../controllers/farmer.controller');
const { authenticate } = require('../middleware/auth.middleware');

// Save or update pickup location pin (authenticated farmer)
router.patch('/pickup-location', authenticate, farmerController.updatePickupLocation);

module.exports = router;
