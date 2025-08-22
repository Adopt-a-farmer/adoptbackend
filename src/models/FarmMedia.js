const mongoose = require('mongoose');

const farmMediaSchema = new mongoose.Schema({
  farmer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FarmerProfile',
    required: true
  },
  url: {
    type: String,
    required: true
  },
  public_id: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['image', 'video'],
    default: 'image'
  },
  caption: {
    type: String,
    maxlength: 200
  },
  format: {
    type: String
  },
  size: {
    type: Number
  },
  tags: [{
    type: String
  }],
  created_at: {
    type: Date,
    default: Date.now
  }
});

// Add virtual for createdAt and updatedAt
farmMediaSchema.set('timestamps', true);

// Indexes for better query performance
farmMediaSchema.index({ farmer: 1, created_at: -1 });
farmMediaSchema.index({ type: 1 });
farmMediaSchema.index({ tags: 1 });

module.exports = mongoose.model('FarmMedia', farmMediaSchema);