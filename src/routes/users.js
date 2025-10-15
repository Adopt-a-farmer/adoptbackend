const express = require('express');
const multer = require('multer');
const os = require('os');
const fs = require('fs');
const {
  getProfile,
  updateProfile,
  uploadAvatar,
  deleteAccount,
  getUserById
} = require('../controllers/userController');
const { protect } = require('../middleware/auth');
const { validateProfileUpdate, validate } = require('../middleware/validation');

const router = express.Router();

// Configure multer for file uploads
const tempDir = os.tmpdir();
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, tempDir); // Use OS temp directory
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
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// Protected routes
router.get('/profile', protect, getProfile);
router.put('/profile', protect, validateProfileUpdate, validate, updateProfile);
router.post('/avatar', protect, upload.single('avatar'), uploadAvatar);
router.delete('/account', protect, deleteAccount);

// Public routes
router.get('/:id', getUserById);

module.exports = router;