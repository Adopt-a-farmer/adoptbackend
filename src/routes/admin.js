const express = require('express');
const router = express.Router();
const {
  getDashboardStats,
  getAllUsers,
  updateUserStatus,
  getAllFarmers,
  getFarmerById,
  verifyFarmer,
  getAllPayments,
  getAnalytics,
  getAllAdopters,
  getAllAdoptersWithFarmers,
  getAllExperts,
  verifyExpert,
  getAllAllocations,
  getAllMessages,
  getFarmerAvailability,
  createUser,
  verifyUser,
  getAllForVerification
} = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/auth');

// Apply admin authorization to all routes
router.use(protect, authorize(['admin']));

// Dashboard routes
router.get('/dashboard', getDashboardStats);
router.get('/analytics', getAnalytics);

// Verification management route
router.get('/verification', getAllForVerification);

// User management routes
router.get('/users', getAllUsers);
router.post('/users', createUser);
router.put('/users/:id/status', updateUserStatus);
router.put('/users/:id/verify', verifyUser);

// Farmer management routes
router.get('/farmers', getAllFarmers);
router.get('/farmers/:id', getFarmerById);
router.put('/farmers/:id/verify', verifyFarmer);

// Adopter management routes
router.get('/adopters', getAllAdoptersWithFarmers);
router.get('/adopters-simple', getAllAdopters);

// Expert management routes
router.get('/experts', getAllExperts);
router.put('/experts/:id/verify', verifyExpert);

// Allocation management routes
router.get('/allocations', getAllAllocations);

// Message monitoring routes
router.get('/messages', getAllMessages);

// Farmer availability routes
router.get('/farmer-availability', getFarmerAvailability);

// Payment management routes
router.get('/payments', getAllPayments);

module.exports = router;