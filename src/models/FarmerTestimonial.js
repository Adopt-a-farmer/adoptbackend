const mongoose = require('mongoose');

const farmerTestimonialSchema = new mongoose.Schema({
  farmer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  problem: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  },
  solution: {
    type: String,
    required: true,
    trim: true,
    maxlength: 2000
  },
  images: [{
    url: {
      type: String,
      required: true
    },
    publicId: {
      type: String,
      required: true
    },
    caption: {
      type: String,
      maxlength: 200
    }
  }],
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  comments: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    comment: {
      type: String,
      required: true,
      maxlength: 500
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  views: {
    type: Number,
    default: 0
  },
  isPublic: {
    type: Boolean,
    default: true
  },
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'published'
  }
}, {
  timestamps: true
});

// Index for efficient queries
farmerTestimonialSchema.index({ createdAt: -1 });
farmerTestimonialSchema.index({ farmer: 1, status: 1 });
farmerTestimonialSchema.index({ tags: 1 });

// Virtual for like count
farmerTestimonialSchema.virtual('likeCount').get(function() {
  return this.likes.length;
});

// Virtual for comment count
farmerTestimonialSchema.virtual('commentCount').get(function() {
  return this.comments.length;
});

// Ensure virtuals are included in JSON
farmerTestimonialSchema.set('toJSON', { virtuals: true });
farmerTestimonialSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('FarmerTestimonial', farmerTestimonialSchema);
