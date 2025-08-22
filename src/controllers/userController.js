const User = require('../models/User');
const FarmerProfile = require('../models/FarmerProfile');
const AdopterProfile = require('../models/AdopterProfile');
const { uploadImage, deleteFile } = require('../utils/cloudinaryUtils');

// @desc    Get user profile
// @route   GET /api/users/profile
// @access  Private
const getProfile = async (req, res) => {
  try {
    const user = req.user;
    
    // Get role-specific profile
    let profile = null;
    if (user.role === 'farmer') {
      profile = await FarmerProfile.findOne({ user: user._id });
    } else if (user.role === 'adopter') {
      profile = await AdopterProfile.findOne({ user: user._id });
    }

    res.json({
      success: true,
      data: {
        user,
        profile
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
const updateProfile = async (req, res) => {
  try {
    const userId = req.user._id;
    const { firstName, lastName, phone } = req.body;

    // Update user basic info
    const user = await User.findByIdAndUpdate(
      userId,
      { firstName, lastName, phone },
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: { user }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Upload user avatar
// @route   POST /api/users/avatar
// @access  Private
const uploadAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file provided'
      });
    }

    const userId = req.user._id;
    const user = await User.findById(userId);

    // Delete old avatar if exists
    if (user.avatar && user.avatar.publicId) {
      await deleteFile(user.avatar.publicId);
    }

    // Upload new avatar
    const result = await uploadImage(req.file, 'adopt-a-farmer/avatars');

    // Update user avatar
    user.avatar = {
      url: result.url,
      publicId: result.publicId
    };
    await user.save();

    res.json({
      success: true,
      message: 'Avatar uploaded successfully',
      data: {
        avatar: user.avatar
      }
    });
  } catch (error) {
    console.error('Upload avatar error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Delete user account
// @route   DELETE /api/users/account
// @access  Private
const deleteAccount = async (req, res) => {
  try {
    const userId = req.user._id;
    const { password } = req.body;

    // Get user with password
    const user = await User.findById(userId).select('+password');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Verify password
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Invalid password'
      });
    }

    // Delete user avatar if exists
    if (user.avatar && user.avatar.publicId) {
      await deleteFile(user.avatar.publicId);
    }

    // Delete role-specific profile
    if (user.role === 'farmer') {
      const farmerProfile = await FarmerProfile.findOne({ user: userId });
      if (farmerProfile) {
        // Delete farm images
        if (farmerProfile.media.farmImages) {
          for (const image of farmerProfile.media.farmImages) {
            if (image.publicId) {
              await deleteFile(image.publicId);
            }
          }
        }
        // Delete videos
        if (farmerProfile.media.videos) {
          for (const video of farmerProfile.media.videos) {
            if (video.publicId) {
              await deleteFile(video.publicId, 'video');
            }
          }
        }
        await FarmerProfile.findOneAndDelete({ user: userId });
      }
    } else if (user.role === 'adopter') {
      await AdopterProfile.findOneAndDelete({ user: userId });
    }

    // Soft delete user (deactivate instead of hard delete to maintain data integrity)
    user.isActive = false;
    user.email = `deleted_${Date.now()}_${user.email}`;
    await user.save();

    res.json({
      success: true,
      message: 'Account deleted successfully'
    });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get user by ID (public info only)
// @route   GET /api/users/:id
// @access  Public
const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('firstName lastName avatar role createdAt');

    if (!user || !user.isActive) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: { user }
    });
  } catch (error) {
    console.error('Get user by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

module.exports = {
  getProfile,
  updateProfile,
  uploadAvatar,
  deleteAccount,
  getUserById
};