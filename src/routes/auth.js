const express = require('express');
const rateLimit = require('express-rate-limit');
const {
  register,
  login,
  getMe,
  refreshToken,
  logout,
  changePassword,
  updateProfile
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const {
  validateRegister,
  validateLogin,
  validatePasswordChange,
  validate
} = require('../middleware/validation');

const router = express.Router();

// Rate limiting for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs for auth routes
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Public routes
router.post('/register', authLimiter, validateRegister, validate, register);
router.post('/login', authLimiter, validateLogin, validate, login);
router.post('/refresh', refreshToken);

// Protected routes
router.get('/me', protect, getMe);
router.put('/me', protect, updateProfile);
router.post('/logout', protect, logout);
router.put('/change-password', protect, validatePasswordChange, validate, changePassword);

module.exports = router;