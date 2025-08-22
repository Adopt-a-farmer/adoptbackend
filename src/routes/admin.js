const express = require('express');
const router = express.Router();
const {
  getDashboardStats,
  getAllUsers,
  updateUserStatus,
  getAllFarmers,
  verifyFarmer,
  getAllPayments,
  getAnalytics
} = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/auth');

// Apply admin authorization to all routes
router.use(protect, authorize(['admin']));

// Dashboard routes
router.get('/dashboard', getDashboardStats);
router.get('/analytics', getAnalytics);

// User management routes
router.get('/users', getAllUsers);
router.put('/users/:id/status', updateUserStatus);

// Farmer management routes
router.get('/farmers', getAllFarmers);
router.put('/farmers/:id/verify', verifyFarmer);

// Payment management routes
router.get('/payments', getAllPayments);

module.exports = router;