const blockchainService = require('../services/blockchainService');
const User = require('../models/User');
const BlockchainTransaction = require('../models/BlockchainTransaction');

/**
 * @desc    Get blockchain connection status
 * @route   GET /api/blockchain/status
 * @access  Private
 */
exports.getBlockchainStatus = async (req, res) => {
  try {
    const status = await blockchainService.getConnectionStatus();
    
    res.json({
      success: true,
      ...status
    });
  } catch (error) {
    console.error('Error getting blockchain status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get blockchain status',
      message: error.message
    });
  }
};

/**
 * @desc    Generate blockchain wallet for user
 * @route   POST /api/blockchain/generate-wallet
 * @access  Private
 */
exports.generateWallet = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    // Check if user already has a wallet
    if (user.blockchainAddress) {
      return res.status(400).json({
        success: false,
        error: 'User already has a blockchain address',
        address: user.blockchainAddress
      });
    }
    
    // Generate new wallet
    const wallet = blockchainService.generateWallet();
    
    // Save address to user
    user.blockchainAddress = wallet.address;
    await user.save();
    
    res.json({
      success: true,
      message: 'Blockchain wallet generated successfully',
      address: wallet.address,
      // In production, don't send private key - user should manage it
      warning: 'IMPORTANT: Save your private key securely. This is the only time it will be shown.',
      privateKey: wallet.privateKey,
      mnemonic: wallet.mnemonic
    });
  } catch (error) {
    console.error('Error generating wallet:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate blockchain wallet',
      message: error.message
    });
  }
};

/**
 * @desc    Register farmer on blockchain
 * @route   POST /api/blockchain/register-farmer
 * @access  Private (Admin)
 */
exports.registerFarmerOnBlockchain = async (req, res) => {
  try {
    const { farmerId } = req.body;
    
    if (!farmerId) {
      return res.status(400).json({
        success: false,
        error: 'Farmer ID is required'
      });
    }
    
    const farmer = await User.findById(farmerId);
    
    if (!farmer) {
      return res.status(404).json({
        success: false,
        error: 'Farmer not found'
      });
    }
    
    if (farmer.role !== 'farmer') {
      return res.status(400).json({
        success: false,
        error: 'User is not a farmer'
      });
    }
    
    // Generate wallet if farmer doesn't have one
    if (!farmer.blockchainAddress) {
      const wallet = blockchainService.generateWallet();
      farmer.blockchainAddress = wallet.address;
      await farmer.save();
    }
    
    // Prepare metadata
    const metadata = JSON.stringify({
      farmerId: farmer._id,
      name: farmer.fullName,
      email: farmer.email,
      phone: farmer.phone,
      registeredAt: new Date().toISOString()
    });
    
    // Register on blockchain
    const result = await blockchainService.registerFarmer(farmer.blockchainAddress, metadata);
    
    // Save transaction record
    const transaction = await BlockchainTransaction.create({
      userId: farmer._id,
      transactionHash: result.transactionHash,
      blockNumber: result.blockNumber,
      contractAddress: process.env.FARM_REGISTRY_ADDRESS,
      eventType: 'FARMER_REGISTERED',
      gasUsed: result.gasUsed,
      metadata: { farmerAddress: result.farmerAddress }
    });
    
    // Update farmer record
    farmer.blockchainRegistrationTxHash = result.transactionHash;
    await farmer.save();
    
    res.json({
      success: true,
      message: 'Farmer registered on blockchain successfully',
      farmer: {
        id: farmer._id,
        name: farmer.fullName,
        blockchainAddress: farmer.blockchainAddress
      },
      transaction: {
        hash: result.transactionHash,
        blockNumber: result.blockNumber,
        gasUsed: result.gasUsed,
        explorerUrl: transaction.explorerUrl
      }
    });
  } catch (error) {
    console.error('Error registering farmer on blockchain:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to register farmer on blockchain',
      message: error.message
    });
  }
};

/**
 * @desc    Verify farmer on blockchain
 * @route   POST /api/blockchain/verify-farmer
 * @access  Private (Admin)
 */
