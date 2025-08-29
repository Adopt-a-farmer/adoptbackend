const FarmerProfile = require('../models/FarmerProfile');
const User = require('../models/User');

/**
 * Service class for farmer profile management
 */
class FarmerProfileService {
  
  /**
   * Validate and clean farmer profile data before saving
   * @param {Object} profileData - Raw profile data from request
   * @param {Object} user - User object for fallback values
   * @returns {Object} Cleaned and validated profile data
   */
  static validateAndCleanProfileData(profileData, user) {
    const cleaned = {};
    
    // Farm name handling
    if (profileData.farmName !== undefined) {
      const farmName = profileData.farmName.trim();
      cleaned.farmName = farmName || `${user.firstName || ''} ${user.lastName || ''}'s Farm`.trim();
    }
    
    // Description handling - reject default values
    if (profileData.description !== undefined) {
      const desc = profileData.description.trim();
      if (desc === 'New farmer profile - please update your information' || desc === '') {
        cleaned.description = '';
      } else {
        cleaned.description = desc;
      }
    }
    
    // Location handling - reject default values
    if (profileData.location) {
      cleaned.location = {};
      
      if (profileData.location.county !== undefined) {
        const county = profileData.location.county.trim();
        cleaned.location.county = county === 'Default County' ? '' : county;
      }
      
      if (profileData.location.subCounty !== undefined) {
        const subCounty = profileData.location.subCounty.trim();
        cleaned.location.subCounty = subCounty === 'Default Sub-County' ? '' : subCounty;
      }
      
      if (profileData.location.village !== undefined) {
        cleaned.location.village = profileData.location.village.trim();
      }
      
      if (profileData.location.coordinates) {
        cleaned.location.coordinates = {
          latitude: parseFloat(profileData.location.coordinates.latitude),
          longitude: parseFloat(profileData.location.coordinates.longitude)
        };
      }
    }
    
    // Farm size handling
    if (profileData.farmSize) {
      cleaned.farmSize = {};
      if (profileData.farmSize.value !== undefined) {
        cleaned.farmSize.value = Math.max(0.1, parseFloat(profileData.farmSize.value) || 0.1);
      }
      if (profileData.farmSize.unit) {
        cleaned.farmSize.unit = ['acres', 'hectares'].includes(profileData.farmSize.unit.toLowerCase()) 
          ? profileData.farmSize.unit.toLowerCase() 
          : 'acres';
      }
    }
    
    // Farming type handling
    if (profileData.farmingType !== undefined) {
      const allowedTypes = ['crop', 'livestock', 'mixed', 'aquaculture', 'apiary'];
      if (Array.isArray(profileData.farmingType)) {
        cleaned.farmingType = profileData.farmingType
          .map(type => type.toLowerCase())
          .filter(type => allowedTypes.includes(type));
      } else if (typeof profileData.farmingType === 'string') {
        const type = profileData.farmingType.toLowerCase();
        cleaned.farmingType = allowedTypes.includes(type) ? [type] : ['crop'];
      }
    }
    
    // Crop types handling
    if (profileData.cropTypes !== undefined) {
      const allowedCrops = ['maize', 'beans', 'rice', 'wheat', 'vegetables', 'fruits', 'coffee', 'tea', 'sugarcane', 'cotton', 'sunflower', 'sorghum', 'millet'];
      cleaned.cropTypes = this.normalizeArrayField(profileData.cropTypes, allowedCrops);
    }
    
    // Farming methods handling
    if (profileData.farmingMethods !== undefined) {
      const allowedMethods = ['organic', 'conventional', 'permaculture', 'hydroponics', 'agroforestry', 'conservation_agriculture', 'precision_farming', 'sustainable_agriculture'];
      cleaned.farmingMethods = this.normalizeArrayField(profileData.farmingMethods, allowedMethods);
    }
    
    // Contact info handling
    if (profileData.contactInfo) {
      cleaned.contactInfo = {};
      if (profileData.contactInfo.phone !== undefined) {
        cleaned.contactInfo.phone = profileData.contactInfo.phone.trim();
      }
      if (profileData.contactInfo.email !== undefined) {
        cleaned.contactInfo.email = profileData.contactInfo.email.trim();
      }
      if (profileData.contactInfo.website !== undefined) {
        cleaned.contactInfo.website = profileData.contactInfo.website.trim();
      }
    }
    
    // Social media handling
    if (profileData.socialMedia) {
      cleaned.socialMedia = {};
      ['facebook', 'twitter', 'instagram'].forEach(platform => {
        if (profileData.socialMedia[platform] !== undefined) {
          cleaned.socialMedia[platform] = profileData.socialMedia[platform].trim();
        }
      });
    }
    
    // Arrays that can be directly assigned if provided
    ['crops', 'livestock', 'certifications'].forEach(field => {
      if (Array.isArray(profileData[field])) {
        cleaned[field] = profileData[field];
      }
    });
    
    // Other fields
    if (profileData.establishedYear !== undefined) {
      const year = parseInt(profileData.establishedYear, 10);
      if (year >= 1900 && year <= 2100) {
        cleaned.establishedYear = year;
      }
    }
    
    if (profileData.media) {
      cleaned.media = profileData.media;
    }
    
    if (profileData.bankDetails) {
      cleaned.bankDetails = profileData.bankDetails;
    }
    
    return cleaned;
  }
  
