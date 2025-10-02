const Adoption = require('../models/Adoption');
const Payment = require('../models/Payment');
const FarmerProfile = require('../models/FarmerProfile');
const AdopterProfile = require('../models/AdopterProfile');
const { 
  initializePayment,
  verifyPayment 
} = require('../services/paystackService');
const { v4: uuidv4 } = require('uuid');

// @desc    Make additional contribution to adopted farmer
// @route   POST /api/adopters/contribute
// @access  Private (Adopter only)
const makeContribution = async (req, res) => {
  try {
    const {
      farmerId,
      adoptionId,
      amount,
      currency = 'KES',
      contributionType = 'additional',
      message,
      paymentMethod = 'card'
    } = req.body;

    const adopterId = req.user._id;

    console.log('Making contribution:', {
      farmerId,
      adoptionId,
      amount,
      currency,
      contributionType,
      adopterId: adopterId.toString()
    });

    // Validate input
    if (!farmerId || !amount || amount < 100) {
      return res.status(400).json({
        success: false,
        message: 'Invalid contribution data. Minimum amount is KES 100.'
      });
    }

    // Get farmer profile
    const farmer = await FarmerProfile.findById(farmerId).populate('user');
    if (!farmer) {
      return res.status(404).json({
        success: false,
        message: 'Farmer not found'
      });
    }

    // Get adopter profile
    const adopter = await AdopterProfile.findOne({ user: adopterId }).populate('user');
    if (!adopter) {
      return res.status(404).json({
        success: false,
        message: 'Adopter profile not found'
      });
    }

    // If it's an additional contribution, check if adoption exists
    let adoption = null;
    if (adoptionId || contributionType === 'additional') {
      adoption = await Adoption.findOne({
        $or: [
          { _id: adoptionId },
          { farmer: farmerId, adopter: adopterId, status: 'active' }
        ]
      });

      if (!adoption && contributionType === 'additional') {
        return res.status(400).json({
          success: false,
          message: 'You must adopt this farmer first to make additional contributions'
        });
      }
    }

    const reference = `CONTRIB_${Date.now()}_${uuidv4().substr(0, 8)}`;

    // Create payment record
    const payment = await Payment.create({
      user: adopterId,
      adoption: adoption?._id,
      farmer: farmerId,
      paymentType: 'contribution',
      amount,
      currency,
      paymentMethod,
      paymentGateway: 'paystack',
      gatewayResponse: {
        reference
      },
      status: 'pending',
      description: `${contributionType} contribution to ${farmer.farmName}`,
      metadata: {
        customerName: `${adopter.user.firstName || ''} ${adopter.user.lastName || ''}`.trim(),
        customerEmail: adopter.user.email,
        customerPhone: adopter.user.phone,
        farmerId: farmerId.toString(),
        farmerName: farmer.farmName,
        contributionType,
        message: message || ''
      }
    });

    console.log('Payment record created:', payment._id);

    // Initialize Paystack payment
    const paystackData = {
      email: adopter.user.email,
      amount: amount, // Amount in KES - paystackService will convert to kobo
      reference,
      currency: currency.toUpperCase(),
      callback_url: process.env.LIVE_CALLBACK_URL || `${process.env.FRONTEND_URL}/payment/callback?reference=${reference}`,
      channels: paymentMethod === 'mobile_money' ? ['mobile_money'] : ['card'],
      metadata: {
        payment_id: payment._id.toString(),
        user_id: adopterId.toString(),
        farmer_id: farmerId.toString(),
        payment_type: 'contribution',
        contribution_type: contributionType,
        custom_fields: [
          {
            display_name: "Payment Type",
            variable_name: "payment_type",
            value: 'contribution'
          },
          {
            display_name: "Farmer",
            variable_name: "farmer_name",
            value: farmer.farmName
          },
          {
            display_name: "Contribution Type",
            variable_name: "contribution_type",
            value: contributionType
          }
        ]
      }
    };

    const paystackResponse = await initializePayment(paystackData);

    if (!paystackResponse.status) {
      await Payment.findByIdAndUpdate(payment._id, { 
        status: 'failed',
        failureReason: paystackResponse.message 
      });

      return res.status(400).json({
        success: false,
        message: paystackResponse.message || 'Payment initialization failed'
      });
    }

    // Update payment with Paystack response
    await Payment.findByIdAndUpdate(payment._id, {
      'gatewayResponse.access_code': paystackResponse.data.access_code,
      'gatewayResponse.authorization_url': paystackResponse.data.authorization_url
    });

    res.status(200).json({
      success: true,
      message: 'Contribution payment initialized successfully',
      data: {
        contribution: {
          _id: payment._id,
          amount,
          currency,
          contributionType,
          farmer: {
            _id: farmer._id,
            farmName: farmer.farmName,
            user: farmer.user
          },
          adopter: {
            _id: adopter._id,
            user: adopter.user
          },
          status: 'pending',
          message: message || '',
          createdAt: payment.createdAt
        },
        payment: {
          authorization_url: paystackResponse.data.authorization_url,
          access_code: paystackResponse.data.access_code,
          reference: paystackResponse.data.reference
        }
      }
    });

  } catch (error) {
    console.error('Error making contribution:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while processing contribution'
    });
  }
};

// @desc    Get contribution history for adopter
// @route   GET /api/adopters/contributions
// @access  Private (Adopter only)
const getContributionHistory = async (req, res) => {
  try {
    const adopterId = req.user._id;
    const { status, farmerId, type, page = 1, limit = 10 } = req.query;

    const query = { 
      user: adopterId, 
      paymentType: 'contribution' 
    };

    if (status) query.status = status;
    if (farmerId) query.farmer = farmerId;
    if (type) query['metadata.contributionType'] = type;

    const contributions = await Payment.find(query)
      .populate('farmer', 'farmName user')
      .populate('adoption', 'monthlyContribution')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Payment.countDocuments(query);

    res.status(200).json({
      success: true,
      data: contributions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching contribution history:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching contribution history'
    });
  }
};

// @desc    Get farmer's received contributions (for farmer dashboard)
// @route   GET /api/farmers/contributions
// @access  Private (Farmer only)
const getFarmerContributions = async (req, res) => {
  try {
    const farmerId = req.user.farmerProfile;
    const { status, page = 1, limit = 10 } = req.query;

    if (!farmerId) {
      return res.status(404).json({
        success: false,
        message: 'Farmer profile not found'
      });
    }

    const query = { 
      farmer: farmerId, 
      paymentType: 'contribution',
      status: status || 'completed'
    };

    const contributions = await Payment.find(query)
      .populate('user', 'firstName lastName email avatar')
      .populate('adoption', 'monthlyContribution')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Payment.countDocuments(query);

    // Calculate stats
    const totalContributions = await Payment.aggregate([
      { $match: { farmer: farmerId, paymentType: 'contribution', status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    const monthlyContributions = await Payment.aggregate([
      { 
        $match: { 
          farmer: farmerId, 
          paymentType: 'contribution', 
          status: 'completed',
          createdAt: {
            $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
          }
        } 
      },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        contributions,
        stats: {
          totalContributions: totalContributions[0]?.total || 0,
          monthlyContributions: monthlyContributions[0]?.total || 0,
          totalCount: total
        }
      },
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching farmer contributions:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching farmer contributions'
    });
  }
};

module.exports = {
  makeContribution,
  getContributionHistory,
  getFarmerContributions
};
