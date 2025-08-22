const mongoose = require('mongoose');

const adopterProfileSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  adopterType: {
    type: String,
    enum: ['individual', 'organization', 'company'],
    required: [true, 'Adopter type is required']
  },
  organization: {
    name: String,
    registrationNumber: String,
    website: String,
    description: String
  },
  location: {
    country: {
      type: String,
      default: 'Kenya'
    },
    county: String,
    city: String,
    address: String
  },
  interests: {
    farmingTypes: [{
      type: String,
      enum: ['crop', 'livestock', 'mixed', 'aquaculture', 'apiary']
    }],
    preferredCrops: [String],
    preferredLivestock: [String],
    sustainabilityFocus: {
      type: Boolean,
      default: false
    },
    organicFocus: {
      type: Boolean,
      default: false
    }
  },
  investmentProfile: {
    totalInvested: {
      type: Number,
      default: 0
    },
    currentInvestments: {
      type: Number,
      default: 0
    },
    preferredInvestmentRange: {
      min: Number,
      max: Number
    },
    riskTolerance: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium'
    }
  },
  adoptionHistory: {
    totalAdoptions: {
      type: Number,
      default: 0
    },
    activeAdoptions: {
      type: Number,
      default: 0
    },
    completedAdoptions: {
      type: Number,
      default: 0
    }
  },
  paymentMethods: [{
    type: {
      type: String,
      enum: ['card', 'mobile_money', 'bank_transfer']
    },
    details: mongoose.Schema.Types.Mixed,
    isDefault: {
      type: Boolean,
      default: false
    }
  }],
  notifications: {
    email: {
      updates: {
        type: Boolean,
        default: true
      },
      messages: {
        type: Boolean,
        default: true
      },
      payments: {
        type: Boolean,
        default: true
      }
    },
    sms: {
      updates: {
        type: Boolean,
        default: false
      },
      payments: {
        type: Boolean,
        default: true
      }
    }
  },
  verificationStatus: {
    type: String,
    enum: ['pending', 'verified', 'rejected'],
    default: 'pending'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  joinedDate: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexing for better search performance
adopterProfileSchema.index({ adopterType: 1 });
adopterProfileSchema.index({ 'location.county': 1 });
adopterProfileSchema.index({ verificationStatus: 1 });

module.exports = mongoose.model('AdopterProfile', adopterProfileSchema);