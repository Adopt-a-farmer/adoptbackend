const mongoose = require('mongoose');
const User = require('../models/User');
const FarmerProfile = require('../models/FarmerProfile');
require('dotenv').config();

const seedOneFarmer = async () => {
  try {
    console.log('🌱 Starting simple farmer seeding...');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Create user first
    const user = new User({
      firstName: 'Test',
      lastName: 'Farmer',
      email: 'test.farmer@example.com',
      phoneNumber: '+254700000000',
      password: 'password123',
      role: 'farmer'
    });
    await user.save();
    console.log(`👤 Created user: ${user.firstName} ${user.lastName}`);

    // Create farmer profile with minimal data
    const profile = new FarmerProfile({
      user: user._id,
      farmName: 'Test Farm',
      description: 'A test farm for validation',
      location: {
        county: 'Nairobi',
        subCounty: 'Westlands'
      },
      farmSize: {
        value: 1,
        unit: 'acres'
      },
      farmingType: ['crop'],
      verificationStatus: 'verified',
      isActive: true
    });
    await profile.save();
    console.log(`🚜 Created farmer profile: ${profile.farmName}`);

    console.log('🎉 Successfully seeded one farmer!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding farmer:', error);
    process.exit(1);
  }
};

seedOneFarmer();