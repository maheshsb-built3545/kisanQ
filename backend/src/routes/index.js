const express = require('express');
const router = express.Router();

const authRoutes = require('./authRoutes');
const bookingRoutes = require('./bookingRoutes');
const queueRoutes = require('./queueRoutes');
const centreRoutes = require('./centreRoutes');
const procurementRoutes = require('./procurementRoutes');
const exceptionRoutes = require('./exceptionRoutes');
const notificationRoutes = require('./notificationRoutes');

// Mount modular service routes
router.use('/auth', authRoutes);
router.use('/bookings', bookingRoutes);
router.use('/queue', queueRoutes);
router.use('/centres', centreRoutes);
router.use('/procurement', procurementRoutes);
router.use('/exceptions', exceptionRoutes);
router.use('/notifications', notificationRoutes);

module.exports = router;
