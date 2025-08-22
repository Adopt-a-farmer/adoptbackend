const mongoose = require('mongoose');
const User = require('../models/User');
const FarmerProfile = require('../models/FarmerProfile');
require('dotenv').config();

const sampleFarmers = [
  {
    user: {
      firstName: 'John',
      lastName: 'Kamau',
      email: 'john.kamau@example.com',
      phoneNumber: '+254712345678',
      password: 'password123',
      role: 'farmer'
    },
    profile: {
      farmName: 'Kamau Family Farm',
      description: 'Organic vegetable farming with sustainable practices. We grow tomatoes, cabbages, and kale using natural fertilizers.',
      location: {
        county: 'Kiambu',
        subCounty: 'Limuru',
        village: 'Tigoni',
        coordinates: {
          latitude: -1.0369,
          longitude: 36.6509
        }
      },
      farmSize: {
        value: 2.5,
        unit: 'acres'
      },
      farmingType: ['crop'],
      crops: [
        {
          name: 'Tomatoes',
          variety: 'Roma VF',
          season: 'Year-round',
          estimatedYield: 800,
          yieldUnit: 'kg per season'
        },
        {
          name: 'Cabbage',
          variety: 'Copenhagen Market',
          season: 'Year-round',
          estimatedYield: 500,
          yieldUnit: 'heads per season'
        }
      ],
      farmingPractices: {
        organic: true,
        sustainable: true,
        irrigation: 'drip'
      },
      verificationStatus: 'verified',
      isActive: true
    }
  },
  {
    user: {
      firstName: 'Mary',
      lastName: 'Wanjiku',
      email: 'mary.wanjiku@example.com',
      phoneNumber: '+254723456789',
      password: 'password123',
      role: 'farmer'
    },
    profile: {
      farmName: 'Wanjiku Dairy Farm',
      description: 'Modern dairy farming with Holstein-Friesian cattle. We focus on high-quality milk production.',
      location: {
        county: 'Nakuru',
        subCounty: 'Nakuru East',
        village: 'Bahati',
        coordinates: {
          latitude: -0.3031,
          longitude: 36.0800
        }
      },
      farmSize: {
        value: 5.0,
        unit: 'acres'
      },
      farmingType: ['livestock'],
      livestock: [
        {
          type: 'Cattle',
          breed: 'Holstein-Friesian',
          count: 15,
          purpose: 'dairy'
        }
      ],
      farmingPractices: {
        organic: false,
        sustainable: true,
        irrigation: 'mixed'
      },
      verificationStatus: 'verified',
      isActive: true
    }
  },
  {
    user: {
      firstName: 'Peter',
      lastName: 'Mwangi',
      email: 'peter.mwangi@example.com',
      phoneNumber: '+254734567890',
      password: 'password123',
      role: 'farmer'
    },
    profile: {
      farmName: 'Mwangi Mixed Farm',
      description: 'Mixed farming operation with both crops and livestock. We practice integrated farming for maximum productivity.',
      location: {
        county: 'Meru',
        subCounty: 'Igembe South',
        village: 'Maua',
        coordinates: {
          latitude: 0.2341,
          longitude: 37.9403
        }
      },
      farmSize: {
        value: 8.0,
        unit: 'acres'
      },
      farmingType: ['mixed'],
      crops: [
        {
          name: 'Maize',
          variety: 'Hybrid 614',
          season: 'March-July',
          estimatedYield: 1200,
          yieldUnit: 'kg per season'
        },
        {
          name: 'Beans',
          variety: 'KK8',
          season: 'March-June',
          estimatedYield: 400,
          yieldUnit: 'kg per season'
        }
      ],
      livestock: [
        {
          type: 'Poultry',
          breed: 'Kienyeji',
          count: 50,
          purpose: 'eggs and meat'
        },
        {
          type: 'Goats',
          breed: 'Galla',
          count: 20,
          purpose: 'meat and milk'
        }
      ],
      farmingPractices: {
        organic: false,
        sustainable: true,
        irrigation: 'rain-fed'
      },
      verificationStatus: 'verified',
      isActive: true
    }
  }
];

const seedFarmers = async () => {
  try {
    console.log('🌱 Starting farmer seeding process...');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Clear existing farmers and users
    await FarmerProfile.deleteMany({});
    await User.deleteMany({ role: 'farmer' });
    console.log('🗑️ Cleared existing farmer data');

    // Create farmers
    for (const farmerData of sampleFarmers) {
      // Create user first
      const user = new User(farmerData.user);
      await user.save();
      console.log(`👤 Created user: ${user.firstName} ${user.lastName}`);

      // Create farmer profile
      const profile = new FarmerProfile({
        ...farmerData.profile,
        user: user._id
      });
      await profile.save();
      console.log(`🚜 Created farmer profile: ${profile.farmName}`);
    }

    console.log('🎉 Successfully seeded farmer data!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding farmers:', error);
    process.exit(1);
  }
};

// Run if called directly
if (require.main === module) {
  seedFarmers();
}

module.exports = seedFarmers;