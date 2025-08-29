const express = require('express');
const router = express.Router();
const {
  getExpertDashboard,
  getExpertArticles,
  updateExpertArticle,
  deleteExpertArticle,
  getExpertProfile,
  updateExpertProfile,
  getExpertMentorships,
  getInvestorFarmerRelationships,
  getExpertConversations,
  getExpertFarmVisits,
  createMentorship
} = require('../controllers/expertController');
const { protect, authorize } = require('../middleware/auth');
const { validate, validateProfileUpdate } = require('../middleware/validation');

// Debug middleware to log all expert route access
router.use((req, res, next) => {
  console.log(`🚀 Expert route accessed: ${req.method} ${req.path}`);
  console.log(`   Headers: Authorization present: ${!!req.headers.authorization}`);
  next();
});

// Apply expert authorization to all routes
router.use(protect);
router.use(authorize(['expert']));

// Dashboard route
router.get('/dashboard', getExpertDashboard);

// Profile routes
router.get('/profile', getExpertProfile);
router.put('/profile', validateProfileUpdate, validate, updateExpertProfile);

// Articles routes
router.get('/articles', getExpertArticles);
router.put('/articles/:id', updateExpertArticle);
router.delete('/articles/:id', deleteExpertArticle);

// Mentorship routes
router.get('/mentorships', getExpertMentorships);
router.post('/mentorships', createMentorship);

// Investor-farmer relationship oversight
router.get('/investors-farmers', getInvestorFarmerRelationships);

// Messaging routes
router.get('/conversations', getExpertConversations);

// Farm visits routes
router.get('/visits', getExpertFarmVisits);

module.exports = router;