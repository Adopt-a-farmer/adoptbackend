const express = require('express');
const router = express.Router();
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

// Knowledge Hub stats
router.get('/stats', getKnowledgeStats);

// Knowledge Articles routes
router.get('/articles', getKnowledgeArticles);
router.get('/articles/:id', getKnowledgeArticle);
router.post('/articles', protect, authorize(['expert', 'admin', 'farmer']), createKnowledgeArticle);
router.post('/articles/:id/like', protect, toggleArticleLike);

// Farming Calendar routes
router.get('/calendar', getFarmingCalendar);
router.post('/calendar', protect, authorize(['expert', 'admin']), createCalendarEntry);

// Farming Videos routes
router.get('/videos', getFarmingVideos);

module.exports = router;