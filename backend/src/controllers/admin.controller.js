const adminService = require('../services/adminService');
const { successResponse, errorResponse } = require('../utils/apiResponse');

const adminController = {
  /**
   * GET /api/admin/dashboard-stats
   * Aggregated metrics for District Admin Command Center
   */
  getDashboardStats: async (req, res) => {
    try {
      const stats = await adminService.getDashboardStats();
      return successResponse(res, stats, 'District admin dashboard statistics retrieved successfully', 200);
    } catch (error) {
      return errorResponse(res, error.message || 'Failed to retrieve admin dashboard stats', 500);
    }
  }
};

module.exports = adminController;
