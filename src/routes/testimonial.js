const express = require('express');
const router = express.Router();
const multer = require('multer');
const os = require('os');
const { protect } = require('../middleware/auth');
const {
  createTestimonial,
  uploadTestimonialImages,
  getAllTestimonials,
  getTestimonial,
  getMyTestimonials,
  updateTestimonial,
  deleteTestimonial,
  toggleLike,
  addComment,
  deleteComment
} = require('../controllers/testimonialController');

// Multer configuration for image uploads
const upload = multer({
  dest: os.tmpdir(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB per file
    files: 5 // Maximum 5 files
  },
  fileFilter: (req, file, cb) => {
    // Accept images only
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'), false);
    }
    cb(null, true);
  }
});

// Public routes
router.get('/', protect, getAllTestimonials);
router.get('/my-testimonials', protect, getMyTestimonials);
router.get('/:id', protect, getTestimonial);

// Protected routes (farmers only for creation/editing)
router.post('/', protect, multer().none(), createTestimonial);
router.post('/upload-images', protect, upload.array('images', 5), uploadTestimonialImages);
router.put('/:id', protect, multer().none(), updateTestimonial);
router.delete('/:id', protect, deleteTestimonial);

// Interaction routes
router.post('/:id/like', protect, toggleLike);
router.post('/:id/comments', protect, multer().none(), addComment);
router.delete('/:id/comments/:commentId', protect, deleteComment);

module.exports = router;
