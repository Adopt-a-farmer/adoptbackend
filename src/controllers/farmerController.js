const FarmerProfile = require('../models/FarmerProfile');
const User = require('../models/User');
const Adoption = require('../models/Adoption');
const Payment = require('../models/Payment');
const { uploadImage, uploadVideo, deleteFile } = require('../utils/cloudinaryUtils');
const FarmerProfileService = require('../services/farmerProfileService');

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
    
    // Location filter
    if (req.query.location) {
      filter['location.county'] = new RegExp(req.query.location, 'i');
    }
    
    // Farming type filter
    if (req.query.farmingType) {
      filter.farmingType = { $in: [req.query.farmingType] };
    }
    
    // Crops filter (comma-separated list)
    if (req.query.crops) {
      const crops = req.query.crops.split(',').map(crop => crop.trim());
      filter.cropTypes = { $in: crops.map(crop => new RegExp(crop, 'i')) };
    }
    
    // Verified filter
    if (req.query.verified === 'true') {
      filter.verificationStatus = 'verified';
    }
    
    // Farm size range filter
    if (req.query.minFarmSize || req.query.maxFarmSize) {
      filter['farmSize.value'] = {};
      if (req.query.minFarmSize) {
        filter['farmSize.value'].$gte = parseInt(req.query.minFarmSize);
      }
      if (req.query.maxFarmSize) {
        filter['farmSize.value'].$lte = parseInt(req.query.maxFarmSize);
      }
    }
    
    // Text search filter
    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search, 'i');
      filter.$or = [
        { farmName: searchRegex },
        { description: searchRegex },
        { bio: searchRegex },
        { cropTypes: { $in: [searchRegex] } },
        { 'location.county': searchRegex },
        { 'location.subCounty': searchRegex }
      ];
    }

    console.log('[FARMERS API] Applied filters:', filter);

    // Sort options
    let sort = { createdAt: -1 }; // Default: newest first
    
    switch (req.query.sortBy) {
      case 'oldest':
        sort = { createdAt: 1 };
        break;
      case 'verified':
        sort = { verificationStatus: -1, createdAt: -1 };
        break;
      case 'most_adopters':
        sort = { 'adoptionStats.totalAdopters': -1 };
        break;
      case 'highest_earnings':
        sort = { 'adoptionStats.totalEarnings': -1 };
        break;
      case 'farm_size_asc':
        sort = { 'farmSize.value': 1 };
        break;
      case 'farm_size_desc':
        sort = { 'farmSize.value': -1 };
        break;
      case 'alphabetical':
        sort = { farmName: 1 };
        break;
      default:
        sort = { createdAt: -1 };
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
        total,
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

    // Get current user info
    const user = req.user;

    // Use service to validate and clean the data
    const cleanedData = FarmerProfileService.validateAndCleanProfileData(updateData, user);
    
    console.log('[FARMERS API] Cleaned data:', cleanedData);

    // Update the farmer profile
    const farmer = await FarmerProfile.findOneAndUpdate(
      { user: userId },
      { $set: cleanedData },
      { new: true, runValidators: true }
    ).populate('user', 'firstName lastName avatar');

    if (!farmer) {
      return res.status(404).json({
        success: false,
        message: 'Farmer profile not found'
      });
    }

    // Check completion status
    const completion = FarmerProfileService.checkProfileCompletion(farmer);
    
    console.log('[FARMERS API] Profile updated successfully');
    res.json({
      success: true,
      message: 'Farmer profile updated successfully',
      data: { 
        farmer,
        completion 
      }
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
    const FarmUpdate = require('../models/FarmUpdate');
    const FarmVisit = require('../models/FarmVisit');
    const Message = require('../models/Message');
    const WithdrawalRequest = require('../models/WithdrawalRequest');

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

    // Get farm updates
    const farmUpdates = await FarmUpdate.find({ farmer: farmer._id })
      .sort({ createdAt: -1 })
      .limit(5);

    // Get visits (use user ID since visits reference farmer user, not profile)
    const visits = await FarmVisit.find({ farmer: userId })
      .populate('adopter', 'firstName lastName avatar')
      .sort({ requestedDate: 1 })
      .limit(10);

    // Get upcoming visits specifically
    const upcomingVisits = await FarmVisit.find({ 
      farmer: userId,
      status: { $in: ['requested', 'confirmed'] },
      requestedDate: { $gte: new Date() }
    })
      .populate('adopter', 'firstName lastName avatar')
      .sort({ requestedDate: 1 })
      .limit(5);

    // Get unread messages count
    const unreadMessages = await Message.countDocuments({
      recipient: userId,
      isRead: false
    });

    // Get wallet balance
    const totalEarnings = payments.reduce((sum, p) => sum + p.netAmount, 0);
    const withdrawals = await WithdrawalRequest.find({ farmer: userId });
    const totalWithdrawn = withdrawals
      .filter(w => w.status === 'completed')
      .reduce((sum, w) => sum + w.amount, 0);
    const pendingWithdrawals = withdrawals
      .filter(w => w.status === 'pending')
      .reduce((sum, w) => sum + w.amount, 0);
    const availableBalance = Math.max(0, totalEarnings - totalWithdrawn - pendingWithdrawals);

    // Calculate comprehensive statistics
    const stats = {
      totalAdopters: adoptions.filter(a => a.status === 'active').length,
      activeAdopters: adoptions.filter(a => a.status === 'active').length,
      totalEarnings: totalEarnings,
      availableBalance: availableBalance,
      activeAdoptions: adoptions.filter(a => a.status === 'active').length,
      completedAdoptions: adoptions.filter(a => a.status === 'completed').length,
      pendingPayments: payments.filter(p => p.status === 'pending').length,
      totalUpdates: farmUpdates.length,
      upcomingVisits: upcomingVisits.length,
      totalVisits: visits.length,
      pendingVisitRequests: visits.filter(v => v.status === 'requested').length,
      confirmedVisits: visits.filter(v => v.status === 'confirmed').length,
      unreadMessages: unreadMessages,
      monthlyGoalProgress: 65 // Mock data - could be calculated based on targets
    };

    // Recent activity feed
    const recentActivity = [];
    
    // Add recent adoptions
    adoptions.slice(0, 3).forEach(adoption => {
      recentActivity.push({
        type: 'adoption',
        description: `New adoption by ${adoption.adopter?.firstName} ${adoption.adopter?.lastName}`,
        date: adoption.createdAt,
        data: adoption
      });
    });

    // Add recent payments
    payments.slice(0, 2).forEach(payment => {
      recentActivity.push({
        type: 'payment',
        description: `Payment received: ${payment.currency} ${payment.netAmount}`,
        date: payment.createdAt,
        data: payment
      });
    });

    // Add recent visits
    upcomingVisits.slice(0, 2).forEach(visit => {
      recentActivity.push({
        type: 'visit',
        description: `Upcoming visit by ${visit.adopter?.firstName} ${visit.adopter?.lastName}`,
        date: visit.requestedDate,
        data: visit
      });
    });

    // Add recent farm updates
    farmUpdates.slice(0, 2).forEach(update => {
      recentActivity.push({
        type: 'update',
        description: `New farm update: ${update.title}`,
        date: update.createdAt,
        data: update
      });
    });

    // Sort activity by date
    recentActivity.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Tasks/Todos
    const tasks = [
      {
        id: 'profile_completion',
        title: 'Complete Profile',
        description: 'Add profile photo and complete all sections',
        priority: 'high',
        completed: !!(farmer.media?.profileImage && farmer.description),
        dueDate: null
      },
      {
        id: 'weekly_update',
        title: 'Share Weekly Update',
        description: 'Share progress photos and updates with your adopters',
        priority: 'medium',
        completed: farmUpdates.some(u => 
          new Date(u.createdAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        ),
        dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000) // 2 days from now
      },
      {
        id: 'respond_messages',
        title: 'Respond to Messages',
        description: `You have ${unreadMessages} unread messages`,
        priority: unreadMessages > 5 ? 'high' : 'low',
        completed: unreadMessages === 0,
        dueDate: null
      },
      {
        id: 'set_availability',
        title: 'Set Visit Availability',
        description: 'Configure your availability for farm visits',
        priority: 'medium',
        completed: false, // Could check if farmer has set any availability
        dueDate: null
      }
    ];

    res.json({
      success: true,
      data: {
        farmer,
        adoptions: adoptions.slice(0, 10), // Latest 10
        payments: payments.slice(0, 10), // Latest 10
        farmUpdates: farmUpdates,
        visits: visits,
        upcomingVisits: upcomingVisits,
        stats,
        recentActivity: recentActivity.slice(0, 10),
        tasks
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

// @desc    Get farmer reports and analytics
// @route   GET /api/farmers/reports
// @access  Private (Farmer only)
const getFarmerReports = async (req, res) => {
  try {
    const userId = req.user._id;
    const { period = 'month' } = req.query; // month, quarter, year
    
    const farmer = await FarmerProfile.findOne({ user: userId });
    if (!farmer) {
      return res.status(404).json({
        success: false,
        message: 'Farmer profile not found'
      });
    }

    // Calculate date range
    const now = new Date();
    let startDate;
    
    switch (period) {
      case 'quarter':
        startDate = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default: // month
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    // Get period data
    const adoptions = await Adoption.find({ 
      farmer: userId,
      createdAt: { $gte: startDate }
    }).populate('adopter', 'firstName lastName');

    const payments = await Payment.find({
      'metadata.farmerName': farmer.farmName,
      status: 'success',
      createdAt: { $gte: startDate }
    });

    const FarmUpdate = require('../models/FarmUpdate');
    const farmUpdates = await FarmUpdate.find({
      farmer: farmer._id,
      createdAt: { $gte: startDate }
    });

    const FarmVisit = require('../models/FarmVisit');
    const visits = await FarmVisit.find({
      farmer: farmer._id,
      createdAt: { $gte: startDate }
    });

    // Calculate metrics
    const totalRevenue = payments.reduce((sum, p) => sum + p.netAmount, 0);
    const avgRevenuePerAdopter = adoptions.length > 0 ? totalRevenue / adoptions.length : 0;
    
    // Generate daily/weekly/monthly breakdown
    const revenueBreakdown = [];
    const adoptionBreakdown = [];
    
    // Simple monthly breakdown for demonstration
    for (let i = 0; i < 12; i++) {
      const monthStart = new Date(now.getFullYear(), i, 1);
      const monthEnd = new Date(now.getFullYear(), i + 1, 0);
      
      const monthPayments = payments.filter(p => 
        new Date(p.createdAt) >= monthStart && new Date(p.createdAt) <= monthEnd
      );
      
      const monthAdoptions = adoptions.filter(a => 
        new Date(a.createdAt) >= monthStart && new Date(a.createdAt) <= monthEnd
      );
      
      revenueBreakdown.push({
        period: monthStart.toISOString().slice(0, 7), // YYYY-MM format
        revenue: monthPayments.reduce((sum, p) => sum + p.netAmount, 0),
        count: monthPayments.length
      });
      
      adoptionBreakdown.push({
        period: monthStart.toISOString().slice(0, 7),
        adoptions: monthAdoptions.length
      });
    }

    const reports = {
      period,
      dateRange: { startDate, endDate: now },
      summary: {
        totalRevenue,
        totalAdoptions: adoptions.length,
        totalUpdates: farmUpdates.length,
        totalVisits: visits.length,
        avgRevenuePerAdopter,
        growthRate: 12.5 // Mock data - would calculate based on previous period
      },
      revenueBreakdown: revenueBreakdown.filter(r => r.revenue > 0),
      adoptionBreakdown: adoptionBreakdown.filter(a => a.adoptions > 0),
      topAdopters: adoptions
        .reduce((acc, adoption) => {
          const adopterId = adoption.adopter._id.toString();
          if (!acc[adopterId]) {
            acc[adopterId] = {
              adopter: adoption.adopter,
              totalSpent: 0,
              adoptionsCount: 0
            };
          }
          acc[adopterId].adoptionsCount++;
          return acc;
        }, {}),
      recentActivities: [
        ...adoptions.slice(0, 5).map(a => ({
          type: 'adoption',
          description: `New adoption by ${a.adopter.firstName} ${a.adopter.lastName}`,
          date: a.createdAt
        })),
        ...farmUpdates.slice(0, 5).map(u => ({
          type: 'update',
          description: `Farm update: ${u.title}`,
          date: u.createdAt
        }))
      ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 10)
    };

    res.json({
      success: true,
      data: reports
    });
  } catch (error) {
    console.error('Get farmer reports error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get farmer settings
// @route   GET /api/farmers/settings
// @access  Private (Farmer only)
const getFarmerSettings = async (req, res) => {
  try {
    const userId = req.user._id;
    
    const farmer = await FarmerProfile.findOne({ user: userId })
      .populate('user', 'firstName lastName email phone avatar');
    
    if (!farmer) {
      return res.status(404).json({
        success: false,
        message: 'Farmer profile not found'
      });
    }

    // Get user settings/preferences
    const settings = {
      profile: {
        farmName: farmer.farmName,
        description: farmer.description,
        location: farmer.location,
        contactInfo: farmer.contactInfo,
        socialMedia: farmer.socialMedia,
        profileImage: farmer.media?.profileImage?.url,
        isPublic: farmer.isActive !== false
      },
      notifications: {
        emailNotifications: true, // Would come from user preferences
        smsNotifications: true,
        pushNotifications: true,
        adoptionUpdates: true,
        paymentAlerts: true,
        messageAlerts: true,
        visitReminders: true
      },
      privacy: {
        showContactInfo: farmer.contactInfo?.phone ? true : false,
        showLocation: farmer.location?.county ? true : false,
        allowDirectMessages: true,
        profileVisibility: 'public'
      },
      account: {
        email: farmer.user.email,
        phone: farmer.user.phone || farmer.contactInfo?.phone,
        bankDetails: farmer.bankDetails ? {
          bankName: farmer.bankDetails.bankName,
          accountName: farmer.bankDetails.accountName,
          accountNumber: farmer.bankDetails.accountNumber?.slice(-4) // Only show last 4 digits
        } : null,
        verificationStatus: farmer.verificationStatus,
        memberSince: farmer.createdAt
      }
    };

    res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    console.error('Get farmer settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Update farmer settings
// @route   PUT /api/farmers/settings
// @access  Private (Farmer only)
const updateFarmerSettings = async (req, res) => {
  try {
    const userId = req.user._id;
    const { profile, notifications, privacy, account } = req.body;
    
    const farmer = await FarmerProfile.findOne({ user: userId });
    if (!farmer) {
      return res.status(404).json({
        success: false,
        message: 'Farmer profile not found'
      });
    }

    // Update profile settings
    if (profile) {
      if (profile.farmName) farmer.farmName = profile.farmName;
      if (profile.description) farmer.description = profile.description;
      
      // Handle location updates properly
      if (profile.location) {
        // Ensure we merge location properly and handle coordinates
        farmer.location = {
          county: profile.location.county || farmer.location?.county,
          subCounty: profile.location.subCounty || farmer.location?.subCounty,
          village: profile.location.village || farmer.location?.village,
          coordinates: profile.location.coordinates ? {
            latitude: parseFloat(profile.location.coordinates.latitude),
            longitude: parseFloat(profile.location.coordinates.longitude)
          } : farmer.location?.coordinates
        };
      }
      
      if (profile.contactInfo) {
        farmer.contactInfo = {
          phone: profile.contactInfo.phone || farmer.contactInfo?.phone,
          email: profile.contactInfo.email || farmer.contactInfo?.email,
          website: profile.contactInfo.website || farmer.contactInfo?.website
        };
      }
      
      if (profile.socialMedia) {
        farmer.socialMedia = {
          facebook: profile.socialMedia.facebook || farmer.socialMedia?.facebook,
          twitter: profile.socialMedia.twitter || farmer.socialMedia?.twitter,
          instagram: profile.socialMedia.instagram || farmer.socialMedia?.instagram
        };
      }
      
      if (profile.isPublic !== undefined) farmer.isActive = profile.isPublic;
    }

    // Update bank details if provided
    if (account?.bankDetails) {
      farmer.bankDetails = {
        ...farmer.bankDetails,
        ...account.bankDetails
      };
    }

    await farmer.save();

    // Update user account details
    if (account) {
      const User = require('../models/User');
      const updateUser = {};
      if (account.email) updateUser.email = account.email;
      if (account.phone) updateUser.phone = account.phone;
      
      if (Object.keys(updateUser).length > 0) {
        await User.findByIdAndUpdate(userId, updateUser);
      }
    }

    res.json({
      success: true,
      message: 'Settings updated successfully'
    });
  } catch (error) {
    console.error('Update farmer settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Change farmer password
// @route   PUT /api/farmers/change-password
// @access  Private (Farmer only)
const changeFarmerPassword = async (req, res) => {
  try {
    const userId = req.user._id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required'
      });
    }

    const User = require('../models/User');
    const bcrypt = require('bcryptjs');
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedNewPassword = await bcrypt.hash(newPassword, salt);

    // Update password
    user.password = hashedNewPassword;
    await user.save();

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Change farmer password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get farmer's assigned experts/mentors
// @route   GET /api/farmers/experts
// @access  Private (Farmer only)
const getFarmerExperts = async (req, res) => {
  try {
    const userId = req.user._id;
    const ExpertMentorship = require('../models/ExpertMentorship');

    // Get active mentorships for this farmer
    const mentorships = await ExpertMentorship.find({ 
      farmer: userId, 
      status: 'active' 
    })
    .populate('expert', 'firstName lastName avatar email')
    .populate('farmer', 'firstName lastName')
    .sort({ startDate: -1 });

    const experts = mentorships.map(mentorship => ({
      _id: mentorship.expert._id,
      firstName: mentorship.expert.firstName,
      lastName: mentorship.expert.lastName,
      avatar: mentorship.expert.avatar,
      email: mentorship.expert.email,
      specialization: mentorship.specialization,
      mentorshipId: mentorship._id,
      startDate: mentorship.startDate,
      status: mentorship.status,
      goals: mentorship.goals,
      completedGoals: mentorship.goals.filter(goal => goal.status === 'completed').length,
      totalGoals: mentorship.goals.length,
      // Create conversation ID for messaging
      conversationId: [userId, mentorship.expert._id].sort().join('_')
    }));

    res.json({
      success: true,
      data: { experts }
    });
  } catch (error) {
    console.error('Get farmer experts error:', error);
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
  deleteFarmMedia,
  getFarmerReports,
  getFarmerSettings,
  updateFarmerSettings,
  changeFarmerPassword,
  getFarmerExperts
};