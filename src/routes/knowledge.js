const express = require('express');
const router = express.Router();
const multer = require('multer');
const {
  getKnowledgeArticles,
  getKnowledgeArticle,
  createKnowledgeArticle,
  toggleArticleLike,
  getFarmingCalendar,
  createCalendarEntry,
  getFarmingVideos,
  getKnowledgeStats
} = require('../controllers/knowledgeController');
const { protect, authorize } = require('../middleware/auth');

// Configure multer for article image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/articles');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'article-' + uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// Knowledge Hub stats
router.get('/stats', getKnowledgeStats);

// Knowledge Articles routes
router.get('/articles', getKnowledgeArticles);
router.get('/articles/:id', getKnowledgeArticle);
router.post('/articles', protect, authorize(['expert', 'admin', 'farmer']), upload.single('featuredImage'), createKnowledgeArticle);
router.post('/articles/:id/like', protect, toggleArticleLike);

// Farming Calendar routes
router.get('/calendar', getFarmingCalendar);
router.post('/calendar', protect, authorize(['expert', 'admin']), createCalendarEntry);

// Farming Videos routes
router.get('/videos', getFarmingVideos);

module.exports = router;