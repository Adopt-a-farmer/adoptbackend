const mongoose = require('mongoose');

const adoptionSchema = new mongoose.Schema({
  adopter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    // One adopter can only adopt one farmer at a time
    unique: function() {
      return this.status === 'active';
    }
  },
  farmer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    // One farmer can only be adopted by one adopter at a time
    unique: function() {
      return this.status === 'active';
    }
  },
  adoptionType: {
    type: String,
    enum: ['full', 'partial', 'crop_specific', 'monthly_support'],
    required: [true, 'Adoption type is required']
  },
  adoptionDetails: {
    crops: [{
      name: String,
      area: Number, // in acres or hectares
      expectedYield: Number,
      pricePerUnit: Number
    }],
    duration: {
      start: {
        type: Date,
        required: function() {
          return this.adoptionType !== 'monthly_support';
        }
      },
      end: {
        type: Date,
        required: function() {
          return this.adoptionType !== 'monthly_support';
        }
      }
    },
    monthlyContribution: {
      type: Number,
      required: function() {
        return this.adoptionType === 'monthly_support';
      }
    },
    currency: {
      type: String,
      default: 'KES'
    },
    message: String
  },
  paymentPlan: {
    type: {
      type: String,
      enum: ['one_time', 'monthly', 'quarterly', 'seasonal'],
      required: true
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
    nextPaymentDate: Date,
    totalPaid: {
      type: Number,
      default: 0
    }
  },
  status: {
    type: String,
    enum: ['pending', 'active', 'completed', 'cancelled', 'paused'],
    default: 'pending'
  },
  contract: {
    terms: String,
    signedByAdopter: {
      type: Boolean,
      default: false
    },
    signedByFarmer: {
      type: Boolean,
      default: false
    },
    signedDate: Date
  },
  progress: {
    milestones: [{
      title: String,
      description: String,
      targetDate: Date,
      completedDate: Date,
      status: {
        type: String,
        enum: ['pending', 'in_progress', 'completed', 'delayed'],
        default: 'pending'
      },
      media: [{
        url: String,
        publicId: String,
        caption: String
      }]
    }],
    lastUpdate: Date
  },
  expectedReturns: {
    estimatedRevenue: Number,
    expectedProfit: Number,
    roi: Number // Return on Investment percentage
  },
  actualReturns: {
    totalRevenue: {
      type: Number,
      default: 0
    },
    profit: {
      type: Number,
      default: 0
    },
    actualRoi: Number
  },
  rating: {
    adopterRating: {
      type: Number,
      min: 1,
      max: 5
    },
    farmerRating: {
      type: Number,
      min: 1,
      max: 5
    },
    adopterReview: String,
    farmerReview: String
  }
}, {
  timestamps: true
});

// Compound indexes for better query performance
adoptionSchema.index({ adopter: 1, status: 1 });
adoptionSchema.index({ farmer: 1, status: 1 });
adoptionSchema.index({ status: 1, 'adoptionDetails.duration.end': 1 });

// Ensure one-to-one adoption: one adopter, one farmer
adoptionSchema.index(
  { adopter: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'active' },
    name: 'one_adopter_one_farmer'
  }
);

// Ensure one farmer can only have one active adoption
adoptionSchema.index(
  { farmer: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'active' },
    name: 'one_farmer_one_adopter'
  }
);

// Pre-save validation for one-to-one adoption
adoptionSchema.pre('save', async function(next) {
  if (this.status === 'active') {
    // Check if adopter already has an active adoption
    const existingAdopterAdoption = await this.constructor.findOne({
      adopter: this.adopter,
      status: 'active',
      _id: { $ne: this._id }
    });

    if (existingAdopterAdoption) {
      throw new Error('This adopter already has an active adoption. One adopter can only adopt one farmer at a time.');
    }

    // Check if farmer already has an active adoption
    const existingFarmerAdoption = await this.constructor.findOne({
      farmer: this.farmer,
      status: 'active',
      _id: { $ne: this._id }
    });

    if (existingFarmerAdoption) {
      throw new Error('This farmer is already adopted. One farmer can only have one adopter at a time.');
    }
  }
  next();
});

module.exports = mongoose.model('Adoption', adoptionSchema);