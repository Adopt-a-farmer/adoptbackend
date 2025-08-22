const jwt = require('jsonwebtoken');

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d'
  });
};

// Generate Refresh Token
const generateRefreshToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET + '_refresh', {
    expiresIn: '7d'
  });
};

// Verify Refresh Token
const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET + '_refresh');
  } catch (error) {
    throw new Error('Invalid refresh token');
  }
};

// Generate random string for tokens
const generateRandomToken = () => {
  return require('crypto').randomBytes(20).toString('hex');
};

module.exports = {
  generateToken,
  generateRefreshToken,
  verifyRefreshToken,
  generateRandomToken
};