const authService = require('../services/authService');
const { successResponse, errorResponse } = require('../utils/apiResponse');

const authController = {
  /**
   * Request OTP for Farmer
   */
  requestFarmerOtp: async (req, res) => {
    try {
      const { phone, name, preferredLanguage, registeredVia } = req.body;
      const result = await authService.requestFarmerOtp({ phone, name, preferredLanguage, registeredVia });
      return successResponse(res, result, 'OTP sent successfully');
    } catch (error) {
      return errorResponse(res, error.message, 400);
    }
  },

  /**
   * Verify Farmer OTP and login/register
   */
  verifyFarmerOtp: async (req, res) => {
    try {
      const { phone, otp, name, preferredLanguage, registeredVia } = req.body;
      const result = await authService.verifyFarmerOtp({ phone, otp, name, preferredLanguage, registeredVia });
      return successResponse(res, result, 'Farmer authenticated successfully');
    } catch (error) {
      return errorResponse(res, error.message, 400);
    }
  },

  /**
   * Staff login via password
   */
  staffLogin: async (req, res) => {
    try {
      const { name, password } = req.body;
      const result = await authService.staffLogin({ name, password });
      return successResponse(res, result, 'Staff authenticated successfully');
    } catch (error) {
      return errorResponse(res, error.message, 401);
    }
  },

  /**
   * Staff register / onboarding
   */
  staffRegister: async (req, res) => {
    try {
      const { name, role, centreId, password } = req.body;
      const result = await authService.staffRegister({ name, role, centreId, password });
      return successResponse(res, result, 'Staff user registered successfully', 201);
    } catch (error) {
      return errorResponse(res, error.message, 400);
    }
  },

  /**
   * Get current authenticated user profile
   */
  getMe: async (req, res) => {
    try {
      return successResponse(res, { user: req.user }, 'Current user profile fetched');
    } catch (error) {
      return errorResponse(res, error.message, 500);
    }
  }
};

module.exports = authController;
