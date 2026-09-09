const mongoose = require('mongoose');
const { Booking } = require('../models');
const { _inMemoryBookings } = require('./bookingService');
const { broadcastQueueUpdate } = require('../socket/queue.socket');
const logger = require('../utils/logger');

const procurementService = {
  /**
   * Record quality inspection (grade, moisture) for a checked-in booking
   */
  recordInspection: async ({ bookingId, grade, moisturePercentage, inspectorNotes }, io) => {
    if (!bookingId) {
      throw new Error('bookingId is required for recording inspection');
    }

    let booking = null;
    try {
      if (mongoose.connection.readyState === 1) {
        booking = await Booking.findById(bookingId);
      } else if (_inMemoryBookings.has(bookingId.toString())) {
        booking = _inMemoryBookings.get(bookingId.toString());
      }
    } catch (e) {
      if (_inMemoryBookings.has(bookingId.toString())) {
        booking = _inMemoryBookings.get(bookingId.toString());
      }
    }

    if (!booking) {
      throw new Error(`Booking with ID '${bookingId}' not found`);
    }

    if (booking.status === 'CANCELLED') {
      throw new Error(`Cannot inspect booking '${bookingId}' because it is CANCELLED`);
    }

    const updatePayload = {
      grade: grade || 'Grade A',
      moisturePercentage: moisturePercentage !== undefined ? Number(moisturePercentage) : 12.0,
      inspectorNotes: inspectorNotes || 'Quality verified at inspection desk',
      status: 'INSPECTED',
      updatedAt: new Date()
    };

    try {
      if (mongoose.connection.readyState === 1) {
        booking = await Booking.findByIdAndUpdate(
          bookingId,
          updatePayload,
          { new: true, runValidators: true }
        );
      } else {
        booking = { ...booking, ...updatePayload };
        _inMemoryBookings.set(bookingId.toString(), booking);
      }
    } catch (err) {
      logger.warn(`Database update fallback for inspection: ${err.message}`);
      booking = { ...booking, ...updatePayload };
      _inMemoryBookings.set(bookingId.toString(), booking);
    }

    // Broadcast live Socket.IO update (emits queue:update to room centre_<centreId>)
    const targetCentreId = booking.centreId?._id ? booking.centreId._id.toString() : (booking.centreId ? booking.centreId.toString() : null);
    if (io && targetCentreId) {
      broadcastQueueUpdate(io, targetCentreId, {
        bookingId: booking._id || bookingId,
        status: booking.status,
        grade: booking.grade,
        moisturePercentage: booking.moisturePercentage
      });
    }

    return booking;
  },

  /**
   * Record weighbridge gross, tare, and net weights for an inspected booking
   */
  recordWeight: async ({ bookingId, grossWeight, tareWeight, netWeight, weighbridgeId }, io) => {
    if (!bookingId) {
      throw new Error('bookingId is required for recording weight');
    }

    let booking = null;
    try {
      if (mongoose.connection.readyState === 1) {
        booking = await Booking.findById(bookingId);
      } else if (_inMemoryBookings.has(bookingId.toString())) {
        booking = _inMemoryBookings.get(bookingId.toString());
      }
    } catch (e) {
      if (_inMemoryBookings.has(bookingId.toString())) {
        booking = _inMemoryBookings.get(bookingId.toString());
      }
    }

    if (!booking) {
      throw new Error(`Booking with ID '${bookingId}' not found`);
    }

    if (booking.status === 'CANCELLED') {
      throw new Error(`Cannot record weight for booking '${bookingId}' because it is CANCELLED`);
    }

    const calculatedNet = netWeight !== undefined ? Number(netWeight) : Math.max(0, Number(grossWeight || 0) - Number(tareWeight || 0));

    const updatePayload = {
      grossWeight: Number(grossWeight || 0),
      tareWeight: Number(tareWeight || 0),
      netWeight: calculatedNet,
      weighbridgeId: weighbridgeId || 'WB-01',
      status: 'WEIGHED_READY_FOR_AUCTION',
      updatedAt: new Date()
    };

    try {
      if (mongoose.connection.readyState === 1) {
        booking = await Booking.findByIdAndUpdate(
          bookingId,
          updatePayload,
          { new: true, runValidators: true }
        );
      } else {
        booking = { ...booking, ...updatePayload };
        _inMemoryBookings.set(bookingId.toString(), booking);
      }
    } catch (err) {
      logger.warn(`Database update fallback for weight: ${err.message}`);
      booking = { ...booking, ...updatePayload };
      _inMemoryBookings.set(bookingId.toString(), booking);
    }

    // Broadcast live Socket.IO update (emits queue:update to room centre_<centreId>)
    const targetCentreId = booking.centreId?._id ? booking.centreId._id.toString() : (booking.centreId ? booking.centreId.toString() : null);
    if (io && targetCentreId) {
      broadcastQueueUpdate(io, targetCentreId, {
        bookingId: booking._id || bookingId,
        status: booking.status,
        grossWeight: booking.grossWeight,
        tareWeight: booking.tareWeight,
        netWeight: booking.netWeight
      });
    }

    return booking;
  }
};

module.exports = procurementService;
