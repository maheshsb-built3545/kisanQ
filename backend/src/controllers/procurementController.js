const procurementService = require('../services/procurementService');
const { successResponse, errorResponse } = require('../utils/apiResponse');

const procurementController = {
  recordInspection: async (req, res) => {
    try {
      const result = await procurementService.recordInspection(req.body);
      return successResponse(res, result, 'Inspection recording endpoint initialized', 201);
    } catch (error) {
      return errorResponse(res, error.message);
    }
  },
  recordWeight: async (req, res) => {
    try {
      const result = await procurementService.recordWeight(req.body);
      return successResponse(res, result, 'Weight recording endpoint initialized', 201);
    } catch (error) {
      return errorResponse(res, error.message);
    }
  }
};

module.exports = procurementController;
