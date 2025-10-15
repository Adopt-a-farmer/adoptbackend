const { ethers } = require('ethers');
const path = require('path');
const fs = require('fs');

// Import ABIs from contracts folder
const FarmRegistryABI = require('../contracts/FarmRegistryUpgradeable.json');
const TraceabilityABI = require('../contracts/TraceabilityUpgradeable.json');
const MerkleAnchoringABI = require('../contracts/MerkleAnchoring.json');

class BlockchainService {
  constructor() {
    try {
      // Initialize provider
      const rpcUrl = process.env.BLOCKCHAIN_RPC_URL || 'http://127.0.0.1:8545';
      this.provider = new ethers.providers.JsonRpcProvider(rpcUrl);
      
      // Initialize wallet
      if (!process.env.BLOCKCHAIN_PRIVATE_KEY) {
        throw new Error('BLOCKCHAIN_PRIVATE_KEY not found in environment variables');
      }
      this.wallet = new ethers.Wallet(process.env.BLOCKCHAIN_PRIVATE_KEY, this.provider);
      
      // Initialize contracts
      this.farmRegistry = new ethers.Contract(
        process.env.FARM_REGISTRY_ADDRESS,
        FarmRegistryABI.abi,
        this.wallet
      );
      
      this.traceability = new ethers.Contract(
        process.env.TRACEABILITY_ADDRESS,
        TraceabilityABI.abi,
        this.wallet
      );
      
      this.merkleAnchoring = new ethers.Contract(
        process.env.MERKLE_ANCHORING_ADDRESS,
        MerkleAnchoringABI.abi,
        this.wallet
      );
      
      console.log('✅ Blockchain service initialized successfully');
      console.log('📍 Network:', process.env.BLOCKCHAIN_NETWORK);
      console.log('🏦 Farm Registry:', process.env.FARM_REGISTRY_ADDRESS);
      console.log('📦 Traceability:', process.env.TRACEABILITY_ADDRESS);
    } catch (error) {
      console.error('❌ Blockchain service initialization failed:', error.message);
      throw error;
    }
  }

  /**
   * Register a farmer on the blockchain
   * @param {string} farmerAddress - Farmer's blockchain wallet address
   * @param {string} metadataCID - IPFS CID or JSON metadata string
   * @returns {Promise<Object>} Transaction receipt
   */
  async registerFarmer(farmerAddress, metadataCID) {
    try {
      console.log(`📝 Registering farmer ${farmerAddress} on blockchain...`);
      
      // If no wallet address, use the service wallet (for testing)
      const addressToUse = farmerAddress || this.wallet.address;
      
      const tx = await this.farmRegistry.registerFarmer(metadataCID);
      const receipt = await tx.wait();
      
      console.log(`✅ Farmer registered! Tx: ${receipt.transactionHash}`);
      
      return {
        success: true,
        transactionHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        farmerAddress: addressToUse
      };
    } catch (error) {
      console.error('❌ Error registering farmer:', error.message);
      throw new Error(`Failed to register farmer on blockchain: ${error.message}`);
    }
  }

  /**
   * Verify a farmer on the blockchain (admin only)
   * @param {string} farmerAddress - Farmer's blockchain wallet address
   * @param {boolean} verified - Verification status
   * @returns {Promise<Object>} Transaction receipt
   */
  async verifyFarmer(farmerAddress, verified = true) {
    try {
      console.log(`🔍 ${verified ? 'Verifying' : 'Unverifying'} farmer ${farmerAddress}...`);
      
      const tx = await this.farmRegistry.verifyFarmer(farmerAddress, verified);
      const receipt = await tx.wait();
      
      console.log(`✅ Farmer ${verified ? 'verified' : 'unverified'}! Tx: ${receipt.transactionHash}`);
      
      return {
        success: true,
        transactionHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        verified
      };
    } catch (error) {
      console.error('❌ Error verifying farmer:', error.message);
      throw new Error(`Failed to verify farmer on blockchain: ${error.message}`);
    }
  }

