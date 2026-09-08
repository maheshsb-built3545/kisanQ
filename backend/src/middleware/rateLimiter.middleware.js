const rateLimit = require('express-rate-limit');

/**
 * OTP Request Rate Limiter
 * Maximum 5 OTP requests per 15 minutes per IP
 */
const otpRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 OTP requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many OTP requests from this IP. Please try again after 15 minutes.',
    timestamp: new Date().toISOString()
  }
});

/**
 * Staff Login Rate Limiter
 * Maximum 10 login attempts per 15 minutes per IP
 */
const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many login attempts from this IP. Please try again after 15 minutes.',
    timestamp: new Date().toISOString()
  }
});

module.exports = {
  otpRateLimiter,
  loginRateLimiter
};
