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
// Place specific routes before parametric routes
router.post('/', protect, authorize('adopter'), scheduleFarmVisit);
router.put('/:id/status', protect, updateVisitStatus);
router.post('/:id/feedback', protect, authorize('adopter'), addVisitFeedback);

// Availability routes
router.get('/farmer/:farmerId/availability', getFarmerAvailability);
router.get('/availability', protect, authorize('farmer'), getAvailability);
router.post('/availability', protect, authorize('farmer'), setFarmerAvailability);

// Parametric route must come last to avoid conflicts with '/availability'
router.get('/:id', protect, getFarmVisit);

module.exports = router;