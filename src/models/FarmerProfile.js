const mongoose = require('mongoose');

const farmerProfileSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  farmName: {
    type: String,
    required: [true, 'Farm name is required'],
    trim: true,
    maxlength: [100, 'Farm name cannot be more than 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Farm description is required'],
    maxlength: [1000, 'Description cannot be more than 1000 characters'],
    default: 'New farmer profile - please update your farm description'
  },
  establishedYear: {
    type: Number,
    min: [1900, 'Year must be >= 1900'],
    max: [2100, 'Year must be <= 2100']
  },
  // Contact information and social links
  contactInfo: {
    phone: { type: String },
    email: { type: String },
    website: { type: String }
  },
  socialMedia: {
    facebook: { type: String },
    twitter: { type: String },
    instagram: { type: String }
  },
  location: {
    county: {
      type: String,
      required: [true, 'County is required'],
      default: 'Not specified'
    },
    subCounty: {
      type: String,
      required: [true, 'Sub-county is required'],
      default: 'Not specified'
    },
    village: String,
    coordinates: {
      latitude: Number,
      longitude: Number
    }
  },
  farmSize: {
    value: {
      type: Number,
      default: 1,
      min: [0.1, 'Farm size must be at least 0.1 acres']
    },
    unit: {
      type: String,
      enum: ['acres', 'hectares'],
      default: 'acres'
    }
  },
  farmingType: {
    type: [String],
    enum: ['crop', 'livestock', 'mixed', 'aquaculture', 'apiary'],
    default: ['crop']
  },
  // High-level crop categories selected by farmer
  cropTypes: {
    type: [{
      type: String,
      enum: [
        'maize', 'beans', 'rice', 'wheat', 'vegetables', 'fruits',
        'coffee', 'tea', 'sugarcane', 'cotton', 'sunflower', 'sorghum', 'millet'
      ]
    }],
    default: []
  },
  crops: [{
    name: String,
    variety: String,
    season: String,
    estimatedYield: Number,
    yieldUnit: String
  }],
  livestock: [{
    animalType: String,
    breed: String,
    count: Number,
    purpose: String // dairy, meat, eggs, etc.
  }],
  certifications: [{
    name: String,
    issuedBy: String,
    issuedDate: Date,
    expiryDate: Date,
    certificateUrl: String
  }],
  farmingPractices: {
    organic: {
      type: Boolean,
      default: false
    },
    sustainable: {
      type: Boolean,
      default: false
    },
    irrigation: {
      type: String,
      enum: ['rain-fed', 'drip', 'sprinkler', 'flood', 'mixed']
    },
    soilConservation: [String]
  },
  // Farming methods selection
  farmingMethods: {
    type: [{
      type: String,
      enum: [
        'organic', 'conventional', 'permaculture', 'hydroponics', 'agroforestry',
        'conservation_agriculture', 'precision_farming', 'sustainable_agriculture'
      ]
    }],
    default: []
  },
  media: {
    profileImage: {
      url: String,
      publicId: String
    },
    farmImages: [{
      url: String,
      publicId: String,
      caption: String
    }],
    videos: [{
      url: String,
      publicId: String,
      caption: String
    }]
  },
  bankDetails: {
    bankName: String,
    accountNumber: String,
    accountName: String,
    branchCode: String
  },
  adoptionStats: {
    totalAdopters: {
      type: Number,
      default: 0
    },
    totalFunding: {
      type: Number,
      default: 0
    },
    currentAdoptions: {
      type: Number,
      default: 0
    }
  },
  verificationStatus: {
    type: String,
    enum: ['pending', 'verified', 'rejected'],
    default: 'pending'
  },
  rating: {
    average: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    count: {
      type: Number,
      default: 0
    }
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
farmerProfileSchema.index({ 'location.county': 1, 'location.subCounty': 1 });
farmerProfileSchema.index({ farmingType: 1 });
farmerProfileSchema.index({ verificationStatus: 1 });
farmerProfileSchema.index({ 'rating.average': -1 });

module.exports = mongoose.model('FarmerProfile', farmerProfileSchema);