const express = require('express');
const {
  getAdopterDashboard,
  updateAdopterProfile,
  getAdoptedFarmers,
  adoptFarmer,
  adoptFarmerWithPayment,
  getPaymentHistory,
  getVisits,
  getInvestmentAnalytics,
  getMentoringFarmers,
  getMentoringConversations,
  createMentorship,
  getAdopterConversations,
  checkAdoptionStatus,
  getAdopterFarmerConversations
} = require('../controllers/adopterController');
const {
  makeContribution,
  getContributionHistory
} = require('../controllers/contributionController');
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
router.post('/adopt-with-payment', adoptFarmerWithPayment);
router.get('/payments', getPaymentHistory);
router.get('/visits', getVisits);
router.get('/analytics', getInvestmentAnalytics);
router.get('/adoptions/check/:farmerId', checkAdoptionStatus);
router.get('/conversations/farmers', getAdopterFarmerConversations);

// Contribution routes
router.post('/contribute', makeContribution);
router.get('/contributions', getContributionHistory);

// Mentoring routes
router.get('/mentoring', getMentoringFarmers);
router.post('/mentoring', createMentorship);
router.get('/mentoring/conversations', getMentoringConversations);

// Conversation routes for messaging
router.get('/conversations', getAdopterConversations);

module.exports = router;