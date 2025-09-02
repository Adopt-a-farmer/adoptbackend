const User = require('../models/User');
const FarmerProfile = require('../models/FarmerProfile');
const AdopterProfile = require('../models/AdopterProfile');
const ExpertProfile = require('../models/ExpertProfile');
const { generateToken, generateRefreshToken, verifyRefreshToken } = require('../utils/tokenUtils');

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
const register = async (req, res) => {
  try {
    const { firstName, lastName, email, password, role, phone, farmerProfile } = req.body;

    console.log('🚀 Registration attempt:', {
      email,
      role,
      firstName,
      lastName,
      phone: phone || 'not provided',
      hasDetailedProfile: !!farmerProfile
    });

    // Check if user exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      console.log('❌ Registration failed: User already exists:', email);
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email'
      });
    }

    // Create user
    const user = await User.create({
      firstName,
      lastName,
      email,
      password,
      role,
      phone
    });

    console.log('✅ User created successfully:', {
      id: user._id,
      email: user.email,
      role: user.role
    });

    // Create role-specific profile
    if (role === 'farmer') {
      const profileData = {
        user: user._id,
        verificationStatus: 'verified', // Auto-verify new farmers
        isActive: true
      };

      // Use detailed profile data if provided, otherwise use defaults
      if (farmerProfile) {
        console.log('📋 Creating detailed farmer profile:', farmerProfile);
        Object.assign(profileData, {
          farmName: farmerProfile.farmName || `${firstName} ${lastName}'s Farm`,
          description: farmerProfile.description || 'New farmer profile - please update your farm description',
          location: {
            county: farmerProfile.location?.county || 'Not specified',
            subCounty: farmerProfile.location?.subCounty || 'Not specified',
            village: farmerProfile.location?.village || ''
          },
          farmSize: {
            value: farmerProfile.farmSize?.value || 1,
            unit: farmerProfile.farmSize?.unit || 'acres'
          },
          establishedYear: farmerProfile.establishedYear || new Date().getFullYear(),
          farmingType: farmerProfile.farmingType && farmerProfile.farmingType.length > 0 
            ? farmerProfile.farmingType 
            : ['crop'],
          cropTypes: farmerProfile.cropTypes || [],
          farmingMethods: farmerProfile.farmingMethods || [],
          contactInfo: {
            phone: farmerProfile.contactInfo?.phone || phone,
            email: farmerProfile.contactInfo?.email || email,
            website: farmerProfile.contactInfo?.website || ''
          },
          socialMedia: {
            facebook: farmerProfile.socialMedia?.facebook || '',
            twitter: farmerProfile.socialMedia?.twitter || '',
            instagram: farmerProfile.socialMedia?.instagram || ''
          },
          crops: [],
          livestock: [],
          certifications: []
        });
      } else {
        // Default profile data
        Object.assign(profileData, {
          farmName: `${firstName} ${lastName}'s Farm`,
          description: 'New farmer profile - please update your farm description',
          location: {
            county: 'Not specified',
            subCounty: 'Not specified'
          },
          farmSize: {
            value: 1,
            unit: 'acres'
          },
          farmingType: ['crop'],
          cropTypes: [],
          farmingMethods: [],
          crops: [],
          livestock: [],
          certifications: []
        });
      }

      await FarmerProfile.create(profileData);
      console.log('✅ FarmerProfile created for user:', user._id);
    } else if (role === 'adopter') {
      await AdopterProfile.create({
        user: user._id,
        adopterType: 'individual',
        location: {
          country: 'Kenya'
        },
        interests: {
          farmingTypes: ['crop']
        }
      });
      console.log('✅ AdopterProfile created for user:', user._id);
    } else if (role === 'expert') {
      const expertProfile = await ExpertProfile.create({
        user: user._id,
        bio: '',
        specializations: [],
        experience: {
          yearsOfExperience: 0,
          education: [],
          certifications: [],
          previousWork: []
        },
        contact: {
          phone: phone || ''
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
      console.log('✅ ExpertProfile created for user:', user._id, 'Profile ID:', expertProfile._id);
    }

    // Generate token
    const token = generateToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    console.log('✅ Registration completed successfully for:', email);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
          isVerified: user.isVerified,
          avatar: user.avatar
        },
        token,
        refreshToken
      }
    });
  } catch (error) {
    console.error('❌ Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during registration'
    });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log('🔐 Login attempt for:', email);

    // Check if user exists and get password
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      console.log('❌ Login failed: User not found:', email);
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    console.log('👤 User found:', {
      id: user._id,
      email: user.email,
      role: user.role,
      isActive: user.isActive
    });

    // Check if user is active
    if (!user.isActive) {
      console.log('❌ Login failed: User account deactivated:', email);
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated. Please contact support.'
      });
    }

    // Check password
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      console.log('❌ Login failed: Invalid password for:', email);
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    console.log('✅ Password verified for:', email);

    // Generate tokens
    const token = generateToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    console.log('✅ Login successful for:', email, 'Role:', user.role);

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
          phone: user.phone,
          isVerified: user.isVerified,
          avatar: user.avatar,
          lastLogin: user.lastLogin
        },
        token,
        refreshToken
      }
    });
  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login'
    });
  }
};

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res) => {
  try {
    const user = req.user;
    
    // Get role-specific profile
    let profile = null;
    if (user.role === 'farmer') {
      profile = await FarmerProfile.findOne({ user: user._id });
    } else if (user.role === 'adopter') {
      profile = await AdopterProfile.findOne({ user: user._id });
    } else if (user.role === 'expert') {
      profile = await ExpertProfile.findOne({ user: user._id });
      
      // Create expert profile if it doesn't exist (for existing users)
      if (!profile) {
        profile = await ExpertProfile.create({
          user: user._id,
          bio: '',
          specializations: [],
          experience: {
            yearsOfExperience: 0,
            education: [],
            certifications: [],
            previousWork: []
          },
          contact: {
            phone: user.phone || ''
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
    }

    res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          _id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          fullName: user.fullName,
          email: user.email,
          role: user.role,
          phone: user.phone,
          isVerified: user.isVerified,
          avatar: user.avatar,
          lastLogin: user.lastLogin,
          createdAt: user.createdAt
        },
        profile
      }
    });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Refresh token
// @route   POST /api/auth/refresh
// @access  Public
const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token is required'
      });
    }

    // Verify refresh token
    const decoded = verifyRefreshToken(refreshToken);
    
    // Get user
    const user = await User.findById(decoded.id);
    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token'
      });
    }

    // Generate new tokens
    const newToken = generateToken(user._id);
    const newRefreshToken = generateRefreshToken(user._id);

    res.json({
      success: true,
      data: {
        token: newToken,
        refreshToken: newRefreshToken
      }
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(401).json({
      success: false,
      message: 'Invalid refresh token'
    });
  }
};

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
const logout = async (req, res) => {
  try {
    // In a production environment, you might want to blacklist the token
    // For now, we'll just send a success response
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during logout'
    });
  }
};

// @desc    Change password
// @route   PUT /api/auth/change-password
// @access  Private
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user._id;

    // Get user with password
    const user = await User.findById(userId).select('+password');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check current password
    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Update user profile
// @route   PUT /api/auth/me
// @access  Private
const updateProfile = async (req, res) => {
  try {
    const userId = req.user._id;
    const { firstName, lastName, phone, email } = req.body;
  console.log(`[AUTH API] PUT /api/auth/me by ${userId} - incoming:`, { firstName, lastName, phone, email });

    // Find and update user
    const user = await User.findByIdAndUpdate(
      userId,
      { 
        firstName, 
        lastName, 
        phone,
        email
      },
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

  console.log('[AUTH API] Updated user:', { id: user._id, firstName: user.firstName, lastName: user.lastName, phone: user.phone, email: user.email });
  res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
          phone: user.phone,
          isVerified: user.isVerified,
          avatar: user.avatar
        }
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

module.exports = {
  register,
  login,
  getMe,
  refreshToken,
  logout,
  changePassword,
  updateProfile
};