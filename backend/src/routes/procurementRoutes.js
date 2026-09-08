const express = require('express');
const router = express.Router();
const procurementController = require('../controllers/procurementController');

router.post('/inspection', procurementController.recordInspection);
router.post('/weight', procurementController.recordWeight);

module.exports = router;
