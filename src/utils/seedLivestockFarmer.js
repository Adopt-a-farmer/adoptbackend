const mongoose = require('mongoose');
const User = require('../models/User');
const FarmerProfile = require('../models/FarmerProfile');
require('dotenv').config();

const seedFarmerWithLivestock = async () => {
  try {
    console.log('🌱 Starting livestock farmer seeding...');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Create user first
    const user = new User({
      firstName: 'Mary',
      lastName: 'Livestock',
      email: 'mary.livestock2@example.com',
      phoneNumber: '+254700000001',
      password: 'password123',
      role: 'farmer'
    });
    await user.save();
    console.log(`👤 Created user: ${user.firstName} ${user.lastName}`);

    // Create farmer profile with livestock
    const profile = new FarmerProfile({
      user: user._id,
      farmName: 'Livestock Test Farm',
      description: 'A farm with livestock for testing',
      location: {
        county: 'Nakuru',
        subCounty: 'Nakuru East'
      },
      farmSize: {
        value: 5,
        unit: 'acres'
      },
      farmingType: ['livestock'],
      livestock: [
        {
          animalType: 'Cattle',
          breed: 'Holstein-Friesian',
          count: 10,
          purpose: 'dairy'
        }
      ],
      verificationStatus: 'verified',
      isActive: true
    });
    await profile.save();
    console.log(`🚜 Created farmer profile: ${profile.farmName}`);

    console.log('🎉 Successfully seeded livestock farmer!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding livestock farmer:', error);
    process.exit(1);
  }
};

seedFarmerWithLivestock();