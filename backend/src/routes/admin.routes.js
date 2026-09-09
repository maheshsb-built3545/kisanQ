const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { checkRole } = require('../middleware/rbac.middleware');

// GET /api/admin/dashboard-stats (Protected for district_admin / supervisor roles)
router.get(
  '/dashboard-stats',
  authenticate,
  checkRole('district_admin', 'supervisor', 'operator', 'auditor'),
  adminController.getDashboardStats
);

module.exports = router;
