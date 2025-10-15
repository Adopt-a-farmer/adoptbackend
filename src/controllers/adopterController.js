const AdopterProfile = require('../models/AdopterProfile');
const FarmerProfile = require('../models/FarmerProfile');
const Adoption = require('../models/Adoption');
const Payment = require('../models/Payment');
const FarmVisit = require('../models/FarmVisit');
const ExpertMentorship = require('../models/ExpertMentorship');
const Message = require('../models/Message');
const { initializePayment } = require('../services/paystackService');

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
      .populate('farmer', 'firstName lastName avatar email')
      .populate('adopter', 'firstName lastName avatar email')
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
      status: { $in: ['active', 'completed', 'pending'] }
    })
    .populate('farmer', 'firstName lastName avatar email')
    .populate('adopter', 'firstName lastName avatar email')
    .sort({ createdAt: -1 });

    // Transform data to match frontend Adoption interface
    const transformedAdoptions = adoptions.map(adoption => ({
      _id: adoption._id,
      farmer: {
        _id: adoption.farmer._id,
        firstName: adoption.farmer.firstName,
        lastName: adoption.farmer.lastName,
        email: adoption.farmer.email,
        avatar: adoption.farmer.avatar
      },
      adopter: {
        _id: userId,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        email: req.user.email
      },
      monthlyContribution: adoption.adoptionDetails?.monthlyContribution || 0,
      currency: adoption.adoptionDetails?.currency || 'KES',
      status: adoption.status,
      startDate: adoption.createdAt,
      totalContributed: adoption.paymentPlan?.totalPaid || adoption.adoptionDetails?.monthlyContribution || 0,
      message: adoption.adoptionDetails?.message,
      createdAt: adoption.createdAt,
      updatedAt: adoption.updatedAt
    }));

    res.json({
      success: true,
      data: transformedAdoptions
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
      adoptionType = 'monthly_support',
      adoptionDetails,
      paymentPlan
    } = req.body;

    console.log('Adopt farmer request:', { adopterId, farmerId, adoptionDetails, paymentPlan });

    // Validate required fields for monthly support
    if (adoptionType === 'monthly_support') {
      if (!adoptionDetails?.monthlyContribution && !paymentPlan?.amount) {
        return res.status(400).json({
          success: false,
          message: 'Monthly contribution amount is required for monthly support adoption'
        });
      }
    }

    // Check if farmer exists - try both farmer profile ID and user ID
    let farmer = await FarmerProfile.findById(farmerId);
    if (!farmer) {
      // Try finding by user ID
      farmer = await FarmerProfile.findOne({ user: farmerId });
    }

    if (!farmer) {
      return res.status(404).json({
        success: false,
        message: 'Farmer not found'
      });
    }

    // Get the farmer's user ID for adoption
    const farmerUserId = farmer.user;

    // Check if already adopted
    const existingAdoption = await Adoption.findOne({
      adopter: adopterId,
      farmer: farmerUserId,
      status: { $in: ['pending', 'active'] }
    });

    if (existingAdoption) {
      return res.status(400).json({
        success: false,
        message: 'You have already adopted this farmer'
      });
    }

    // Create adoption with proper structure
    const adoptionData = {
      adopter: adopterId,
      farmer: farmerUserId,
      adoptionType,
      status: 'pending', // Will be activated after payment
      adoptionDetails: {
        ...adoptionDetails,
        monthlyContribution: adoptionDetails?.monthlyContribution || paymentPlan?.amount,
        currency: adoptionDetails?.currency || paymentPlan?.currency || 'KES',
        message: adoptionDetails?.message || '',
        // Only add duration for non-monthly support types
        ...(adoptionType !== 'monthly_support' && {
          duration: {
            start: adoptionDetails?.duration?.start || new Date(),
            end: adoptionDetails?.duration?.end || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year from now
          }
        })
      },
      paymentPlan,
      paymentReference: req.body.paymentReference // Link to payment
    };

    const adoption = await Adoption.create(adoptionData);

    // Update farmer adoption stats immediately
    if (farmer.adoptionStats) {
      farmer.adoptionStats.currentAdoptions = (farmer.adoptionStats.currentAdoptions || 0) + 1;
      farmer.adoptionStats.totalFunding = (farmer.adoptionStats.totalFunding || 0) + (adoptionDetails?.monthlyContribution || paymentPlan?.amount || 0);
    } else {
      farmer.adoptionStats = { 
        currentAdoptions: 1,
        totalFunding: adoptionDetails?.monthlyContribution || paymentPlan?.amount || 0
      };
    }
    await farmer.save();

    // Update adopter stats immediately
    const adopter = await AdopterProfile.findOne({ user: adopterId });
    if (adopter) {
      if (adopter.adoptionHistory) {
        adopter.adoptionHistory.totalAdoptions = (adopter.adoptionHistory.totalAdoptions || 0) + 1;
        adopter.adoptionHistory.activeAdoptions = (adopter.adoptionHistory.activeAdoptions || 0) + 1;
      } else {
        adopter.adoptionHistory = {
          totalAdoptions: 1,
          activeAdoptions: 1
        };
      }
      if (adopter.investmentProfile) {
        adopter.investmentProfile.totalInvested = (adopter.investmentProfile.totalInvested || 0) + (adoptionDetails?.monthlyContribution || paymentPlan?.amount || 0);
      } else {
        adopter.investmentProfile = {
          totalInvested: adoptionDetails?.monthlyContribution || paymentPlan?.amount || 0
        };
      }
      await adopter.save();
    }

    // Populate the adoption before returning
    const populatedAdoption = await Adoption.findById(adoption._id)
      .populate('adopter', 'firstName lastName avatar email')
      .populate('farmer', 'firstName lastName avatar email');

    res.status(201).json({
      success: true,
      message: 'Farmer adopted successfully',
      data: { adoption: populatedAdoption }
    });
  } catch (error) {
    console.error('Adopt farmer error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while adopting farmer'
    });
  }
};

