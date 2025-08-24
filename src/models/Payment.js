const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  adoption: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Adoption'
  },
  crowdfunding: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CrowdfundingProject'
  },
  paymentType: {
    type: String,
    enum: ['adoption', 'crowdfunding', 'visit', 'subscription'],
    required: [true, 'Payment type is required']
  },
  amount: {
    type: Number,
    required: [true, 'Payment amount is required'],
    min: [0, 'Payment amount must be positive']
  },
  currency: {
    type: String,
    default: 'KES'
  },
  paymentMethod: {
    type: String,
    enum: ['card', 'mobile_money', 'bank_transfer'],
    required: [true, 'Payment method is required']
  },
  paymentGateway: {
    type: String,
    enum: ['paystack', 'mpesa', 'bank'],
    default: 'paystack'
  },
  gatewayResponse: {
    reference: {
      type: String,
      unique: true,
      required: true
    },
    gatewayRef: String,
    authorizationCode: String,
    channel: String,
    cardType: String,
    bank: String,
    last4: String,
    expMonth: String,
    expYear: String,
    countryCode: String,
    brand: String,
    reusable: Boolean
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'success', 'failed', 'cancelled', 'refunded'],
    default: 'pending'
  },
  description: String,
  metadata: {
    customerName: String,
    customerEmail: String,
    customerPhone: String,
    farmerName: String,
    farmName: String,
    customFields: mongoose.Schema.Types.Mixed
  },
  fees: {
    gateway: {
      type: Number,
      default: 0
    },
    platform: {
      type: Number,
      default: 0
    }
  },
  netAmount: Number, // Amount after fees
  paidAt: Date,
  failureReason: String,
  refund: {
    amount: Number,
    reason: String,
    refundedAt: Date,
    refundReference: String
  },
  isRecurring: {
    type: Boolean,
    default: false
  },
  recurringDetails: {
    frequency: {
      type: String,
      enum: ['weekly', 'monthly', 'quarterly', 'annually']
    },
    nextPaymentDate: Date,
    endDate: Date,
    totalPayments: Number,
    completedPayments: {
      type: Number,
      default: 0
    }
  }
}, {
  timestamps: true
});

// Indexes for better query performance
paymentSchema.index({ user: 1, status: 1 });
// Note: gatewayResponse.reference index is automatically created by unique: true
paymentSchema.index({ paymentType: 1, status: 1 });
paymentSchema.index({ paidAt: -1 });

// Pre-save middleware to calculate net amount
paymentSchema.pre('save', function(next) {
  if (this.isModified('amount') || this.isModified('fees')) {
    this.netAmount = this.amount - (this.fees.gateway || 0) - (this.fees.platform || 0);
  }
  next();
});

module.exports = mongoose.model('Payment', paymentSchema);