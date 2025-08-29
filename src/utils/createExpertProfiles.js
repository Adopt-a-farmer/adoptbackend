const User = require('../models/User');
const ExpertProfile = require('../models/ExpertProfile');

/**
 * Create expert profiles for existing expert users who don't have profiles yet
 */
const createMissingExpertProfiles = async () => {
  try {
    console.log('Starting to create missing expert profiles...');
    
    // Find all expert users
    const expertUsers = await User.find({ role: 'expert' }).select('_id firstName lastName phone');
    console.log(`Found ${expertUsers.length} expert users`);
    
    let createdCount = 0;
    
    for (const user of expertUsers) {
      // Check if expert profile exists
      const existingProfile = await ExpertProfile.findOne({ user: user._id });
      
      if (!existingProfile) {
        // Create expert profile
        await ExpertProfile.create({
          user: user._id,
          bio: '',
          specializations: [],
          experience: {
            yearsOfExperience: 0,
            education: [],
            certifications: [],
            previousWork: []
          },
          contact: {
            phone: user.phone || ''
          },
          availability: {
            isAvailable: true,
            maxMentorships: 10,
            workingHours: {
              start: '08:00',
              end: '17:00'
            },
            workingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
            consultationTypes: ['remote', 'phone', 'video_call']
          },
          location: {
            county: '',
            subCounty: '',
            serviceRadius: 50
          }
        });
        
        createdCount++;
        console.log(`Created expert profile for user ${user.firstName} ${user.lastName} (ID: ${user._id})`);
      }
    }
    
    console.log(`Successfully created ${createdCount} expert profiles`);
    return { success: true, created: createdCount, total: expertUsers.length };
    
  } catch (error) {
    console.error('Error creating missing expert profiles:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  createMissingExpertProfiles
};