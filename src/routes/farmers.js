const express = require('express');
const multer = require('multer');
const {
  getFarmers,
  getFarmerById,
  getCurrentFarmerProfile,
  updateFarmerProfile,
  uploadFarmImages,
  uploadFarmVideos,
  getFarmerDashboard,
  getFarmerAdopters,
  deleteFarmMedia,
  getFarmerReports,
  getFarmerSettings,
  updateFarmerSettings,
  changeFarmerPassword,
  getFarmerExperts
} = require('../controllers/farmerController');
const { protect, authorize } = require('../middleware/auth');
const { validateFarmerProfile, validateFarmerProfilePartial, validate } = require('../middleware/validation');
const { cleanupFarmerProfiles } = require('../utils/cleanupFarmerProfiles');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, '/tmp/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + '.' + file.originalname.split('.').pop());
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024 // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = process.env.ALLOWED_FILE_TYPES?.split(',') || [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'video/mp4', 'video/mov'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed'), false);
    }
  }
});

// Public routes
router.get('/', getFarmers);

// Protected farmer routes - MUST come before parametric routes
router.get('/me', protect, authorize('farmer'), getCurrentFarmerProfile);
router.get('/profile', protect, authorize('farmer'), getCurrentFarmerProfile);
router.put('/profile', protect, authorize('farmer'), validateFarmerProfile, validate, updateFarmerProfile);
router.patch('/profile', protect, authorize('farmer'), validateFarmerProfilePartial, validate, updateFarmerProfile);
router.get('/dashboard', protect, authorize('farmer'), getFarmerDashboard);
router.get('/adopters', protect, authorize('farmer'), getFarmerAdopters);
router.get('/reports', protect, authorize('farmer'), getFarmerReports);
router.get('/settings', protect, authorize('farmer'), getFarmerSettings);
router.put('/settings', protect, authorize('farmer'), updateFarmerSettings);
router.get('/experts', protect, authorize('farmer'), getFarmerExperts);

// Message/conversation routes for farmers
router.get('/conversations', protect, authorize('farmer'), async (req, res) => {
  // Delegate to message controller
  const { getConversations } = require('../controllers/messageController');
  getConversations(req, res);
});

router.get('/messages/unread-count', protect, authorize('farmer'), async (req, res) => {
  // Delegate to message controller
  const { getUnreadCount } = require('../controllers/messageController');
  getUnreadCount(req, res);
});

// Wallet endpoints for farmers (delegate to wallet controller)
router.get('/wallet/balance', protect, authorize('farmer'), async (req, res) => {
  const { getWalletBalance } = require('../controllers/walletController');
  getWalletBalance(req, res);
});

router.get('/wallet/transactions', protect, authorize('farmer'), async (req, res) => {
  const { getWalletTransactions } = require('../controllers/walletController');
  getWalletTransactions(req, res);
});

// Visit management endpoints for farmers
router.get('/visits', protect, authorize('farmer'), async (req, res) => {
  const { getFarmVisits } = require('../controllers/visitController');
  getFarmVisits(req, res);
});

router.get('/visits/stats', protect, authorize('farmer'), async (req, res) => {
  const { getVisitStats } = require('../controllers/visitController');
  getVisitStats(req, res);
});

router.get('/availability', protect, authorize('farmer'), async (req, res) => {
  const { getAvailability } = require('../controllers/visitController');
  getAvailability(req, res);
});

router.post('/availability', protect, authorize('farmer'), async (req, res) => {
  const { setFarmerAvailability } = require('../controllers/visitController');
  setFarmerAvailability(req, res);
});

// Settings and account management routes
router.get('/settings', protect, authorize('farmer'), getFarmerSettings);
router.put('/settings', protect, authorize('farmer'), updateFarmerSettings);
router.put('/change-password', protect, authorize('farmer'), changeFarmerPassword);

// Admin cleanup route
router.post('/cleanup-profiles', protect, authorize('admin'), async (req, res) => {
  try {
    const result = await cleanupFarmerProfiles();
    res.json({
      success: result.success,
      message: result.success ? `Cleaned up ${result.updated} profiles` : 'Cleanup failed',
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error during cleanup',
      error: error.message
    });
  }
});

// Media upload routes
router.post('/images', protect, authorize('farmer'), upload.array('images', 10), uploadFarmImages);
router.post('/videos', protect, authorize('farmer'), upload.single('video'), uploadFarmVideos);
router.delete('/media/:publicId', protect, authorize('farmer'), deleteFarmMedia);

// Parametric routes - MUST come last
router.get('/:id', getFarmerById);

module.exports = router;