const User = require('../models/User');
const FarmerProfile = require('../models/FarmerProfile');
const AdopterProfile = require('../models/AdopterProfile');
const ExpertProfile = require('../models/ExpertProfile');
const Adoption = require('../models/Adoption');
const Payment = require('../models/Payment');
const CrowdfundingProject = require('../models/CrowdfundingProject');
const FarmVisit = require('../models/FarmVisit');
const KnowledgeArticle = require('../models/KnowledgeArticle');
const Message = require('../models/Message');
const FarmerAvailability = require('../models/FarmerAvailability');

// @desc    Get dashboard statistics
// @route   GET /api/admin/dashboard
// @access  Private (Admin only)
const getDashboardStats = async (req, res) => {
  try {
    // User statistics
    const totalUsers = await User.countDocuments();
    const totalAdopters = await User.countDocuments({ role: 'adopter' });
    const totalExperts = await User.countDocuments({ role: 'expert' });
    
    // Farmer statistics (only count verified farmers as real farmers)
    const verifiedFarmers = await FarmerProfile.countDocuments({ verificationStatus: 'verified' });
    const pendingFarmers = await FarmerProfile.countDocuments({ verificationStatus: 'pending' });
    const rejectedFarmers = await FarmerProfile.countDocuments({ verificationStatus: 'rejected' });
    const totalFarmers = verifiedFarmers; // Only verified farmers count as real farmers
    
    // New users this month
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const newUsersThisMonth = await User.countDocuments({
      createdAt: { $gte: startOfMonth }
    });

    // Financial statistics - Only count successful/completed payments
    const totalRevenue = await Payment.aggregate([
      { $match: { status: { $in: ['success', 'completed'] } } }, // Support both statuses
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    const revenueThisMonth = await Payment.aggregate([
      { 
        $match: { 
          status: { $in: ['success', 'completed'] },
          createdAt: { $gte: startOfMonth }
        } 
      },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    // Activity statistics
    const totalAdoptions = await Adoption.countDocuments();
    const activeAdoptions = await Adoption.countDocuments({ status: 'active' });
    const totalProjects = await CrowdfundingProject.countDocuments();
    const activeProjects = await CrowdfundingProject.countDocuments({ status: 'active' });
    const totalVisits = await FarmVisit.countDocuments();
    const completedVisits = await FarmVisit.countDocuments({ status: 'completed' });

    // Content statistics
    const totalArticles = await KnowledgeArticle.countDocuments();
    const publishedArticles = await KnowledgeArticle.countDocuments({ status: 'published' });
    const totalMessages = await Message.countDocuments();

    // Recent activity (last 7 days)
    const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentUsers = await User.countDocuments({ createdAt: { $gte: lastWeek } });
    const recentAdoptions = await Adoption.countDocuments({ createdAt: { $gte: lastWeek } });
    const recentPayments = await Payment.countDocuments({ 
      createdAt: { $gte: lastWeek },
      status: { $in: ['success', 'completed'] } // Support both statuses
    });

    res.json({
      success: true,
      data: {
        users: {
          total: totalUsers,
          farmers: totalFarmers, // Only verified farmers
          adopters: totalAdopters,
          experts: totalExperts,
          newThisMonth: newUsersThisMonth,
          newThisWeek: recentUsers
        },
        farmers: {
          verified: verifiedFarmers,
          pending: pendingFarmers,
          rejected: rejectedFarmers,
          total: verifiedFarmers // Only verified count as total
        },
        financial: {
          totalRevenue: totalRevenue[0]?.total || 0,
          revenueThisMonth: revenueThisMonth[0]?.total || 0,
          recentPayments
        },
        activity: {
          adoptions: {
            total: totalAdoptions,
            active: activeAdoptions,
            recent: recentAdoptions
          },
          projects: {
            total: totalProjects,
            active: activeProjects
          },
          visits: {
            total: totalVisits,
            completed: completedVisits
          }
        },
        content: {
          articles: {
            total: totalArticles,
            published: publishedArticles
          },
          messages: totalMessages
        }
      }
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get all users with pagination
// @route   GET /api/admin/users
// @access  Private (Admin only)
const getAllUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.role) {
      filter.role = req.query.role;
    }
    if (req.query.status) {
      filter.isActive = req.query.status === 'active';
    }
    if (req.query.search) {
      filter.$or = [
        { firstName: { $regex: req.query.search, $options: 'i' } },
        { lastName: { $regex: req.query.search, $options: 'i' } },
        { email: { $regex: req.query.search, $options: 'i' } }
      ];
    }

    const users = await User.find(filter)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await User.countDocuments(filter);

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total,
          hasNext: page * limit < total,
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Update user status
// @route   PUT /api/admin/users/:id/status
// @access  Private (Admin only)
const updateUserStatus = async (req, res) => {
  try {
    const { isActive, reason } = req.body;
    const userId = req.params.id;

    const user = await User.findById(userId).select('-password');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    user.isActive = isActive;
    if (!isActive && reason) {
      user.deactivationReason = reason;
      user.deactivatedAt = new Date();
    }

    await user.save();

    res.json({
      success: true,
      message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
      data: { user }
    });
  } catch (error) {
    console.error('Update user status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get all farmers with profiles
// @route   GET /api/admin/farmers
// @access  Private (Admin only)
const getAllFarmers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.status) {
      filter.verificationStatus = req.query.status;
    }
    if (req.query.category) {
      filter.farmingType = req.query.category;
    }
    if (req.query.search) {
      filter.$or = [
        { farmName: { $regex: req.query.search, $options: 'i' } },
        { 'location.county': { $regex: req.query.search, $options: 'i' } },
        { 'location.subCounty': { $regex: req.query.search, $options: 'i' } },
        { 'location.village': { $regex: req.query.search, $options: 'i' } }
      ];
    }

    const farmers = await FarmerProfile.find(filter)
      .populate('user', 'firstName lastName email phone isActive createdAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await FarmerProfile.countDocuments(filter);

    res.json({
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
    });
  } catch (error) {
    console.error('Get all farmers error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get farmer profile by ID
// @route   GET /api/admin/farmers/:id
// @access  Private (Admin only)
const getFarmerById = async (req, res) => {
  try {
    const farmerId = req.params.id;

    const farmer = await FarmerProfile.findById(farmerId)
      .populate('user', 'firstName lastName email phone isActive createdAt verifiedAt')
      .populate('verifiedBy', 'firstName lastName email');

    if (!farmer) {
      return res.status(404).json({
        success: false,
        message: 'Farmer profile not found'
      });
    }

    res.json({
      success: true,
      data: { farmer }
    });
  } catch (error) {
    console.error('Get farmer by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Verify farmer profile
// @route   PUT /api/admin/farmers/:id/verify
// @access  Private (Admin only)
const verifyFarmer = async (req, res) => {
  try {
    const { status, notes } = req.body;
    const farmerId = req.params.id;

    const farmer = await FarmerProfile.findById(farmerId)
      .populate('user', 'firstName lastName email');

    if (!farmer) {
      return res.status(404).json({
        success: false,
        message: 'Farmer profile not found'
      });
    }

    farmer.verificationStatus = status;
    farmer.verificationNotes = notes;
    farmer.verifiedAt = status === 'verified' ? new Date() : null;
    farmer.verifiedBy = req.user._id;

    await farmer.save();

    res.json({
      success: true,
      message: `Farmer ${status} successfully`,
      data: { farmer }
    });
  } catch (error) {
    console.error('Verify farmer error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get all payments
// @route   GET /api/admin/payments
// @access  Private (Admin only)
const getAllPayments = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.status) {
      filter.status = req.query.status;
    }
    if (req.query.type) {
      filter.type = req.query.type;
    }
    if (req.query.startDate && req.query.endDate) {
      filter.createdAt = {
        $gte: new Date(req.query.startDate),
        $lte: new Date(req.query.endDate)
      };
    }

    const payments = await Payment.find(filter)
      .populate('user', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Payment.countDocuments(filter);

    res.json({
      success: true,
      data: {
        payments,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total,
          hasNext: page * limit < total,
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    console.error('Get all payments error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get analytics data
// @route   GET /api/admin/analytics
// @access  Private (Admin only)
const getAnalytics = async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    
    let startDate;
    const endDate = new Date();
    
    switch (period) {
      case '7d':
        startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '1y':
        startDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    }

    // User registration trends
    const userTrends = await User.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            role: '$role'
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.date': 1 } }
    ]);

    // Revenue trends
    const revenueTrends = await Payment.aggregate([
      {
        $match: {
          status: 'completed',
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            type: '$type'
          },
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.date': 1 } }
    ]);

    // Adoption trends
    const adoptionTrends = await Adoption.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id': 1 } }
    ]);

    res.json({
      success: true,
      data: {
        period,
        startDate,
        endDate,
        userTrends,
        revenueTrends,
        adoptionTrends
      }
    });
  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get all adopters with their adopted farmers
// @route   GET /api/admin/adopters
// @access  Private (Admin only)
const getAllAdoptersWithFarmers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Get all adopters with their adoptions
    const adoptersWithAdoptions = await Adoption.aggregate([
      {
        $lookup: {
          from: 'users',
          localField: 'adopter',
          foreignField: '_id',
          as: 'adopterUser'
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'farmer',
          foreignField: '_id',
          as: 'farmerUser'
        }
      },
      {
        $lookup: {
          from: 'farmerprofiles',
          localField: 'farmer',
          foreignField: 'user',
          as: 'farmerProfile'
        }
      },
      {
        $lookup: {
          from: 'adopterprofiles',
          localField: 'adopter',
          foreignField: 'user',
          as: 'adopterProfile'
        }
      },
      {
        $unwind: '$adopterUser'
      },
      {
        $unwind: '$farmerUser'
      },
      {
        $unwind: {
          path: '$farmerProfile',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $unwind: {
          path: '$adopterProfile',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $group: {
          _id: '$adopter',
          adopterInfo: { $first: '$adopterUser' },
          adopterProfile: { $first: '$adopterProfile' },
          adoptedFarmers: {
            $push: {
              adoptionId: '$_id',
              farmer: '$farmerUser',
              farmerProfile: '$farmerProfile',
              adoptionType: '$adoptionType',
              status: '$status',
              paymentPlan: '$paymentPlan',
              createdAt: '$createdAt',
              expectedReturns: '$expectedReturns',
              actualReturns: '$actualReturns'
            }
          },
          totalAdoptions: { $sum: 1 },
          activeAdoptions: {
            $sum: {
              $cond: [{ $eq: ['$status', 'active'] }, 1, 0]
            }
          },
          totalAmountPaid: { $sum: '$paymentPlan.totalPaid' }
        }
      },
      {
        $sort: { 'adopterInfo.createdAt': -1 }
      },
      {
        $skip: skip
      },
      {
        $limit: limit
      }
    ]);

    // Get total count for pagination
    const totalCountPipeline = await Adoption.aggregate([
      {
        $group: {
          _id: '$adopter'
        }
      },
      {
        $count: 'total'
      }
    ]);

    const total = totalCountPipeline[0]?.total || 0;

    res.json({
      success: true,
      data: {
        adopters: adoptersWithAdoptions,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total,
          hasNext: page * limit < total,
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    console.error('Get all adopters with farmers error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get all adopters with profiles (original endpoint)
// @route   GET /api/admin/adopters-simple
// @access  Private (Admin only)
const getAllAdopters = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.status) {
      filter.isActive = req.query.status === 'active';
    }
    if (req.query.search) {
      filter.$or = [
        { 'user.firstName': { $regex: req.query.search, $options: 'i' } },
        { 'user.lastName': { $regex: req.query.search, $options: 'i' } },
        { 'user.email': { $regex: req.query.search, $options: 'i' } }
      ];
    }

    const adopters = await AdopterProfile.find(filter)
      .populate('user', 'firstName lastName email phone isActive createdAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await AdopterProfile.countDocuments(filter);

    res.json({
      success: true,
      data: {
        adopters,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total,
          hasNext: page * limit < total,
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    console.error('Get all adopters error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get all experts with profiles
// @route   GET /api/admin/experts
// @access  Private (Admin only)
const getAllExperts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.status) {
      filter.verificationStatus = req.query.status;
    }
    if (req.query.specialization) {
      filter.specializations = { $in: [req.query.specialization] };
    }
    if (req.query.search) {
      filter.$or = [
        { 'user.firstName': { $regex: req.query.search, $options: 'i' } },
        { 'user.lastName': { $regex: req.query.search, $options: 'i' } },
        { specializations: { $in: [new RegExp(req.query.search, 'i')] } }
      ];
    }

    const experts = await ExpertProfile.find(filter)
      .populate('user', 'firstName lastName email phone isActive createdAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await ExpertProfile.countDocuments(filter);

    res.json({
      success: true,
      data: {
        experts,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total,
          hasNext: page * limit < total,
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    console.error('Get all experts error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Verify expert profile and documents
// @route   PUT /api/admin/experts/:id/verify
// @access  Private (Admin only)
const verifyExpert = async (req, res) => {
  try {
    const { status, notes, documentApprovals } = req.body;
    const expertId = req.params.id;

    const expert = await ExpertProfile.findById(expertId)
      .populate('user', 'firstName lastName email');

    if (!expert) {
      return res.status(404).json({
        success: false,
        message: 'Expert profile not found'
      });
    }

    expert.verificationStatus = status;
    if (notes) expert.verificationNotes = notes;
    
    if (status === 'verified') {
      expert.verifiedAt = new Date();
      expert.verifiedBy = req.user._id;
    }

    // Update document verification statuses if provided
    if (documentApprovals && Array.isArray(documentApprovals)) {
      documentApprovals.forEach(approval => {
        const doc = expert.verificationDocuments.id(approval.documentId);
        if (doc) {
          doc.status = approval.status;
        }
      });
    }

    await expert.save();

    res.json({
      success: true,
      message: `Expert ${status} successfully`,
      data: { expert }
    });
  } catch (error) {
    console.error('Verify expert error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get all farmer-adopter allocations
// @route   GET /api/admin/allocations
// @access  Private (Admin only)
const getAllAllocations = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.status) {
      filter.status = req.query.status;
    }
    if (req.query.farmerId) {
      filter.farmer = req.query.farmerId;
    }
    if (req.query.adopterId) {
      filter.adopter = req.query.adopterId;
    }

    const adoptions = await Adoption.find(filter)
      .populate({
        path: 'farmer',
        populate: {
          path: 'user',
          select: 'firstName lastName email phone'
        }
      })
      .populate({
        path: 'adopter',
        populate: {
          path: 'user',
          select: 'firstName lastName email phone'
        }
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Adoption.countDocuments(filter);

    res.json({
      success: true,
      data: {
        allocations: adoptions,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total,
          hasNext: page * limit < total,
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    console.error('Get all allocations error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get all messages for monitoring
// @route   GET /api/admin/messages
// @access  Private (Admin only)
const getAllMessages = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.conversationId) {
      filter.conversationId = req.query.conversationId;
    }
    if (req.query.senderId) {
      filter.sender = req.query.senderId;
    }
    if (req.query.recipientId) {
      filter.recipient = req.query.recipientId;
    }
    if (req.query.messageType) {
      filter.messageType = req.query.messageType;
    }

    const messages = await Message.find(filter)
      .populate('sender', 'firstName lastName email role')
      .populate('recipient', 'firstName lastName email role')
      .populate('adoption', 'status')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Message.countDocuments(filter);

    res.json({
      success: true,
      data: {
        messages,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total,
          hasNext: page * limit < total,
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    console.error('Get all messages error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get farmer availability overview
// @route   GET /api/admin/farmer-availability
// @access  Private (Admin only)
const getFarmerAvailability = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const { farmerId, date, startDate, endDate } = req.query;

    let dateFilter = {};
    if (date) {
      dateFilter.date = date;
    } else if (startDate && endDate) {
      dateFilter.date = { $gte: startDate, $lte: endDate };
    }

    let matchFilter = dateFilter;
    if (farmerId) {
      matchFilter.farmer = farmerId;
    }

    const availability = await FarmerAvailability.find(matchFilter)
      .populate({
        path: 'farmer',
        populate: {
          path: 'user',
          select: 'firstName lastName email phone'
        }
      })
      .sort({ date: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await FarmerAvailability.countDocuments(matchFilter);

    res.json({
      success: true,
      data: {
        availability,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total,
          hasNext: page * limit < total,
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    console.error('Get farmer availability error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Create new user (farmer, adopter, expert)
// @route   POST /api/admin/users
// @access  Private (Admin only)
const createUser = async (req, res) => {
  try {
    const { 
      firstName, lastName, email, password, role, phone,
      profileData 
    } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Create user
    const userData = {
      firstName,
      lastName,
      email,
      password,
      role,
      phone,
      isVerified: true, // Admin-created users are auto-verified
      isActive: true
    };

    const user = await User.create(userData);

    // Create role-specific profile if profileData provided
    let profile = null;
    if (profileData) {
      switch (role) {
        case 'farmer':
          profile = await FarmerProfile.create({
            user: user._id,
            ...profileData,
            verificationStatus: 'verified' // Admin-created farmers are auto-verified
          });
          break;
        case 'adopter':
          profile = await AdopterProfile.create({
            user: user._id,
            ...profileData
          });
          break;
        case 'expert':
          profile = await ExpertProfile.create({
            user: user._id,
            ...profileData,
            verificationStatus: 'verified' // Admin-created experts are auto-verified
          });
          break;
      }
    }

    const responseUser = await User.findById(user._id).select('-password');

    res.status(201).json({
      success: true,
      message: `${role.charAt(0).toUpperCase() + role.slice(1)} created successfully`,
      data: {
        user: responseUser,
        profile
      }
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Update user verification status
// @route   PUT /api/admin/users/:id/verify
// @access  Private (Admin only)
const verifyUser = async (req, res) => {
  try {
    const { isVerified, notes } = req.body;
    const userId = req.params.id;

    const user = await User.findById(userId).select('-password');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    user.isVerified = isVerified;
    if (notes) user.verificationNotes = notes;
    
    if (isVerified) {
      user.verifiedAt = new Date();
      user.verifiedBy = req.user._id;
    }

    await user.save();

    // Also update profile verification if applicable
    let profile = null;
    switch (user.role) {
      case 'farmer':
        profile = await FarmerProfile.findOne({ user: userId });
        if (profile) {
          profile.verificationStatus = isVerified ? 'verified' : 'pending';
          await profile.save();
        }
        break;
      case 'expert':
        profile = await ExpertProfile.findOne({ user: userId });
        if (profile) {
          profile.verificationStatus = isVerified ? 'verified' : 'pending';
          await profile.save();
        }
        break;
    }

    res.json({
      success: true,
      message: `User ${isVerified ? 'verified' : 'unverified'} successfully`,
      data: { user, profile }
    });
  } catch (error) {
    console.error('Verify user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get all farmers and experts for verification page
// @route   GET /api/admin/verification
// @access  Private (Admin only)
const getAllForVerification = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    // Get filter parameters
    const searchTerm = req.query.search || '';
    const statusFilter = req.query.status || 'all'; // all, pending, verified, rejected
    const typeFilter = req.query.type || 'all'; // all, farmers, experts

    // Build farmer query
    const farmerFilter = {};
    if (statusFilter !== 'all') {
      farmerFilter.verificationStatus = statusFilter;
    }
    if (searchTerm) {
      farmerFilter.$or = [
        { farmName: { $regex: searchTerm, $options: 'i' } },
        { 'location.state': { $regex: searchTerm, $options: 'i' } },
        { 'location.city': { $regex: searchTerm, $options: 'i' } }
      ];
    }

    // Build expert query
    const expertFilter = {};
    if (statusFilter !== 'all') {
      expertFilter.verificationStatus = statusFilter;
    }
    if (searchTerm) {
      expertFilter.$or = [
        { specializations: { $in: [new RegExp(searchTerm, 'i')] } },
        { 'bio': { $regex: searchTerm, $options: 'i' } }
      ];
    }

    let farmers = [];
    let experts = [];
    let farmerCount = 0;
    let expertCount = 0;

    // Fetch farmers if needed
    if (typeFilter === 'all' || typeFilter === 'farmers') {
      farmers = await FarmerProfile.find(farmerFilter)
        .populate('user', 'firstName lastName email phone isActive createdAt')
        .sort({ createdAt: -1 })
        .limit(typeFilter === 'farmers' ? limit : Math.ceil(limit / 2));

      farmerCount = await FarmerProfile.countDocuments(farmerFilter);
    }

    // Fetch experts if needed
    if (typeFilter === 'all' || typeFilter === 'experts') {
      experts = await ExpertProfile.find(expertFilter)
        .populate('user', 'firstName lastName email phone isActive createdAt')
        .sort({ createdAt: -1 })
        .limit(typeFilter === 'experts' ? limit : Math.ceil(limit / 2));

      expertCount = await ExpertProfile.countDocuments(expertFilter);
    }

    // Format data with type identification
    const formattedFarmers = farmers.map(farmer => ({
      ...farmer.toObject(),
      type: 'farmer',
      name: farmer.farmName,
      fullName: farmer.user ? `${farmer.user.firstName} ${farmer.user.lastName}` : 'Unknown'
    }));

    const formattedExperts = experts.map(expert => ({
      ...expert.toObject(),
      type: 'expert',
      name: expert.specializations?.join(', ') || 'Expert',
      fullName: expert.user ? `${expert.user.firstName} ${expert.user.lastName}` : 'Unknown'
    }));

    // Combine and sort by creation date
    const allUsers = [...formattedFarmers, ...formattedExperts].sort((a, b) => 
      new Date(b.createdAt) - new Date(a.createdAt)
    );

    // Apply pagination to combined results
    const paginatedUsers = allUsers.slice(skip, skip + limit);
    const totalCount = farmerCount + expertCount;

    // Get statistics
    const stats = {
      total: totalCount,
      farmers: farmerCount,
      experts: expertCount,
      pending: {
        farmers: await FarmerProfile.countDocuments({ verificationStatus: 'pending' }),
        experts: await ExpertProfile.countDocuments({ verificationStatus: 'pending' })
      },
      verified: {
        farmers: await FarmerProfile.countDocuments({ verificationStatus: 'verified' }),
        experts: await ExpertProfile.countDocuments({ verificationStatus: 'verified' })
      },
      rejected: {
        farmers: await FarmerProfile.countDocuments({ verificationStatus: 'rejected' }),
        experts: await ExpertProfile.countDocuments({ verificationStatus: 'rejected' })
      }
    };

    res.json({
      success: true,
      data: {
        users: paginatedUsers,
        stats,
        pagination: {
          current: page,
          pages: Math.ceil(totalCount / limit),
          total: totalCount,
          hasNext: page * limit < totalCount,
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    console.error('Get all for verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

module.exports = {
  getDashboardStats,
  getAllUsers,
  updateUserStatus,
  getAllFarmers,
  getFarmerById,
  verifyFarmer,
  getAllPayments,
  getAnalytics,
  getAllAdopters,
  getAllAdoptersWithFarmers,
  getAllExperts,
  verifyExpert,
  getAllAllocations,
  getAllMessages,
  getFarmerAvailability,
  createUser,
  verifyUser,
  getAllForVerification
};