  /**
   * Check if a farmer is verified on blockchain
   * @param {string} farmerAddress - Farmer's blockchain wallet address
   * @returns {Promise<boolean>} Verification status
   */
  async isFarmerVerified(farmerAddress) {
    try {
      const isVerified = await this.farmRegistry.isVerified(farmerAddress);
      return isVerified;
    } catch (error) {
      console.error('❌ Error checking verification:', error.message);
      return false;
    }
  }

  /**
   * Register a planting on the blockchain
   * @param {string} farmerAddress - Farmer's blockchain wallet address
   * @param {Object} plantingData - Planting information
   * @returns {Promise<Object>} Transaction receipt with product ID
   */
  async registerPlanting(farmerAddress, plantingData) {
    try {
      console.log(`🌱 Registering planting for farmer ${farmerAddress}...`);
      
      // Convert planting data to hash
      const dataString = JSON.stringify(plantingData);
      const plantingHash = ethers.utils.id(dataString);
      
      const tx = await this.traceability.registerPlanting(farmerAddress, plantingHash);
      const receipt = await tx.wait();
      
      // Get product ID from event
      const event = receipt.events.find(e => e.event === 'ProductRegistered');
      const productId = event ? event.args.productId.toNumber() : null;
      
      console.log(`✅ Planting registered! Product ID: ${productId}, Tx: ${receipt.transactionHash}`);
      
      return {
        success: true,
        productId,
        transactionHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        plantingHash
      };
    } catch (error) {
      console.error('❌ Error registering planting:', error.message);
      throw new Error(`Failed to register planting on blockchain: ${error.message}`);
    }
  }

  /**
   * Record germination observation
   * @param {number} productId - Product ID
   * @param {Object} observationData - Observation details
   * @returns {Promise<Object>} Transaction receipt
   */
  async recordGermination(productId, observationData) {
    try {
      console.log(`🌿 Recording germination for product ${productId}...`);
      
      const dataString = JSON.stringify(observationData);
      const observationHash = ethers.utils.id(dataString);
      
      const tx = await this.traceability.observeGermination(productId, observationHash);
      const receipt = await tx.wait();
      
      console.log(`✅ Germination recorded! Tx: ${receipt.transactionHash}`);
      
      return {
        success: true,
        transactionHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString()
      };
    } catch (error) {
      console.error('❌ Error recording germination:', error.message);
      throw new Error(`Failed to record germination: ${error.message}`);
    }
  }

  /**
   * Declare crop maturity
   * @param {number} productId - Product ID
   * @returns {Promise<Object>} Transaction receipt
   */
  async declareMaturity(productId) {
    try {
      console.log(`🌾 Declaring maturity for product ${productId}...`);
      
      const tx = await this.traceability.declareMaturity(productId);
      const receipt = await tx.wait();
      
      console.log(`✅ Maturity declared! Tx: ${receipt.transactionHash}`);
      
      return {
        success: true,
        transactionHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString()
      };
    } catch (error) {
      console.error('❌ Error declaring maturity:', error.message);
      throw new Error(`Failed to declare maturity: ${error.message}`);
    }
  }

  /**
   * Record harvest
   * @param {number} productId - Product ID
   * @param {number} quantityKg - Quantity in kilograms
   * @param {Object} harvestData - Harvest details
   * @returns {Promise<Object>} Transaction receipt
   */
  async recordHarvest(productId, quantityKg, harvestData) {
    try {
      console.log(`🚜 Recording harvest for product ${productId}...`);
      
      const dataString = JSON.stringify(harvestData);
      const harvestHash = ethers.utils.id(dataString);
      
      const tx = await this.traceability.recordHarvest(productId, quantityKg, harvestHash);
      const receipt = await tx.wait();
      
      // Get harvest batch ID from event
      const event = receipt.events.find(e => e.event === 'HarvestRecorded');
      const harvestBatchId = event ? event.args.harvestBatchId.toNumber() : null;
      
      console.log(`✅ Harvest recorded! Batch ID: ${harvestBatchId}, Tx: ${receipt.transactionHash}`);
      
      return {
        success: true,
        harvestBatchId,
        transactionHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString()
      };
    } catch (error) {
      console.error('❌ Error recording harvest:', error.message);
      throw new Error(`Failed to record harvest: ${error.message}`);
    }
  }

