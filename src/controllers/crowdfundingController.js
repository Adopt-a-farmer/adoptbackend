const CrowdfundingProject = require('../models/CrowdfundingProject');
const Payment = require('../models/Payment');
const { initializePayment, verifyPayment } = require('../services/paystackService');

// @desc    Get all crowdfunding projects
// @route   GET /api/crowdfunding/projects
// @access  Public
const getCrowdfundingProjects = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const skip = (page - 1) * limit;

    const filter = { status: 'active' };
    
    if (req.query.category) {
      filter.category = req.query.category;
    }
    
    if (req.query.search) {
      filter.$text = { $search: req.query.search };
    }

    let sort = { createdAt: -1 };
    if (req.query.sort === 'ending') {
      sort = { endDate: 1 };
    } else if (req.query.sort === 'progress') {
      sort = { 'progress.percentage': -1 };
    } else if (req.query.sort === 'goal') {
      sort = { goalAmount: -1 };
    }

    const projects = await CrowdfundingProject.find(filter)
      .populate('farmer', 'firstName lastName avatar farmName location')
      .sort(sort)
      .skip(skip)
      .limit(limit);

    const total = await CrowdfundingProject.countDocuments(filter);

    res.json({
      success: true,
      data: {
        projects,
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
    console.error('Get crowdfunding projects error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get single crowdfunding project
// @route   GET /api/crowdfunding/projects/:id
// @access  Public
const getCrowdfundingProject = async (req, res) => {
  try {
    const project = await CrowdfundingProject.findById(req.params.id)
      .populate('farmer', 'firstName lastName avatar farmName location bio')
      .populate('backers.user', 'firstName lastName avatar')
      .populate('updates.author', 'firstName lastName avatar');

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    res.json({
      success: true,
      data: { project }
    });
  } catch (error) {
    console.error('Get crowdfunding project error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Create crowdfunding project
// @route   POST /api/crowdfunding/projects
// @access  Private (Farmer only)
const createCrowdfundingProject = async (req, res) => {
  try {
    if (req.user.role !== 'farmer') {
      return res.status(403).json({
        success: false,
        message: 'Only farmers can create crowdfunding projects'
      });
    }

    // Check if farmer already has an active project
    const existingProject = await CrowdfundingProject.findOne({
      farmer: req.user._id,
      status: 'active'
    });

    if (existingProject) {
      return res.status(400).json({
        success: false,
        message: 'You already have an active crowdfunding project'
      });
    }

    const projectData = {
      ...req.body,
      farmer: req.user._id
    };

    const project = await CrowdfundingProject.create(projectData);

    res.status(201).json({
      success: true,
      message: 'Crowdfunding project created successfully',
      data: { project }
    });
  } catch (error) {
    console.error('Create crowdfunding project error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Back a crowdfunding project
// @route   POST /api/crowdfunding/projects/:id/back
// @access  Private
const backProject = async (req, res) => {
  try {
    const { amount, message } = req.body;
    const projectId = req.params.id;
    const userId = req.user._id;

    const project = await CrowdfundingProject.findById(projectId)
      .populate('farmer', 'firstName lastName');

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    if (project.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'Project is not active'
      });
    }

    if (new Date() > project.endDate) {
      return res.status(400).json({
        success: false,
        message: 'Project funding period has ended'
      });
    }

    // Initialize payment with Paystack
    const paymentData = await initializePayment({
      amount: amount * 100, // Convert to kobo
      email: req.user.email,
      reference: `crowd_${projectId}_${userId}_${Date.now()}`,
      metadata: {
        type: 'crowdfunding',
        projectId,
        userId,
        amount,
        message
      }
    });

    res.json({
      success: true,
      message: 'Payment initialized',
      data: {
        paymentUrl: paymentData.authorization_url,
        reference: paymentData.reference
      }
    });
  } catch (error) {
    console.error('Back project error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Verify crowdfunding payment
// @route   POST /api/crowdfunding/verify-payment
// @access  Private
const verifyCrowdfundingPayment = async (req, res) => {
  try {
    const { reference } = req.body;

    const verification = await verifyPayment(reference);

    if (verification.status === 'success') {
      const { projectId, userId, amount, message } = verification.metadata;

      const project = await CrowdfundingProject.findById(projectId);
      if (!project) {
        return res.status(404).json({
          success: false,
          message: 'Project not found'
        });
      }

      // Add backer to project
      const existingBacker = project.backers.find(
        backer => backer.user.toString() === userId
      );

      if (existingBacker) {
        existingBacker.amount += amount;
        existingBacker.date = new Date();
        if (message) existingBacker.message = message;
      } else {
        project.backers.push({
          user: userId,
          amount,
          message,
          date: new Date()
        });
      }

      // Update project progress
      project.progress.raised += amount;
      project.progress.percentage = Math.min(
        (project.progress.raised / project.goalAmount) * 100,
        100
      );

      // Check if project is fully funded
      if (project.progress.percentage >= 100 && project.status === 'active') {
        project.status = 'funded';
      }

      await project.save();

      // Create payment record
      await Payment.create({
        user: userId,
        amount,
        type: 'crowdfunding',
        status: 'completed',
        reference,
        metadata: {
          projectId,
          projectTitle: project.title
        }
      });

      res.json({
        success: true,
        message: 'Payment verified and project backed successfully',
        data: {
          project: {
            _id: project._id,
            progress: project.progress,
            status: project.status
          }
        }
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Payment verification failed'
      });
    }
  } catch (error) {
    console.error('Verify crowdfunding payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Add project update
// @route   POST /api/crowdfunding/projects/:id/updates
// @access  Private (Project farmer only)
const addProjectUpdate = async (req, res) => {
  try {
    const projectId = req.params.id;
    const { title, content, images } = req.body;

    const project = await CrowdfundingProject.findById(projectId);

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    if (project.farmer.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only project owner can add updates'
      });
    }

    project.updates.push({
      title,
      content,
      images: images || [],
      author: req.user._id,
      date: new Date()
    });

    await project.save();

    res.json({
      success: true,
      message: 'Project update added successfully',
      data: {
        update: project.updates[project.updates.length - 1]
      }
    });
  } catch (error) {
    console.error('Add project update error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

module.exports = {
  getCrowdfundingProjects,
  getCrowdfundingProject,
  createCrowdfundingProject,
  backProject,
  verifyCrowdfundingPayment,
  addProjectUpdate
};