const authService = require('../services/authService');
const { successResponse, errorResponse } = require('../utils/apiResponse');

const authController = {
  login: async (req, res) => {
    try {
      const result = await authService.login(req.body);
      return successResponse(res, result, 'Auth login endpoint initialized');
    } catch (error) {
      return errorResponse(res, error.message);
    }
  },
  verifyOtp: async (req, res) => {
    try {
      const { phone, otp } = req.body;
      const result = await authService.verifyOtp(phone, otp);
      return successResponse(res, result, 'Auth OTP verification endpoint initialized');
    } catch (error) {
      return errorResponse(res, error.message);
    }
  }
};

module.exports = authController;
