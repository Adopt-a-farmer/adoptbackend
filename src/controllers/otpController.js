const nodemailer = require('nodemailer');
const crypto = require('crypto');
const User = require('../models/User');
const { otpStore, generateOTP, storeOTP, getOTP, deleteOTP } = require('../utils/otpUtils');

// Email transporter configuration - supports multiple services
const createTransporter = () => {
  // Only use mock email when explicitly enabled
  if (process.env.USE_MOCK_EMAIL === 'true') {
    console.log('🔧 Using MOCK EMAIL transporter');
    return {
      sendMail: async (mailOptions) => {
        console.log('\n📧 MOCK EMAIL SENT:');
        console.log('From:', mailOptions.from);
        console.log('To:', mailOptions.to);
        console.log('Subject:', mailOptions.subject);
        console.log('HTML Content:', mailOptions.html.substring(0, 200) + '...');
        console.log('📧 END MOCK EMAIL\n');
        
        return {
          messageId: 'mock-message-id-' + Date.now(),
          accepted: [mailOptions.to],
          rejected: []
        };
      },
      verify: async () => {
        console.log('📧 Mock email transporter verified');
        return true;
      }
    };
  }

  console.log('🔧 Using REAL EMAIL transporter with Gmail');
  
  // Production email configurations
  const emailConfigs = [
    // Gmail configuration
    {
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER || 'brianmayoga@gmail.com',
        pass: process.env.GMAIL_APP_PASSWORD || 'mmqnprmlelectshl'
      }
    },
    // Generic SMTP configuration
    {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: process.env.SMTP_PORT || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER || process.env.GMAIL_USER || 'brianmayoga@gmail.com',
        pass: process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD || 'mmqnprmlelectshl'
      },
      tls: {
        rejectUnauthorized: false
      }
    }
  ];

  // Use the generic SMTP configuration
  return nodemailer.createTransport(emailConfigs[1]);
};

const transporter = createTransporter();

// Note: generateOTP is now imported from utils/otpUtils.js

