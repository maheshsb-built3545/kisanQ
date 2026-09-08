const centreService = require('../services/centreService');
const { successResponse, errorResponse } = require('../utils/apiResponse');

const centreController = {
  getAllCentres: async (req, res) => {
    try {
      const result = await centreService.getAllCentres(req.query);
      return successResponse(res, result, 'Centres list endpoint initialized');
    } catch (error) {
      return errorResponse(res, error.message);
    }
  },
  getCentreById: async (req, res) => {
    try {
      const { id } = req.params;
      const result = await centreService.getCentreById(id);
      return successResponse(res, result, 'Centre details endpoint initialized');
    } catch (error) {
      return errorResponse(res, error.message);
    }
  }
};

module.exports = centreController;
