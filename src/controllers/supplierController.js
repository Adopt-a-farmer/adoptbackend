const Supplier = require('../models/Supplier');
const SupplierOrder = require('../models/SupplierOrder');
const BlockchainService = require('../services/blockchainService');

// Initialize blockchain service
let blockchainService;
try {
  blockchainService = new BlockchainService();
} catch (error) {
  console.warn('⚠️ Blockchain service not available:', error.message);
}

// Get all suppliers (with filters)
exports.getAllSuppliers = async (req, res) => {
  try {
    const { 
      status, 
      category, 
      search, 
      page = 1, 
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const query = {};

    // Apply filters
    if (status) query.status = status;
    if (category) query.category = category;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { businessName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (page - 1) * limit;
    const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

    const suppliers = await Supplier.find(query)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .select('-__v');

    const total = await Supplier.countDocuments(query);

    res.status(200).json({
      success: true,
      data: suppliers,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching suppliers',
      error: error.message
    });
  }
};

// Get supplier by ID
exports.getSupplierById = async (req, res) => {
  try {
    const supplier = await Supplier.findById(req.params.id);

    if (!supplier) {
      return res.status(404).json({
        success: false,
        message: 'Supplier not found'
      });
    }

    res.status(200).json({
      success: true,
      data: supplier
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching supplier',
      error: error.message
    });
  }
};

// Create new supplier
exports.createSupplier = async (req, res) => {
  try {
    const supplierData = req.body;

    // Create supplier
    const supplier = await Supplier.create(supplierData);

    // Register on blockchain if wallet address provided
    if (supplierData.blockchain?.walletAddress && blockchainService) {
      try {
        const metadata = {
          supplierId: supplier._id.toString(),
          name: supplier.name,
          businessName: supplier.businessName,
          category: supplier.category,
          registeredAt: new Date().toISOString()
        };

        const result = await blockchainService.registerFarmer(
          supplierData.blockchain.walletAddress,
          JSON.stringify(metadata)
        );

        supplier.blockchain = {
          isRegistered: true,
          walletAddress: supplierData.blockchain.walletAddress,
          transactionHash: result.transactionHash,
          registeredAt: new Date(),
          verified: false
        };

        await supplier.save();

        console.log('✅ Supplier registered on blockchain:', result.transactionHash);
      } catch (blockchainError) {
        console.error('⚠️ Blockchain registration failed:', blockchainError.message);
        // Continue without blockchain - non-blocking
      }
    }

    res.status(201).json({
      success: true,
      message: 'Supplier created successfully',
      data: supplier
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Error creating supplier',
      error: error.message
    });
  }
};

// Update supplier
exports.updateSupplier = async (req, res) => {
  try {
    const supplier = await Supplier.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: Date.now() },
      { new: true, runValidators: true }
    );

    if (!supplier) {
      return res.status(404).json({
        success: false,
        message: 'Supplier not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Supplier updated successfully',
      data: supplier
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Error updating supplier',
      error: error.message
    });
  }
};

// Delete supplier
exports.deleteSupplier = async (req, res) => {
  try {
    const supplier = await Supplier.findByIdAndDelete(req.params.id);

    if (!supplier) {
      return res.status(404).json({
        success: false,
        message: 'Supplier not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Supplier deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting supplier',
      error: error.message
    });
  }
};

// Verify supplier on blockchain (Admin only)
exports.verifySupplierBlockchain = async (req, res) => {
  try {
    const supplier = await Supplier.findById(req.params.id);

    if (!supplier) {
      return res.status(404).json({
        success: false,
        message: 'Supplier not found'
      });
    }

    if (!supplier.blockchain?.walletAddress) {
      return res.status(400).json({
        success: false,
        message: 'Supplier does not have a blockchain wallet address'
      });
    }

    if (!blockchainService) {
      return res.status(503).json({
        success: false,
        message: 'Blockchain service is not available'
      });
    }

    // Verify on blockchain
    const result = await blockchainService.verifyFarmer(
      supplier.blockchain.walletAddress,
      true
    );

    supplier.blockchain.verified = true;
    supplier.blockchain.verificationHash = result.transactionHash;
    await supplier.save();

    res.status(200).json({
      success: true,
      message: 'Supplier verified on blockchain',
      data: {
        transactionHash: result.transactionHash,
        blockNumber: result.blockNumber
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error verifying supplier on blockchain',
      error: error.message
    });
  }
};

// Get supplier statistics
exports.getSupplierStats = async (req, res) => {
  try {
    const stats = await Supplier.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          active: {
            $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
          },
          pending: {
            $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
          },
          suspended: {
            $sum: { $cond: [{ $eq: ['$status', 'suspended'] }, 1, 0] }
          },
          blockchainRegistered: {
            $sum: { $cond: ['$blockchain.isRegistered', 1, 0] }
          },
          totalProducts: { $sum: { $size: { $ifNull: ['$products', []] } } },
          totalRevenue: { $sum: '$totalRevenue' }
        }
      }
    ]);

    const categoryBreakdown = await Supplier.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        overview: stats[0] || {
          total: 0,
          active: 0,
          pending: 0,
          suspended: 0,
          blockchainRegistered: 0,
          totalProducts: 0,
          totalRevenue: 0
        },
        categories: categoryBreakdown
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching supplier statistics',
      error: error.message
    });
  }
};

// Add product to supplier
exports.addProduct = async (req, res) => {
  try {
    const supplier = await Supplier.findById(req.params.id);

    if (!supplier) {
      return res.status(404).json({
        success: false,
        message: 'Supplier not found'
      });
    }

    supplier.products.push(req.body);
    await supplier.save();

    res.status(200).json({
      success: true,
      message: 'Product added successfully',
      data: supplier.products[supplier.products.length - 1]
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Error adding product',
      error: error.message
    });
  }
};

// Update product
exports.updateProduct = async (req, res) => {
  try {
    const supplier = await Supplier.findById(req.params.id);

    if (!supplier) {
      return res.status(404).json({
        success: false,
        message: 'Supplier not found'
      });
    }

    const product = supplier.products.id(req.params.productId);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    Object.assign(product, req.body);
    await supplier.save();

    res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      data: product
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Error updating product',
      error: error.message
    });
  }
};

// Delete product
exports.deleteProduct = async (req, res) => {
  try {
    const supplier = await Supplier.findById(req.params.id);

    if (!supplier) {
      return res.status(404).json({
        success: false,
        message: 'Supplier not found'
      });
    }

    supplier.products.id(req.params.productId).remove();
    await supplier.save();

    res.status(200).json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting product',
      error: error.message
    });
  }
};

// Get all orders for a supplier
exports.getSupplierOrders = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const query = { supplier: req.params.id };

    if (status) query.status = status;

    const skip = (page - 1) * limit;

    const orders = await SupplierOrder.find(query)
      .populate('farmer', 'firstName lastName email phone')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await SupplierOrder.countDocuments(query);

    res.status(200).json({
      success: true,
      data: orders,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching orders',
      error: error.message
    });
  }
};
