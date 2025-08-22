const mongoose = require('mongoose');

const crowdfundingProjectSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Project title is required'],
    trim: true,
    maxlength: [150, 'Title cannot be more than 150 characters']
  },
  description: {
    type: String,
    required: [true, 'Project description is required'],
    maxlength: [2000, 'Description cannot be more than 2000 characters']
  },
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  category: {
    type: String,
    enum: [
      'technology',
      'equipment',
      'infrastructure',
      'research',
      'processing',
      'marketing',
      'sustainability',
      'education',
      'startup'
    ],
    required: [true, 'Project category is required']
  },
  fundingGoal: {
    type: Number,
    required: [true, 'Funding goal is required'],
    min: [1000, 'Minimum funding goal is KES 1,000']
  },
  currentAmount: {
    type: Number,
    default: 0
  },
  currency: {
    type: String,
    default: 'KES'
  },
  duration: {
    startDate: {
      type: Date,
      required: true
    },
    endDate: {
      type: Date,
      required: true
    }
  },
  status: {
    type: String,
    enum: ['draft', 'active', 'funded', 'failed', 'completed', 'cancelled'],
    default: 'draft'
  },
  media: {
    featuredImage: {
      url: String,
      publicId: String
    },
    gallery: [{
      url: String,
      publicId: String,
      caption: String
    }],
    video: {
      url: String,
      publicId: String
    }
  },
  businessPlan: {
    problemStatement: String,
    solution: String,
    marketAnalysis: String,
    financialProjections: String,
    timeline: [{
      milestone: String,
      expectedDate: Date,
      status: {
        type: String,
        enum: ['pending', 'in_progress', 'completed'],
        default: 'pending'
      }
    }]
  },
  rewards: [{
    amount: {
      type: Number,
      required: true
    },
    title: String,
    description: String,
    estimatedDelivery: Date,
    limitedQuantity: Number,
    claimedCount: {
      type: Number,
      default: 0
    }
  }],
  backers: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    amount: Number,
    reward: mongoose.Schema.Types.ObjectId,
    backedAt: {
      type: Date,
      default: Date.now
    },
    isAnonymous: {
      type: Boolean,
      default: false
    }
  }],
  updates: [{
    title: String,
    content: String,
    media: [{
      url: String,
      publicId: String
    }],
    postedAt: {
      type: Date,
      default: Date.now
    }
  }],
  comments: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    content: String,
    replies: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      content: String,
      createdAt: {
        type: Date,
        default: Date.now
      }
    }],
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  totalBackers: {
    type: Number,
    default: 0
  },
  percentageFunded: {
    type: Number,
    default: 0
  },
  featured: {
    type: Boolean,
    default: false
  },
  tags: [String],
  location: {
    county: String,
    subCounty: String
  }
}, {
  timestamps: true
});

// Indexes for better query performance
crowdfundingProjectSchema.index({ status: 1, 'duration.endDate': 1 });
crowdfundingProjectSchema.index({ category: 1, status: 1 });
crowdfundingProjectSchema.index({ creator: 1 });
crowdfundingProjectSchema.index({ featured: 1, status: 1 });

// Pre-save middleware to calculate percentage funded
crowdfundingProjectSchema.pre('save', function(next) {
  if (this.isModified('currentAmount') || this.isModified('fundingGoal')) {
    this.percentageFunded = (this.currentAmount / this.fundingGoal) * 100;
    
    // Update status based on funding
    if (this.percentageFunded >= 100 && this.status === 'active') {
      this.status = 'funded';
    }
  }
  
  if (this.isModified('backers')) {
    this.totalBackers = this.backers.length;
  }
  
  next();
});

module.exports = mongoose.model('CrowdfundingProject', crowdfundingProjectSchema);