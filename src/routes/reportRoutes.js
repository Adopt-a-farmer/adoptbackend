const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  generateFarmerReport,
  generateAdopterReport,
  generateExpertReport,
  generateAdminReport
} = require('../controllers/reportController');

// @route   GET /api/reports/farmer
// @desc    Generate farmer report
// @access  Private (Farmer only)
router.get('/farmer', protect, authorize('farmer'), generateFarmerReport);

// @route   GET /api/reports/adopter
// @desc    Generate adopter report
// @access  Private (Adopter only)
router.get('/adopter', protect, authorize('adopter'), generateAdopterReport);

// @route   GET /api/reports/expert
// @desc    Generate expert report
// @access  Private (Expert only)
router.get('/expert', protect, authorize('expert'), generateExpertReport);

// @route   GET /api/reports/admin
// @desc    Generate admin report
// @access  Private (Admin only)
router.get('/admin', protect, authorize('admin'), generateAdminReport);

module.exports = router;
