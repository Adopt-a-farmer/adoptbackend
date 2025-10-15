const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');
const {
  uploadSingleImage,
  uploadMultipleImages,
  uploadSingleVideo,
  deleteUploadedFile,
  getUploadSignature,
  uploadProfileImage,
  uploadExpertDocuments,
  uploadRegistrationDocuments
} = require('../controllers/uploadController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// Get OS temp directory and ensure it exists
const tempDir = os.tmpdir();
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, tempDir);
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
    'video/mp4', 'video/mov', 'video/avi', 'video/mkv',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
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

// Create a flexible upload that accepts multiple field names
const registrationUpload = (req, res, next) => {
  // Try to determine which field name is being used
  const uploadMiddleware = upload.fields([
    { name: 'documents', maxCount: 10 },
    { name: 'images', maxCount: 10 },
    { name: 'certificates', maxCount: 10 },
    { name: 'profilePicture', maxCount: 1 }
  ]);
  
  uploadMiddleware(req, res, (err) => {
    if (err) {
      return next(err);
    }
    // Normalize the files to req.files array for backward compatibility
    if (req.files) {
      const allFiles = [];
      Object.keys(req.files).forEach(fieldName => {
        allFiles.push(...req.files[fieldName]);
      });
      req.files = allFiles;
    }
    next();
  });
};

// Public route for registration documents (no auth required)
router.post('/registration-documents', registrationUpload, uploadRegistrationDocuments);

// All other upload routes require authentication
router.use(protect);

// Image upload routes
router.post('/single', upload.single('image'), uploadSingleImage); // Add the missing /single route
router.post('/image', upload.single('image'), uploadSingleImage);
router.post('/profile-image', upload.single('image'), uploadProfileImage);
router.post('/images', upload.array('images', 10), uploadMultipleImages);

// Expert document upload route
router.post('/expert-documents', authorize(['expert']), upload.array('documents', 5), uploadExpertDocuments);

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