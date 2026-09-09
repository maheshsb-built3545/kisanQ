const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notification.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { checkRole } = require('../middleware/rbac.middleware');

// View notification delivery logs for a booking
router.get(
  '/:bookingId/log',
  authenticate,
  checkRole('operator', 'staff', 'supervisor', 'admin'),
  notificationController.getNotificationLog
);

// Dispatch a notification
router.post(
  '/send',
  authenticate,
  checkRole('operator', 'staff', 'supervisor', 'admin'),
  notificationController.sendNotification
);

// Retry a notification
router.post(
  '/:id/retry',
  authenticate,
  checkRole('operator', 'staff', 'supervisor', 'admin'),
  notificationController.retryNotification
);

module.exports = router;
