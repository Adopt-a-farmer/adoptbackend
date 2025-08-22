const express = require('express');
const multer = require('multer');
const {
  uploadSingleImage,
  uploadMultipleImages,
  uploadSingleVideo,
  deleteUploadedFile,
  getUploadSignature
} = require('../controllers/uploadController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, '/tmp/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = file.originalname.split('.').pop();
    cb(null, file.fieldname + '-' + uniqueSuffix + '.' + extension);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = process.env.ALLOWED_FILE_TYPES?.split(',') || [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'video/mp4', 'video/mov', 'video/avi', 'video/mkv'
  ];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${file.mimetype} not allowed`), false);
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 50 * 1024 * 1024 // 50MB default
  },
  fileFilter: fileFilter
});

// All upload routes require authentication
router.use(protect);

// Image upload routes
router.post('/image', upload.single('image'), uploadSingleImage);
router.post('/images', upload.array('images', 10), uploadMultipleImages);

// Video upload route
router.post('/video', upload.single('video'), uploadSingleVideo);

// File deletion route
router.delete('/:publicId', deleteUploadedFile);

// Get upload signature for direct client uploads
router.post('/signature', getUploadSignature);

// Error handling middleware for multer
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File too large'
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: 'Too many files'
      });
    }
  }
  
  if (error.message.includes('File type') && error.message.includes('not allowed')) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }

  next(error);
});

module.exports = router;