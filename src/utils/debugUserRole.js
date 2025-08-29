const mongoose = require('mongoose');
const User = require('../models/User');

const debugSpecificUser = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      console.log('❌ User not found');
      return;
    }

    console.log('🔍 User Debug Info:');
    console.log('   ID:', user._id);
    console.log('   Email:', user.email);
    console.log('   Role (raw):', JSON.stringify(user.role));
    console.log('   Role (type):', typeof user.role);
    console.log('   Role (length):', user.role ? user.role.length : 0);
    console.log('   Role (charCodes):', user.role ? Array.from(user.role).map(char => char.charCodeAt(0)) : []);
    console.log('   Role (trimmed):', user.role ? `"${user.role.trim()}"` : null);
    console.log('   Role === "expert":', user.role === 'expert');
    console.log('   ["expert"].includes(role):', ['expert'].includes(user.role));
    
    return user;
  } catch (error) {
    console.error('❌ Error debugging user:', error);
  }
};

module.exports = { debugSpecificUser };