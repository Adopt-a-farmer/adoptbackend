const Payment = require('../models/Payment');
const Adoption = require('../models/Adoption');
const CrowdfundingProject = require('../models/CrowdfundingProject');
const FarmerProfile = require('../models/FarmerProfile');
const AdopterProfile = require('../models/AdopterProfile');
const { 
  initializePayment,
  verifyPayment,
  verifyWebhookSignature,
  calculateFees
} = require('../services/paystackService');
const { v4: uuidv4 } = require('uuid');

// @desc    Initialize payment
// @route   POST /api/payments/initialize
// @access  Private
const initializePaymentController = async (req, res) => {
  try {
    const {
      amount,
      currency = 'KES',
      paymentType = 'adoption',
      paymentMethod = 'card',
      adoption,
      crowdfunding,
      description,
      metadata
    } = req.body;

    const user = req.user;
    const reference = `AAF_${Date.now()}_${uuidv4().substr(0, 8)}`;

    // Calculate fees
    const fees = calculateFees(amount);

    // Create payment record
    const payment = await Payment.create({
      user: user._id,
      adoption,
      crowdfunding,
      paymentType,
      amount,
      currency,
      paymentMethod,
      paymentGateway: 'paystack',
      gatewayResponse: {
        reference
      },
      status: 'pending',
      description: description || `${paymentType} payment`,
      metadata: {
        customerName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
        customerEmail: user.email,
        customerPhone: user.phone,
        ...metadata
      },
      fees
    });

    // Initialize Paystack payment
    const paystackData = {
      email: user.email,
      amount: (amount + fees.gateway + fees.platform) * 100, // Convert to kobo and include fees
      reference,
      currency: currency.toUpperCase(),
      callback_url: `${process.env.FRONTEND_URL}/payment/callback?reference=${reference}`,
      metadata: {
        payment_id: payment._id.toString(),
        user_id: user._id.toString(),
        payment_type: paymentType,
        custom_fields: [
          {
            display_name: "Payment Type",
            variable_name: "payment_type",
            value: paymentType
          },
          {
            display_name: "User Name",
            variable_name: "user_name",
            value: `${user.firstName || ''} ${user.lastName || ''}`.trim()
          }
        ]
      }
    };

    const paystackResponse = await initializePayment(paystackData);

    if (!paystackResponse.status) {
      payment.status = 'failed';
      payment.failureReason = 'Payment initialization failed';
      await payment.save();

      return res.status(400).json({
        success: false,
        message: 'Payment initialization failed',
        error: paystackResponse.message
      });
    }

    // Update payment with Paystack response
    payment.gatewayResponse.gatewayRef = paystackResponse.data.reference;
    await payment.save();

    res.json({
      success: true,
      message: 'Payment initialized successfully',
      data: {
        payment_id: payment._id,
        authorization_url: paystackResponse.data.authorization_url,
        access_code: paystackResponse.data.access_code,
        reference: paystackResponse.data.reference
      }
    });
  } catch (error) {
    console.error('Initialize payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during payment initialization'
    });
  }
};