// @desc    Adopt farmer with payment integration
// @route   POST /api/adopters/adopt-with-payment
// @access  Private (Adopter only)
const adoptFarmerWithPayment = async (req, res) => {
  try {
    const adopterId = req.user._id;
    const {
      farmerId,
      adoptionType = 'monthly_support',
      adoptionDetails,
      paymentPlan
    } = req.body;

    console.log('Adopt farmer with payment request:', { adopterId, farmerId, adoptionDetails, paymentPlan });

    // Validate required fields for monthly support
    if (adoptionType === 'monthly_support') {
      if (!adoptionDetails?.monthlyContribution && !paymentPlan?.amount) {
        return res.status(400).json({
          success: false,
          message: 'Monthly contribution amount is required for monthly support adoption'
        });
      }
    }

    // Check if farmer exists
    let farmer = await FarmerProfile.findById(farmerId);
    if (!farmer) {
      farmer = await FarmerProfile.findOne({ user: farmerId });
    }

    if (!farmer) {
      return res.status(404).json({
        success: false,
        message: 'Farmer not found'
      });
    }

    const farmerUserId = farmer.user;

    // Check if already adopted
    const existingAdoption = await Adoption.findOne({
      adopter: adopterId,
      farmer: farmerUserId,
      status: { $in: ['pending', 'active'] }
    });

    if (existingAdoption) {
      return res.status(400).json({
        success: false,
        message: 'You have already adopted this farmer'
      });
    }

    // Create adoption first
    const adoptionData = {
      adopter: adopterId,
      farmer: farmerUserId,
      adoptionType,
      status: 'active', // Set to active immediately for testing
      adoptionDetails: {
        ...adoptionDetails,
        monthlyContribution: adoptionDetails?.monthlyContribution || paymentPlan?.amount,
        currency: adoptionDetails?.currency || paymentPlan?.currency || 'KES',
        message: adoptionDetails?.message || '',
        ...(adoptionType !== 'monthly_support' && {
          duration: {
            start: adoptionDetails?.duration?.start || new Date(),
            end: adoptionDetails?.duration?.end || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
          }
        })
      },
      paymentPlan,
      startDate: new Date() // Set start date immediately
    };

    const adoption = await Adoption.create(adoptionData);

    // Initialize payment
    const amount = adoptionDetails?.monthlyContribution || paymentPlan?.amount;
    
    // Validate amount
    if (!amount || amount <= 0) {
      await Adoption.findByIdAndDelete(adoption._id);
      return res.status(400).json({
        success: false,
        message: 'Invalid payment amount'
      });
    }

    const reference = `AAF_${Date.now()}_${adoption._id.toString().substr(-8)}`;

    const paystackData = {
      email: req.user.email,
      amount: amount,
      reference,
      currency: (adoptionDetails?.currency || 'KES').toUpperCase(),
      callback_url: process.env.LIVE_CALLBACK_URL || `${process.env.FRONTEND_URL}/payment/callback?reference=${reference}`,
      metadata: {
        adoption_id: adoption._id.toString(),
        user_id: req.user._id.toString(),
        farmer_id: farmerUserId.toString(),
        payment_type: 'adoption',
        adoption_type: adoptionType,
        custom_fields: [
          {
            display_name: "Adoption Type",
            variable_name: "adoption_type", 
            value: adoptionType
          },
          {
            display_name: "Farmer",
            variable_name: "farmer_name",
            value: farmer.businessName || `Farmer ${farmer._id.toString().substr(-4)}`
          }
        ]
      }
    };

    console.log('Paystack data being sent:', paystackData);

    const paystackResponse = await initializePayment(paystackData);

    if (!paystackResponse.status) {
      // Delete the adoption if payment initialization fails
      await Adoption.findByIdAndDelete(adoption._id);
      return res.status(400).json({
        success: false,
        message: 'Payment initialization failed',
        error: paystackResponse.message
      });
    }

    // Update adoption with payment reference
    adoption.paymentReference = reference;
    await adoption.save();

    // Populate the adoption before returning
    const populatedAdoption = await Adoption.findById(adoption._id)
      .populate('adopter', 'firstName lastName avatar email')
      .populate('farmer', 'firstName lastName avatar email');

    res.status(201).json({
      success: true,
      message: 'Adoption created and activated successfully! Payment link is ready for processing.',
      data: {
        adoption: populatedAdoption,
        payment: {
          authorization_url: paystackResponse.data.authorization_url,
          access_code: paystackResponse.data.access_code,
          reference: paystackResponse.data.reference
        }
      }
    });
  } catch (error) {
    console.error('Adopt farmer with payment error:', error);
    
    // More specific error messages
    if (error.message && error.message.includes('Payment initialization failed')) {
      return res.status(400).json({
        success: false,
        message: 'Payment system is currently unavailable. Please try again later.',
        error: error.message
      });
    }
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Duplicate adoption request detected'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error while creating adoption with payment',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
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

// @desc    Get farmers that the adopter is mentoring
// @route   GET /api/adopters/mentoring
// @access  Private (Adopter only)
const getMentoringFarmers = async (req, res) => {
  try {
    const userId = req.user._id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Get all mentorships where this adopter is the mentor
    const mentorships = await ExpertMentorship.find({ expert: userId })
      .populate({
        path: 'farmer',
        select: 'firstName lastName avatar email',
        populate: {
          path: 'farmerProfile',
          model: 'FarmerProfile',
          select: 'farmName location farmingType cropTypes verificationStatus'
        }
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await ExpertMentorship.countDocuments({ expert: userId });

    // Get recent messages for each mentorship
    const mentoringData = await Promise.all(mentorships.map(async (mentorship) => {
      const conversationId = `${userId}_${mentorship.farmer._id}`;
      const lastMessage = await Message.findOne({ conversationId })
        .sort({ createdAt: -1 });

      const unreadCount = await Message.countDocuments({
        conversationId,
        recipient: userId,
        isRead: false
      });

      return {
        _id: mentorship._id,
        farmer: mentorship.farmer,
        specialization: mentorship.specialization,
        status: mentorship.status,
        startDate: mentorship.startDate,
        goals: mentorship.goals,
        progressNotes: mentorship.progressNotes,
        lastMessage,
        unreadCount,
        totalSessions: mentorship.sessions?.length || 0,
        nextSession: mentorship.sessions?.find(s => 
          s.status === 'scheduled' && new Date(s.scheduledDate) > new Date()
        ),
        createdAt: mentorship.createdAt
      };
    }));

    res.json({
      success: true,
      data: {
        mentorships: mentoringData,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get mentoring farmers error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Create mentorship with farmer
// @route   POST /api/adopters/mentoring
// @access  Private (Adopter only)
const createMentorship = async (req, res) => {
  try {
    const { farmerId, specialization, goals, sessionFrequency, paymentTerms } = req.body;
    const adopterId = req.user._id;

    // Check if mentorship already exists
    const existingMentorship = await ExpertMentorship.findOne({
      expert: adopterId,
      farmer: farmerId,
      status: { $in: ['active', 'pending'] }
    });

    if (existingMentorship) {
      return res.status(400).json({
        success: false,
        message: 'Active mentorship with this farmer already exists'
      });
    }

    // Verify farmer exists
    const farmer = await FarmerProfile.findOne({ user: farmerId });
    if (!farmer) {
      return res.status(404).json({
        success: false,
        message: 'Farmer not found'
      });
    }

    const mentorship = new ExpertMentorship({
      expert: adopterId,
      farmer: farmerId,
      specialization,
      goals: goals || [],
      sessionFrequency,
      paymentTerms,
      status: 'pending',
      startDate: new Date()
    });

    await mentorship.save();

    const populatedMentorship = await ExpertMentorship.findById(mentorship._id)
      .populate('expert', 'firstName lastName avatar')
      .populate('farmer', 'firstName lastName avatar');

    res.status(201).json({
      success: true,
      data: { mentorship: populatedMentorship }
    });
  } catch (error) {
    console.error('Create mentorship error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Check if farmer is adopted by current user
// @route   GET /api/adopters/adoptions/check/:farmerId
// @access  Private (Adopter only)
const checkAdoptionStatus = async (req, res) => {
  try {
    const adopterId = req.user._id;
    const { farmerId } = req.params;

    // Check if adoption exists
    const adoption = await Adoption.findOne({
      adopter: adopterId,
      farmer: farmerId,
      status: { $in: ['active', 'pending'] }
    });

    res.json({
      success: true,
      data: {
        isAdopted: !!adoption,
        adoption: adoption ? {
          _id: adoption._id,
          status: adoption.status,
          createdAt: adoption.createdAt
        } : null
      }
    });
  } catch (error) {
    console.error('Check adoption status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get adopter conversations
// @route   GET /api/adopters/conversations
// @access  Private (Adopter only)
const getAdopterConversations = async (req, res) => {
  try {
    const adopterId = req.user._id;

    // Get all adoptions for this adopter
    const adoptions = await Adoption.find({ adopter: adopterId })
      .populate('farmer', '_id firstName lastName avatar')
      .select('farmer createdAt');

    // Get conversations with farmers
    const conversations = [];
    
    for (const adoption of adoptions) {
      if (adoption.farmer) {
        const conversationId = [adopterId, adoption.farmer._id].sort().join('_');
        
        // Get last message for this conversation
        const lastMessage = await Message.findOne({ conversationId })
          .sort({ createdAt: -1 })
          .populate('sender', 'firstName lastName')
          .populate('recipient', 'firstName lastName');

        // Get unread count
        const unreadCount = await Message.countDocuments({
          conversationId,
          recipient: adopterId,
          isRead: false
        });

        conversations.push({
          id: conversationId,
          conversationId,
          participant_id: adoption.farmer._id,
          participant_name: `${adoption.farmer.firstName} ${adoption.farmer.lastName}`,
          participant_image: adoption.farmer.avatar || '',
          participant_role: 'farmer',
          last_message: lastMessage ? (lastMessage.content?.text || 'File') : 'No messages yet',
          last_message_at: lastMessage?.createdAt || adoption.createdAt,
          unread_count: unreadCount,
          status: 'active',
          participant_details: {
            role: 'farmer',
            adoptionDate: adoption.createdAt
          }
        });
      }
    }

    // Sort by last message date
    conversations.sort((a, b) => new Date(b.last_message_at) - new Date(a.last_message_at));

    res.json({
      success: true,
      data: {
        conversations,
        totalUnread: conversations.reduce((total, conv) => total + conv.unread_count, 0)
      }
    });
  } catch (error) {
    console.error('Get adopter conversations error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get mentoring conversations for adopter
// @route   GET /api/adopters/mentoring/conversations
// @access  Private (Adopter only)
const getMentoringConversations = async (req, res) => {
  try {
    const adopterId = req.user._id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    // Get mentoring relationships
    const mentorships = await ExpertMentorship.find({ adopter: adopterId })
      .populate('farmer', 'firstName lastName avatar')
      .sort({ createdAt: -1 });

    // Get real message counts from conversations
    const Message = require('../models/Message');
    const conversations = await Promise.all(mentorships.map(async (mentorship) => {
      const messageCount = await Message.countDocuments({
        $or: [
          { sender: adopterId, receiver: mentorship.farmer._id },
          { sender: mentorship.farmer._id, receiver: adopterId }
        ]
      });

      return {
        id: mentorship._id,
        farmer: mentorship.farmer,
        specialization: mentorship.specialization,
        status: mentorship.status,
        lastInteraction: mentorship.updatedAt,
        messageCount
      };
    }));

    const paginatedConversations = conversations.slice((page - 1) * limit, page * limit);

    res.json({
      success: true,
      data: {
        conversations: paginatedConversations,
        pagination: {
          page,
          limit,
          total: conversations.length,
          pages: Math.ceil(conversations.length / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get mentoring conversations error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get adopter-farmer conversations
// @route   GET /api/adopters/conversations/farmers
// @access  Private (Adopter only)
const getAdopterFarmerConversations = async (req, res) => {
  try {
    const adopterId = req.user._id;

    // Get all active adoptions for this adopter
    const adoptions = await Adoption.find({
      adopter: adopterId,
      status: { $in: ['active', 'pending'] }
    })
    .populate('farmer', 'firstName lastName avatar email')
    .sort({ createdAt: -1 });

    // Create conversation data for each adoption
    const conversations = await Promise.all(
      adoptions.map(async (adoption) => {
        const farmerId = adoption.farmer._id;
        const conversationId = [adopterId, farmerId].sort().join('_');
        
        // Get latest message in this conversation
        const latestMessage = await Message.findOne({
          conversationId,
          adoption: adoption._id
        })
        .sort({ createdAt: -1 })
        .populate('sender', 'firstName lastName');

        // Get unread message count
        const unreadCount = await Message.countDocuments({
          conversationId,
          adoption: adoption._id,
          recipient: adopterId,
          isRead: false
        });

        return {
          conversationId,
          adoption: {
            _id: adoption._id,
            status: adoption.status,
            monthlyContribution: adoption.adoptionDetails?.monthlyContribution,
            startDate: adoption.createdAt
          },
          farmer: adoption.farmer,
          latestMessage: latestMessage ? {
            content: latestMessage.content,
            createdAt: latestMessage.createdAt,
            sender: latestMessage.sender
          } : null,
          unreadCount
        };
      })
    );

    res.json({
      success: true,
      data: conversations
    });
  } catch (error) {
    console.error('Get adopter-farmer conversations error:', error);
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
  adoptFarmerWithPayment,
  getPaymentHistory,
  getVisits,
  getInvestmentAnalytics,
  getMentoringFarmers,
  getMentoringConversations,
  createMentorship,
  getAdopterConversations,
  checkAdoptionStatus,
  getAdopterFarmerConversations
};