  /**
   * Record packaging
   * @param {number} harvestBatchId - Harvest batch ID
   * @param {number} packageQuantity - Package quantity
   * @param {Object} packagingData - Packaging details
   * @returns {Promise<Object>} Transaction receipt
   */
  async recordPackaging(harvestBatchId, packageQuantity, packagingData) {
    try {
      console.log(`📦 Recording packaging for harvest batch ${harvestBatchId}...`);
      
      const dataString = JSON.stringify(packagingData);
      const packageHash = ethers.utils.id(dataString);
      
      const tx = await this.traceability.recordPackaging(harvestBatchId, packageQuantity, packageHash);
      const receipt = await tx.wait();
      
      // Get package ID from event
      const event = receipt.events.find(e => e.event === 'Packaged');
      const packageId = event ? event.args.packageId.toNumber() : null;
      
      console.log(`✅ Packaging recorded! Package ID: ${packageId}, Tx: ${receipt.transactionHash}`);
      
      return {
        success: true,
        packageId,
        transactionHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString()
      };
    } catch (error) {
      console.error('❌ Error recording packaging:', error.message);
      throw new Error(`Failed to record packaging: ${error.message}`);
    }
  }

  /**
   * Add quality assurance record
   * @param {number} packageId - Package ID
   * @param {boolean} passed - QA pass status
   * @param {string} certificationHash - Certificate hash
   * @param {Object} qaData - QA details
   * @returns {Promise<Object>} Transaction receipt
   */
  async addQualityAssurance(packageId, passed, certificationHash, qaData) {
    try {
      console.log(`🔬 Adding quality assurance for package ${packageId}...`);
      
      const dataString = JSON.stringify(qaData);
      const qaHash = ethers.utils.id(dataString);
      
      const tx = await this.traceability.addQualityAssurance(
        packageId,
        passed,
        certificationHash,
        qaHash
      );
      const receipt = await tx.wait();
      
      console.log(`✅ Quality assurance added! Tx: ${receipt.transactionHash}`);
      
      return {
        success: true,
        transactionHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString()
      };
    } catch (error) {
      console.error('❌ Error adding quality assurance:', error.message);
      throw new Error(`Failed to add quality assurance: ${error.message}`);
    }
  }

  /**
   * Get product history from blockchain
   * @param {number} productId - Product ID
   * @returns {Promise<Object>} Product details
   */
  async getProductHistory(productId) {
    try {
      console.log(`📋 Fetching history for product ${productId}...`);
      
      const product = await this.traceability.products(productId);
      const harvestCount = await this.traceability.harvestBatchCount(productId);
      
      return {
        productId,
        farmer: product.farmer,
        plantedAt: new Date(product.plantedAt.toNumber() * 1000).toISOString(),
        plantingRecordHash: product.plantingRecordHash,
        isMature: product.isMature,
        harvestCount: harvestCount.toNumber()
      };
    } catch (error) {
      console.error('❌ Error fetching product history:', error.message);
      throw new Error(`Failed to fetch product history: ${error.message}`);
    }
  }

  /**
   * Get blockchain connection status
   * @returns {Promise<Object>} Connection info
   */
  async getConnectionStatus() {
    try {
      const network = await this.provider.getNetwork();
      const blockNumber = await this.provider.getBlockNumber();
      const balance = await this.wallet.getBalance();
      
      return {
        connected: true,
        network: network.name,
        chainId: network.chainId,
        blockNumber,
        walletAddress: this.wallet.address,
        balance: ethers.utils.formatEther(balance)
      };
    } catch (error) {
      return {
        connected: false,
        error: error.message
      };
    }
  }

  /**
   * Generate a blockchain address for a user (for demo purposes)
   * In production, users would connect their own wallets
   * @returns {Object} Wallet address and private key
   */
  generateWallet() {
    const wallet = ethers.Wallet.createRandom();
    return {
      address: wallet.address,
      privateKey: wallet.privateKey,
      mnemonic: wallet.mnemonic.phrase
    };
  }
}

// Export singleton instance
module.exports = new BlockchainService();
