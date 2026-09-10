const express = require('express');
const router = express.Router();

const authRoutes = require('./auth.routes');
const bookingRoutes = require('./booking.routes');
const queueRoutes = require('./queue.routes');
const centreRoutes = require('./centre.routes');
const procurementRoutes = require('./procurementRoutes');
const exceptionRoutes = require('./exception.routes');
const notificationRoutes = require('./notification.routes');
const adminRoutes = require('./admin.routes');
const auditRoutes = require('./audit.routes');

// Mount modular service routes
router.use('/auth', authRoutes);
router.use('/bookings', bookingRoutes);
router.use('/queue', queueRoutes);
router.use('/centres', centreRoutes);
router.use('/procurement', procurementRoutes);
router.use('/exceptions', exceptionRoutes);
router.use('/notifications', notificationRoutes);
router.use('/admin', adminRoutes);
router.use('/audit', auditRoutes);

module.exports = router;
