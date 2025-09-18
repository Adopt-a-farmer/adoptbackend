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
const {
  sendOTP,
  verifyOTP,
  completeSignup,
  resendOTP,
  testEmail,
  testDatabase
} = require('../controllers/otpController');
const { protect } = require('../middleware/auth');
const {
  validateRegister,
  validateLogin,
  validatePasswordChange,
  validate
} = require('../middleware/validation');
const { debugExpertUsers, fixUserRole } = require('../utils/debugExpertUsers');
const { debugSpecificUser } = require('../utils/debugUserRole');
const { checkVerificationStatus, getVerificationStatus } = require('../middleware/verification');

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
router.get('/verification-status', protect, checkVerificationStatus, getVerificationStatus);
router.get('/debug', protect, (req, res) => {
  console.log('🔍 Debug endpoint called');
  console.log('User data:', {
    id: req.user._id,
    email: req.user.email,
    role: req.user.role,
    firstName: req.user.firstName,
    lastName: req.user.lastName,
    isActive: req.user.isActive,
    createdAt: req.user.createdAt
  });
  
  res.json({
    success: true,
    data: {
      user: {
        id: req.user._id,
        email: req.user.email,
        role: req.user.role,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        isActive: req.user.isActive,
        createdAt: req.user.createdAt
      },
      isExpert: req.user.role === 'expert',
      canAccessExpertRoutes: ['expert'].includes(req.user.role)
    }
  });
});

// Debug routes for development
router.get('/debug-experts', async (req, res) => {
  try {
    const result = await debugExpertUsers();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/fix-user-role', async (req, res) => {
  try {
    const { email, role } = req.body;
    if (!email || !role) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email and role are required' 
      });
    }
    
    const result = await fixUserRole(email, role);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/debug-user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    console.log(`🔍 Debugging specific user: ${userId}`);
    
    const result = await debugSpecificUser(userId);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('❌ Error in debug-user route:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/me', protect, updateProfile);
router.post('/logout', protect, logout);
router.put('/change-password', protect, validatePasswordChange, validate, changePassword);

// OTP routes for new signup flow
router.post('/send-otp', sendOTP);
router.post('/verify-otp', verifyOTP);
router.post('/resend-otp', resendOTP);
router.post('/complete-signup', completeSignup);

// Test email configuration (development only)
if (process.env.NODE_ENV !== 'production') {
  router.get('/test-email', testEmail);
  router.get('/test-database', testDatabase);
}

module.exports = router;