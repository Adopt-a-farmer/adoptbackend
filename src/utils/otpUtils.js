const crypto = require('crypto');

// Store OTP temporarily (in production, use Redis)
const otpStore = new Map();

// Generate OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Store OTP data
const storeOTP = (email, userData, otp = null) => {
  const token = crypto.randomBytes(32).toString('hex');
  const generatedOTP = otp || generateOTP();
  
  otpStore.set(token, {
    ...userData,
    email,
    otp: generatedOTP,
    verified: false,
    expires: Date.now() + 5 * 60 * 1000 // 5 minutes
  });
  
  return { token, otp: generatedOTP };
};

// Get OTP data
const getOTP = (token) => {
  return otpStore.get(token);
};

// Delete OTP data
const deleteOTP = (token) => {
  return otpStore.delete(token);
};

// Mark OTP as verified
const verifyOTP = (token) => {
  const otpData = otpStore.get(token);
  if (otpData) {
    otpData.verified = true;
    otpStore.set(token, otpData);
    return true;
  }
  return false;
};

// Clean expired OTPs (should be called periodically)
const cleanExpiredOTPs = () => {
  const now = Date.now();
  for (const [token, data] of otpStore.entries()) {
    if (now > data.expires) {
      otpStore.delete(token);
    }
  }
};

// Set up periodic cleanup (every 5 minutes)
setInterval(cleanExpiredOTPs, 5 * 60 * 1000);

module.exports = {
  otpStore,
  generateOTP,
  storeOTP,
  getOTP,
  deleteOTP,
  verifyOTP: verifyOTP,
  cleanExpiredOTPs
};