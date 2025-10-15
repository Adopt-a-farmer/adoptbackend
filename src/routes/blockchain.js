const express = require('express');
const router = express.Router();
const {
  getBlockchainStatus,
  generateWallet,
  registerFarmerOnBlockchain,
  verifyFarmerOnBlockchain,
  getFarmerVerificationStatus,
  registerPlantingOnBlockchain,
  recordGerminationOnBlockchain,
  declareMaturityOnBlockchain,
  recordHarvestOnBlockchain,
  recordPackagingOnBlockchain,
  addQualityAssuranceOnBlockchain,
  getCropLifecycleStatus,
  getProductHistory,
  getUserTransactions
} = require('../controllers/blockchainController');

const { protect, authorize } = require('../middleware/auth');

// Public routes
router.get('/product/:productId', getProductHistory);

// Protected routes - All authenticated users
router.get('/status', protect, getBlockchainStatus);
router.get('/transactions', protect, getUserTransactions);
router.get('/crop-lifecycle', protect, getCropLifecycleStatus);

// Farmer routes
router.post('/generate-wallet', protect, generateWallet);
router.post('/register-planting', protect, authorize('farmer'), registerPlantingOnBlockchain);
router.post('/record-germination', protect, recordGerminationOnBlockchain);
router.post('/declare-maturity', protect, authorize('farmer'), declareMaturityOnBlockchain);
router.post('/record-harvest', protect, recordHarvestOnBlockchain);
router.post('/record-packaging', protect, recordPackagingOnBlockchain);
router.post('/add-quality-assurance', protect, addQualityAssuranceOnBlockchain);
router.get('/farmer/:farmerId/verification', protect, getFarmerVerificationStatus);

// Admin routes
router.post('/register-farmer', protect, authorize('admin'), registerFarmerOnBlockchain);
router.post('/verify-farmer', protect, authorize('admin'), verifyFarmerOnBlockchain);

module.exports = router;
