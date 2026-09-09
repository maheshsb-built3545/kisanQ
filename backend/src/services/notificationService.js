const mongoose = require('mongoose');
const { Notification } = require('../models');
const logger = require('../utils/logger');

// In-memory fallback
const inMemoryNotifications = [];

const notificationService = {
  /**
   * Dispatch a notification (mock SMS/Push/IVR delivery for MVP)
   */
  sendNotification: async ({ bookingId, channel, messageType, payload }) => {
    if (!bookingId || !channel || !messageType) {
      throw new Error('bookingId, channel, and messageType are required');
    }

    const validChannels = ['sms', 'push', 'ivr'];
    if (!validChannels.includes(channel)) {
      throw new Error(`Invalid channel '${channel}'. Must be one of: ${validChannels.join(', ')}`);
    }

    const validMessageTypes = ['booking_confirmed', 'window_approaching', 'status_update', 'vacancy_released'];
    if (!validMessageTypes.includes(messageType)) {
      throw new Error(`Invalid messageType '${messageType}'. Must be one of: ${validMessageTypes.join(', ')}`);
    }

    // Simulate delivery with mock latency and randomised success/failure
    const deliverySuccess = Math.random() > 0.1; // 90% success rate for mock
    const deliveryStatus = deliverySuccess ? 'delivered' : 'failed';

    logger.info(
      `[Notification Mock] Channel: ${channel.toUpperCase()} | Type: ${messageType} | ` +
      `Booking: ${bookingId} | Status: ${deliveryStatus} | Payload: ${JSON.stringify(payload || {})}`
    );

    const notificationData = {
      _id: new mongoose.Types.ObjectId(),
      bookingId,
      channel,
      messageType,
      deliveryStatus,
      timestamp: new Date()
    };

    let notification = null;
    try {
      if (mongoose.connection.readyState === 1) {
        notification = await Notification.create(notificationData);
      }
    } catch (err) {
      logger.warn(`Notification DB fallback: ${err.message}`);
    }

    if (!notification) {
      notification = { ...notificationData, createdAt: new Date(), updatedAt: new Date() };
      inMemoryNotifications.push(notification);
    }

    return notification;
  },

  /**
   * Retry a failed notification
   */
  retryNotification: async (notificationId) => {
    let notification = null;
    try {
      if (mongoose.connection.readyState === 1) {
        notification = await Notification.findById(notificationId);
      }
    } catch (e) { /* fallback */ }
    if (!notification) {
      notification = inMemoryNotifications.find((n) => n._id?.toString() === notificationId.toString());
    }
    if (!notification) {
      throw new Error(`Notification ${notificationId} not found`);
    }

    // Re-simulate delivery
    const retrySuccess = Math.random() > 0.05; // 95% on retry
    const newStatus = retrySuccess ? 'delivered' : 'retried';

    logger.info(
      `[Notification Retry] Channel: ${notification.channel?.toUpperCase()} | ` +
      `Booking: ${notification.bookingId} | New Status: ${newStatus}`
    );

    try {
      if (mongoose.connection.readyState === 1) {
        notification = await Notification.findByIdAndUpdate(notificationId, { deliveryStatus: newStatus }, { new: true });
      }
    } catch (e) { /* fallback */ }
    if (notification && !notification.deliveryStatus) {
      notification.deliveryStatus = newStatus;
    }

    return notification;
  },

  /**
   * Get notification delivery log for a booking
   */
  getNotificationLog: async (bookingId) => {
    let notifications = [];
    try {
      if (mongoose.connection.readyState === 1) {
        notifications = await Notification.find({ bookingId }).sort({ timestamp: -1 });
      }
    } catch (e) { /* fallback */ }

    if (notifications.length === 0) {
      notifications = inMemoryNotifications.filter(
        (n) => n.bookingId?.toString() === bookingId.toString()
      );
    }

    return notifications;
  },

  /**
   * Send batch notifications (convenience helper for booking events)
   */
  sendBookingConfirmation: async (bookingId) => {
    const results = [];
    results.push(await notificationService.sendNotification({
      bookingId,
      channel: 'sms',
      messageType: 'booking_confirmed',
      payload: { message: 'Your booking has been confirmed. Please arrive during your scheduled window.' }
    }));
    results.push(await notificationService.sendNotification({
      bookingId,
      channel: 'push',
      messageType: 'booking_confirmed',
      payload: { title: 'Booking Confirmed', body: 'Your slot has been reserved.' }
    }));
    return results;
  },

  sendWindowApproaching: async (bookingId) => {
    return notificationService.sendNotification({
      bookingId,
      channel: 'sms',
      messageType: 'window_approaching',
      payload: { message: 'Your arrival window is approaching. Please proceed to the centre.' }
    });
  },

  sendStatusUpdate: async (bookingId, statusMessage) => {
    return notificationService.sendNotification({
      bookingId,
      channel: 'push',
      messageType: 'status_update',
      payload: { message: statusMessage || 'Your booking status has been updated.' }
    });
  }
};

module.exports = notificationService;