// @desc    Verify payment
// @route   POST /api/payments/verify
// @access  Private
const verifyPaymentController = async (req, res) => {
  try {
    const { reference } = req.body;
    const userId = req.user._id;

    // Find payment record
    const payment = await Payment.findOne({
      'gatewayResponse.reference': reference,
      user: userId
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    // Verify with Paystack
    const verification = await verifyPayment(reference);

    if (!verification.status) {
      payment.status = 'failed';
      payment.failureReason = verification.message;
      await payment.save();

      return res.status(400).json({
        success: false,
        message: 'Payment verification failed',
        error: verification.message
      });
    }

    const verificationData = verification.data;

    // Update payment record
    payment.status = verificationData.status === 'success' ? 'success' : 'failed';
    payment.gatewayResponse = {
      ...payment.gatewayResponse,
      gatewayRef: verificationData.reference,
      authorizationCode: verificationData.authorization?.authorization_code,
      channel: verificationData.channel,
      cardType: verificationData.authorization?.card_type,
      bank: verificationData.authorization?.bank,
      last4: verificationData.authorization?.last4,
      expMonth: verificationData.authorization?.exp_month,
      expYear: verificationData.authorization?.exp_year,
      countryCode: verificationData.authorization?.country_code,
      brand: verificationData.authorization?.brand,
      reusable: verificationData.authorization?.reusable
    };

    if (payment.status === 'success') {
      payment.paidAt = new Date(verificationData.paid_at);
      
      // Process payment based on type
      await processSuccessfulPayment(payment);
    } else {
      payment.failureReason = verificationData.gateway_response;
    }

    await payment.save();

    res.json({
      success: true,
      message: payment.status === 'success' ? 'Payment verified successfully' : 'Payment verification failed',
      data: {
        payment,
        status: payment.status,
        amount: payment.amount,
        fees: payment.fees,
        net_amount: payment.netAmount
      }
    });
  } catch (error) {
    console.error('Verify payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during payment verification'
    });
  }
};

// @desc    Webhook handler for Paystack
// @route   POST /api/payments/webhook
// @access  Public (but verified)
const handleWebhook = async (req, res) => {
  try {
    const signature = req.headers['x-paystack-signature'];
    const body = req.body;

    // Verify webhook signature
    if (!verifyWebhookSignature(body, signature)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid webhook signature'
      });
    }

    const event = body.event;
    const data = body.data;

    switch (event) {
      case 'charge.success':
        await handleSuccessfulCharge(data);
        break;
      
      case 'charge.failed':
        await handleFailedCharge(data);
        break;
      
      case 'subscription.create':
        await handleSubscriptionCreate(data);
        break;
      
      case 'subscription.disable':
        await handleSubscriptionDisable(data);
        break;
      
      default:
        console.log(`Unhandled webhook event: ${event}`);
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Webhook handling error:', error);
    res.status(500).json({
      success: false,
      message: 'Webhook processing failed'
    });
  }
};

// @desc    Get payment history
// @route   GET /api/payments/history
// @access  Private
const getPaymentHistory = async (req, res) => {
  try {
    const userId = req.user._id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const filter = { user: userId };
    
    if (req.query.status) {
      filter.status = req.query.status;
    }
    
    if (req.query.type) {
      filter.paymentType = req.query.type;
    }

    const payments = await Payment.find(filter)
      .populate('adoption', 'farmer adoptionType')
      .populate('crowdfunding', 'title')
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
    console.error('Get payment history error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Helper function to process successful payment
const processSuccessfulPayment = async (payment) => {
  try {
    switch (payment.paymentType) {
      case 'adoption':
        if (payment.adoption) {
          const adoption = await Adoption.findById(payment.adoption);
          if (adoption && adoption.status === 'pending') {
            adoption.status = 'active';
            adoption.paymentPlan.totalPaid += payment.netAmount;
            await adoption.save();

            // Update farmer stats
            const farmer = await FarmerProfile.findOne({ user: adoption.farmer });
            if (farmer) {
              farmer.adoptionStats.totalFunding += payment.netAmount;
              await farmer.save();
            }

            // Update adopter stats
            const adopter = await AdopterProfile.findOne({ user: adoption.adopter });
            if (adopter) {
              adopter.investmentProfile.totalInvested += payment.netAmount;
              await adopter.save();
            }
          }
        }
        break;

      case 'crowdfunding':
        if (payment.crowdfunding) {
          const project = await CrowdfundingProject.findById(payment.crowdfunding);
          if (project) {
            project.currentAmount += payment.netAmount;
            project.backers.push({
              user: payment.user,
              amount: payment.netAmount,
              backedAt: new Date()
            });
            await project.save();
          }
        }
        break;

      default:
        console.log(`Processing payment for type: ${payment.paymentType}`);
    }
  } catch (error) {
    console.error('Process payment error:', error);
  }
};

// Webhook event handlers
const handleSuccessfulCharge = async (data) => {
  const payment = await Payment.findOne({
    'gatewayResponse.reference': data.reference
  });

  if (payment && payment.status === 'pending') {
    payment.status = 'success';
    payment.paidAt = new Date(data.paid_at);
    await payment.save();
    await processSuccessfulPayment(payment);
  }
};

const handleFailedCharge = async (data) => {
  const payment = await Payment.findOne({
    'gatewayResponse.reference': data.reference
  });

  if (payment && payment.status === 'pending') {
    payment.status = 'failed';
    payment.failureReason = data.gateway_response;
    await payment.save();
  }
};

const handleSubscriptionCreate = async (data) => {
  // Handle subscription creation
  console.log('Subscription created:', data);
};

const handleSubscriptionDisable = async (data) => {
  // Handle subscription disable
  console.log('Subscription disabled:', data);
};

module.exports = {
  initializePaymentController,
  verifyPaymentController,
  handleWebhook,
  getPaymentHistory
};