const User = require('../models/User');
const FarmerProfile = require('../models/FarmerProfile');
const ExpertProfile = require('../models/ExpertProfile');

// Check if user's account verification is pending and should show blurred dashboard
const checkVerificationStatus = async (req, res, next) => {
  try {
    const user = req.user;
    
    if (!user) {
      return next();
    }

    let verificationStatus = {
      isEmailVerified: user.isEmailVerified,
      accountStatus: user.verificationStatus,
      profileVerified: false,
      requiresBlur: false,
      message: null
    };

    // Check role-specific verification status
    if (user.role === 'farmer') {
      const farmerProfile = await FarmerProfile.findOne({ user: user._id });
      if (farmerProfile) {
        verificationStatus.profileVerified = farmerProfile.verificationStatus === 'verified';
        verificationStatus.profileStatus = farmerProfile.verificationStatus;
        
        // Farmers need admin verification - show blur if pending
        if (farmerProfile.verificationStatus === 'pending') {
          verificationStatus.requiresBlur = true;
          verificationStatus.message = 'Your farmer account is under review by our admin team. Please wait while we verify your account details.';
        }
      }
    } else if (user.role === 'expert') {
      const expertProfile = await ExpertProfile.findOne({ user: user._id });
      if (expertProfile) {
        verificationStatus.profileVerified = expertProfile.verificationStatus === 'verified';
        verificationStatus.profileStatus = expertProfile.verificationStatus;
        
        // Experts need admin verification - show blur if pending
        if (expertProfile.verificationStatus === 'pending') {
          verificationStatus.requiresBlur = true;
          verificationStatus.message = 'Your expert account is under review by our admin team. Please wait while we verify your credentials and expertise.';
        }
      }
    }

    // Email verification check (skip for admin users)
    if (!user.isEmailVerified && user.role !== 'admin') {
      verificationStatus.requiresBlur = true;
      verificationStatus.message = 'Please verify your email address to access all features. Check your email for the verification code.';
    }

    // Add verification status to request object
    req.verificationStatus = verificationStatus;
    
    next();
  } catch (error) {
    console.error('Verification status check error:', error);
    next(); // Continue even if verification check fails
  }
};

// Middleware to return verification status as response
const getVerificationStatus = (req, res) => {
  const verificationStatus = req.verificationStatus || {
    isEmailVerified: true,
    accountStatus: 'verified',
    profileVerified: true,
    requiresBlur: false,
    message: null
  };

  res.json({
    success: true,
    data: verificationStatus
  });
};

// Middleware to block actions if verification is pending
const requireVerification = (req, res, next) => {
  const verificationStatus = req.verificationStatus;
  
  if (verificationStatus && verificationStatus.requiresBlur) {
    return res.status(403).json({
      success: false,
      message: 'Action not allowed. Account verification is required.',
      verificationRequired: true,
      details: verificationStatus.message
    });
  }
  
  next();
};

module.exports = {
  checkVerificationStatus,
  getVerificationStatus,
  requireVerification
};