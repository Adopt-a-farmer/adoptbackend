const User = require('../models/User');
const FarmerProfile = require('../models/FarmerProfile');
const AdopterProfile = require('../models/AdopterProfile');
const ExpertProfile = require('../models/ExpertProfile');
const { generateToken, generateRefreshToken } = require('../utils/tokenUtils');

/**
 * @desc    Handle Google OAuth sign-in/sign-up
 * @route   POST /api/auth/google
 * @access  Public
 */
const googleAuth = async (req, res) => {
  try {
    const { googleId, email, firstName, lastName, avatar, role, phoneNumber, farmLocation } = req.body;

    console.log('🔐 Google Auth attempt:', {
      email,
      googleId: googleId ? `${googleId.substring(0, 8)}...` : 'missing',
      firstName,
      lastName,
      role,
      hasAvatar: !!avatar,
      hasPhoneNumber: !!phoneNumber,
      hasFarmLocation: !!farmLocation
    });

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required from Google authentication'
      });
    }

    // Check if user already exists
    let user = await User.findOne({ email });
    let isNewUser = false;

    if (user) {
      // Existing user - update Google info if not already linked
      console.log('👤 Existing user found:', user.email);
      
      if (!user.googleId) {
        user.googleId = googleId;
      }
      
      // Update avatar if user doesn't have one
      if (!user.avatar?.url && avatar) {
        user.avatar = { url: avatar, publicId: '' };
      }

      // Update phone if provided and user doesn't have one
      if (phoneNumber && !user.phone) {
        user.phone = phoneNumber;
        user.requiresPhoneNumber = false;
      }
      
      // Update last login
      user.lastLogin = new Date();
      await user.save();
      
    } else {
      // New user - create account
      isNewUser = true;
      console.log('🆕 Creating new user via Google:', email);

      const userRole = role || 'adopter'; // Default to adopter if no role specified

      user = await User.create({
        firstName: firstName || 'User',
        lastName: lastName || '',
        email,
        phone: phoneNumber || undefined,
        password: `google_${googleId}_${Date.now()}`, // Random password for Google users
        googleId,
        role: userRole,
        isVerified: true,
        isEmailVerified: true,
        verificationStatus: userRole === 'adopter' ? 'verified' : 'pending',
        avatar: avatar ? { url: avatar, publicId: '' } : undefined,
        requiresPhoneNumber: !phoneNumber // Only require if not provided
      });

      console.log('✅ User created successfully:', {
        id: user._id,
        email: user.email,
        role: user.role,
        hasPhone: !!phoneNumber
      });

      // Create role-specific profile
      if (userRole === 'farmer') {
        const farmerProfileData = {
          user: user._id,
          farmName: `${firstName || 'My'}'s Farm`,
          description: 'New farmer profile - please update your farm description',
          location: {
            county: 'Not specified',
            subCounty: 'Not specified'
          },
          farmSize: { value: 1, unit: 'acres' },
          farmingType: ['crop'],
          verificationStatus: 'pending'
        };

        // Add farm coordinates if provided
        if (farmLocation && farmLocation.coordinates) {
          farmerProfileData.location.coordinates = {
            latitude: farmLocation.coordinates.latitude,
            longitude: farmLocation.coordinates.longitude
          };
          if (farmLocation.formattedAddress) {
            farmerProfileData.location.formattedAddress = farmLocation.formattedAddress;
          }
          console.log('📍 Farm location captured:', farmLocation.coordinates);
        }

        await FarmerProfile.create(farmerProfileData);
        console.log('✅ FarmerProfile created with location');
      } else if (userRole === 'adopter') {
        await AdopterProfile.create({
          user: user._id,
          adopterType: 'individual',
          location: { country: 'Kenya' },
          interests: { farmingTypes: ['crop'] }
        });
        console.log('✅ AdopterProfile created');
      } else if (userRole === 'expert') {
        await ExpertProfile.create({
          user: user._id,
          bio: '',
          specializations: [],
          experience: {
            yearsOfExperience: 0,
            education: [],
            certifications: [],
            previousWork: []
          },
          availability: {
            isAvailable: true,
            maxMentorships: 10
          },
          verificationStatus: 'pending'
        });
        console.log('✅ ExpertProfile created');
      }
    }

    // Check if phone number is required
    const requiresPhoneNumber = !user.phone;

    // Generate tokens
    const token = generateToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    console.log('✅ Google Auth successful for:', email);

    res.json({
      success: true,
      message: isNewUser ? 'Account created successfully via Google' : 'Login successful via Google',
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
        refreshToken,
        isNewUser,
        requiresPhoneNumber
      }
    });

  } catch (error) {
    console.error('❌ Google Auth error:', error);
    res.status(500).json({
      success: false,
      message: 'Google authentication failed',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Update user phone number after Google sign-in
 * @route   PUT /api/auth/update-phone
 * @access  Private
 */
const updatePhoneNumber = async (req, res) => {
  try {
    const { phone } = req.body;
    const userId = req.user._id;

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required'
      });
    }

    // Validate phone number format
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    if (!phoneRegex.test(phone.replace(/\s/g, ''))) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid phone number'
      });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { phone: phone.replace(/\s/g, ''), requiresPhoneNumber: false },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    console.log('✅ Phone number updated for user:', user.email);

    res.json({
      success: true,
      message: 'Phone number updated successfully',
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
    console.error('❌ Update phone error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update phone number'
    });
  }
};

module.exports = {
  googleAuth,
  updatePhoneNumber
};
