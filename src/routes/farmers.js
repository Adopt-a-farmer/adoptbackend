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
  deleteFarmMedia
} = require('../controllers/farmerController');
const { protect, authorize } = require('../middleware/auth');
const { validateFarmerProfile, validateFarmerProfilePartial, validate } = require('../middleware/validation');

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

// Media upload routes
router.post('/images', protect, authorize('farmer'), upload.array('images', 10), uploadFarmImages);
router.post('/videos', protect, authorize('farmer'), upload.single('video'), uploadFarmVideos);
router.delete('/media/:publicId', protect, authorize('farmer'), deleteFarmMedia);

// Parametric routes - MUST come last
router.get('/:id', getFarmerById);

module.exports = router;