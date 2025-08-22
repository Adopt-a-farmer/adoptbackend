const Payment = require('../models/Payment');
const User = require('../models/User');
const WithdrawalRequest = require('../models/WithdrawalRequest');
const FarmerProfile = require('../models/FarmerProfile');

// @desc    Get farmer's wallet balance
// @route   GET /api/wallet/balance
// @access  Private (Farmer)
const getWalletBalance = async (req, res) => {
  try {
    const userId = req.user._id;
    
    // Get farmer profile
    const farmer = await FarmerProfile.findOne({ user: userId });
    if (!farmer) {
      return res.status(404).json({
        success: false,
        message: 'Farmer profile not found'
      });
    }

    // Get all successful payments for this farmer
    const payments = await Payment.find({
      'metadata.farmerName': farmer.farmName,
      status: 'success'
    });

    // Get all withdrawal requests
    const withdrawals = await WithdrawalRequest.find({
      farmer: userId
    });

    // Calculate balances
    const totalEarnings = payments.reduce((sum, payment) => sum + payment.netAmount, 0);
    const totalWithdrawn = withdrawals
      .filter(w => w.status === 'completed')
      .reduce((sum, withdrawal) => sum + withdrawal.amount, 0);
    const pendingWithdrawals = withdrawals
      .filter(w => w.status === 'pending')
      .reduce((sum, withdrawal) => sum + withdrawal.amount, 0);
    
    const availableBalance = totalEarnings - totalWithdrawn - pendingWithdrawals;

    res.json({
      success: true,
      data: {
        total_earnings: totalEarnings,
        available_balance: Math.max(0, availableBalance),
        pending_balance: pendingWithdrawals,
        total_withdrawn: totalWithdrawn,
        currency: 'KES'
      }
    });
  } catch (error) {
    console.error('Get wallet balance error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get farmer's wallet transactions
// @route   GET /api/wallet/transactions
// @access  Private (Farmer)
const getWalletTransactions = async (req, res) => {
  try {
    const userId = req.user._id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    // Get farmer profile
    const farmer = await FarmerProfile.findOne({ user: userId });
    if (!farmer) {
      return res.status(404).json({
        success: false,
        message: 'Farmer profile not found'
      });
    }

    // Get payments (earnings)
    const payments = await Payment.find({
      'metadata.farmerName': farmer.farmName,
      status: 'success'
    })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

    // Get withdrawals
    const withdrawals = await WithdrawalRequest.find({
      farmer: userId
    })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

    // Combine and format transactions
    const transactions = [];

    // Add payment transactions
    payments.forEach(payment => {
      transactions.push({
        id: payment._id,
        type: 'earning',
        amount: payment.netAmount,
        description: `Payment from ${payment.metadata.adopterName || 'Adopter'}`,
        status: 'completed',
        date: payment.createdAt,
        reference: payment.reference
      });
    });

    // Add withdrawal transactions
    withdrawals.forEach(withdrawal => {
      transactions.push({
        id: withdrawal._id,
        type: 'withdrawal',
        amount: -withdrawal.amount,
        description: `Withdrawal to ${withdrawal.method === 'mpesa' ? 'M-Pesa' : 'Bank Account'}`,
        status: withdrawal.status,
        date: withdrawal.createdAt,
        reference: withdrawal.reference
      });
    });

    // Sort by date (newest first)
    transactions.sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json({
      success: true,
      data: transactions.slice(0, limit)
    });
  } catch (error) {
    console.error('Get wallet transactions error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Request withdrawal
// @route   POST /api/wallet/withdraw
// @access  Private (Farmer)
const requestWithdrawal = async (req, res) => {
  try {
    const userId = req.user._id;
    const { amount, method, account_details } = req.body;

    // Validate input
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid withdrawal amount'
      });
    }

    if (!method || !['mpesa', 'bank'].includes(method)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid withdrawal method'
      });
    }

    if (!account_details) {
      return res.status(400).json({
        success: false,
        message: 'Account details are required'
      });
    }

    // Get farmer profile
    const farmer = await FarmerProfile.findOne({ user: userId });
    if (!farmer) {
      return res.status(404).json({
        success: false,
        message: 'Farmer profile not found'
      });
    }

    // Check available balance
    const payments = await Payment.find({
      'metadata.farmerName': farmer.farmName,
      status: 'success'
    });

    const withdrawals = await WithdrawalRequest.find({
      farmer: userId
    });

    const totalEarnings = payments.reduce((sum, payment) => sum + payment.netAmount, 0);
    const totalWithdrawn = withdrawals
      .filter(w => w.status === 'completed')
      .reduce((sum, withdrawal) => sum + withdrawal.amount, 0);
    const pendingWithdrawals = withdrawals
      .filter(w => w.status === 'pending')
      .reduce((sum, withdrawal) => sum + withdrawal.amount, 0);
    
    const availableBalance = totalEarnings - totalWithdrawn - pendingWithdrawals;

    if (amount > availableBalance) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient balance'
      });
    }

    // Create withdrawal request
    const withdrawalRequest = new WithdrawalRequest({
      farmer: userId,
      amount,
      method,
      account_details,
      status: 'pending',
      reference: `WDR-${Date.now()}`,
      requested_at: new Date()
    });

    await withdrawalRequest.save();

    res.status(201).json({
      success: true,
      message: 'Withdrawal request submitted successfully',
      data: withdrawalRequest
    });
  } catch (error) {
    console.error('Request withdrawal error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get withdrawal requests
// @route   GET /api/wallet/withdrawals
// @access  Private (Farmer)
const getWithdrawalRequests = async (req, res) => {
  try {
    const userId = req.user._id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const withdrawals = await WithdrawalRequest.find({
      farmer: userId
    })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

    res.json({
      success: true,
      data: withdrawals
    });
  } catch (error) {
    console.error('Get withdrawal requests error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Update withdrawal status (Admin only)
// @route   PATCH /api/wallet/withdrawals/:id
// @access  Private (Admin)
const updateWithdrawalStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    if (!['pending', 'processing', 'completed', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
    }

    const withdrawal = await WithdrawalRequest.findById(id);
    if (!withdrawal) {
      return res.status(404).json({
        success: false,
        message: 'Withdrawal request not found'
      });
    }

    withdrawal.status = status;
    if (notes) withdrawal.notes = notes;
    if (status === 'completed') withdrawal.completed_at = new Date();
    if (status === 'rejected') withdrawal.rejected_at = new Date();

    await withdrawal.save();

    res.json({
      success: true,
      message: 'Withdrawal status updated successfully',
      data: withdrawal
    });
  } catch (error) {
    console.error('Update withdrawal status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

module.exports = {
  getWalletBalance,
  getWalletTransactions,
  requestWithdrawal,
  getWithdrawalRequests,
  updateWithdrawalStatus
};