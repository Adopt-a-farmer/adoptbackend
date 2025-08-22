const mongoose = require('mongoose');

const knowledgeArticleSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Article title is required'],
    trim: true,
    maxlength: [200, 'Title cannot be more than 200 characters']
  },
  slug: {
    type: String,
    unique: true,
    required: true
  },
  content: {
    type: String,
    required: [true, 'Article content is required']
  },
  excerpt: {
    type: String,
    maxlength: [500, 'Excerpt cannot be more than 500 characters']
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  category: {
    type: String,
    enum: [
      'crop_farming',
      'livestock',
      'pest_control',
      'soil_management',
      'irrigation',
      'harvesting',
      'post_harvest',
      'marketing',
      'finance',
      'technology',
      'climate',
      'sustainability'
    ],
    required: [true, 'Article category is required']
  },
  tags: [String],
  featuredImage: {
    url: String,
    publicId: String,
    caption: String
  },
  media: [{
    type: {
      type: String,
      enum: ['image', 'video']
    },
    url: String,
    publicId: String,
    caption: String
  }],
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'draft'
  },
  isExpert: {
    type: Boolean,
    default: false
  },
  difficulty: {
    type: String,
    enum: ['beginner', 'intermediate', 'advanced'],
    default: 'beginner'
  },
  estimatedReadTime: {
    type: Number, // in minutes
    default: 5
  },
  likes: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    likedAt: {
      type: Date,
      default: Date.now
    }
  }],
  views: {
    type: Number,
    default: 0
  },
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
  publishedAt: Date,
  lastModified: Date
}, {
  timestamps: true
});

// Indexes for better search and query performance
knowledgeArticleSchema.index({ category: 1, status: 1 });
knowledgeArticleSchema.index({ author: 1, status: 1 });
knowledgeArticleSchema.index({ tags: 1 });
knowledgeArticleSchema.index({ publishedAt: -1 });
knowledgeArticleSchema.index({ 'likes.user': 1 });

// Text index for search functionality
knowledgeArticleSchema.index({
  title: 'text',
  content: 'text',
  excerpt: 'text',
  tags: 'text'
});

module.exports = mongoose.model('KnowledgeArticle', knowledgeArticleSchema);