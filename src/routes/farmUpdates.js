const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const {
  getFarmUpdates,
  getFarmUpdatesByFarmerId,
  createFarmUpdate,
  updateFarmUpdate,
  deleteFarmUpdate,
  getFarmMedia,
  uploadFarmMedia,
  deleteFarmMedia
} = require('../controllers/farmUpdateController');

const router = express.Router();

// All routes require authentication
router.use(protect);

// @route   GET /api/farm-updates
// @desc    Get farmer's updates
// @access  Private (Farmer)
router.get('/', authorize('farmer'), getFarmUpdates);

// @route   GET /api/farm-updates/farmer/:farmerId
// @desc    Get farmer's updates by farmer ID (public)
// @access  Public
router.get('/farmer/:farmerId', getFarmUpdatesByFarmerId);

// @route   POST /api/farm-updates
// @desc    Create new farm update
// @access  Private (Farmer)
router.post('/', authorize('farmer'), createFarmUpdate);

// @route   PUT /api/farm-updates/:id
// @desc    Update farm update
// @access  Private (Farmer)
router.put('/:id', authorize('farmer'), updateFarmUpdate);

// @route   DELETE /api/farm-updates/:id
// @desc    Delete farm update
// @access  Private (Farmer)
router.delete('/:id', authorize('farmer'), deleteFarmUpdate);

// @route   GET /api/farm-updates/media
// @desc    Get farmer's media files
// @access  Private (Farmer)
router.get('/media', authorize('farmer'), getFarmMedia);

// @route   POST /api/farm-updates/media
// @desc    Upload farm media
// @access  Private (Farmer)
router.post('/media', authorize('farmer'), uploadFarmMedia);

// @route   DELETE /api/farm-updates/media/:id
// @desc    Delete farm media
// @access  Private (Farmer)
router.delete('/media/:id', authorize('farmer'), deleteFarmMedia);

module.exports = router;