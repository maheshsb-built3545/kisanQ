const bookingService = require('../services/bookingService');
const { successResponse, errorResponse } = require('../utils/apiResponse');

const bookingController = {
  createBooking: async (req, res) => {
    try {
      const result = await bookingService.createBooking(req.body);
      return successResponse(res, result, 'Booking creation endpoint initialized', 201);
    } catch (error) {
      return errorResponse(res, error.message);
    }
  },
  getAvailableSlots: async (req, res) => {
    try {
      const { centreId, date } = req.query;
      const result = await bookingService.getAvailableSlots(centreId, date);
      return successResponse(res, result, 'Available slots endpoint initialized');
    } catch (error) {
      return errorResponse(res, error.message);
    }
  }
};

module.exports = bookingController;
