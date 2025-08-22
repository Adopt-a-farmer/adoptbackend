const FarmerProfile = require('../models/FarmerProfile');
const User = require('../models/User');
const Adoption = require('../models/Adoption');
const Payment = require('../models/Payment');
const { uploadImage, uploadVideo, deleteFile } = require('../utils/cloudinaryUtils');

// @desc    Get all farmers (public browsing)
// @route   GET /api/farmers
// @access  Public
const getFarmers = async (req, res) => {
  try {
    console.log('[FARMERS API] GET /api/farmers called');
    console.log('[FARMERS API] Query parameters:', req.query);
    
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const skip = (page - 1) * limit;

    console.log('[FARMERS API] Pagination:', { page, limit, skip });

    // Build filter object
    const filter = { verificationStatus: 'verified', isActive: true };
    
    if (req.query.county) {
      filter['location.county'] = new RegExp(req.query.county, 'i');
    }
    
    if (req.query.farmingType) {
      filter.farmingType = { $in: [req.query.farmingType] };
    }
    
    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search, 'i');
      filter.$or = [
        { farmName: searchRegex },
        { description: searchRegex },
        { 'crops.name': searchRegex },
        { 'livestock.type': searchRegex }
      ];
    }

    console.log('[FARMERS API] Applied filters:', filter);

    // Sort options
    let sort = { createdAt: -1 }; // Default: newest first
    if (req.query.sort === 'rating') {
      sort = { 'rating.average': -1 };
    } else if (req.query.sort === 'funding') {
      sort = { 'adoptionStats.totalFunding': -1 };
    }

    console.log('[FARMERS API] Sort criteria:', sort);

    const farmers = await FarmerProfile.find(filter)
      .populate('user', 'firstName lastName avatar')
      .sort(sort)
      .skip(skip)
      .limit(limit);

    const total = await FarmerProfile.countDocuments(filter);

    console.log(`[FARMERS API] Found ${farmers.length} farmers out of ${total} total`);
    console.log('[FARMERS API] Farmers data:', farmers.map(f => ({
      id: f._id,
      farmName: f.farmName,
      user: f.user ? `${f.user.firstName} ${f.user.lastName}` : 'No user',
      location: f.location,
      farmingType: f.farmingType
    })));

    const response = {
      success: true,
      data: {
        farmers,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total,
          hasNext: page * limit < total,
          hasPrev: page > 1
        }
      }
    };

    console.log('[FARMERS API] Response pagination:', response.data.pagination);

    res.json(response);
  } catch (error) {
    console.error('[FARMERS API] Get farmers error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get current farmer profile
// @route   GET /api/farmers/me
// @access  Private (Farmer)
const getCurrentFarmerProfile = async (req, res) => {
  try {
    const userId = req.user._id;

    // Find farmer profile by user ID
    const farmer = await FarmerProfile.findOne({ user: userId })
      .populate('user', 'firstName lastName avatar phone email');

    if (!farmer) {
      return res.status(404).json({
        success: false,
        message: 'Farmer profile not found'
      });
    }

    console.log('[FARMERS API] GET profile - cropTypes:', farmer.cropTypes);
    console.log('[FARMERS API] GET profile - farmingMethods:', farmer.farmingMethods);
    console.log('[FARMERS API] GET profile - location:', farmer.location);
    console.log('[FARMERS API] GET profile - farmSize:', farmer.farmSize);

    res.json({
      success: true,
      data: {
        profile: farmer
      }
    });
  } catch (error) {
    console.error('Get current farmer profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get single farmer profile
// @route   GET /api/farmers/:id
// @access  Public
const getFarmerById = async (req, res) => {
  try {
    // Special handling for routes that might be confused with API endpoints
    if (req.params.id === 'adopters' || req.params.id === 'undefined') {
      return res.status(400).json({
        success: false,
        message: 'Invalid farmer ID'
      });
    }

    // Check if the ID is a valid MongoDB ObjectId
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid farmer ID format'
      });
    }

    const farmer = await FarmerProfile.findById(req.params.id)
      .populate('user', 'firstName lastName avatar phone email');

    if (!farmer || !farmer.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Farmer not found'
      });
    }

    // Get adoption statistics
    const adoptions = await Adoption.find({ 
      farmer: farmer.user._id, 
      status: { $in: ['active', 'completed'] }
    });

    res.json({
      success: true,
      data: {
        farmer,
        adoptionCount: adoptions.length
      }
    });
  } catch (error) {
    console.error('Get farmer by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Update farmer profile (full or partial)
// @route   PUT/PATCH /api/farmers/profile
// @access  Private (Farmer only)
const updateFarmerProfile = async (req, res) => {
  try {
    const userId = req.user._id;
    const updateData = req.body || {};
  console.log(`[FARMERS API] ${req.method} /api/farmers/profile by ${userId} - incoming:`, JSON.stringify(updateData));
  console.log(`[FARMERS API] cropTypes in request:`, updateData.cropTypes);
  console.log(`[FARMERS API] farmingMethods in request:`, updateData.farmingMethods);

    // Build update object to only include provided fields (supports PATCH)
  const buildUpdate = (data) => {
      const update = {};
      const assign = (path, value) => {
        if (value === undefined) return;
        // Avoid setting empty strings for required fields during partial updates
        if (req.method === 'PATCH' && typeof value === 'string' && value.trim() === '') return;
        update[path] = value;
      };
  const normalizeKey = (v) => String(v).toLowerCase().trim().replace(/\s+/g, '_');

      assign('farmName', data.farmName);
      assign('description', data.description);
      if (data.location) {
        assign('location.county', data.location.county);
        assign('location.subCounty', data.location.subCounty);
        assign('location.village', data.location.village);
        if (data.location.coordinates) {
          assign('location.coordinates.latitude', data.location.coordinates.latitude);
          assign('location.coordinates.longitude', data.location.coordinates.longitude);
        }
      }
      if (data.farmSize) {
        assign('farmSize.value', data.farmSize.value);
        if (data.farmSize.unit) assign('farmSize.unit', String(data.farmSize.unit).toLowerCase());
      }
      if (data.establishedYear) assign('establishedYear', parseInt(data.establishedYear, 10));
      if (Array.isArray(data.farmingType)) {
        assign('farmingType', data.farmingType.map(v => String(v).toLowerCase()));
      } else if (typeof data.farmingType === 'string') {
        assign('farmingType', [data.farmingType.toLowerCase()]);
      }
      // Contact info
      if (data.contactInfo) {
        assign('contactInfo.phone', data.contactInfo.phone);
        assign('contactInfo.email', data.contactInfo.email);
        assign('contactInfo.website', data.contactInfo.website);
      }
      // Social links
      if (data.socialMedia) {
        assign('socialMedia.facebook', data.socialMedia.facebook);
        assign('socialMedia.twitter', data.socialMedia.twitter);
        assign('socialMedia.instagram', data.socialMedia.instagram);
      }
      // Farming selections
      // Crop types: accept array of strings, array of objects, string, or boolean map
      const allowedCrops = new Set(['maize','beans','rice','wheat','vegetables','fruits','coffee','tea','sugarcane','cotton','sunflower','sorghum','millet']);
      if (data.cropTypes !== undefined) {
        let values = [];
        if (Array.isArray(data.cropTypes)) {
          // ['Maize'] or [{value:'Maize'}]
          values = data.cropTypes.map(item => {
            if (typeof item === 'string') return item;
            if (item && typeof item === 'object') return item.value || item.name || '';
            return '';
          });
        } else if (typeof data.cropTypes === 'object' && data.cropTypes !== null) {
          // { maize: true, beans: false, ... }
          values = Object.keys(data.cropTypes).filter(k => !!data.cropTypes[k]);
        } else if (typeof data.cropTypes === 'string') {
          values = [data.cropTypes];
        }
        const normalized = values.map(v => String(v).toLowerCase().trim()).filter(v => allowedCrops.has(v));
        if (normalized.length) assign('cropTypes', normalized);
      }
      // Farming methods: accept array/string/object map and normalize to enum
      const allowedMethods = new Set(['organic','conventional','permaculture','hydroponics','agroforestry','conservation_agriculture','precision_farming','sustainable_agriculture']);
      if (data.farmingMethods !== undefined) {
        let values = [];
        if (Array.isArray(data.farmingMethods)) {
          values = data.farmingMethods.map(item => {
            if (typeof item === 'string') return item;
            if (item && typeof item === 'object') return item.value || item.name || '';
            return '';
          });
        } else if (typeof data.farmingMethods === 'object' && data.farmingMethods !== null) {
          values = Object.keys(data.farmingMethods).filter(k => !!data.farmingMethods[k]);
        } else if (typeof data.farmingMethods === 'string') {
          values = [data.farmingMethods];
        }
        const normalized = values.map(v => normalizeKey(v)).filter(v => allowedMethods.has(v));
        if (normalized.length) assign('farmingMethods', normalized);
      }
      if (Array.isArray(data.crops)) assign('crops', data.crops);
      if (Array.isArray(data.livestock)) assign('livestock', data.livestock);
      if (data.media) assign('media', data.media);
      if (data.bankDetails) assign('bankDetails', data.bankDetails);
      return update;
    };

    const updateOps = buildUpdate(updateData);

  const farmer = await FarmerProfile.findOneAndUpdate(
      { user: userId },
      { $set: updateOps },
      { new: true, runValidators: true }
    ).populate('user', 'firstName lastName avatar');

    if (!farmer) {
      return res.status(404).json({
        success: false,
        message: 'Farmer profile not found'
      });
    }

  console.log('[FARMERS API] Update ops applied:', updateOps);
  console.log('[FARMERS API] cropTypes ops:', updateOps.cropTypes);
  console.log('[FARMERS API] farmingMethods ops:', updateOps.farmingMethods);
  res.json({
      success: true,
      message: 'Farmer profile updated successfully',
      data: { farmer }
    });
  } catch (error) {
    console.error('Update farmer profile error:', error);
    // Handle mongoose validation errors explicitly
    if (error.name === 'ValidationError') {
      const errors = Object.keys(error.errors).map((key) => ({
        field: key,
        message: error.errors[key].message
      }));
      return res.status(400).json({ success: false, message: 'Validation failed', errors });
    }
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Upload farm images
// @route   POST /api/farmers/images
// @access  Private (Farmer only)
const uploadFarmImages = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No image files provided'
      });
    }

    const userId = req.user._id;
    const farmer = await FarmerProfile.findOne({ user: userId });

    if (!farmer) {
      return res.status(404).json({
        success: false,
        message: 'Farmer profile not found'
      });
    }

    const uploadedImages = [];

    for (const file of req.files) {
      const result = await uploadImage(file, 'adopt-a-farmer/farms');
      uploadedImages.push({
        url: result.url,
        publicId: result.publicId,
        caption: req.body.caption || ''
      });
    }

    // Add images to farmer profile
    farmer.media.farmImages.push(...uploadedImages);
    await farmer.save();

    res.json({
      success: true,
      message: 'Images uploaded successfully',
      data: {
        images: uploadedImages
      }
    });
  } catch (error) {
    console.error('Upload farm images error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Upload farm videos
// @route   POST /api/farmers/videos
// @access  Private (Farmer only)
const uploadFarmVideos = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No video file provided'
      });
    }

    const userId = req.user._id;
    const farmer = await FarmerProfile.findOne({ user: userId });

    if (!farmer) {
      return res.status(404).json({
        success: false,
        message: 'Farmer profile not found'
      });
    }

    const result = await uploadVideo(req.file, 'adopt-a-farmer/farms/videos');

    const videoData = {
      url: result.url,
      publicId: result.publicId,
      caption: req.body.caption || ''
    };

    // Add video to farmer profile
    farmer.media.videos.push(videoData);
    await farmer.save();

    res.json({
      success: true,
      message: 'Video uploaded successfully',
      data: {
        video: videoData
      }
    });
  } catch (error) {
    console.error('Upload farm video error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get farmer dashboard data
// @route   GET /api/farmers/dashboard
// @access  Private (Farmer only)
const getFarmerDashboard = async (req, res) => {
  try {
    const userId = req.user._id;

    // Get farmer profile
    const farmer = await FarmerProfile.findOne({ user: userId })
      .populate('user', 'firstName lastName avatar');

    if (!farmer) {
      return res.status(404).json({
        success: false,
        message: 'Farmer profile not found'
      });
    }

    // Get adoptions
    const adoptions = await Adoption.find({ farmer: userId })
      .populate('adopter', 'firstName lastName avatar')
      .sort({ createdAt: -1 });

    // Get payments
    const payments = await Payment.find({ 
      'metadata.farmerName': farmer.farmName,
      status: 'success'
    }).sort({ createdAt: -1 });

    // Calculate statistics
    const stats = {
      totalAdopters: adoptions.filter(a => a.status === 'active').length,
      totalEarnings: payments.reduce((sum, p) => sum + p.netAmount, 0),
      activeAdoptions: adoptions.filter(a => a.status === 'active').length,
      completedAdoptions: adoptions.filter(a => a.status === 'completed').length,
      pendingPayments: payments.filter(p => p.status === 'pending').length
    };

    res.json({
      success: true,
      data: {
        farmer,
        adoptions: adoptions.slice(0, 10), // Latest 10
        payments: payments.slice(0, 10), // Latest 10
        stats
      }
    });
  } catch (error) {
    console.error('Get farmer dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get farmer adopters
// @route   GET /api/farmers/adopters
// @access  Private (Farmer only)
const getFarmerAdopters = async (req, res) => {
  try {
    const userId = req.user._id;

    const adoptions = await Adoption.find({ 
      farmer: userId,
      status: { $in: ['active', 'completed'] }
    })
    .populate('adopter', 'firstName lastName avatar email phone')
    .populate('adoption')
    .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: { adoptions }
    });
  } catch (error) {
    console.error('Get farmer adopters error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Delete farm media
// @route   DELETE /api/farmers/media/:publicId
// @access  Private (Farmer only)
const deleteFarmMedia = async (req, res) => {
  try {
    const userId = req.user._id;
    const { publicId } = req.params;
    const { type } = req.query; // 'image' or 'video'

    const farmer = await FarmerProfile.findOne({ user: userId });

    if (!farmer) {
      return res.status(404).json({
        success: false,
        message: 'Farmer profile not found'
      });
    }

    let mediaArray, resourceType;
    if (type === 'video') {
      mediaArray = farmer.media.videos;
      resourceType = 'video';
    } else {
      mediaArray = farmer.media.farmImages;
      resourceType = 'image';
    }

    // Find and remove media from array
    const mediaIndex = mediaArray.findIndex(item => item.publicId === publicId);
    if (mediaIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Media not found'
      });
    }

    // Delete from Cloudinary
    await deleteFile(publicId, resourceType);

    // Remove from database
    mediaArray.splice(mediaIndex, 1);
    await farmer.save();

    res.json({
      success: true,
      message: 'Media deleted successfully'
    });
  } catch (error) {
    console.error('Delete farm media error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

module.exports = {
  getFarmers,
  getFarmerById,
  getCurrentFarmerProfile,
  updateFarmerProfile,
  uploadFarmImages,
  uploadFarmVideos,
  getFarmerDashboard,
  getFarmerAdopters,
  deleteFarmMedia
};