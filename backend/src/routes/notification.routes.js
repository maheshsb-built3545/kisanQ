const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notification.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { checkRole } = require('../middleware/rbac.middleware');

// View notification delivery logs for a booking
router.get(
  '/:bookingId/log',
  authenticate,
  checkRole('operator', 'staff', 'supervisor', 'district_admin', 'auditor'),
  notificationController.getNotificationLog
);

// Dispatch a notification (restricted to supervisor and district_admin)
router.post(
  '/send',
  authenticate,
  checkRole('supervisor', 'district_admin'),
  notificationController.sendNotification
);

// Retry a notification (restricted to supervisor and district_admin)
router.post(
  '/:id/retry',
  authenticate,
  checkRole('supervisor', 'district_admin'),
  notificationController.retryNotification
);

module.exports = router;
