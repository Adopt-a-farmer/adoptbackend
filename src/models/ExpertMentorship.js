const mongoose = require('mongoose');

const expertMentorshipSchema = new mongoose.Schema({
  expert: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  farmer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  specialization: {
    type: String,
    enum: [
      'crop_management', 'livestock_care', 'soil_health', 'pest_control',
      'irrigation', 'organic_farming', 'sustainable_practices', 'marketing',
      'financial_planning', 'technology_adoption', 'climate_adaptation'
    ],
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'completed', 'paused', 'terminated'],
    default: 'active'
  },
  startDate: {
    type: Date,
    default: Date.now
  },
  endDate: Date,
  goals: [{
    title: String,
    description: String,
    targetDate: Date,
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed', 'overdue'],
      default: 'pending'
    },
    completedDate: Date
  }],
  sessions: [{
    type: {
      type: String,
      enum: ['consultation', 'field_visit', 'training', 'follow_up'],
      required: true
    },
    title: String,
    description: String,
    scheduledDate: Date,
    completedDate: Date,
    duration: Number, // in minutes
    location: {
      type: String,
      enum: ['on_farm', 'remote', 'office', 'field_day']
    },
    notes: String,
    farmerFeedback: {
      rating: {
        type: Number,
        min: 1,
        max: 5
      },
      comment: String
    },
    expertNotes: String,
    attachments: [{
      url: String,
      publicId: String,
      fileName: String,
      fileType: String
    }]
  }],
  progress: {
    totalSessions: {
      type: Number,
      default: 0
    },
    completedGoals: {
      type: Number,
      default: 0
    },
    overallRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    farmImprovements: [{
      area: String,
      improvement: String,
      date: Date,
      evidence: [{
        type: String, // 'image', 'document', 'metric'
        url: String,
        description: String
      }]
    }]
  },
  paymentTerms: {
    isPayable: {
      type: Boolean,
      default: false
    },
    ratePerSession: Number,
    currency: {
      type: String,
      default: 'KES'
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'partial', 'paid', 'overdue'],
      default: 'pending'
    }
  },
  communicationPreferences: {
    preferredMethods: [{
      type: String,
      enum: ['phone', 'whatsapp', 'email', 'video_call', 'in_person']
    }],
    language: {
      type: String,
      default: 'en'
    },
    frequency: {
      type: String,
      enum: ['weekly', 'bi_weekly', 'monthly', 'as_needed'],
      default: 'monthly'
    }
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes for better query performance
expertMentorshipSchema.index({ expert: 1, status: 1 });
expertMentorshipSchema.index({ farmer: 1, status: 1 });
expertMentorshipSchema.index({ specialization: 1 });
expertMentorshipSchema.index({ startDate: -1 });

// Virtual for duration in days
expertMentorshipSchema.virtual('durationInDays').get(function() {
  const end = this.endDate || new Date();
  return Math.ceil((end - this.startDate) / (1000 * 60 * 60 * 24));
});

// Virtual for success rate
expertMentorshipSchema.virtual('successRate').get(function() {
  const totalGoals = this.goals.length;
  if (totalGoals === 0) return 0;
  return (this.progress.completedGoals / totalGoals) * 100;
});

module.exports = mongoose.model('ExpertMentorship', expertMentorshipSchema);