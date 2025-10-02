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
    console.log('Payment initialization request:', {
      body: req.body,
      user: req.user ? { id: req.user._id, email: req.user.email } : null
    });

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
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User authentication required'
      });
    }

    const reference = `AAF_${Date.now()}_${uuidv4().substr(0, 8)}`;

    // Calculate fees
    const fees = calculateFees(amount);
    console.log('Calculated fees:', fees);

    // Create payment record
    const payment = await Payment.create({
      user: user._id,
      adoption: metadata?.adoptionId, // Link to adoption if provided
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

    console.log('Payment record created:', payment._id);

    // Initialize Paystack payment
    const paystackData = {
      email: user.email,
      amount: amount + fees.gateway + fees.platform, // Amount in KES - paystackService will convert to kobo
      reference,
      currency: currency.toUpperCase(),
      callback_url: process.env.LIVE_CALLBACK_URL || `${process.env.FRONTEND_URL}/payment/callback?reference=${reference}`,
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
    console.log('Paystack response:', paystackResponse);

    if (!paystackResponse.status) {
      console.error('Paystack initialization failed:', paystackResponse);
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

    console.log('Payment verification request:', { reference, userId });

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
    console.log('Paystack verification response:', verification);

    // Check if verification was successful (status code 200 and status: true)
    if (!verification.status || !verification.data) {
      payment.status = 'failed';
      payment.failureReason = verification.message || 'Payment verification failed';
      await payment.save();

      return res.status(400).json({
        success: false,
        message: 'Payment verification failed',
        error: verification.message
      });
    }

    const verificationData = verification.data;

    // CRITICAL: Only process payment if Paystack returns success status
    // Paystack returns status: 'success' for successful payments
    const isPaymentSuccessful = verificationData.status === 'success';
    
    console.log('Payment verification status:', {
      paystackStatus: verificationData.status,
      isSuccessful: isPaymentSuccessful,
      amount: verificationData.amount,
      currency: verificationData.currency
    });

    // Update payment record with verification details
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
      reusable: verificationData.authorization?.reusable,
      verificationResponse: verificationData // Store full verification response
    };

    // Only mark as success and process if Paystack confirms payment was successful
    if (isPaymentSuccessful) {
      payment.status = 'success';
      payment.paidAt = new Date(verificationData.paid_at || verificationData.paidAt);
      
      // Verify amount matches (convert from kobo to main currency)
      const verifiedAmount = verificationData.amount / 100;
      const expectedAmount = payment.amount + (payment.fees?.gateway || 0) + (payment.fees?.platform || 0);
      
      if (Math.abs(verifiedAmount - expectedAmount) > 1) { // Allow 1 KES tolerance
        console.warn('Amount mismatch:', { verifiedAmount, expectedAmount });
      }
      
      // Process payment based on type (credit wallet, update adoption, etc.)
      await processSuccessfulPayment(payment);
      
      console.log('Payment processed successfully:', payment._id);
    } else {
      payment.status = 'failed';
      payment.failureReason = verificationData.gateway_response || 'Payment not successful';
      console.log('Payment marked as failed:', payment.failureReason);
    }

    await payment.save();

    res.json({
      success: isPaymentSuccessful,
      message: isPaymentSuccessful ? 'Payment verified successfully' : 'Payment verification failed',
      data: {
        payment: {
          id: payment._id,
          status: payment.status,
          amount: payment.amount,
          currency: payment.currency,
          paidAt: payment.paidAt,
          paymentType: payment.paymentType
        },
        verification: {
          status: verificationData.status,
          reference: verificationData.reference,
          amount: verificationData.amount / 100, // Convert from kobo
          currency: verificationData.currency,
          channel: verificationData.channel,
          paid_at: verificationData.paid_at
        }
      }
    });
  } catch (error) {
    console.error('Verify payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during payment verification',
      error: error.message
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
        // Find adoption by payment reference or metadata
        let adoption = null;
        if (payment.adoption) {
          adoption = await Adoption.findById(payment.adoption);
        } else if (payment.metadata && payment.metadata.farmerId) {
          // Find adoption by farmer and adopter
          adoption = await Adoption.findOne({
            farmer: payment.metadata.farmerId,
            adopter: payment.user,
            status: 'pending'
          });
        }
        
        if (adoption && adoption.status === 'pending') {
          adoption.status = 'active';
          adoption.startDate = new Date();
          if (!adoption.paymentPlan) {
            adoption.paymentPlan = { totalPaid: 0 };
          }
          adoption.paymentPlan.totalPaid = (adoption.paymentPlan.totalPaid || 0) + payment.amount;
          await adoption.save();

          // Update farmer stats
          const farmer = await FarmerProfile.findOne({ user: adoption.farmer });
          if (farmer) {
            if (!farmer.adoptionStats) {
              farmer.adoptionStats = { totalFunding: 0, currentAdoptions: 0 };
            }
            farmer.adoptionStats.totalFunding = (farmer.adoptionStats.totalFunding || 0) + payment.amount;
            await farmer.save();
          }

          // Update adopter stats
          const adopter = await AdopterProfile.findOne({ user: adoption.adopter });
          if (adopter) {
            if (!adopter.investmentProfile) {
              adopter.investmentProfile = { totalInvested: 0 };
            }
            adopter.investmentProfile.totalInvested = (adopter.investmentProfile.totalInvested || 0) + payment.amount;
            await adopter.save();
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
  try {
    console.log('Handling successful charge webhook:', { reference: data.reference, status: data.status });
    
    const payment = await Payment.findOne({
      'gatewayResponse.reference': data.reference
    });

    if (!payment) {
      console.warn('Payment not found for reference:', data.reference);
      return;
    }

    // Only process if payment is pending and Paystack confirms success
    if (payment.status === 'pending' && data.status === 'success') {
      payment.status = 'success';
      payment.paidAt = new Date(data.paid_at || data.paidAt);
      
      // Store full webhook data for audit
      payment.gatewayResponse.webhookData = data;
      
      // Verify amount matches (convert from kobo)
      const webhookAmount = data.amount / 100;
      const expectedAmount = payment.amount + (payment.fees?.gateway || 0) + (payment.fees?.platform || 0);
      
      if (Math.abs(webhookAmount - expectedAmount) > 1) {
        console.warn('Webhook amount mismatch:', { webhookAmount, expectedAmount, reference: data.reference });
      }
      
      await payment.save();
      await processSuccessfulPayment(payment);
      
      console.log('Payment processed via webhook successfully:', payment._id);
    } else {
      console.log('Payment already processed or status not success:', {
        paymentStatus: payment.status,
        webhookStatus: data.status
      });
    }
  } catch (error) {
    console.error('Handle successful charge error:', error);
  }
};

const handleFailedCharge = async (data) => {
  try {
    console.log('Handling failed charge webhook:', { reference: data.reference });
    
    const payment = await Payment.findOne({
      'gatewayResponse.reference': data.reference
    });

    if (!payment) {
      console.warn('Payment not found for reference:', data.reference);
      return;
    }

    if (payment.status === 'pending') {
      payment.status = 'failed';
      payment.failureReason = data.gateway_response || 'Payment failed';
      payment.gatewayResponse.webhookData = data;
      await payment.save();
      
      console.log('Payment marked as failed via webhook:', payment._id);
    }
  } catch (error) {
    console.error('Handle failed charge error:', error);
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