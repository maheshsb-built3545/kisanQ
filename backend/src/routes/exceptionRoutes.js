const express = require('express');
const router = express.Router();
const exceptionController = require('../controllers/exceptionController');

router.post('/delay', exceptionController.reportDelay);
router.post('/reschedule/:bookingId', exceptionController.emergencyReschedule);

module.exports = router;
