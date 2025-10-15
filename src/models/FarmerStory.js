const mongoose = require('mongoose');

const farmerStorySchema = new mongoose.Schema({
  farmer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: [true, 'Please add a story title'],
    trim: true,
    maxlength: [200, 'Title cannot be more than 200 characters']
  },
  challenge: {
    type: String,
    required: [true, 'Please describe the challenge you faced'],
    maxlength: [2000, 'Challenge description cannot be more than 2000 characters']
  },
  solution: {
    type: String,
    required: [true, 'Please describe how you solved the challenge'],
    maxlength: [2000, 'Solution description cannot be more than 2000 characters']
  },
  outcome: {
    type: String,
    maxlength: [1000, 'Outcome description cannot be more than 1000 characters']
  },
  category: {
    type: String,
    enum: [
      'pest_control',
      'crop_disease',
      'drought',
      'flooding',
      'soil_management',
      'irrigation',
      'marketing',
      'finance',
      'labor',
      'weather',
      'equipment',
      'livestock',
      'harvest',
      'storage',
      'other'
    ],
    required: true
  },
  tags: [{
    type: String,
    trim: true
  }],
  media: [{
    type: {
      type: String,
      enum: ['image', 'video'],
      required: true
    },
    url: {
      type: String,
      required: true
    },
    publicId: {
      type: String,
      required: true
    },
    caption: String
  }],
  likes: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    date: {
      type: Date,
      default: Date.now
    }
  }],
  comments: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    text: {
      type: String,
      required: true,
      maxlength: [500, 'Comment cannot be more than 500 characters']
    },
    date: {
      type: Date,
      default: Date.now
    }
  }],
  views: {
    type: Number,
    default: 0
  },
  isApproved: {
    type: Boolean,
    default: true // Auto-approve by default, can be moderated by admin
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  helpfulCount: {
    type: Number,
    default: 0
  },
  markedHelpfulBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index for better query performance
farmerStorySchema.index({ farmer: 1, createdAt: -1 });
farmerStorySchema.index({ category: 1, isApproved: 1 });
farmerStorySchema.index({ tags: 1 });
farmerStorySchema.index({ createdAt: -1 });

// Virtual for comment count
farmerStorySchema.virtual('commentCount').get(function() {
  return this.comments ? this.comments.length : 0;
});

// Virtual for like count
farmerStorySchema.virtual('likeCount').get(function() {
  return this.likes ? this.likes.length : 0;
});

module.exports = mongoose.model('FarmerStory', farmerStorySchema);
