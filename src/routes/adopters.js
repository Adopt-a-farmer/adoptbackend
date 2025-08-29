const express = require('express');
const {
  getAdopterDashboard,
  updateAdopterProfile,
  getAdoptedFarmers,
  adoptFarmer,
  getPaymentHistory,
  getVisits,
  getInvestmentAnalytics,
  getMentoringFarmers,
  getMentoringConversations,
  createMentorship
} = require('../controllers/adopterController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// All routes are protected and for adopters only
router.use(protect);
router.use(authorize('adopter'));

router.get('/dashboard', getAdopterDashboard);
router.get('/dashboard-stats', getAdopterDashboard); // Alias for frontend compatibility
router.get('/recent-updates', getAdopterDashboard); // Will return recent updates
router.post('/adopt', adoptFarmer); // Alias for frontend compatibility
router.put('/profile', updateAdopterProfile);
router.get('/adopted-farmers', getAdoptedFarmers);
router.post('/adopt-farmer', adoptFarmer);
router.get('/payments', getPaymentHistory);
router.get('/visits', getVisits);
router.get('/analytics', getInvestmentAnalytics);

// Mentoring routes
router.get('/mentoring', getMentoringFarmers);
router.post('/mentoring', createMentorship);
router.get('/mentoring/conversations', getMentoringConversations);

module.exports = router;