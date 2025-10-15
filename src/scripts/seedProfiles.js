/**
 * Comprehensive Profile Seeding Script
 * Creates verified Expert, Farmer, and Adopter profiles with complete details
 * 
 * Usage:
 * - Development: node src/scripts/seedProfiles.js
 * - With custom DB: DB_URI=mongodb://... node src/scripts/seedProfiles.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Import models
const User = require('../models/User');
const ExpertProfile = require('../models/ExpertProfile');
const FarmerProfile = require('../models/FarmerProfile');
const AdopterProfile = require('../models/AdopterProfile');

// Database connection
const connectDB = async () => {
  try {
    const dbUri = process.env.MONGO_URI || 'mongodb://localhost:27017/adopt_a_farmer';
    await mongoose.connect(dbUri);
    console.log('✅ MongoDB Connected Successfully');
  } catch (error) {
    console.error('❌ MongoDB Connection Error:', error.message);
    process.exit(1);
  }
};

// ============= SEED DATA =============

const seedData = {
  // 1. EXPERT PROFILES
  experts: [
    {
      user: {
        firstName: 'Dr. Sarah',
        lastName: 'Wanjiru',
        email: 'sarah.wanjiru@agriexpert.ke',
        password: 'Expert@123',
        role: 'expert',
        phone: '+254722111222',
        isVerified: true,
        isEmailVerified: true,
        verificationStatus: 'verified'
      },
      profile: {
        specializations: ['crop_management', 'soil_health', 'organic_farming', 'sustainable_practices'],
        bio: 'Dr. Sarah Wanjiru is a renowned agricultural scientist with over 15 years of experience in sustainable farming practices. She holds a PhD in Agricultural Sciences from the University of Nairobi and has worked with numerous smallholder farmers across East Africa. Her passion lies in helping farmers increase yields while maintaining environmental sustainability.',
        experience: {
          yearsOfExperience: 15,
          education: [
            {
              institution: 'University of Nairobi',
              degree: 'PhD',
              field: 'Agricultural Sciences',
              year: 2008
            },
            {
              institution: 'Egerton University',
              degree: 'MSc',
              field: 'Soil Science',
              year: 2003
            },
            {
              institution: 'Jomo Kenyatta University',
              degree: 'BSc',
              field: 'Agriculture',
              year: 2000
            }
          ],
          certifications: [
            {
              name: 'Certified Organic Farming Specialist',
              issuingOrganization: 'International Federation of Organic Agriculture Movements (IFOAM)',
              issueDate: new Date('2010-06-15'),
              expiryDate: new Date('2030-06-15')
            },
            {
              name: 'Sustainable Agriculture Practices',
              issuingOrganization: 'FAO',
              issueDate: new Date('2012-03-20'),
              expiryDate: null
            },
            {
              name: 'Soil Health Management',
              issuingOrganization: 'Kenya Agricultural Research Institute',
              issueDate: new Date('2015-09-10'),
              expiryDate: null
            }
          ],
          previousWork: [
            {
              organization: 'Kenya Agricultural Research Institute',
              position: 'Senior Research Scientist',
              startDate: new Date('2010-01-01'),
              endDate: new Date('2020-12-31'),
              description: 'Led research projects on sustainable farming and soil health improvement across 10 counties'
            },
            {
              organization: 'FAO Kenya Office',
              position: 'Agricultural Consultant',
              startDate: new Date('2008-06-01'),
              endDate: new Date('2009-12-31'),
              description: 'Provided technical expertise on organic farming adoption programs'
            }
          ]
        },
        contact: {
          phone: '+254722111222',
          whatsapp: '+254722111222',
          alternateEmail: 's.wanjiru@gmail.com',
          linkedIn: 'https://linkedin.com/in/sarah-wanjiru',
          website: 'https://drwanjiruagri.com'
        },
        availability: {
          isAvailable: true,
          maxMentorships: 15,
          workingHours: {
            start: '08:00',
            end: '18:00'
          },
          workingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
          consultationTypes: ['remote', 'on_farm', 'video_call', 'phone']
        },
        location: {
          county: 'Kiambu',
          subCounty: 'Kikuyu',
          serviceRadius: 100,
          officeAddress: 'Nairobi Innovation Hub, Westlands, Nairobi'
        },
        statistics: {
          totalMentorships: 45,
          activeMentorships: 8,
          completedMentorships: 37,
          averageRating: 4.8,
          totalReviews: 42,
          articlesPublished: 15,
          totalViews: 5420,
          totalLikes: 892
        },
        pricing: {
          consultationFee: 5000,
          currency: 'KES',
          paymentMethods: ['mpesa', 'bank_transfer'],
          offersFreeConsultation: true,
          freeSessionsPerFarmer: 1
        },
        verificationStatus: 'verified',
        languages: ['English', 'Swahili', 'Kikuyu'],
        isActive: true,
        profileCompleteness: 100
      }
    },
    {
      user: {
        firstName: 'James',
        lastName: 'Otieno',
        email: 'james.otieno@livestockexpert.ke',
        password: 'Expert@123',
        role: 'expert',
        phone: '+254733222333',
        isVerified: true,
        isEmailVerified: true,
        verificationStatus: 'verified'
      },
      profile: {
        specializations: ['livestock_care', 'dairy_farming', 'poultry', 'veterinary_care'],
        bio: 'James Otieno is a certified veterinarian and livestock management expert with 12 years of hands-on experience. He specializes in dairy farming, poultry management, and animal health. James has helped over 200 farmers improve their livestock productivity through better breeding, feeding, and health management practices.',
        experience: {
          yearsOfExperience: 12,
          education: [
            {
              institution: 'University of Nairobi',
              degree: 'Doctor of Veterinary Medicine (DVM)',
              field: 'Veterinary Medicine',
              year: 2011
            },
            {
              institution: 'Egerton University',
              degree: 'Diploma',
              field: 'Animal Health',
              year: 2007
            }
          ],
          certifications: [
            {
              name: 'Certified Veterinary Practitioner',
              issuingOrganization: 'Kenya Veterinary Board',
              issueDate: new Date('2011-08-01'),
              expiryDate: new Date('2026-08-01')
            },
            {
              name: 'Dairy Farm Management',
              issuingOrganization: 'Kenya Dairy Board',
              issueDate: new Date('2014-05-10'),
              expiryDate: null
            }
          ],
          previousWork: [
            {
              organization: 'National Dairy Farmers Association',
              position: 'Livestock Consultant',
              startDate: new Date('2015-01-01'),
              endDate: new Date('2023-12-31'),
              description: 'Provided veterinary and farm management services to dairy farmers'
            }
          ]
        },
        contact: {
          phone: '+254733222333',
          whatsapp: '+254733222333',
          alternateEmail: 'jotieno@gmail.com'
        },
        availability: {
          isAvailable: true,
          maxMentorships: 12,
          workingHours: {
            start: '07:00',
            end: '17:00'
          },
          workingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
          consultationTypes: ['on_farm', 'phone', 'video_call']
        },
        location: {
          county: 'Nakuru',
          subCounty: 'Nakuru East',
          serviceRadius: 80,
          officeAddress: 'Nakuru Town, Near Afraha Stadium'
        },
        statistics: {
          totalMentorships: 32,
          activeMentorships: 6,
          completedMentorships: 26,
          averageRating: 4.7,
          totalReviews: 30,
          articlesPublished: 8,
          totalViews: 3200,
          totalLikes: 540
        },
        pricing: {
          consultationFee: 4000,
          currency: 'KES',
          paymentMethods: ['mpesa', 'cash'],
          offersFreeConsultation: true,
          freeSessionsPerFarmer: 1
        },
        verificationStatus: 'verified',
        languages: ['English', 'Swahili', 'Luo'],
        isActive: true,
        profileCompleteness: 95
      }
    }
  ],

  // 2. FARMER PROFILES
  farmers: [
    {
      user: {
        firstName: 'Peter',
        lastName: 'Kamau',
        email: 'peter.kamau@greenfarm.ke',
        password: 'Farmer@123',
        role: 'farmer',
        phone: '+254744333444',
        isVerified: true,
        isEmailVerified: true,
        verificationStatus: 'verified'
      },
      profile: {
        farmName: 'Green Valley Organic Farm',
        description: 'Green Valley Organic Farm is a 10-acre certified organic farm located in the fertile highlands of Kiambu County. We specialize in organic vegetable production including kale, spinach, tomatoes, and capsicum. Our farm follows strict organic farming practices, using natural compost and biological pest control. We are committed to sustainable agriculture and providing healthy, chemical-free produce to our community.',
        establishedYear: 2015,
        contactInfo: {
          phone: '+254744333444',
          email: 'peter.kamau@greenfarm.ke',
          website: 'https://greenvalleyfarm.co.ke'
        },
        socialMedia: {
          facebook: 'https://facebook.com/greenvalleyfarm',
          instagram: 'https://instagram.com/greenvalleyke'
        },
        location: {
          county: 'Kiambu',
          subCounty: 'Limuru',
          village: 'Tigoni',
          coordinates: {
            latitude: -1.1371,
            longitude: 36.6509
          }
        },
        farmSize: {
          value: 10,
          unit: 'acres'
        },
        farmingType: ['crop'],
        cropTypes: ['vegetables', 'fruits', 'maize', 'beans'],
        crops: [
          {
            name: 'Kale (Sukuma Wiki)',
            variety: 'Thousand Headed',
            season: 'Year-round',
            estimatedYield: 5000,
            yieldUnit: 'kg per acre'
          },
          {
            name: 'Tomatoes',
            variety: 'Anna F1',
            season: 'Year-round',
            estimatedYield: 8000,
            yieldUnit: 'kg per acre'
          },
          {
            name: 'Capsicum',
            variety: 'Yolo Wonder',
            season: 'Year-round',
            estimatedYield: 6000,
            yieldUnit: 'kg per acre'
          },
          {
            name: 'Spinach',
            variety: 'Bloomsdale',
            season: 'Year-round',
            estimatedYield: 4000,
            yieldUnit: 'kg per acre'
          }
        ],
        certifications: [
          {
            name: 'Organic Certification',
            issuedBy: 'Kenya Organic Agriculture Network (KOAN)',
            issuedDate: new Date('2016-03-15'),
            expiryDate: new Date('2026-03-15')
          },
          {
            name: 'Good Agricultural Practices (GAP)',
            issuedBy: 'Kenya Bureau of Standards',
            issuedDate: new Date('2018-07-20'),
            expiryDate: new Date('2025-07-20')
          }
        ],
        farmingPractices: {
          organic: true,
          sustainable: true,
          irrigation: 'drip',
          soilConservation: ['terracing', 'mulching', 'cover_crops', 'crop_rotation']
        },
        farmingMethods: ['organic', 'sustainable_agriculture', 'conservation_agriculture'],
        bankDetails: {
          bankName: 'Kenya Commercial Bank',
          accountNumber: '1234567890',
          accountName: 'Peter Kamau',
          branchCode: '01100'
        },
        adoptionStats: {
          totalAdopters: 15,
          totalFunding: 450000,
          currentAdoptions: 8
        },
        verificationStatus: 'verified',
        verifiedAt: new Date('2015-06-01'),
        rating: {
          average: 4.6,
          count: 18
        },
        isActive: true
      }
    },
    {
      user: {
        firstName: 'Mary',
        lastName: 'Njeri',
        email: 'mary.njeri@sunrisedairy.ke',
        password: 'Farmer@123',
        role: 'farmer',
        phone: '+254755444555',
        isVerified: true,
        isEmailVerified: true,
        verificationStatus: 'verified'
      },
      profile: {
        farmName: 'Sunrise Dairy Farm',
        description: 'Sunrise Dairy Farm is a modern 15-acre dairy farm in Nakuru County. We maintain a herd of 50 high-grade Friesian cows, producing an average of 800 liters of fresh milk daily. Our farm uses modern dairy farming techniques including silage making, zero-grazing, and AI breeding. We also practice mixed farming with Napier grass and maize for cattle feed. Our commitment is to provide high-quality milk while maintaining excellent animal welfare standards.',
        establishedYear: 2012,
        contactInfo: {
          phone: '+254755444555',
          email: 'mary.njeri@sunrisedairy.ke'
        },
        socialMedia: {
          facebook: 'https://facebook.com/sunrisedairy'
        },
        location: {
          county: 'Nakuru',
          subCounty: 'Njoro',
          village: 'Mau Summit',
          coordinates: {
            latitude: -0.3357,
            longitude: 35.9384
          }
        },
        farmSize: {
          value: 15,
          unit: 'acres'
        },
        farmingType: ['livestock', 'mixed'],
        cropTypes: ['maize'],
        crops: [
          {
            name: 'Napier Grass',
            variety: 'Bana Grass',
            season: 'Year-round',
            estimatedYield: 300,
            yieldUnit: 'tons per acre'
          },
          {
            name: 'Maize',
            variety: 'H614',
            season: 'April-August, October-February',
            estimatedYield: 30,
            yieldUnit: 'bags per acre'
          }
        ],
        livestock: [
          {
            animalType: 'Cattle',
            breed: 'Friesian',
            count: 50,
            purpose: 'Dairy milk production'
          },
          {
            animalType: 'Poultry',
            breed: 'Kienyeji',
            count: 200,
            purpose: 'Eggs and meat'
          }
        ],
        certifications: [
          {
            name: 'Kenya Dairy Board License',
            issuedBy: 'Kenya Dairy Board',
            issuedDate: new Date('2013-01-10'),
            expiryDate: new Date('2026-01-10')
          }
        ],
        farmingPractices: {
          organic: false,
          sustainable: true,
          irrigation: 'sprinkler',
          soilConservation: ['contour_farming', 'manure_application']
        },
        farmingMethods: ['conventional', 'sustainable_agriculture'],
        bankDetails: {
          bankName: 'Cooperative Bank of Kenya',
          accountNumber: '0987654321',
          accountName: 'Mary Njeri',
          branchCode: '11001'
        },
        adoptionStats: {
          totalAdopters: 22,
          totalFunding: 780000,
          currentAdoptions: 14
        },
        verificationStatus: 'verified',
        verifiedAt: new Date('2012-05-15'),
        rating: {
          average: 4.8,
          count: 25
        },
        isActive: true
      }
    },
    {
      user: {
        firstName: 'David',
        lastName: 'Mwangi',
        email: 'david.mwangi@goldenfields.ke',
        password: 'Farmer@123',
        role: 'farmer',
        phone: '+254766555666',
        isVerified: true,
        isEmailVerified: true,
        verificationStatus: 'verified'
      },
      profile: {
        farmName: 'Golden Fields Coffee Estate',
        description: 'Golden Fields is a premium coffee estate spanning 20 acres in the rich volcanic soils of Nyeri County. We grow high-quality Arabica coffee (SL28 and Ruiru 11 varieties) that consistently scores above 85 on the SCA scale. Our coffee is shade-grown under indigenous trees, hand-picked at peak ripeness, and processed using eco-friendly wet processing methods. We are certified by the Rainforest Alliance and supply specialty coffee to international markets.',
        establishedYear: 2008,
        contactInfo: {
          phone: '+254766555666',
          email: 'david.mwangi@goldenfields.ke',
          website: 'https://goldenfieldscoffee.co.ke'
        },
        socialMedia: {
          facebook: 'https://facebook.com/goldenfieldscoffee',
          instagram: 'https://instagram.com/goldenfieldscoffee',
          twitter: 'https://twitter.com/goldenfieldsKE'
        },
        location: {
          county: 'Nyeri',
          subCounty: 'Tetu',
          village: 'Karatina',
          coordinates: {
            latitude: -0.4833,
            longitude: 37.1300
          }
        },
        farmSize: {
          value: 20,
          unit: 'acres'
        },
        farmingType: ['crop'],
        cropTypes: ['coffee'],
        crops: [
          {
            name: 'Coffee',
            variety: 'SL28 and Ruiru 11',
            season: 'Main: May-July, Fly: October-December',
            estimatedYield: 10,
            yieldUnit: 'tons per acre'
          },
          {
            name: 'Macadamia',
            variety: 'Beaumont',
            season: 'February-June',
            estimatedYield: 5,
            yieldUnit: 'tons per acre'
          }
        ],
        certifications: [
          {
            name: 'Rainforest Alliance Certification',
            issuedBy: 'Rainforest Alliance',
            issuedDate: new Date('2010-09-01'),
            expiryDate: new Date('2026-09-01')
          },
          {
            name: 'Specialty Coffee Certification',
            issuedBy: 'Specialty Coffee Association',
            issuedDate: new Date('2012-04-15'),
            expiryDate: null
          }
        ],
        farmingPractices: {
          organic: false,
          sustainable: true,
          irrigation: 'drip',
          soilConservation: ['mulching', 'shade_trees', 'terracing', 'composting']
        },
        farmingMethods: ['sustainable_agriculture', 'agroforestry'],
        bankDetails: {
          bankName: 'Equity Bank',
          accountNumber: '1122334455',
          accountName: 'David Mwangi',
          branchCode: '68000'
        },
        adoptionStats: {
          totalAdopters: 30,
          totalFunding: 1200000,
          currentAdoptions: 18
        },
        verificationStatus: 'verified',
        verifiedAt: new Date('2008-11-20'),
        rating: {
          average: 4.9,
          count: 35
        },
        isActive: true
      }
    }
  ],

  // 3. ADOPTER PROFILES
  adopters: [
    {
      user: {
        firstName: 'Susan',
        lastName: 'Akinyi',
        email: 'susan.akinyi@gmail.com',
        password: 'Adopter@123',
        role: 'adopter',
        phone: '+254777666777',
        isVerified: true,
        isEmailVerified: true,
        verificationStatus: 'verified'
      },
      profile: {
        adopterType: 'individual',
        location: {
          country: 'Kenya',
          county: 'Nairobi',
          city: 'Nairobi',
          address: 'Kilimani, Nairobi'
        },
        interests: {
          farmingTypes: ['crop', 'organic'],
          preferredCrops: ['vegetables', 'fruits', 'coffee'],
          sustainabilityFocus: true,
          organicFocus: true
        },
        investmentProfile: {
          totalInvested: 125000,
          currentInvestments: 45000,
          preferredInvestmentRange: {
            min: 10000,
            max: 50000
          },
          riskTolerance: 'medium'
        },
        adoptionHistory: {
          totalAdoptions: 5,
          activeAdoptions: 2,
          completedAdoptions: 3
        },
        paymentMethods: [
          {
            type: 'mobile_money',
            details: { provider: 'M-Pesa', number: '+254777666777' },
            isDefault: true
          }
        ],
        notifications: {
          email: {
            updates: true,
            messages: true,
            payments: true
          },
          sms: {
            updates: true,
            payments: true
          }
        },
        verificationStatus: 'verified',
        isActive: true
      }
    },
    {
      user: {
        firstName: 'John',
        lastName: 'Odhiambo',
        email: 'john.odhiambo@techcorp.co.ke',
        password: 'Adopter@123',
        role: 'adopter',
        phone: '+254788777888',
        isVerified: true,
        isEmailVerified: true,
        verificationStatus: 'verified'
      },
      profile: {
        adopterType: 'organization',
        organization: {
          name: 'TechCorp Kenya',
          registrationNumber: 'CPR/2018/123456',
          website: 'https://techcorp.co.ke',
          description: 'A technology company committed to supporting sustainable agriculture through farm adoption programs'
        },
        location: {
          country: 'Kenya',
          county: 'Nairobi',
          city: 'Nairobi',
          address: 'Westlands, ABC Place, 5th Floor'
        },
        interests: {
          farmingTypes: ['crop', 'livestock', 'mixed'],
          preferredCrops: ['maize', 'beans', 'vegetables'],
          sustainabilityFocus: true,
          organicFocus: false
        },
        investmentProfile: {
          totalInvested: 850000,
          currentInvestments: 320000,
          preferredInvestmentRange: {
            min: 50000,
            max: 200000
          },
          riskTolerance: 'high'
        },
        adoptionHistory: {
          totalAdoptions: 12,
          activeAdoptions: 5,
          completedAdoptions: 7
        },
        paymentMethods: [
          {
            type: 'bank_transfer',
            details: { bankName: 'KCB', accountNumber: '1234567890' },
            isDefault: true
          },
          {
            type: 'mobile_money',
            details: { provider: 'M-Pesa', number: '+254788777888' },
            isDefault: false
          }
        ],
        notifications: {
          email: {
            updates: true,
            messages: true,
            payments: true
          },
          sms: {
            updates: false,
            payments: true
          }
        },
        verificationStatus: 'verified',
        isActive: true
      }
    },
    {
      user: {
        firstName: 'Grace',
        lastName: 'Wambui',
        email: 'grace.wambui@diaspora.com',
        password: 'Adopter@123',
        role: 'adopter',
        phone: '+254799888999',
        isVerified: true,
        isEmailVerified: true,
        verificationStatus: 'verified'
      },
      profile: {
        adopterType: 'individual',
        location: {
          country: 'Kenya',
          county: 'Kiambu',
          city: 'Thika',
          address: 'Thika Town'
        },
        interests: {
          farmingTypes: ['livestock', 'dairy'],
          preferredCrops: [],
          preferredLivestock: ['cattle', 'poultry'],
          sustainabilityFocus: true,
          organicFocus: false
        },
        investmentProfile: {
          totalInvested: 350000,
          currentInvestments: 150000,
          preferredInvestmentRange: {
            min: 30000,
            max: 100000
          },
          riskTolerance: 'low'
        },
        adoptionHistory: {
          totalAdoptions: 8,
          activeAdoptions: 3,
          completedAdoptions: 5
        },
        paymentMethods: [
          {
            type: 'mobile_money',
            details: { provider: 'M-Pesa', number: '+254799888999' },
            isDefault: true
          },
          {
            type: 'bank_transfer',
            details: { bankName: 'Equity Bank', accountNumber: '9876543210' },
            isDefault: false
          }
        ],
        notifications: {
          email: {
            updates: true,
            messages: true,
            payments: true
          },
          sms: {
            updates: true,
            payments: true
          }
        },
        verificationStatus: 'verified',
        isActive: true
      }
    }
  ]
};

// ============= SEEDING FUNCTIONS =============

const seedExperts = async () => {
  console.log('\n🌱 Seeding Expert Profiles...');
  
  for (const expertData of seedData.experts) {
    try {
      // Check if user already exists
      let user = await User.findOne({ email: expertData.user.email });
      
      if (user) {
        console.log(`   ⚠️  Expert user already exists: ${expertData.user.email}`);
        continue;
      }

      // Create user
      user = await User.create(expertData.user);
      console.log(`   ✅ Created expert user: ${user.fullName} (${user.email})`);

      // Create expert profile
      const expertProfile = await ExpertProfile.create({
        ...expertData.profile,
        user: user._id
      });

      // Calculate profile completeness
      expertProfile.calculateCompleteness();
      await expertProfile.save();

      console.log(`   ✅ Created expert profile for ${user.fullName}`);
      console.log(`      - Specializations: ${expertProfile.specializations.join(', ')}`);
      console.log(`      - Experience: ${expertProfile.experience.yearsOfExperience} years`);
      console.log(`      - Profile Completeness: ${expertProfile.profileCompleteness}%`);
      
    } catch (error) {
      console.error(`   ❌ Error seeding expert ${expertData.user.email}:`, error.message);
    }
  }
};

const seedFarmers = async () => {
  console.log('\n🌱 Seeding Farmer Profiles...');
  
  for (const farmerData of seedData.farmers) {
    try {
      // Check if user already exists
      let user = await User.findOne({ email: farmerData.user.email });
      
      if (user) {
        console.log(`   ⚠️  Farmer user already exists: ${farmerData.user.email}`);
        continue;
      }

      // Create user
      user = await User.create(farmerData.user);
      console.log(`   ✅ Created farmer user: ${user.fullName} (${user.email})`);

      // Create farmer profile
      const farmerProfile = await FarmerProfile.create({
        ...farmerData.profile,
        user: user._id
      });

      console.log(`   ✅ Created farmer profile: ${farmerProfile.farmName}`);
      console.log(`      - Farm Size: ${farmerProfile.farmSize.value} ${farmerProfile.farmSize.unit}`);
      console.log(`      - Farming Type: ${farmerProfile.farmingType.join(', ')}`);
      console.log(`      - Location: ${farmerProfile.location.county}, ${farmerProfile.location.subCounty}`);
      console.log(`      - Total Adopters: ${farmerProfile.adoptionStats.totalAdopters}`);
      
    } catch (error) {
      console.error(`   ❌ Error seeding farmer ${farmerData.user.email}:`, error.message);
    }
  }
};

const seedAdopters = async () => {
  console.log('\n🌱 Seeding Adopter Profiles...');
  
  for (const adopterData of seedData.adopters) {
    try {
      // Check if user already exists
      let user = await User.findOne({ email: adopterData.user.email });
      
      if (user) {
        console.log(`   ⚠️  Adopter user already exists: ${adopterData.user.email}`);
        continue;
      }

      // Create user
      user = await User.create(adopterData.user);
      console.log(`   ✅ Created adopter user: ${user.fullName} (${user.email})`);

      // Create adopter profile
      const adopterProfile = await AdopterProfile.create({
        ...adopterData.profile,
        user: user._id
      });

      console.log(`   ✅ Created adopter profile for ${user.fullName}`);
      console.log(`      - Type: ${adopterProfile.adopterType}`);
      if (adopterProfile.organization?.name) {
        console.log(`      - Organization: ${adopterProfile.organization.name}`);
      }
      console.log(`      - Total Investments: KES ${adopterProfile.investmentProfile.totalInvested.toLocaleString()}`);
      console.log(`      - Total Adoptions: ${adopterProfile.adoptionHistory.totalAdoptions}`);
      
    } catch (error) {
      console.error(`   ❌ Error seeding adopter ${adopterData.user.email}:`, error.message);
    }
  }
};

// ============= MAIN SEEDING FUNCTION =============

const seedDatabase = async () => {
  try {
    console.log('\n');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('   🚀 COMPREHENSIVE PROFILE SEEDING SCRIPT');
    console.log('═══════════════════════════════════════════════════════════');
    
    await connectDB();

    // Seed in order
    await seedExperts();
    await seedFarmers();
    await seedAdopters();

    console.log('\n');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('   ✅ SEEDING COMPLETED SUCCESSFULLY');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('\n📊 Summary:');
    
    const expertCount = await ExpertProfile.countDocuments();
    const farmerCount = await FarmerProfile.countDocuments();
    const adopterCount = await AdopterProfile.countDocuments();
    
    console.log(`   - Total Experts: ${expertCount}`);
    console.log(`   - Total Farmers: ${farmerCount}`);
    console.log(`   - Total Adopters: ${adopterCount}`);
    console.log('\n📝 Login Credentials:');
    console.log('   Password for all accounts: [Role]@123');
    console.log('   Example: Expert@123, Farmer@123, Adopter@123\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Seeding failed:', error);
    process.exit(1);
  }
};

// Run the seeding
seedDatabase();
