const mongoose = require('mongoose');

const expertProfileSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  specializations: [{
    type: String,
    enum: [
      'crop_management', 'livestock_care', 'soil_health', 'pest_control',
      'irrigation', 'organic_farming', 'sustainable_practices', 'marketing',
      'financial_planning', 'technology_adoption', 'climate_adaptation',
      'aquaculture', 'poultry', 'dairy_farming', 'beekeeping', 'horticulture'
    ]
  }],
  bio: {
    type: String,
    maxlength: [1000, 'Bio cannot be more than 1000 characters']
  },
  experience: {
    yearsOfExperience: {
      type: Number,
      min: 0,
      default: 0
    },
    education: [{
      institution: String,
      degree: String,
      field: String,
      year: Number
    }],
    certifications: [{
      name: String,
      issuingOrganization: String,
      issueDate: Date,
      expiryDate: Date,
      certificateUrl: String
    }],
    previousWork: [{
      organization: String,
      position: String,
      startDate: Date,
      endDate: Date,
      description: String
    }]
  },
  contact: {
    phone: String,
    whatsapp: String,
    alternateEmail: String,
    linkedIn: String,
    website: String
  },
  availability: {
    isAvailable: {
      type: Boolean,
      default: true
    },
    maxMentorships: {
      type: Number,
      default: 10
    },
    workingHours: {
      start: {
        type: String,
        default: '08:00'
      },
      end: {
        type: String,
        default: '17:00'
      }
    },
    workingDays: [{
      type: String,
      enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    }],
    consultationTypes: [{
      type: String,
      enum: ['remote', 'on_farm', 'office', 'phone', 'video_call']
    }]
  },
  location: {
    county: String,
    subCounty: String,
    serviceRadius: {
      type: Number,
      default: 50 // kilometers
    },
    officeAddress: String
  },
  statistics: {
    totalMentorships: {
      type: Number,
      default: 0
    },
    activeMentorships: {
      type: Number,
      default: 0
    },
    completedMentorships: {
      type: Number,
      default: 0
    },
    averageRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    totalReviews: {
      type: Number,
      default: 0
    },
    articlesPublished: {
      type: Number,
      default: 0
    },
    totalViews: {
      type: Number,
      default: 0
    },
    totalLikes: {
      type: Number,
      default: 0
    }
  },
  pricing: {
    consultationFee: {
      type: Number,
      default: 0
    },
    currency: {
      type: String,
      default: 'KES'
    },
    paymentMethods: [{
      type: String,
      enum: ['mpesa', 'bank_transfer', 'cash', 'paypal']
    }],
    offersFreeConsultation: {
      type: Boolean,
      default: false
    },
    freeSessionsPerFarmer: {
      type: Number,
      default: 1
    }
  },
  profileImage: {
    url: String,
    publicId: String
  },
  verificationStatus: {
    type: String,
    enum: ['pending', 'verified', 'rejected'],
    default: 'pending'
  },
  verificationDocuments: [{
    type: {
      type: String, // 'degree', 'certificate', 'license', 'id'
      default: 'other'
    },
    url: String,
    publicId: String,
    fileName: String,
    uploadDate: {
      type: Date,
      default: Date.now
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    }
  }],
  languages: [{
    type: String,
    default: ['English', 'Swahili']
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  profileCompleteness: {
    type: Number,
    default: 20, // Basic info from registration
    min: 0,
    max: 100
  }
}, {
  timestamps: true
});

// Indexes for better query performance
expertProfileSchema.index({ user: 1 });
expertProfileSchema.index({ specializations: 1 });
expertProfileSchema.index({ 'location.county': 1 });
expertProfileSchema.index({ verificationStatus: 1 });
expertProfileSchema.index({ isActive: 1 });
expertProfileSchema.index({ 'availability.isAvailable': 1 });

// Virtual for current mentorship capacity
expertProfileSchema.virtual('mentorshipCapacity').get(function() {
  const maxMentorships = this.availability.maxMentorships || 10;
  const currentMentorships = this.statistics.activeMentorships || 0;
  return maxMentorships - currentMentorships;
});

// Virtual for experience level
expertProfileSchema.virtual('experienceLevel').get(function() {
  const years = this.experience.yearsOfExperience || 0;
  if (years < 2) return 'Junior';
  if (years < 5) return 'Mid-level';
  if (years < 10) return 'Senior';
  return 'Expert';
});

// Method to calculate profile completeness
expertProfileSchema.methods.calculateCompleteness = function() {
  let score = 20; // Base score for registration
  
  if (this.bio && this.bio.length > 50) score += 10;
  if (this.specializations && this.specializations.length > 0) score += 15;
  if (this.experience.yearsOfExperience > 0) score += 10;
  if (this.experience.education && this.experience.education.length > 0) score += 10;
  if (this.experience.certifications && this.experience.certifications.length > 0) score += 10;
  if (this.contact.phone) score += 5;
  if (this.location.county && this.location.subCounty) score += 10;
  if (this.availability.workingDays && this.availability.workingDays.length > 0) score += 5;
  if (this.verificationStatus === 'verified') score += 15;
  
  this.profileCompleteness = Math.min(score, 100);
  return this.profileCompleteness;
};

// Method to check if expert can take new mentorships
expertProfileSchema.methods.canTakeNewMentorship = function() {
  return this.isActive && 
         this.availability.isAvailable && 
         this.mentorshipCapacity > 0 &&
         this.verificationStatus === 'verified';
};

module.exports = mongoose.model('ExpertProfile', expertProfileSchema);