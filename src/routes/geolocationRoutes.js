const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  addFarmGeolocation,
  getFarmGeolocation,
  validatePlotCoordinates,
  generateEUDRReport,
  getTraceabilityData
} = require('../controllers/geolocationController');

// All geolocation routes require authentication
router.use(protect);

// @route   POST /api/geolocation/farm
// @desc    Add or update farm geolocation
// @access  Private (Farmer)
router.post('/farm', addFarmGeolocation);

// @route   GET /api/geolocation/farm/:farmerId?
// @desc    Get farm geolocation data
// @access  Private
router.get('/farm/:farmerId?', getFarmGeolocation);

// @route   POST /api/geolocation/validate
// @desc    Validate plot coordinates
// @access  Private
router.post('/validate', validatePlotCoordinates);

// @route   POST /api/geolocation/eudr-report
// @desc    Generate EUDR compliance report
// @access  Private
router.post('/eudr-report', generateEUDRReport);

// @route   GET /api/geolocation/traceability
// @desc    Get all plots for traceability
// @access  Private (Admin/Exporter)
router.get('/traceability', getTraceabilityData);

module.exports = router;
