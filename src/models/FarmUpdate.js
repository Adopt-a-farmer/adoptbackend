const mongoose = require('mongoose');

const farmUpdateSchema = new mongoose.Schema({
  farmer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FarmerProfile',
    required: true
  },
  title: {
    type: String,
    required: true,
    maxlength: 200
  },
  content: {
    type: String,
    required: true,
    maxlength: 2000
  },
  type: {
    type: String,
    enum: ['general', 'harvest', 'planting', 'weather', 'milestone', 'challenge'],
    default: 'general'
  },
  media_urls: [{
    type: String
  }],
  tags: [{
    type: String
  }],
  visibility: {
    type: String,
    enum: ['public', 'adopters_only', 'private'],
    default: 'adopters_only'
  },
  likes_count: {
    type: Number,
    default: 0
  },
  comments_count: {
    type: Number,
    default: 0
  },
  views_count: {
    type: Number,
    default: 0
  },
  is_pinned: {
    type: Boolean,
    default: false
  },
  weather_data: {
    temperature: Number,
    humidity: Number,
    rainfall: Number,
    conditions: String
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number],
      index: '2dsphere'
    }
  },
  created_at: {
    type: Date,
    default: Date.now
  },
  updated_at: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for better query performance
farmUpdateSchema.index({ farmer: 1, created_at: -1 });
farmUpdateSchema.index({ type: 1 });
farmUpdateSchema.index({ visibility: 1 });
farmUpdateSchema.index({ tags: 1 });

// Update the updated_at field before saving
farmUpdateSchema.pre('save', function(next) {
  this.updated_at = Date.now();
  next();
});

module.exports = mongoose.model('FarmUpdate', farmUpdateSchema);