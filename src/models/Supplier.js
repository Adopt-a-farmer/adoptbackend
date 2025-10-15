const mongoose = require('mongoose');

const supplierSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Supplier name is required'],
    trim: true
  },
  businessName: {
    type: String,
    required: [true, 'Business name is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required']
  },
  address: {
    street: String,
    city: String,
    state: String,
    country: String,
    zipCode: String
  },
  category: {
    type: String,
    enum: ['Seeds', 'Fertilizers', 'Equipment', 'Tools', 'Chemicals', 'Irrigation', 'Feed', 'Other'],
    required: [true, 'Category is required']
  },
  description: {
    type: String,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  registrationNumber: {
    type: String,
    unique: true,
    sparse: true
  },
  taxId: {
    type: String,
    unique: true,
    sparse: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended', 'pending'],
    default: 'pending'
  },
  verificationDocuments: [{
    type: {
      type: String,
      enum: ['business_license', 'tax_certificate', 'certification', 'insurance', 'other']
    },
    url: String,
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  products: [{
    name: String,
    description: String,
    category: String,
    unitPrice: Number,
    unit: String,
    stockQuantity: Number,
    minOrderQuantity: Number,
    images: [String],
    specifications: mongoose.Schema.Types.Mixed,
    isAvailable: {
      type: Boolean,
      default: true
    }
  }],
  ratings: {
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
  totalOrders: {
    type: Number,
    default: 0
  },
  totalRevenue: {
    type: Number,
    default: 0
  },
  paymentTerms: {
    type: String,
    default: 'Net 30'
  },
  deliveryAreas: [String],
  minimumOrderValue: {
    type: Number,
    default: 0
  },
  blockchain: {
    isRegistered: {
      type: Boolean,
      default: false
    },
    walletAddress: String,
    transactionHash: String,
    registeredAt: Date,
    verified: {
      type: Boolean,
      default: false
    },
    verificationHash: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for searching
supplierSchema.index({ name: 'text', businessName: 'text', category: 'text' });
supplierSchema.index({ status: 1, category: 1 });
supplierSchema.index({ 'blockchain.isRegistered': 1 });

module.exports = mongoose.model('Supplier', supplierSchema);
