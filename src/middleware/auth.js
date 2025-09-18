const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Helper function to validate JWT token format
const isValidJWT = (token) => {
  if (!token || typeof token !== 'string') return false;
  if (token === 'null' || token === 'undefined') return false;
  if (token.trim() === '') return false;
  
  // JWT should have 3 parts separated by dots
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  
  // Each part should be base64 encoded
  try {
    parts.forEach(part => {
      if (!part || part.length === 0) throw new Error('Empty part');
      // Try to decode the base64
      Buffer.from(part, 'base64');
    });
    return true;
  } catch (error) {
    return false;
  }
};

// Protect routes - verify JWT token
const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];
      console.log('Token received:', token ? 'Token present' : 'Token missing');
      console.log('Token length:', token ? token.length : 0);
      console.log('Token starts with:', token ? token.substring(0, 20) : 'N/A');
      console.log('Raw auth header:', req.headers.authorization);

      // Validate JWT token format before attempting verification
      if (!isValidJWT(token)) {
        console.error('Invalid JWT token format detected:', token);
        return res.status(401).json({
          success: false,
          message: 'Invalid token format'
        });
      }

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log('Token decoded successfully, user ID:', decoded.id);

      // Get user from token
      req.user = await User.findById(decoded.id).select('-password');

      if (!req.user) {
        console.error('User not found for ID:', decoded.id);
        return res.status(401).json({
          success: false,
          message: 'User not found'
        });
      }

      if (!req.user.isActive) {
        console.error('User account deactivated for ID:', decoded.id);
        return res.status(401).json({
          success: false,
          message: 'User account is deactivated'
        });
      }

      console.log(`User authenticated successfully: ${req.user.email} (Role: ${req.user.role})`);
      next();
    } catch (error) {
      console.error('Token verification error:', error);
      return res.status(401).json({
        success: false,
        message: 'Not authorized, token failed'
      });
    }
  }

  if (!token) {
    console.error('No token provided in authorization header');
    return res.status(401).json({
      success: false,
      message: 'Not authorized, no token'
    });
  }
};

// Role authorization middleware
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      console.error('❌ Authorization failed: User not authenticated');
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    const userRole = req.user.role ? String(req.user.role).trim() : '';
    const requiredRoles = roles.map(role => String(role).trim());

    console.log(`🔍 Authorization check:`);
    console.log(`   User ID: ${req.user._id}`);
    console.log(`   User Email: ${req.user.email}`);
    console.log(`   User Role (raw): '${req.user.role}' (length: ${req.user.role ? req.user.role.length : 0})`);
    console.log(`   User Role (cleaned): '${userRole}' (length: ${userRole.length})`);
    console.log(`   Required Roles: [${requiredRoles.join(', ')}]`);
    console.log(`   Role type: ${typeof req.user.role}`);
    console.log(`   Includes check: ${requiredRoles.includes(userRole)}`);
    
    // Check each role individually for debugging
    requiredRoles.forEach((role, index) => {
      const matches = role === userRole;
      console.log(`     Role ${index}: '${role}' === '${userRole}' = ${matches}`);
    });
    
    if (!requiredRoles.includes(userRole)) {
      console.error(`❌ Authorization failed: User role '${userRole}' is not authorized. Required: [${requiredRoles.join(', ')}]`);
      console.error(`   User details: ID=${req.user._id}, Email=${req.user.email}`);
      console.error(`   Debug: userRole='${userRole}', typeof=${typeof userRole}, requiredRoles=${JSON.stringify(requiredRoles)}`);
      return res.status(403).json({
        success: false,
        message: `User role '${userRole}' is not authorized to access this route. Required roles: [${requiredRoles.join(', ')}]`
      });
    }

    console.log(`✅ Authorization successful: User role '${userRole}' is authorized`);
    next();
  };
};

// Optional authentication - sets user if token exists but doesn't fail if missing
const optionalAuth = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];
      
      // Only proceed if token is valid format
      if (isValidJWT(token)) {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = await User.findById(decoded.id).select('-password');
      } else {
        req.user = null;
      }
    } catch (error) {
      // Token exists but is invalid - continue without user
      req.user = null;
    }
  }

  next();
};

module.exports = { protect, authorize, optionalAuth };