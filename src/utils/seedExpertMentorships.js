const mongoose = require('mongoose');
const ExpertMentorship = require('../models/ExpertMentorship');
const User = require('../models/User');
const FarmerProfile = require('../models/FarmerProfile');

const seedExpertMentorships = async () => {
  try {
    console.log('🌱 Starting Expert Mentorship seeding...');

    // Find some farmers and experts
    const farmers = await User.find({ role: 'farmer' }).limit(5);
    const experts = await User.find({ role: 'expert' }).limit(3);

    if (farmers.length === 0) {
      console.log('❌ No farmers found. Please create some farmer accounts first.');
      return;
    }

    if (experts.length === 0) {
      console.log('❌ No experts found. Please create some expert accounts first.');
      return;
    }

    const specializations = [
      'crop_management', 
      'livestock_care', 
      'soil_health', 
      'pest_control',
      'irrigation', 
      'organic_farming', 
      'sustainable_practices'
    ];

    const sampleGoals = [
      {
        title: 'Improve Crop Yield',
        description: 'Increase maize production by 30% through better farming techniques',
        targetDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days from now
        status: 'in_progress'
      },
      {
        title: 'Implement Irrigation System',
        description: 'Set up efficient drip irrigation for water conservation',
        targetDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days from now
        status: 'pending'
      },
      {
        title: 'Soil Health Assessment',
        description: 'Conduct soil testing and implement improvement strategies',
        targetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        status: 'completed',
        completedDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) // 5 days ago
      },
      {
        title: 'Pest Control Training',
        description: 'Learn integrated pest management techniques',
        targetDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000), // 45 days from now
        status: 'in_progress'
      },
      {
        title: 'Market Linkage',
        description: 'Connect with buyers for direct farm-to-market sales',
        targetDate: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000), // 120 days from now
        status: 'pending'
      }
    ];

    const mentorships = [];

    // Create mentorships - each farmer gets 1-2 experts
    for (const farmer of farmers) {
      const numExperts = Math.random() > 0.5 ? 2 : 1; // 50% chance of having 2 experts
      const selectedExperts = experts.slice(0, numExperts);

      for (const expert of selectedExperts) {
        const randomSpecialization = specializations[Math.floor(Math.random() * specializations.length)];
        const randomGoals = sampleGoals
          .sort(() => 0.5 - Math.random())
          .slice(0, Math.floor(Math.random() * 3) + 2); // 2-4 goals per mentorship

        const completedGoals = randomGoals.filter(goal => goal.status === 'completed').length;

        const mentorship = {
          expert: expert._id,
          farmer: farmer._id,
          specialization: randomSpecialization,
          status: 'active',
          startDate: new Date(Date.now() - Math.random() * 180 * 24 * 60 * 60 * 1000), // Started 0-180 days ago
          goals: randomGoals,
          progress: {
            totalSessions: Math.floor(Math.random() * 10) + 1, // 1-10 sessions
            completedGoals: completedGoals,
            overallRating: Math.round((Math.random() * 2 + 3) * 10) / 10 // 3.0 - 5.0 rating
          },
          sessions: [{
            type: 'consultation',
            title: 'Initial Assessment',
            description: 'Farm assessment and goal setting session',
            completedDate: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
            duration: 120,
            location: 'on_farm',
            notes: 'Comprehensive farm assessment completed. Identified key areas for improvement.',
            farmerFeedback: {
              rating: Math.floor(Math.random() * 2) + 4, // 4-5 rating
              comment: 'Very helpful session. Expert was knowledgeable and practical.'
            }
          }],
          communicationPreferences: {
            preferredMethods: ['phone', 'whatsapp'],
            language: 'en',
            frequency: 'bi_weekly'
          },
          paymentTerms: {
            isPayable: Math.random() > 0.5,
            ratePerSession: Math.random() > 0.5 ? Math.floor(Math.random() * 2000) + 1000 : 0, // 0 or 1000-3000
            currency: 'KES',
            paymentStatus: 'paid'
          }
        };

        mentorships.push(mentorship);
      }
    }

    // Clear existing mentorships
    await ExpertMentorship.deleteMany({});
    console.log('🗑️  Cleared existing expert mentorships');

    // Insert new mentorships
    const result = await ExpertMentorship.insertMany(mentorships);
    console.log(`✅ Created ${result.length} expert mentorship relationships`);

    // Display summary
    const summary = {};
    for (const mentorship of result) {
      const farmerUser = farmers.find(f => f._id.toString() === mentorship.farmer.toString());
      const expertUser = experts.find(e => e._id.toString() === mentorship.expert.toString());
      
      if (!summary[farmerUser.firstName]) {
        summary[farmerUser.firstName] = [];
      }
      summary[farmerUser.firstName].push({
        expert: `${expertUser.firstName} ${expertUser.lastName}`,
        specialization: mentorship.specialization,
        goals: mentorship.goals.length,
        completedGoals: mentorship.progress.completedGoals
      });
    }

    console.log('\n📊 Mentorship Summary:');
    for (const [farmer, expertList] of Object.entries(summary)) {
      console.log(`\n👨‍🌾 ${farmer}:`);
      for (const expert of expertList) {
        console.log(`  👨‍💼 ${expert.expert} (${expert.specialization})`);
        console.log(`     📋 Goals: ${expert.completedGoals}/${expert.goals} completed`);
      }
    }

    console.log('\n🎉 Expert Mentorship seeding completed successfully!');

  } catch (error) {
    console.error('❌ Error seeding expert mentorships:', error);
  }
};

module.exports = seedExpertMentorships;

// If this file is run directly
if (require.main === module) {
  require('dotenv').config();
  const connectDB = require('../config/database');
  
  connectDB().then(() => {
    seedExpertMentorships().then(() => {
      process.exit(0);
    });
  }).catch(error => {
    console.error('Database connection error:', error);
    process.exit(1);
  });
}