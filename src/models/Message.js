const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  conversationId: {
    type: String,
    required: true,
    index: true
  },
  messageType: {
    type: String,
    enum: ['text', 'image', 'video', 'file', 'location'],
    default: 'text'
  },
  content: {
    text: String,
    media: {
      url: String,
      publicId: String,
      fileName: String,
      fileSize: Number,
      mimeType: String
    },
    location: {
      latitude: Number,
      longitude: Number,
      address: String
    }
  },
  adoption: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Adoption'
  },
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: Date,
  isDelivered: {
    type: Boolean,
    default: false
  },
  deliveredAt: Date,
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: Date,
  editHistory: [{
    originalContent: String,
    editedAt: Date
  }],
  reactions: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    emoji: String,
    reactedAt: {
      type: Date,
      default: Date.now
    }
  }],
  replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  }
}, {
  timestamps: true
});

// Indexes for better query performance
messageSchema.index({ conversationId: 1, createdAt: -1 });
messageSchema.index({ sender: 1, recipient: 1 });
messageSchema.index({ isRead: 1, recipient: 1 });

module.exports = mongoose.model('Message', messageSchema);