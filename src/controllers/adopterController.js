const AdopterProfile = require('../models/AdopterProfile');
const FarmerProfile = require('../models/FarmerProfile');
const Adoption = require('../models/Adoption');
const Payment = require('../models/Payment');
const FarmVisit = require('../models/FarmVisit');

// @desc    Get adopter dashboard
// @route   GET /api/adopters/dashboard
// @access  Private (Adopter only)
const getAdopterDashboard = async (req, res) => {
  try {
    const userId = req.user._id;

    // Get adopter profile
    const adopter = await AdopterProfile.findOne({ user: userId })
      .populate('user', 'firstName lastName avatar');

    if (!adopter) {
      return res.status(404).json({
        success: false,
        message: 'Adopter profile not found'
      });
    }

    // Get adoptions
    const adoptions = await Adoption.find({ adopter: userId })
      .populate('farmer', 'firstName lastName avatar')
      .populate({
        path: 'farmer',
        populate: {
          path: 'user',
          select: 'firstName lastName avatar'
        }
      })
      .sort({ createdAt: -1 });

    // Get payments
    const payments = await Payment.find({ 
      user: userId,
      status: 'success'
    }).sort({ createdAt: -1 });

    // Get upcoming visits
    const visits = await FarmVisit.find({
      adopter: userId,
      status: { $in: ['confirmed', 'requested'] }
    })
    .populate('farmer', 'firstName lastName')
    .sort({ requestedDate: 1 });

    // Calculate statistics
    const stats = {
      totalAdoptions: adoptions.length,
      activeAdoptions: adoptions.filter(a => a.status === 'active').length,
      totalInvested: payments.reduce((sum, p) => sum + p.amount, 0),
      upcomingVisits: visits.length
    };

    res.json({
      success: true,
      data: {
        adopter,
        adoptions: adoptions.slice(0, 10), // Latest 10
        payments: payments.slice(0, 10), // Latest 10
        visits: visits.slice(0, 5), // Next 5
        stats
      }
    });
  } catch (error) {
    console.error('Get adopter dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Update adopter profile
// @route   PUT /api/adopters/profile
// @access  Private (Adopter only)
const updateAdopterProfile = async (req, res) => {
  try {
    const userId = req.user._id;
    const updateData = req.body;

    const adopter = await AdopterProfile.findOneAndUpdate(
      { user: userId },
      updateData,
      { new: true, runValidators: true }
    ).populate('user', 'firstName lastName avatar');

    if (!adopter) {
      return res.status(404).json({
        success: false,
        message: 'Adopter profile not found'
      });
    }

    res.json({
      success: true,
      message: 'Adopter profile updated successfully',
      data: { adopter }
    });
  } catch (error) {
    console.error('Update adopter profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get adopted farmers
// @route   GET /api/adopters/adopted-farmers
// @access  Private (Adopter only)
const getAdoptedFarmers = async (req, res) => {
  try {
    const userId = req.user._id;

    const adoptions = await Adoption.find({ 
      adopter: userId,
      status: { $in: ['active', 'completed'] }
    })
    .populate({
      path: 'farmer',
      populate: {
        path: 'user',
        select: 'firstName lastName avatar'
      }
    })
    .sort({ createdAt: -1 });

    // Get farmer profiles for adopted farmers
    const farmersData = await Promise.all(
      adoptions.map(async (adoption) => {
        const farmerProfile = await FarmerProfile.findOne({ user: adoption.farmer._id });
        return {
          adoption,
          farmerProfile
        };
      })
    );

    res.json({
      success: true,
      data: { farmersData }
    });
  } catch (error) {
    console.error('Get adopted farmers error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Adopt a farmer
// @route   POST /api/adopters/adopt-farmer
// @access  Private (Adopter only)
const adoptFarmer = async (req, res) => {
  try {
    const adopterId = req.user._id;
    const {
      farmerId,
      adoptionType,
      adoptionDetails,
      paymentPlan
    } = req.body;

    // Check if farmer exists
    const farmer = await FarmerProfile.findOne({ user: farmerId });
    if (!farmer) {
      return res.status(404).json({
        success: false,
        message: 'Farmer not found'
      });
    }

    // Check if already adopted
    const existingAdoption = await Adoption.findOne({
      adopter: adopterId,
      farmer: farmerId,
      status: 'active'
    });

    if (existingAdoption) {
      return res.status(400).json({
        success: false,
        message: 'You have already adopted this farmer'
      });
    }

    // Create adoption
    const adoption = await Adoption.create({
      adopter: adopterId,
      farmer: farmerId,
      adoptionType,
      adoptionDetails,
      paymentPlan,
      status: 'pending' // Will be activated after payment
    });

    // Update adoption stats
    farmer.adoptionStats.currentAdoptions += 1;
    await farmer.save();

    // Update adopter stats
    const adopter = await AdopterProfile.findOne({ user: adopterId });
    adopter.adoptionHistory.totalAdoptions += 1;
    adopter.adoptionHistory.activeAdoptions += 1;
    await adopter.save();

    res.status(201).json({
      success: true,
      message: 'Farmer adopted successfully',
      data: { adoption }
    });
  } catch (error) {
    console.error('Adopt farmer error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get payment history
// @route   GET /api/adopters/payments
// @access  Private (Adopter only)
const getPaymentHistory = async (req, res) => {
  try {
    const userId = req.user._id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const payments = await Payment.find({ user: userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Payment.countDocuments({ user: userId });

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
    console.error('Get payment history error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get visits
// @route   GET /api/adopters/visits
// @access  Private (Adopter only)
const getVisits = async (req, res) => {
  try {
    const userId = req.user._id;

    const visits = await FarmVisit.find({ adopter: userId })
      .populate('farmer', 'firstName lastName')
      .populate('adoption')
      .sort({ requestedDate: -1 });

    res.json({
      success: true,
      data: { visits }
    });
  } catch (error) {
    console.error('Get visits error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get investment analytics
// @route   GET /api/adopters/analytics
// @access  Private (Adopter only)
const getInvestmentAnalytics = async (req, res) => {
  try {
    const userId = req.user._id;

    // Get all adoptions with financial data
    const adoptions = await Adoption.find({ adopter: userId })
      .populate('farmer', 'firstName lastName');

    // Get all payments
    const payments = await Payment.find({ 
      user: userId,
      status: 'success'
    });

    // Calculate analytics
    const analytics = {
      totalInvested: payments.reduce((sum, p) => sum + p.amount, 0),
      totalFees: payments.reduce((sum, p) => sum + (p.fees.gateway + p.fees.platform), 0),
      averageInvestment: payments.length > 0 ? payments.reduce((sum, p) => sum + p.amount, 0) / payments.length : 0,
      investmentsByMonth: {},
      farmingTypeDistribution: {},
      activeVsCompleted: {
        active: adoptions.filter(a => a.status === 'active').length,
        completed: adoptions.filter(a => a.status === 'completed').length
      }
    };

    // Group payments by month
    payments.forEach(payment => {
      const month = payment.createdAt.toISOString().substring(0, 7); // YYYY-MM
      analytics.investmentsByMonth[month] = (analytics.investmentsByMonth[month] || 0) + payment.amount;
    });

    res.json({
      success: true,
      data: { analytics }
    });
  } catch (error) {
    console.error('Get investment analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

module.exports = {
  getAdopterDashboard,
  updateAdopterProfile,
  getAdoptedFarmers,
  adoptFarmer,
  getPaymentHistory,
  getVisits,
  getInvestmentAnalytics
};