// @desc    Send OTP to email and store user data temporarily
// @route   POST /api/auth/send-otp
// @access  Public
const sendOTP = async (req, res) => {
  try {
    const { email, firstName, lastName, phone, password, role } = req.body;

    console.log('📧 OTP Request received:', { 
      email, 
      firstName, 
      lastName, 
      phone, 
      role,
      hasPassword: !!password,
      requestBody: Object.keys(req.body),
      mockEmailEnabled: process.env.USE_MOCK_EMAIL === 'true'
    });

    if (!email) {
      console.log('❌ Missing email');
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    if (!firstName || !lastName || !password || !role) {
      console.log('❌ Missing required fields:', {
        hasFirstName: !!firstName,
        hasLastName: !!lastName,
        hasPassword: !!password,
        hasRole: !!role
      });
      return res.status(400).json({
        success: false,
        message: 'First name, last name, password, and role are required'
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      console.log('❌ User already exists:', email);
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Create user immediately with unverified status
    console.log('💾 Creating user in MongoDB...');
    const newUser = await User.create({
      firstName,
      lastName,
      email,
      password, // Note: Make sure User model hashes this
      phone,
      role,
      isEmailVerified: false, // Will be set to true after OTP verification
      verificationStatus: 'pending'
    });

    console.log('✅ User created in MongoDB:', {
      id: newUser._id,
      email: newUser.email,
      firstName: newUser.firstName,
      lastName: newUser.lastName,
      role: newUser.role
    });

    // Generate OTP and token using utility
    const { token, otp } = storeOTP(email, {
      userId: newUser._id,
      firstName,
      lastName,
      phone,
      password,
      role
    });

    console.log('💾 OTP stored with user data:', {
      token,
      email,
      userId: newUser._id,
      otp: `${otp.substring(0, 2)}****` // Partially hide OTP in logs
    });

    // Email template
    const mailOptions = {
      from: process.env.GMAIL_USER || 'brianmayoga@gmail.com',
      to: email,
      subject: 'Verify Your Email - Adopt a Farmer',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%); padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0;">Adopt a Farmer</h1>
            <p style="color: white; margin: 5px 0;">Email Verification</p>
          </div>
          <div style="padding: 30px; background-color: #f9f9f9;">
            <h2 style="color: #333; margin-bottom: 20px;">Verify Your Email Address</h2>
            <p style="color: #666; font-size: 16px; line-height: 1.5;">
              Thank you for joining Adopt a Farmer! To complete your registration, please use the verification code below:
            </p>
            <div style="text-align: center; margin: 30px 0;">
              <div style="background-color: #4CAF50; color: white; font-size: 32px; font-weight: bold; padding: 15px 30px; border-radius: 8px; display: inline-block; letter-spacing: 5px;">
                ${otp}
              </div>
            </div>
            <p style="color: #666; font-size: 14px; line-height: 1.5;">
              This code will expire in 5 minutes. If you didn't request this verification, please ignore this email.
            </p>
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
              <p style="color: #999; font-size: 12px; text-align: center;">
                © 2025 Adopt a Farmer. All rights reserved.
              </p>
            </div>
          </div>
        </div>
      `
    };

    // Send email
    let result;
    try {
      result = await transporter.sendMail(mailOptions);
      console.log('📧 Email sent successfully:', {
        messageId: result.messageId,
        accepted: result.accepted,
        rejected: result.rejected,
        to: email
      });
    } catch (emailError) {
      console.error('Send OTP error:', emailError);
      
      // Enhanced error handling for specific Gmail issues
      let errorMessage = 'Failed to send OTP email';
      let suggestions = [];
      
      if (emailError.code === 'EAUTH' && emailError.responseCode === 534) {
        errorMessage = 'Gmail authentication failed';
        suggestions = [
          '1. Generate a new Gmail App Password (16-character format)',
          '2. Enable 2-Factor Authentication on your Gmail account',
          '3. Update GMAIL_APP_PASSWORD in .env with the new app password',
          '4. Or set USE_MOCK_EMAIL=true for development'
        ];
        
        console.error('🔒 Gmail Auth Issue Detected:', {
          issue: 'Invalid Gmail App Password',
          currentPassword: process.env.GMAIL_APP_PASSWORD ? `${process.env.GMAIL_APP_PASSWORD.substring(0, 4)}****` : 'NOT_SET',
          gmail: process.env.GMAIL_USER,
          solution: 'Generate new Gmail App Password'
        });
      } else if (emailError.code === 'ECONNECTION') {
        errorMessage = 'Failed to connect to email server';
        suggestions = [
          'Check your internet connection',
          'Verify SMTP settings in .env file'
        ];
      }
      
      // If not using mock email and real email fails, provide helpful error
      if (process.env.USE_MOCK_EMAIL !== 'true') {
        return res.status(500).json({
          success: false,
          message: errorMessage,
          error: emailError.code || 'EMAIL_SEND_FAILED',
          details: emailError.message,
          suggestions
        });
      }
      throw emailError;
    }
    
    // Enhanced response for development
    const responseMessage = process.env.USE_MOCK_EMAIL === 'true' 
      ? `OTP sent successfully (MOCK MODE - Check console for OTP: ${otp})`
      : `OTP sent successfully to ${email}`;

    console.log('✅ OTP Response being sent:', {
      success: true,
      message: responseMessage,
      token,
      email,
      userData: { firstName, lastName, phone, role }
    });

    res.json({
      success: true,
      message: responseMessage,
      token,
      ...(process.env.USE_MOCK_EMAIL === 'true' && { 
        developmentOTP: otp,
        note: 'This OTP is shown because USE_MOCK_EMAIL is enabled' 
      })
    });

  } catch (error) {
    console.error('Send OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send OTP'
    });
  }
};

// @desc    Verify OTP
// @route   POST /api/auth/verify-otp
// @access  Public
const verifyOTP = async (req, res) => {
  try {
    const { email, otp, token } = req.body;

    if (!email || !otp || !token) {
      return res.status(400).json({
        success: false,
        message: 'Email, OTP, and token are required'
      });
    }

    // Get stored OTP data
    const otpData = getOTP(token);
    
    if (!otpData) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired verification token'
      });
    }

    // Check if OTP is expired
    if (Date.now() > otpData.expires) {
      deleteOTP(token);
      return res.status(400).json({
        success: false,
        message: 'OTP has expired. Please request a new one.'
      });
    }

    // Verify email and OTP
    if (otpData.email !== email || otpData.otp !== otp) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email or OTP'
      });
    }

    // Mark as verified (keep token for complete signup)
    const { verifyOTP } = require('../utils/otpUtils');
    verifyOTP(token);

    // Update user's email verification status in MongoDB
    console.log('📧 Updating user email verification status...');
    await User.findOneAndUpdate(
      { email }, 
      { isEmailVerified: true },
      { new: true }
    );
    console.log('✅ User email verification status updated in MongoDB');

    res.json({
      success: true,
      message: 'Email verified successfully'
    });

  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify OTP'
    });
  }
};

// @desc    Complete signup after OTP verification
// @route   POST /api/auth/complete-signup
// @access  Public
const completeSignup = async (req, res) => {
  try {
    // For multipart/form-data, the token might be in the body
    const { 
      email, 
      password, 
      phone, 
      role, 
      firstName, 
      lastName,
      farmName,
      farmingType,
      farmSize,
      location,
      specializations,
      experience,
      hourlyRate,
      bio
    } = req.body;

    if (!email || !password || !role) {
      return res.status(400).json({
        success: false,
        message: 'Email, password, and role are required'
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Create user
    const user = await User.create({
      firstName,
      lastName,
      email,
      password,
      phone,
      role,
      isEmailVerified: true, // Since they completed OTP verification
      verificationStatus: role === 'adopter' ? 'verified' : 'pending'
    });

    // Create role-specific profile
    if (role === 'farmer') {
      const FarmerProfile = require('../models/FarmerProfile');
      await FarmerProfile.create({
        user: user._id,
        farmName,
        farmingType,
        farmSize,
        location: location ? JSON.parse(location) : undefined,
        verificationStatus: 'pending'
      });
    } else if (role === 'expert') {
      const ExpertProfile = require('../models/ExpertProfile');
      await ExpertProfile.create({
        user: user._id,
        specializations: specializations ? JSON.parse(specializations) : [],
        bio,
        experience: {
          yearsOfExperience: experience || 0
        },
        hourlyRate,
        verificationStatus: 'pending'
      });
    } else if (role === 'adopter') {
      const AdopterProfile = require('../models/AdopterProfile');
      await AdopterProfile.create({
        user: user._id,
        verificationStatus: 'verified' // Adopters are auto-verified
      });
    }

    // Generate JWT token
    const jwt = require('jsonwebtoken');
    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: '24h' }
    );

    // Remove password from response
    const userResponse = user.toObject();
    delete userResponse.password;

    res.status(201).json({
      success: true,
      message: 'Registration completed successfully',
      data: {
        user: userResponse,
        token
      }
    });

  } catch (error) {
    console.error('Complete signup error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to complete registration'
    });
  }
};

// Test email configuration
const testEmail = async (req, res) => {
  try {
    // Verify transporter configuration
    await transporter.verify();
    
    res.status(200).json({
      success: true,
      message: 'Email configuration is working properly',
      config: {
        service: 'gmail',
        user: process.env.GMAIL_USER || 'adoptafarmerkenya@gmail.com'
      }
    });
  } catch (error) {
    console.error('Email test error:', error);
    res.status(500).json({
      success: false,
      message: 'Email configuration failed',
      error: error.message
    });
  }
};

// Test database - check recent users
const testDatabase = async (req, res) => {
  try {
    const recentUsers = await User.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('firstName lastName email role isEmailVerified verificationStatus createdAt');
    
    res.status(200).json({
      success: true,
      message: 'Database connection working',
      recentUsers: recentUsers.length,
      users: recentUsers
    });
  } catch (error) {
    console.error('Database test error:', error);
    res.status(500).json({
      success: false,
      message: 'Database connection failed',
      error: error.message
    });
  }
};

// @desc    Resend OTP to existing user
// @route   POST /api/auth/resend-otp
// @access  Public
const resendOTP = async (req, res) => {
  try {
    const { email } = req.body;

    console.log('🔄 Resend OTP request for:', email);

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      console.log('❌ Resend OTP failed: User not found:', email);
      return res.status(404).json({
        success: false,
        message: 'No account found with this email address'
      });
    }

    // Check if user is already verified
    if (user.isEmailVerified) {
      console.log('ℹ️ User already verified:', email);
      return res.status(400).json({
        success: false,
        message: 'Email is already verified'
      });
    }

    // Generate new OTP and token using utility
    const { token, otp } = storeOTP(user.email, {
      userId: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      role: user.role
    });

    console.log('🔄 New OTP generated for resend:', {
      token,
      email: user.email,
      userId: user._id,
      otp: `${otp.substring(0, 2)}****`
    });

    // Email template
    const mailOptions = {
      from: process.env.GMAIL_USER || 'brianmayoga@gmail.com',
      to: email,
      subject: 'Email Verification Code (Resent) - Adopt a Farmer',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%); padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0;">Adopt a Farmer</h1>
            <p style="color: white; margin: 5px 0;">Email Verification (Resent)</p>
          </div>
          <div style="padding: 30px; background-color: #f9f9f9;">
            <h2 style="color: #333; margin-bottom: 20px;">Verify Your Email Address</h2>
            <p style="color: #666; font-size: 16px; line-height: 1.5;">
              Here's your new verification code for your Adopt a Farmer account:
            </p>
            <div style="text-align: center; margin: 30px 0;">
              <div style="background-color: #4CAF50; color: white; font-size: 32px; font-weight: bold; padding: 15px 30px; border-radius: 8px; display: inline-block; letter-spacing: 5px;">
                ${otp}
              </div>
            </div>
            <p style="color: #666; font-size: 14px; line-height: 1.5;">
              This code will expire in 5 minutes. If you didn't request this verification, please ignore this email.
            </p>
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
              <p style="color: #999; font-size: 12px; text-align: center;">
                © 2025 Adopt a Farmer. All rights reserved.
              </p>
            </div>
          </div>
        </div>
      `
    };

    // Send email
    try {
      const result = await transporter.sendMail(mailOptions);
      console.log('📧 Resend OTP email sent successfully:', {
        messageId: result.messageId,
        to: email
      });
    } catch (emailError) {
      console.error('Send OTP error:', emailError);
      
      // Enhanced error handling for specific Gmail issues
      let errorMessage = 'Failed to send OTP email';
      let suggestions = [];
      
      if (emailError.code === 'EAUTH' && emailError.responseCode === 534) {
        errorMessage = 'Gmail authentication failed';
        suggestions = [
          '1. Generate a new Gmail App Password (16-character format)',
          '2. Enable 2-Factor Authentication on your Gmail account',
          '3. Update GMAIL_APP_PASSWORD in .env with the new app password',
          '4. Or set USE_MOCK_EMAIL=true for development'
        ];
      }
      
      if (process.env.USE_MOCK_EMAIL !== 'true') {
        return res.status(500).json({
          success: false,
          message: errorMessage,
          error: emailError.code || 'EMAIL_SEND_FAILED',
          details: emailError.message,
          suggestions
        });
      }
    }
    
    const responseMessage = process.env.USE_MOCK_EMAIL === 'true' 
      ? `OTP resent successfully (MOCK MODE - Check console for OTP: ${otp})`
      : `New verification code sent to ${email}`;

    res.json({
      success: true,
      message: responseMessage,
      token,
      ...(process.env.USE_MOCK_EMAIL === 'true' && { 
        developmentOTP: otp,
        note: 'This OTP is shown because USE_MOCK_EMAIL is enabled' 
      })
    });

  } catch (error) {
    console.error('Resend OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to resend OTP'
    });
  }
};

module.exports = {
  sendOTP,
  verifyOTP,
  completeSignup,
  resendOTP,
  testEmail,
  testDatabase
};