const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { checkRole } = require('../middleware/rbac.middleware');
const { otpRateLimiter, loginRateLimiter } = require('../middleware/rateLimiter.middleware');
const { successResponse } = require('../utils/apiResponse');

// Farmer authentication endpoints
router.post('/farmer/request-otp', otpRateLimiter, authController.requestFarmerOtp);
router.post('/farmer/verify-otp', otpRateLimiter, authController.verifyFarmerOtp);

// Staff authentication endpoints
router.post('/staff/login', loginRateLimiter, authController.staffLogin);
router.post('/staff/register', authController.staffRegister);

// Current user profile check (Protected)
router.get('/me', authenticate, authController.getMe);

// RBAC test endpoints for automated testing and verification
router.get('/test-supervisor-guard', authenticate, checkRole('supervisor', 'district_admin'), (req, res) => {
  return successResponse(res, { role: req.user.role }, 'Supervisor authorization check passed');
});

router.get('/test-farmer-guard', authenticate, checkRole('farmer'), (req, res) => {
  return successResponse(res, { role: req.user.role }, 'Farmer authorization check passed');
});

module.exports = router;
