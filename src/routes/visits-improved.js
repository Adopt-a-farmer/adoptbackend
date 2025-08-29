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

// Public availability check
router.get('/farmer/:farmerId/availability', getFarmerAvailability);

// Visit routes (protected)
router.get('/', protect, getFarmVisits);
router.get('/stats', protect, getVisitStats);

// Adopter can schedule visits
router.post('/', protect, authorize('adopter'), scheduleFarmVisit);

// Both farmer and adopter can view visit details
router.get('/:id', protect, getFarmVisit);

// Farmer can update visit status, adopter can add feedback
router.put('/:id/status', protect, updateVisitStatus);
router.post('/:id/feedback', protect, authorize('adopter'), addVisitFeedback);

// Farmer availability management (farmer only)
router.get('/availability', protect, authorize('farmer'), getAvailability);
router.post('/availability', protect, authorize('farmer'), setFarmerAvailability);

// Bulk availability operations for farmers
router.delete('/availability', protect, authorize('farmer'), async (req, res) => {
  try {
    const { date } = req.body;
    const userId = req.user._id;
    
    const FarmerProfile = require('../models/FarmerProfile');
    const FarmerAvailability = require('../models/FarmerAvailability');
    
    const farmer = await FarmerProfile.findOne({ user: userId });
    if (!farmer) {
      return res.status(404).json({
        success: false,
        message: 'Farmer profile not found'
      });
    }

    if (date) {
      // Delete specific date
      await FarmerAvailability.findOneAndDelete({
        farmer: farmer._id,
        date: new Date(date).toISOString().slice(0, 10)
      });
    } else {
      // Delete all future availability
      const today = new Date().toISOString().slice(0, 10);
      await FarmerAvailability.deleteMany({
        farmer: farmer._id,
        date: { $gte: today }
      });
    }

    res.json({
      success: true,
      message: date ? `Availability cleared for ${date}` : 'All future availability cleared'
    });
  } catch (error) {
    console.error('Delete availability error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;