const queueService = require('../services/queueService');
const { successResponse, errorResponse } = require('../utils/apiResponse');

const queueController = {
  getLiveQueue: async (req, res) => {
    try {
      const { centreId } = req.params;
      const result = await queueService.getLiveQueue(centreId);
      return successResponse(res, result, 'Live queue endpoint initialized');
    } catch (error) {
      return errorResponse(res, error.message);
    }
  },
  generateToken: async (req, res) => {
    try {
      const { bookingId } = req.body;
      const result = await queueService.generateToken(bookingId);
      return successResponse(res, result, 'Token generation endpoint initialized', 201);
    } catch (error) {
      return errorResponse(res, error.message);
    }
  }
};

module.exports = queueController;
