const farmerService = require('../services/farmerService');
const { successResponse, errorResponse } = require('../utils/apiResponse');

const farmerController = {
  /**
   * Update farmer's pickup location
   * PATCH /api/farmers/pickup-location
   */
  updatePickupLocation: async (req, res) => {
    try {
      const { latitude, longitude, address } = req.body;
      const farmerId = req.user?.id || req.user?._id;
      const phone = req.user?.phone || req.body?.phone;

      if (!latitude || !longitude) {
        return errorResponse(res, 'Latitude and longitude are required', 400);
      }

      const result = await farmerService.updatePickupLocation({
        farmerId,
        phone,
        latitude,
        longitude,
        address
      });

      return successResponse(res, result, 'Pickup location updated successfully');
    } catch (error) {
      return errorResponse(res, error.message, error.statusCode || 400);
    }
  }
};

module.exports = farmerController;
