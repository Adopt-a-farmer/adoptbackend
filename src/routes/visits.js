const express = require('express');
const router = express.Router();
const {
  getFarmVisits,
  getFarmVisit,
  scheduleFarmVisit,
  updateVisitStatus,
  addVisitFeedback,
  getFarmerAvailability,
  getAvailability,
  setFarmerAvailability,
  getVisitStats
} = require('../controllers/visitController');
const { protect, authorize } = require('../middleware/auth');

// Visit routes
router.get('/', protect, getFarmVisits);
router.get('/stats', protect, getVisitStats);

// Availability routes - MUST come before /:id route
router.get('/availability', protect, authorize('farmer'), (req, res, next) => {
  console.log('✅ GET /api/visits/availability route HIT!', req.query);
  getAvailability(req, res, next);
});
router.post('/availability', protect, authorize('farmer'), (req, res, next) => {
  console.log('✅ POST /api/visits/availability route HIT!', req.body);
  setFarmerAvailability(req, res, next);
});
router.get('/farmer/:farmerId/availability', getFarmerAvailability);

// Place specific routes before parametric routes
router.post('/', protect, authorize(['adopter', 'expert']), scheduleFarmVisit);
router.put('/:id/status', protect, updateVisitStatus);
router.post('/:id/feedback', protect, authorize(['adopter', 'expert']), addVisitFeedback);

// Parametric route MUST come last to avoid conflicts with '/availability'
router.get('/:id', protect, getFarmVisit);

module.exports = router;