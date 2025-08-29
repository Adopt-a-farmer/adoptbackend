const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

const createExpertUser = async () => {
  try {
    console.log('🌱 Creating expert user...');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Create expert user
    const expertUser = new User({
      firstName: 'Dr. Jane',
      lastName: 'Agricultural Expert',
      email: 'expert@example.com',
      phoneNumber: '+254700000999',
      password: 'password123',
      role: 'expert'
    });
    await expertUser.save();
    console.log(`👨‍🎓 Created expert user: ${expertUser.firstName} ${expertUser.lastName}`);

    console.log('🎉 Successfully created expert user!');
    console.log('Login credentials:');
    console.log('Email: expert@example.com');
    console.log('Password: password123');
    process.exit(0);
  } catch (error) {
    if (error.code === 11000) {
      console.log('ℹ️  Expert user already exists with this email');
      process.exit(0);
    }
    console.error('❌ Error creating expert user:', error);
    process.exit(1);
  }
};

createExpertUser();