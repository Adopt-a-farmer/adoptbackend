const mongoose = require('mongoose');

const withdrawalRequestSchema = new mongoose.Schema({
  farmer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  method: {
    type: String,
    required: true,
    enum: ['mpesa', 'bank']
  },
  account_details: {
    // For M-Pesa: phone number
    // For Bank: account details object
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'rejected'],
    default: 'pending'
  },
  reference: {
    type: String,
    unique: true,
    required: true
  },
  notes: {
    type: String,
    default: ''
  },
  requested_at: {
    type: Date,
    default: Date.now
  },
  processed_at: {
    type: Date
  },
  completed_at: {
    type: Date
  },
  rejected_at: {
    type: Date
  },
  processed_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Index for farmer queries
withdrawalRequestSchema.index({ farmer: 1, createdAt: -1 });
withdrawalRequestSchema.index({ status: 1 });
// Note: reference index is automatically created by unique: true

module.exports = mongoose.model('WithdrawalRequest', withdrawalRequestSchema);