  /**
   * Normalize array fields (crop types, farming methods, etc.)
   * @param {*} value - Input value (can be array, object, or string)
   * @param {Array} allowedValues - Array of allowed values
   * @returns {Array} Normalized array
   */
  static normalizeArrayField(value, allowedValues) {
    let values = [];
    
    if (Array.isArray(value)) {
      values = value.map(item => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object') return item.value || item.name || '';
        return '';
      });
    } else if (typeof value === 'object' && value !== null) {
      // Handle object with boolean values { maize: true, beans: false, ... }
      values = Object.keys(value).filter(k => !!value[k]);
    } else if (typeof value === 'string') {
      values = [value];
    }
    
    return values
      .map(v => String(v).toLowerCase().trim().replace(/\\s+/g, '_'))
      .filter(v => allowedValues.includes(v));
  }
  
  /**
   * Check if a farmer profile is complete
   * @param {Object} profile - Farmer profile object
   * @returns {Object} Completion status and missing fields
   */
  static checkProfileCompletion(profile) {
    const required = [
      'farmName',
      'description',
      'location.county',
      'location.subCounty',
      'farmSize.value',
      'farmingType'
    ];
    
    const recommended = [
      'location.village',
      'cropTypes',
      'farmingMethods',
      'contactInfo.phone',
      'media.profileImage'
    ];
    
    const missing = [];
    const missingRecommended = [];
    
    required.forEach(field => {
      const value = this.getNestedValue(profile, field);
      if (!value || (typeof value === 'string' && value.trim() === '') || 
          (Array.isArray(value) && value.length === 0)) {
        missing.push(field);
      }
    });
    
    recommended.forEach(field => {
      const value = this.getNestedValue(profile, field);
      if (!value || (typeof value === 'string' && value.trim() === '') || 
          (Array.isArray(value) && value.length === 0)) {
        missingRecommended.push(field);
      }
    });
    
    const completionPercentage = Math.round(
      ((required.length - missing.length) / required.length) * 100
    );
    
    return {
      isComplete: missing.length === 0,
      completionPercentage,
      missingRequired: missing,
      missingRecommended
    };
  }
  
  /**
   * Get nested object value by path
   * @param {Object} obj - Object to search in
   * @param {string} path - Dot notation path (e.g., 'location.county')
   * @returns {*} Value at path or undefined
   */
  static getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }
  
  /**
   * Get farmer statistics for dashboard
   * @param {string} userId - User ID of the farmer
   * @returns {Object} Farmer statistics
   */
  static async getFarmerStats(userId) {
    try {
      const Adoption = require('../models/Adoption');
      const Payment = require('../models/Payment');
      const FarmUpdate = require('../models/FarmUpdate');
      const FarmVisit = require('../models/FarmVisit');
      const Message = require('../models/Message');
      
      const farmer = await FarmerProfile.findOne({ user: userId });
      if (!farmer) {
        throw new Error('Farmer profile not found');
      }
      
      // Get all related data in parallel
      const [adoptions, payments, farmUpdates, visits, unreadMessages] = await Promise.all([
        Adoption.find({ farmer: userId }),
        Payment.find({ 'metadata.farmerName': farmer.farmName, status: 'success' }),
        FarmUpdate.find({ farmer: farmer._id }),
        FarmVisit.find({ farmer: userId }),
        Message.countDocuments({ recipient: userId, isRead: false })
      ]);
      
      // Calculate stats
      const totalEarnings = payments.reduce((sum, p) => sum + (p.netAmount || 0), 0);
      const activeAdoptions = adoptions.filter(a => a.status === 'active').length;
      const upcomingVisits = visits.filter(v => 
        v.status === 'confirmed' && new Date(v.requestedDate) > new Date()
      ).length;
      
      return {
        totalAdopters: activeAdoptions,
        totalEarnings,
        totalUpdates: farmUpdates.length,
        upcomingVisits,
        unreadMessages,
        totalVisits: visits.length,
        completedVisits: visits.filter(v => v.status === 'completed').length,
        profileCompletion: this.checkProfileCompletion(farmer)
      };
    } catch (error) {
      console.error('Error calculating farmer stats:', error);
      throw error;
    }
  }
}

module.exports = FarmerProfileService;