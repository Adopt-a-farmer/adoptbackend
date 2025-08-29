const KnowledgeArticle = require('../models/KnowledgeArticle');
const FarmingCalendar = require('../models/FarmingCalendar');
const User = require('../models/User');
const FarmerProfile = require('../models/FarmerProfile');
const ExpertProfile = require('../models/ExpertProfile');
const ExpertMentorship = require('../models/ExpertMentorship');
const Adoption = require('../models/Adoption');
const AdopterProfile = require('../models/AdopterProfile');
const Message = require('../models/Message');
const FarmVisit = require('../models/FarmVisit');

// @desc    Get expert dashboard stats
// @route   GET /api/experts/dashboard
// @access  Private (Expert only)
const getExpertDashboard = async (req, res) => {
  try {
    const expertId = req.user._id;

    // Get expert's articles stats
    const [
      totalArticles,
      publishedArticles,
      draftArticles,
      totalViews,
      totalLikes
    ] = await Promise.all([
      KnowledgeArticle.countDocuments({ author: expertId }),
      KnowledgeArticle.countDocuments({ author: expertId, status: 'published' }),
      KnowledgeArticle.countDocuments({ author: expertId, status: 'draft' }),
      KnowledgeArticle.aggregate([
        { $match: { author: expertId } },
        { $group: { _id: null, totalViews: { $sum: '$views' } } }
      ]),
      KnowledgeArticle.aggregate([
        { $match: { author: expertId } },
        { $project: { likesCount: { $size: '$likes' } } },
        { $group: { _id: null, totalLikes: { $sum: '$likesCount' } } }
      ])
    ]);

    // Get mentorship stats
    const [
      totalMentorships,
      activeMentorships,
      completedMentorships
    ] = await Promise.all([
      ExpertMentorship.countDocuments({ expert: expertId }),
      ExpertMentorship.countDocuments({ expert: expertId, status: 'active' }),
      ExpertMentorship.countDocuments({ expert: expertId, status: 'completed' })
    ]);

    // Get recent mentorships
    const recentMentorships = await ExpertMentorship.find({ expert: expertId })
      .populate('farmer', 'firstName lastName avatar')
      .sort({ createdAt: -1 })
      .limit(5);

    // Get recent articles
    const recentArticles = await KnowledgeArticle.find({ author: expertId })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('title status views likes createdAt updatedAt');

    // Get calendar entries created by expert
    const calendarEntries = await FarmingCalendar.countDocuments({ 
      'expertAdvice.author': expertId 
    });

    // Get messaging stats
    const unreadMessages = await Message.countDocuments({
      recipient: expertId,
      isRead: false
    });

    // Get upcoming farm visits
    const upcomingVisits = await FarmVisit.find({
      adopter: expertId,
      scheduledDate: { $gte: new Date() },
      status: { $in: ['requested', 'confirmed'] }
    })
    .populate('farmer', 'farmName')
    .populate('farmer.user', 'firstName lastName')
    .sort({ scheduledDate: 1 })
    .limit(5);

    // Get platform stats
    const [totalFarmers, totalAdopters, totalInvestorFarmerPairs] = await Promise.all([
      User.countDocuments({ role: 'farmer' }),
      User.countDocuments({ role: 'adopter' }),
      Adoption.countDocuments({ status: 'active' })
    ]);

    res.json({
      success: true,
      data: {
        stats: {
          articles: {
            total: totalArticles,
            published: publishedArticles,
            drafts: draftArticles
          },
          mentorships: {
            total: totalMentorships,
            active: activeMentorships,
            completed: completedMentorships
          },
          engagement: {
            totalViews: totalViews[0]?.totalViews || 0,
            totalLikes: totalLikes[0]?.totalLikes || 0,
            calendarEntries,
            unreadMessages
          },
          platform: {
            totalFarmers,
            totalAdopters,
            totalInvestorFarmerPairs
          }
        },
        recentActivity: {
          articles: recentArticles.map(article => ({
            ...article.toObject(),
            likesCount: article.likes?.length || 0
          })),
          mentorships: recentMentorships,
          upcomingVisits
        }
      }
    });
  } catch (error) {
    console.error('Expert dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get expert's articles
// @route   GET /api/experts/articles
// @access  Private (Expert only)
const getExpertArticles = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    const filter = { author: req.user._id };
    
    if (req.query.status) {
      filter.status = req.query.status;
    }
    
    if (req.query.category) {
      filter.category = req.query.category;
    }

    let sort = { createdAt: -1 };
    if (req.query.sort === 'views') {
      sort = { views: -1 };
    } else if (req.query.sort === 'likes') {
      sort = { 'likes.length': -1 };
    }

    const articles = await KnowledgeArticle.find(filter)
      .populate('author', 'firstName lastName avatar')
      .sort(sort)
      .skip(skip)
      .limit(limit);

    const total = await KnowledgeArticle.countDocuments(filter);

    res.json({
      success: true,
      data: {
        articles: articles.map(article => ({
          ...article.toObject(),
          likesCount: article.likes?.length || 0
        })),
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
    console.error('Get expert articles error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Update expert article
// @route   PUT /api/experts/articles/:id
// @access  Private (Expert only)
const updateExpertArticle = async (req, res) => {
  try {
    const articleId = req.params.id;
    const expertId = req.user._id;

    const article = await KnowledgeArticle.findOne({ 
      _id: articleId, 
      author: expertId 
    });

    if (!article) {
      return res.status(404).json({
        success: false,
        message: 'Article not found or you do not have permission to edit it'
      });
    }

    const updatedData = { ...req.body };
    
    // Update slug if title changed
    if (req.body.title && req.body.title !== article.title) {
      updatedData.slug = req.body.title.toLowerCase().replace(/[^a-zA-Z0-9]/g, '-');
    }

    // Update published date if publishing for the first time
    if (req.body.status === 'published' && article.status !== 'published') {
      updatedData.publishedAt = new Date();
    }

    const updatedArticle = await KnowledgeArticle.findByIdAndUpdate(
      articleId,
      updatedData,
      { new: true, runValidators: true }
    ).populate('author', 'firstName lastName avatar');

    res.json({
      success: true,
      message: 'Article updated successfully',
      data: { article: updatedArticle }
    });
  } catch (error) {
    console.error('Update expert article error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Delete expert article
// @route   DELETE /api/experts/articles/:id
// @access  Private (Expert only)
const deleteExpertArticle = async (req, res) => {
  try {
    const articleId = req.params.id;
    const expertId = req.user._id;

    const article = await KnowledgeArticle.findOne({ 
      _id: articleId, 
      author: expertId 
    });

    if (!article) {
      return res.status(404).json({
        success: false,
        message: 'Article not found or you do not have permission to delete it'
      });
    }

    await KnowledgeArticle.findByIdAndDelete(articleId);

    res.json({
      success: true,
      message: 'Article deleted successfully'
    });
  } catch (error) {
    console.error('Delete expert article error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get expert profile
// @route   GET /api/experts/profile
// @access  Private (Expert only)
const getExpertProfile = async (req, res) => {
  try {
    const expert = await User.findById(req.user._id).select('-password');
    
    if (!expert) {
      return res.status(404).json({
        success: false,
        message: 'Expert not found'
      });
    }

    // Get or create expert profile
    let expertProfile = await ExpertProfile.findOne({ user: expert._id });
    
    if (!expertProfile) {
      // Create expert profile if it doesn't exist (for existing users)
      expertProfile = await ExpertProfile.create({
        user: expert._id,
        bio: '',
        specializations: [],
        experience: {
          yearsOfExperience: 0,
          education: [],
          certifications: [],
          previousWork: []
        },
        contact: {
          phone: expert.phone || ''
        },
        availability: {
          isAvailable: true,
          maxMentorships: 10,
          workingHours: {
            start: '08:00',
            end: '17:00'
          },
          workingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
          consultationTypes: ['remote', 'phone', 'video_call']
        },
        location: {
          county: '',
          subCounty: '',
          serviceRadius: 50
        }
      });
    }

    // Get expert's article statistics
    const [totalArticles, totalViews, totalLikes] = await Promise.all([
      KnowledgeArticle.countDocuments({ author: expert._id }),
      KnowledgeArticle.aggregate([
        { $match: { author: expert._id } },
        { $group: { _id: null, totalViews: { $sum: '$views' } } }
      ]),
      KnowledgeArticle.aggregate([
        { $match: { author: expert._id } },
        { $project: { likesCount: { $size: '$likes' } } },
        { $group: { _id: null, totalLikes: { $sum: '$likesCount' } } }
      ])
    ]);

    // Update statistics in profile
    expertProfile.statistics.totalArticles = totalArticles;
    expertProfile.statistics.totalViews = totalViews[0]?.totalViews || 0;
    expertProfile.statistics.totalLikes = totalLikes[0]?.totalLikes || 0;
    await expertProfile.save();

    res.json({
      success: true,
      data: {
        expert: {
          user: expert,
          profile: expertProfile,
          stats: {
            totalArticles,
            totalViews: totalViews[0]?.totalViews || 0,
            totalLikes: totalLikes[0]?.totalLikes || 0
          }
        }
      }
    });
  } catch (error) {
    console.error('Get expert profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Update expert profile
// @route   PUT /api/experts/profile
// @access  Private (Expert only)
const updateExpertProfile = async (req, res) => {
  try {
    const userId = req.user._id;
    
    // Separate user fields from profile fields
    const userFields = ['firstName', 'lastName', 'phone', 'avatar'];
    const profileFields = [
      'bio', 'specializations', 'experience', 'contact', 'availability', 
      'location', 'pricing', 'languages'
    ];
    
    const userUpdates = {};
    const profileUpdates = {};
    
    // Extract user updates
    userFields.forEach(field => {
      if (req.body[field] !== undefined) {
        userUpdates[field] = req.body[field];
      }
    });
    
    // Extract profile updates
    profileFields.forEach(field => {
      if (req.body[field] !== undefined) {
        profileUpdates[field] = req.body[field];
      }
    });

    // Update user if there are user fields to update
    let updatedUser = null;
    if (Object.keys(userUpdates).length > 0) {
      updatedUser = await User.findByIdAndUpdate(
        userId,
        userUpdates,
        { new: true, runValidators: true }
      ).select('-password');
    } else {
      updatedUser = await User.findById(userId).select('-password');
    }

    // Update or create expert profile
    let expertProfile = await ExpertProfile.findOne({ user: userId });
    
    if (!expertProfile) {
      // Create expert profile if it doesn't exist
      expertProfile = await ExpertProfile.create({
        user: userId,
        ...profileUpdates,
        bio: profileUpdates.bio || '',
        specializations: profileUpdates.specializations || [],
        contact: {
          phone: updatedUser.phone || '',
          ...profileUpdates.contact
        }
      });
    } else if (Object.keys(profileUpdates).length > 0) {
      // Update existing profile
      Object.assign(expertProfile, profileUpdates);
      
      // Update contact phone if user phone was updated
      if (userUpdates.phone) {
        expertProfile.contact.phone = userUpdates.phone;
      }
      
      // Recalculate profile completeness
      expertProfile.calculateCompleteness();
      
      await expertProfile.save();
    }

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: { 
        expert: {
          user: updatedUser,
          profile: expertProfile
        }
      }
    });
  } catch (error) {
    console.error('Update expert profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get expert's mentoring relationships
// @route   GET /api/experts/mentorships
// @access  Private (Expert only)
const getExpertMentorships = async (req, res) => {
  try {
    const expertId = req.user._id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    const filter = { expert: expertId };
    
    if (req.query.status) {
      filter.status = req.query.status;
    }
    
    if (req.query.specialization) {
      filter.specialization = req.query.specialization;
    }

    const mentorships = await ExpertMentorship.find(filter)
      .populate({
        path: 'farmer',
        select: 'firstName lastName avatar email phone',
        populate: {
          path: 'farmerProfile',
          model: 'FarmerProfile',
          select: 'farmName location farmingType cropTypes'
        }
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await ExpertMentorship.countDocuments(filter);

    res.json({
      success: true,
      data: {
        mentorships,
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
    console.error('Get expert mentorships error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get farmers that have investors (for expert oversight)
// @route   GET /api/experts/investors-farmers
// @access  Private (Expert only)
const getInvestorFarmerRelationships = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Get all active adoptions with investor and farmer details
    const adoptions = await Adoption.find({ status: 'active' })
      .populate({
        path: 'adopter',
        select: 'firstName lastName avatar email'
      })
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

    const total = await Adoption.countDocuments({ status: 'active' });

    // Group by farmer to show all their investors
    const farmerInvestorMap = {};
    adoptions.forEach(adoption => {
      const farmerId = adoption.farmer._id.toString();
      if (!farmerInvestorMap[farmerId]) {
        farmerInvestorMap[farmerId] = {
          farmer: adoption.farmer,
          investors: [],
          totalInvestment: 0
        };
      }
      farmerInvestorMap[farmerId].investors.push({
        adopter: adoption.adopter,
        adoption: {
          _id: adoption._id,
          adoptionType: adoption.adoptionType,
          startDate: adoption.adoptionDetails.duration.start,
          endDate: adoption.adoptionDetails.duration.end,
          status: adoption.status
        }
      });
      farmerInvestorMap[farmerId].totalInvestment += adoption.paymentPlan.totalAmount || 0;
    });

    const farmerInvestorRelationships = Object.values(farmerInvestorMap);

    res.json({
      success: true,
      data: {
        relationships: farmerInvestorRelationships,
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
    console.error('Get investor-farmer relationships error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get conversations for expert (farmers they're mentoring)
// @route   GET /api/experts/conversations
// @access  Private (Expert only)
const getExpertConversations = async (req, res) => {
  try {
    const expertId = req.user._id;

    // Get farmers this expert is mentoring
    const mentorships = await ExpertMentorship.find({ 
      expert: expertId, 
      status: 'active' 
    }).select('farmer');
    
    const farmerIds = mentorships.map(m => m.farmer);

    // Get conversations with these farmers
    const conversations = await Message.aggregate([
      {
        $match: {
          $or: [
            { sender: expertId, recipient: { $in: farmerIds } },
            { sender: { $in: farmerIds }, recipient: expertId }
          ]
        }
      },
      {
        $sort: { createdAt: -1 }
      },
      {
        $group: {
          _id: '$conversationId',
          lastMessage: { $first: '$$ROOT' },
          unreadCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$recipient', expertId] },
                    { $eq: ['$isRead', false] }
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      },
      {
        $sort: { 'lastMessage.createdAt': -1 }
      }
    ]);

    // Populate user details
    const populatedConversations = await Promise.all(
      conversations.map(async (conv) => {
        const lastMessage = await Message.findById(conv.lastMessage._id)
          .populate('sender', 'firstName lastName avatar')
          .populate('recipient', 'firstName lastName avatar');

        // Determine the farmer in conversation
        const otherUserId = conv._id.split('_').find(id => id !== expertId.toString());
        const farmer = await User.findById(otherUserId)
          .select('firstName lastName avatar role');

        // Get farmer profile
        const farmerProfile = await FarmerProfile.findOne({ user: otherUserId })
          .select('farmName location');

        return {
          conversationId: conv._id,
          farmer: {
            ...farmer.toObject(),
            farmerProfile
          },
          lastMessage,
          unreadCount: conv.unreadCount
        };
      })
    );

    // Convert to consistent format for frontend
    const formattedConversations = populatedConversations.map(conv => {
      return {
        conversationId: conv.conversationId,
        farmer: {
          _id: conv.farmer._id,
          firstName: conv.farmer.firstName,
          lastName: conv.farmer.lastName,
          avatar: conv.farmer.avatar,
          role: conv.farmer.role,
          farmerProfile: conv.farmer.farmerProfile
        },
        lastMessage: {
          _id: conv.lastMessage._id,
          content: {
            text: conv.lastMessage.content?.text || 'File'
          },
          sender: {
            firstName: conv.lastMessage.sender.firstName,
            lastName: conv.lastMessage.sender.lastName
          },
          createdAt: conv.lastMessage.createdAt
        },
        unreadCount: conv.unreadCount
      };
    });

    res.json({
      success: true,
      data: formattedConversations
    });
  } catch (error) {
    console.error('Get expert conversations error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get farm visits for expert
// @route   GET /api/experts/visits
// @access  Private (Expert only)
const getExpertFarmVisits = async (req, res) => {
  try {
    const expertId = req.user._id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Get farmers this expert is mentoring
    const mentorships = await ExpertMentorship.find({ 
      expert: expertId, 
      status: 'active' 
    }).select('farmer');
    
    const farmerIds = mentorships.map(m => m.farmer);
    
    // Get farmer profiles for these farmers
    const farmerProfiles = await FarmerProfile.find({ 
      user: { $in: farmerIds } 
    }).select('_id user');
    
    const farmerProfileIds = farmerProfiles.map(fp => fp._id);

    const filter = {
      $or: [
        { adopter: expertId }, // Expert as visitor
        { farmer: { $in: farmerProfileIds } } // Visits to farmers expert mentors
      ]
    };
    
    if (req.query.status) {
      filter.status = req.query.status;
    }
    
    if (req.query.date) {
      const date = new Date(req.query.date);
      filter.scheduledDate = {
        $gte: new Date(date.setHours(0, 0, 0, 0)),
        $lte: new Date(date.setHours(23, 59, 59, 999))
      };
    }

    const visits = await FarmVisit.find(filter)
      .populate('adopter', 'firstName lastName avatar email')
      .populate({
        path: 'farmer',
        populate: {
          path: 'user',
          select: 'firstName lastName avatar email'
        }
      })
      .sort({ scheduledDate: -1 })
      .skip(skip)
      .limit(limit);

    const total = await FarmVisit.countDocuments(filter);

    res.json({
      success: true,
      data: {
        visits,
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
    console.error('Get expert farm visits error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Create a mentorship relationship
// @route   POST /api/experts/mentorships
// @access  Private (Expert only)
const createMentorship = async (req, res) => {
  try {
    const expertId = req.user._id;
    const { farmerId, specialization, goals, paymentTerms, communicationPreferences } = req.body;

    // Verify farmer exists
    const farmer = await User.findById(farmerId);
    if (!farmer || farmer.role !== 'farmer') {
      return res.status(404).json({
        success: false,
        message: 'Farmer not found'
      });
    }

    // Check if mentorship already exists
    const existingMentorship = await ExpertMentorship.findOne({
      expert: expertId,
      farmer: farmerId,
      status: 'active'
    });

    if (existingMentorship) {
      return res.status(400).json({
        success: false,
        message: 'Active mentorship already exists with this farmer'
      });
    }

    const mentorship = await ExpertMentorship.create({
      expert: expertId,
      farmer: farmerId,
      specialization,
      goals: goals || [],
      paymentTerms: paymentTerms || {},
      communicationPreferences: communicationPreferences || {}
    });

    const populatedMentorship = await ExpertMentorship.findById(mentorship._id)
      .populate('farmer', 'firstName lastName avatar email')
      .populate('expert', 'firstName lastName avatar email');

    res.status(201).json({
      success: true,
      message: 'Mentorship created successfully',
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

module.exports = {
  getExpertDashboard,
  getExpertArticles,
  updateExpertArticle,
  deleteExpertArticle,
  getExpertProfile,
  updateExpertProfile,
  getExpertMentorships,
  getInvestorFarmerRelationships,
  getExpertConversations,
  getExpertFarmVisits,
  createMentorship
};