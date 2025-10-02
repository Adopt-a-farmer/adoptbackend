const mongoose = require('mongoose');

const farmVisitSchema = new mongoose.Schema({
  adopter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    // Not required anymore - will use visitor field instead
  },
  visitor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    // Generic visitor field to support both adopters and experts
  },
  visitorRole: {
    type: String,
    enum: ['adopter', 'expert'],
    // Track the role of the visitor
  },
  farmer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // Reference user directly, not farmer profile
    required: true
  },
  adoption: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Adoption'
  },
  visitType: {
    type: String,
    enum: ['scheduled', 'inspection', 'harvest', 'general', 'educational'],
    default: 'scheduled'
  },
  requestedDate: {
    type: Date,
    required: [true, 'Requested visit date is required'],
    validate: {
      validator: function(v) {
        // Ensure date is not in the past (with some tolerance for same day)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return v >= today;
      },
      message: 'Visit date cannot be in the past'
    }
  },
  confirmedDate: Date,
  duration: {
    type: String,
    enum: ['half_day', 'full_day', 'weekend', 'custom'],
    default: 'half_day'
  },
  customDuration: {
    hours: Number,
    description: String
  },
  groupSize: {
    adults: {
      type: Number,
      default: 1,
      min: 1
    },
    children: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  purpose: {
    type: String,
    required: [true, 'Visit purpose is required'],
    maxlength: [500, 'Purpose cannot be more than 500 characters']
  },
  activities: [{
    name: String,
    description: String,
    estimatedDuration: String
  }],
  requirements: {
    transportation: {
      needed: {
        type: Boolean,
        default: false
      },
      details: String
    },
    accommodation: {
      needed: {
        type: Boolean,
        default: false
      },
      type: {
        type: String,
        enum: ['homestay', 'hotel', 'camping']
      },
      nights: Number
    },
    meals: {
      breakfast: {
        type: Boolean,
        default: false
      },
      lunch: {
        type: Boolean,
        default: true
      },
      dinner: {
        type: Boolean,
        default: false
      },
      specialDiet: String
    },
    specialNeeds: String
  },
  costs: {
    visitFee: {
      type: Number,
      default: 0
    },
    transportationCost: {
      type: Number,
      default: 0
    },
    accommodationCost: {
      type: Number,
      default: 0
    },
    mealsCost: {
      type: Number,
      default: 0
    },
    totalCost: {
      type: Number,
      default: 0
    },
    currency: {
      type: String,
      default: 'KES'
    }
  },
  status: {
    type: String,
    enum: ['requested', 'confirmed', 'cancelled', 'completed', 'rescheduled'],
    default: 'requested'
  },
  farmerResponse: {
    approved: Boolean,
    message: String,
    respondedAt: Date,
    suggestedAlternatives: [{
      date: Date,
      reason: String
    }]
  },
  visitReport: {
    summary: String,
    highlights: [String],
    media: [{
      url: String,
      publicId: String,
      caption: String,
      type: {
        type: String,
        enum: ['image', 'video']
      }
    }],
    adopterFeedback: {
      rating: {
        type: Number,
        min: 1,
        max: 5
      },
      review: String,
      wouldRecommend: Boolean
    },
    farmerFeedback: {
      rating: {
        type: Number,
        min: 1,
        max: 5
      },
      review: String
    },
    completedAt: Date
  },
  weather: {
    forecast: String,
    suitableConditions: Boolean
  },
  emergencyContact: {
    name: String,
    phone: String,
    relationship: String
  },
  cancellationReason: String,
  cancelledAt: Date,
  rescheduledFrom: Date,
  rescheduledReason: String
}, {
  timestamps: true
});

// Indexes for better query performance
farmVisitSchema.index({ adopter: 1, status: 1 });
farmVisitSchema.index({ visitor: 1, status: 1 });
farmVisitSchema.index({ farmer: 1, status: 1 });
farmVisitSchema.index({ adoption: 1 });
farmVisitSchema.index({ requestedDate: 1, status: 1 });

// Pre-save middleware to calculate total cost
farmVisitSchema.pre('save', function(next) {
  if (this.isModified('costs')) {
    this.costs.totalCost = 
      (this.costs.visitFee || 0) +
      (this.costs.transportationCost || 0) +
      (this.costs.accommodationCost || 0) +
      (this.costs.mealsCost || 0);
  }
  next();
});

module.exports = mongoose.model('FarmVisit', farmVisitSchema);