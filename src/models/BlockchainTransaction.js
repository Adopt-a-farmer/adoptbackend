const mongoose = require('mongoose');

const blockchainTransactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  transactionHash: {
    type: String,
    required: true,
    unique: true
  },
  blockNumber: {
    type: Number,
    required: true
  },
  contractAddress: {
    type: String,
    required: true
  },
  eventType: {
    type: String,
    enum: [
      'FARMER_REGISTERED',
      'FARMER_VERIFIED',
      'FARMER_UNVERIFIED',
      'PLANTING_REGISTERED',
      'GERMINATION_RECORDED',
      'MATURITY_DECLARED',
      'HARVEST_RECORDED',
      'PACKAGE_RECORDED',
      'QA_ADDED'
    ],
    required: true
  },
  productId: {
    type: Number
  },
  harvestBatchId: {
    type: Number
  },
  packageId: {
    type: Number
  },
  dataHash: {
    type: String
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'failed'],
    default: 'confirmed'
  },
  gasUsed: {
    type: String
  },
  gasCost: {
    type: String
  },
  errorMessage: {
    type: String
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
blockchainTransactionSchema.index({ userId: 1, eventType: 1 });
blockchainTransactionSchema.index({ createdAt: -1 });
blockchainTransactionSchema.index({ productId: 1 }, { sparse: true });
blockchainTransactionSchema.index({ transactionHash: 1 }, { unique: true });

// Virtual for explorer URL
blockchainTransactionSchema.virtual('explorerUrl').get(function() {
  const network = process.env.BLOCKCHAIN_NETWORK || 'hardhat';
  
  if (network === 'mumbai') {
    return `https://mumbai.polygonscan.com/tx/${this.transactionHash}`;
  } else if (network === 'polygon') {
    return `https://polygonscan.com/tx/${this.transactionHash}`;
  } else {
    return `http://localhost:8545/tx/${this.transactionHash}`;
  }
});

// Ensure virtuals are included in JSON
blockchainTransactionSchema.set('toJSON', { virtuals: true });
blockchainTransactionSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('BlockchainTransaction', blockchainTransactionSchema);