exports.verifyFarmerOnBlockchain = async (req, res) => {
  try {
    const { farmerId, verified = true } = req.body;
    
    if (!farmerId) {
      return res.status(400).json({
        success: false,
        error: 'Farmer ID is required'
      });
    }
    
    const farmer = await User.findById(farmerId);
    
    if (!farmer) {
      return res.status(404).json({
        success: false,
        error: 'Farmer not found'
      });
    }
    
    if (!farmer.blockchainAddress) {
      return res.status(400).json({
        success: false,
        error: 'Farmer must be registered on blockchain first'
      });
    }
    
    // Verify on blockchain
    const result = await blockchainService.verifyFarmer(farmer.blockchainAddress, verified);
    
    // Save transaction record
    const transaction = await BlockchainTransaction.create({
      userId: farmer._id,
      transactionHash: result.transactionHash,
      blockNumber: result.blockNumber,
      contractAddress: process.env.FARM_REGISTRY_ADDRESS,
      eventType: verified ? 'FARMER_VERIFIED' : 'FARMER_UNVERIFIED',
      gasUsed: result.gasUsed,
      metadata: { verified }
    });
    
    // Update farmer record
    farmer.blockchainVerified = verified;
    farmer.blockchainVerificationTxHash = result.transactionHash;
    farmer.isVerified = verified; // Also update main verification status
    farmer.verificationStatus = verified ? 'verified' : 'rejected';
    await farmer.save();
    
    res.json({
      success: true,
      message: `Farmer ${verified ? 'verified' : 'unverified'} on blockchain successfully`,
      farmer: {
        id: farmer._id,
        name: farmer.fullName,
        blockchainAddress: farmer.blockchainAddress,
        blockchainVerified: farmer.blockchainVerified
      },
      transaction: {
        hash: result.transactionHash,
        blockNumber: result.blockNumber,
        gasUsed: result.gasUsed,
        explorerUrl: transaction.explorerUrl
      }
    });
  } catch (error) {
    console.error('Error verifying farmer on blockchain:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify farmer on blockchain',
      message: error.message
    });
  }
};

/**
 * @desc    Check farmer verification status on blockchain
 * @route   GET /api/blockchain/farmer/:farmerId/verification
 * @access  Private
 */
exports.getFarmerVerificationStatus = async (req, res) => {
  try {
    const { farmerId } = req.params;
    
    const farmer = await User.findById(farmerId);
    
    if (!farmer) {
      return res.status(404).json({
        success: false,
        error: 'Farmer not found'
      });
    }
    
    if (!farmer.blockchainAddress) {
      return res.json({
        success: true,
        verified: false,
        message: 'Farmer not registered on blockchain',
        blockchainAddress: null
      });
    }
    
    // Check verification status on blockchain
    const isVerified = await blockchainService.isFarmerVerified(farmer.blockchainAddress);
    
    res.json({
      success: true,
      verified: isVerified,
      blockchainAddress: farmer.blockchainAddress,
      registrationTx: farmer.blockchainRegistrationTxHash,
      verificationTx: farmer.blockchainVerificationTxHash
    });
  } catch (error) {
    console.error('Error checking farmer verification:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check farmer verification status',
      message: error.message
    });
  }
};

/**
 * @desc    Register planting on blockchain
 * @route   POST /api/blockchain/register-planting
 * @access  Private (Farmer)
 */
exports.registerPlantingOnBlockchain = async (req, res) => {
  try {
    const { cropType, areaSize, plantingDate, farmId, location } = req.body;
    const userId = req.user.id;
    
    const farmer = await User.findById(userId);
    
    if (!farmer || farmer.role !== 'farmer') {
      return res.status(403).json({
        success: false,
        error: 'Only farmers can register plantings'
      });
    }
    
    if (!farmer.blockchainAddress) {
      return res.status(400).json({
        success: false,
        error: 'Farmer must be registered on blockchain first'
      });
    }
    
    // Prepare planting data
    const plantingData = {
      farmerId: farmer._id,
      farmId,
      cropType,
      areaSize,
      plantingDate: plantingDate || new Date().toISOString(),
      location,
      farmerName: farmer.fullName
    };
    
    // Register on blockchain
    const result = await blockchainService.registerPlanting(farmer.blockchainAddress, plantingData);
    
    // Save transaction record
    const transaction = await BlockchainTransaction.create({
      userId: farmer._id,
      transactionHash: result.transactionHash,
      blockNumber: result.blockNumber,
      contractAddress: process.env.TRACEABILITY_ADDRESS,
      eventType: 'PLANTING_REGISTERED',
      productId: result.productId,
      dataHash: result.plantingHash,
      gasUsed: result.gasUsed,
      metadata: plantingData
    });
    
    res.json({
      success: true,
      message: 'Planting registered on blockchain successfully',
      productId: result.productId,
      transaction: {
        hash: result.transactionHash,
        blockNumber: result.blockNumber,
        gasUsed: result.gasUsed,
        explorerUrl: transaction.explorerUrl
      }
    });
  } catch (error) {
    console.error('Error registering planting on blockchain:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to register planting on blockchain',
      message: error.message
    });
  }
};

