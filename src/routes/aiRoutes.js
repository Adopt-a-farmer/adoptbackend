const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  getFarmingAdvice,
  getImpactReport,
  getYieldPrediction,
  getOnboardingGuide,
  getComplianceReport,
  chatWithAI
} = require('../controllers/aiController');

// All AI routes require authentication
router.use(protect);

// @route   POST /api/ai/farming-advice
// @desc    Get AI-powered farming advice
// @access  Private
router.post('/farming-advice', getFarmingAdvice);

// @route   POST /api/ai/impact-report
// @desc    Generate impact report
// @access  Private
router.post('/impact-report', getImpactReport);

// @route   POST /api/ai/predict-yield
// @desc    Predict crop yield
// @access  Private
router.post('/predict-yield', getYieldPrediction);

// @route   POST /api/ai/onboarding-guide
// @desc    Generate onboarding guide
// @access  Private
router.post('/onboarding-guide', getOnboardingGuide);

// @route   POST /api/ai/compliance-report
// @desc    Generate EUDR compliance report
// @access  Private
router.post('/compliance-report', getComplianceReport);

// @route   POST /api/ai/chat
// @desc    Chat with AI assistant
// @access  Private
router.post('/chat', chatWithAI);

module.exports = router;
