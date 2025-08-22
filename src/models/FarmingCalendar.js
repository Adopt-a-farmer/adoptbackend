const mongoose = require('mongoose');

const farmingCalendarSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Calendar event title is required'],
    trim: true
  },
  description: {
    type: String,
    required: [true, 'Description is required']
  },
  category: {
    type: String,
    enum: [
      'planting',
      'fertilization',
      'irrigation',
      'pest_control',
      'harvesting',
      'soil_preparation',
      'pruning',
      'vaccination',
      'breeding',
      'market_preparation'
    ],
    required: [true, 'Category is required']
  },
  cropType: [String], // e.g., ['maize', 'beans', 'potatoes']
  livestockType: [String], // e.g., ['cattle', 'poultry', 'goats']
  region: {
    type: String,
    enum: ['coast', 'western', 'nyanza', 'rift_valley', 'central', 'eastern', 'north_eastern', 'nairobi'],
    required: [true, 'Region is required']
  },
  season: {
    type: String,
    enum: ['long_rains', 'short_rains', 'dry_season', 'year_round'],
    required: [true, 'Season is required']
  },
  timing: {
    month: {
      type: Number,
      min: 1,
      max: 12,
      required: true
    },
    week: {
      type: Number,
      min: 1,
      max: 4
    },
    dayRange: {
      start: Number,
      end: Number
    }
  },
  weather: {
    temperature: {
      min: Number,
      max: Number
    },
    rainfall: {
      min: Number,
      max: Number
    },
    conditions: [String] // e.g., ['sunny', 'rainy', 'windy']
  },
  instructions: {
    whatToDo: String,
    howToDo: String,
    tools: [String],
    materials: [String],
    tips: [String]
  },
  expertAdvice: {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    content: String,
    videoUrl: String
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  estimatedDuration: String, // e.g., '2-3 hours', '1 day', '1 week'
  estimatedCost: {
    min: Number,
    max: Number,
    currency: {
      type: String,
      default: 'KES'
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Indexes for better query performance
farmingCalendarSchema.index({ region: 1, season: 1, 'timing.month': 1 });
farmingCalendarSchema.index({ category: 1, cropType: 1 });
farmingCalendarSchema.index({ livestockType: 1, category: 1 });
farmingCalendarSchema.index({ priority: 1, 'timing.month': 1 });

module.exports = mongoose.model('FarmingCalendar', farmingCalendarSchema);