/**
 * @desc    Get product history from blockchain
 * @route   GET /api/blockchain/product/:productId
 * @access  Public
 */
exports.getProductHistory = async (req, res) => {
  try {
    const { productId } = req.params;
    
    if (!productId || isNaN(productId)) {
      return res.status(400).json({
        success: false,
        error: 'Valid product ID is required'
      });
    }
    
    // Get product history from blockchain
    const history = await blockchainService.getProductHistory(parseInt(productId));
    
    // Get related transactions from database
    const transactions = await BlockchainTransaction.find({ productId: parseInt(productId) })
      .sort({ createdAt: 1 })
      .select('eventType transactionHash blockNumber createdAt metadata explorerUrl');
    
    res.json({
      success: true,
      product: history,
      transactions
    });
  } catch (error) {
    console.error('Error getting product history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get product history',
      message: error.message
    });
  }
};

/**
 * @desc    Get user's blockchain transactions
 * @route   GET /api/blockchain/transactions
 * @access  Private
 */
exports.getUserTransactions = async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 50, page = 1 } = req.query;
    
    const transactions = await BlockchainTransaction.find({ userId })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .select('-__v');
    
    const total = await BlockchainTransaction.countDocuments({ userId });
    
    res.json({
      success: true,
      transactions,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error getting transactions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get transactions',
      message: error.message
    });
  }
};

/**
 * @desc    Record germination observation on blockchain
 * @route   POST /api/blockchain/record-germination
 * @access  Private (Farmer or Field Observer)
 */
exports.recordGerminationOnBlockchain = async (req, res) => {
  try {
    const { productId, germinationPercent, notes, photos } = req.body;
    
    if (!productId || germinationPercent === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Product ID and germination percentage are required'
      });
    }
    
    if (germinationPercent < 0 || germinationPercent > 100) {
      return res.status(400).json({
        success: false,
        error: 'Germination percentage must be between 0 and 100'
      });
    }
    
    const observationData = {
      productId: parseInt(productId),
      germinationPercent: parseInt(germinationPercent),
      observedBy: req.user.id,
      observerName: req.user.fullName,
      notes,
      photos: photos || [],
      observedAt: new Date().toISOString()
    };
    
    // Record on blockchain
    const result = await blockchainService.recordGermination(
      parseInt(productId),
      observationData
    );
    
    // Save transaction record
    const transaction = await BlockchainTransaction.create({
      userId: req.user.id,
      transactionHash: result.transactionHash,
      blockNumber: result.blockNumber,
      contractAddress: process.env.TRACEABILITY_ADDRESS,
      eventType: 'GERMINATION_OBSERVED',
      productId: parseInt(productId),
      metadata: observationData,
      gasUsed: result.gasUsed
    });
    
    res.json({
      success: true,
      message: 'Germination recorded on blockchain successfully',
      productId: parseInt(productId),
      germinationPercent: parseInt(germinationPercent),
      transaction: {
        hash: result.transactionHash,
        blockNumber: result.blockNumber,
        gasUsed: result.gasUsed,
        explorerUrl: transaction.explorerUrl
      }
    });
  } catch (error) {
    console.error('Error recording germination:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to record germination on blockchain',
      message: error.message
    });
  }
};

/**
 * @desc    Declare crop maturity on blockchain
 * @route   POST /api/blockchain/declare-maturity
 * @access  Private (Farmer)
 */
exports.declareMaturityOnBlockchain = async (req, res) => {
  try {
    const { productId, maturityNotes, qualityGrade, estimatedYield } = req.body;
    
    if (!productId) {
      return res.status(400).json({
        success: false,
        error: 'Product ID is required'
      });
    }
    
    const farmer = await User.findById(req.user.id);
    
    if (!farmer || farmer.role !== 'farmer') {
      return res.status(403).json({
        success: false,
        error: 'Only farmers can declare maturity'
      });
    }
    
    const maturityData = {
      productId: parseInt(productId),
      declaredBy: req.user.id,
      farmerName: req.user.fullName,
      maturityNotes,
      qualityGrade: qualityGrade || 'A',
      estimatedYield,
      declaredAt: new Date().toISOString()
    };
    
    // Declare on blockchain
    const result = await blockchainService.declareMaturity(parseInt(productId));
    
    // Save transaction record
    const transaction = await BlockchainTransaction.create({
      userId: req.user.id,
      transactionHash: result.transactionHash,
      blockNumber: result.blockNumber,
      contractAddress: process.env.TRACEABILITY_ADDRESS,
      eventType: 'MATURITY_DECLARED',
      productId: parseInt(productId),
      metadata: maturityData,
      gasUsed: result.gasUsed
    });
    
    res.json({
      success: true,
      message: 'Maturity declared on blockchain successfully',
      productId: parseInt(productId),
      transaction: {
        hash: result.transactionHash,
        blockNumber: result.blockNumber,
        gasUsed: result.gasUsed,
        explorerUrl: transaction.explorerUrl
      }
    });
  } catch (error) {
    console.error('Error declaring maturity:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to declare maturity on blockchain',
      message: error.message
    });
  }
};

