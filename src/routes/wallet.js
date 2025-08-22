const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const {
  getWalletBalance,
  getWalletTransactions,
  requestWithdrawal,
  getWithdrawalRequests,
  updateWithdrawalStatus
} = require('../controllers/walletController');

const router = express.Router();

// All wallet routes require authentication
router.use(protect);

// @route   GET /api/wallet/balance
// @desc    Get farmer's wallet balance
// @access  Private (Farmer)
router.get('/balance', authorize(['farmer']), getWalletBalance);

// @route   GET /api/wallet/transactions
// @desc    Get farmer's wallet transactions
// @access  Private (Farmer)
router.get('/transactions', authorize(['farmer']), getWalletTransactions);

// @route   POST /api/wallet/withdraw
// @desc    Request withdrawal
// @access  Private (Farmer)
router.post('/withdraw', authorize(['farmer']), requestWithdrawal);

// @route   GET /api/wallet/withdrawals
// @desc    Get withdrawal requests
// @access  Private (Farmer)
router.get('/withdrawals', authorize(['farmer']), getWithdrawalRequests);

// @route   PATCH /api/wallet/withdrawals/:id
// @desc    Update withdrawal status (Admin only)
// @access  Private (Admin)
router.patch('/withdrawals/:id', authorize(['admin']), updateWithdrawalStatus);

module.exports = router;