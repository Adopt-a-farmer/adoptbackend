const User = require('../models/User');
const FarmerProfile = require('../models/FarmerProfile');
const AdopterProfile = require('../models/AdopterProfile');
const Adoption = require('../models/Adoption');
const Payment = require('../models/Payment');
const CrowdfundingProject = require('../models/CrowdfundingProject');
const FarmVisit = require('../models/FarmVisit');
const KnowledgeArticle = require('../models/KnowledgeArticle');
const Message = require('../models/Message');

// @desc    Get dashboard statistics
// @route   GET /api/admin/dashboard
// @access  Private (Admin only)
const getDashboardStats = async (req, res) => {
  try {
    // User statistics
    const totalUsers = await User.countDocuments();
    const totalFarmers = await User.countDocuments({ role: 'farmer' });
    const totalAdopters = await User.countDocuments({ role: 'adopter' });
    const totalExperts = await User.countDocuments({ role: 'expert' });
    
    // New users this month
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const newUsersThisMonth = await User.countDocuments({
      createdAt: { $gte: startOfMonth }
    });

    // Financial statistics
    const totalRevenue = await Payment.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    const revenueThisMonth = await Payment.aggregate([
      { 
        $match: { 
          status: 'completed',
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
      status: 'completed'
    });

    res.json({
      success: true,
      data: {
        users: {
          total: totalUsers,
          farmers: totalFarmers,
          adopters: totalAdopters,
          experts: totalExperts,
          newThisMonth: newUsersThisMonth,
          newThisWeek: recentUsers
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
        { 'location.state': { $regex: req.query.search, $options: 'i' } },
        { 'location.city': { $regex: req.query.search, $options: 'i' } }
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

module.exports = {
  getDashboardStats,
  getAllUsers,
  updateUserStatus,
  getAllFarmers,
  verifyFarmer,
  getAllPayments,
  getAnalytics
};