/**
 * @desc    Record harvest on blockchain
 * @route   POST /api/blockchain/record-harvest
 * @access  Private (Farmer or Harvester)
 */
exports.recordHarvestOnBlockchain = async (req, res) => {
  try {
    const { productId, quantityKg, qualityGrade, harvestNotes, photos } = req.body;
    
    if (!productId || !quantityKg) {
      return res.status(400).json({
        success: false,
        error: 'Product ID and quantity are required'
      });
    }
    
    const harvestData = {
      productId: parseInt(productId),
      quantityKg: parseFloat(quantityKg),
      qualityGrade: qualityGrade || 'A',
      harvestedBy: req.user.id,
      harvesterName: req.user.fullName,
      harvestNotes,
      photos: photos || [],
      harvestedAt: new Date().toISOString()
    };
    
    // Record on blockchain
    const result = await blockchainService.recordHarvest(
      parseInt(productId),
      parseFloat(quantityKg),
      harvestData
    );
    
    // Save transaction record
    const transaction = await BlockchainTransaction.create({
      userId: req.user.id,
      transactionHash: result.transactionHash,
      blockNumber: result.blockNumber,
      contractAddress: process.env.TRACEABILITY_ADDRESS,
      eventType: 'HARVEST_RECORDED',
      productId: parseInt(productId),
      metadata: harvestData,
      gasUsed: result.gasUsed
    });
    
    res.json({
      success: true,
      message: 'Harvest recorded on blockchain successfully',
      productId: parseInt(productId),
      harvestBatchId: result.harvestBatchId,
      quantity: parseFloat(quantityKg),
      transaction: {
        hash: result.transactionHash,
        blockNumber: result.blockNumber,
        gasUsed: result.gasUsed,
        explorerUrl: transaction.explorerUrl
      }
    });
  } catch (error) {
    console.error('Error recording harvest:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to record harvest on blockchain',
      message: error.message
    });
  }
};

/**
 * @desc    Record packaging on blockchain
 * @route   POST /api/blockchain/record-packaging
 * @access  Private (Packager)
 */
exports.recordPackagingOnBlockchain = async (req, res) => {
  try {
    const { harvestBatchId, packageQuantity, packageType, batchNumber, expiryDate } = req.body;
    
    if (!harvestBatchId || !packageQuantity) {
      return res.status(400).json({
        success: false,
        error: 'Harvest batch ID and package quantity are required'
      });
    }
    
    const packagingData = {
      harvestBatchId: parseInt(harvestBatchId),
      packageQuantity: parseInt(packageQuantity),
      packageType: packageType || 'Standard',
      batchNumber,
      expiryDate,
      packagedBy: req.user.id,
      packagerName: req.user.fullName,
      packagedAt: new Date().toISOString()
    };
    
    // Record on blockchain
    const result = await blockchainService.recordPackaging(
      parseInt(harvestBatchId),
      parseInt(packageQuantity),
      packagingData
    );
    
    // Save transaction record
    const transaction = await BlockchainTransaction.create({
      userId: req.user.id,
      transactionHash: result.transactionHash,
      blockNumber: result.blockNumber,
      contractAddress: process.env.TRACEABILITY_ADDRESS,
      eventType: 'PACKAGING_RECORDED',
      metadata: packagingData,
      gasUsed: result.gasUsed
    });
    
    res.json({
      success: true,
      message: 'Packaging recorded on blockchain successfully',
      packageId: result.packageId,
      transaction: {
        hash: result.transactionHash,
        blockNumber: result.blockNumber,
        gasUsed: result.gasUsed,
        explorerUrl: transaction.explorerUrl
      }
    });
  } catch (error) {
    console.error('Error recording packaging:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to record packaging on blockchain',
      message: error.message
    });
  }
};

/**
 * @desc    Add quality assurance record on blockchain
 * @route   POST /api/blockchain/add-quality-assurance
 * @access  Private (QA Inspector)
 */
