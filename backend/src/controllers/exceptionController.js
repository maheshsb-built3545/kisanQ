const exceptionService = require('../services/exceptionService');
const { successResponse, errorResponse } = require('../utils/apiResponse');

const exceptionController = {
  reportDelay: async (req, res) => {
    try {
      const result = await exceptionService.reportDelay(req.body);
      return successResponse(res, result, 'Delay reporting endpoint initialized', 201);
    } catch (error) {
      return errorResponse(res, error.message);
    }
  },
  emergencyReschedule: async (req, res) => {
    try {
      const { bookingId } = req.params;
      const result = await exceptionService.emergencyReschedule(bookingId, req.body);
      return successResponse(res, result, 'Emergency rescheduling endpoint initialized');
    } catch (error) {
      return errorResponse(res, error.message);
    }
  }
};

module.exports = exceptionController;