exports.addQualityAssuranceOnBlockchain = async (req, res) => {
  try {
    const { packageId, passed, certificationHash, labName, testResults, notes } = req.body;
    
    if (!packageId || passed === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Package ID and pass/fail status are required'
      });
    }
    
    const qaData = {
      packageId: parseInt(packageId),
      passed: Boolean(passed),
      certificationHash: certificationHash || '',
      labName: labName || 'Default QA Lab',
      inspectedBy: req.user.id,
      inspectorName: req.user.fullName,
      testResults: testResults || {},
      notes,
      inspectedAt: new Date().toISOString()
    };
    
    // Record on blockchain
    const result = await blockchainService.addQualityAssurance(
      parseInt(packageId),
      Boolean(passed),
      certificationHash || '',
      qaData
    );
    
    // Save transaction record
    const transaction = await BlockchainTransaction.create({
      userId: req.user.id,
      transactionHash: result.transactionHash,
      blockNumber: result.blockNumber,
      contractAddress: process.env.TRACEABILITY_ADDRESS,
      eventType: 'QUALITY_ASSURANCE_ADDED',
      metadata: qaData,
      gasUsed: result.gasUsed
    });
    
    res.json({
      success: true,
      message: 'Quality assurance record added to blockchain successfully',
      packageId: parseInt(packageId),
      passed: Boolean(passed),
      transaction: {
        hash: result.transactionHash,
        blockNumber: result.blockNumber,
        gasUsed: result.gasUsed,
        explorerUrl: transaction.explorerUrl
      }
    });
  } catch (error) {
    console.error('Error adding quality assurance:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add quality assurance record to blockchain',
      message: error.message
    });
  }
};

/**
 * @desc    Get crop lifecycle status for user's products
 * @route   GET /api/blockchain/crop-lifecycle
 * @access  Private
 */
exports.getCropLifecycleStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get all planting transactions for this user
    const plantingTransactions = await BlockchainTransaction.find({
      userId,
      eventType: 'PLANTING_REGISTERED'
    }).sort({ createdAt: -1 });
    
    const products = [];
    
    for (const tx of plantingTransactions) {
      const productId = tx.productId;
      
      // Get all lifecycle events for this product
      const allEvents = await BlockchainTransaction.find({ productId })
        .sort({ createdAt: 1 })
        .select('eventType createdAt metadata transactionHash');
      
      // Determine current stage
      const stages = {
        planted: allEvents.some(e => e.eventType === 'PLANTING_REGISTERED'),
        germinated: allEvents.some(e => e.eventType === 'GERMINATION_OBSERVED'),
        mature: allEvents.some(e => e.eventType === 'MATURITY_DECLARED'),
        harvested: allEvents.some(e => e.eventType === 'HARVEST_RECORDED'),
        packaged: allEvents.some(e => e.eventType === 'PACKAGING_RECORDED'),
        qaCompleted: allEvents.some(e => e.eventType === 'QUALITY_ASSURANCE_ADDED')
      };
      
      // Calculate completion percentage
      const completedStages = Object.values(stages).filter(Boolean).length;
      const totalStages = 6;
      const completionPercentage = Math.round((completedStages / totalStages) * 100);
      
      // Get planting metadata
      const plantingEvent = allEvents.find(e => e.eventType === 'PLANTING_REGISTERED');
      
      products.push({
        productId,
        cropType: plantingEvent?.metadata?.cropType || 'Unknown',
        plantingDate: plantingEvent?.createdAt,
        stages,
        completionPercentage,
        currentStage: getCurrentStage(stages),
        nextAction: getNextAction(stages),
        events: allEvents.map(e => ({
          type: e.eventType,
          date: e.createdAt,
          txHash: e.transactionHash
        }))
      });
    }
    
    res.json({
      success: true,
      products,
      summary: {
        totalProducts: products.length,
        inProgress: products.filter(p => p.completionPercentage < 100).length,
        completed: products.filter(p => p.completionPercentage === 100).length
      }
    });
  } catch (error) {
    console.error('Error getting crop lifecycle status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get crop lifecycle status',
      message: error.message
    });
  }
};

// Helper function to determine current stage
function getCurrentStage(stages) {
  if (stages.qaCompleted) return 'Quality Assured';
  if (stages.packaged) return 'Packaged';
  if (stages.harvested) return 'Harvested';
  if (stages.mature) return 'Mature';
  if (stages.germinated) return 'Germinated';
  if (stages.planted) return 'Planted';
  return 'Unknown';
}

// Helper function to get next action
function getNextAction(stages) {
  if (!stages.germinated) return 'Record Germination';
  if (!stages.mature) return 'Declare Maturity';
  if (!stages.harvested) return 'Record Harvest';
  if (!stages.packaged) return 'Record Packaging';
  if (!stages.qaCompleted) return 'Add Quality Assurance';
  return 'Complete';
}
