const User = require('../models/User');
const ExpertProfile = require('../models/ExpertProfile');

/**
 * Debug and fix expert user issues
 */
const debugExpertUsers = async () => {
  try {
    console.log('🔍 Starting expert user debug...');
    
    // Find all users
    const allUsers = await User.find({}).select('_id firstName lastName email role isActive');
    console.log(`📊 Total users in database: ${allUsers.length}`);
    
    // Group by role
    const roleGroups = allUsers.reduce((acc, user) => {
      acc[user.role] = (acc[user.role] || 0) + 1;
      return acc;
    }, {});
    
    console.log('👥 Users by role:', roleGroups);
    
    // Find expert users specifically
    const expertUsers = await User.find({ role: 'expert' }).select('_id firstName lastName email role isActive createdAt');
    console.log(`🎓 Expert users found: ${expertUsers.length}`);
    
    if (expertUsers.length > 0) {
      console.log('📋 Expert users details:');
      expertUsers.forEach((user, index) => {
        console.log(`   ${index + 1}. ID: ${user._id}`);
        console.log(`      Name: ${user.firstName} ${user.lastName}`);
        console.log(`      Email: ${user.email}`);
        console.log(`      Role: ${user.role}`);
        console.log(`      Active: ${user.isActive}`);
        console.log(`      Created: ${user.createdAt}`);
        console.log('      ---');
      });
      
      // Check expert profiles
      console.log('🔍 Checking expert profiles...');
      for (const user of expertUsers) {
        const profile = await ExpertProfile.findOne({ user: user._id });
        console.log(`   User ${user.email}: ${profile ? '✅ Has profile' : '❌ No profile'}`);
        
        if (!profile) {
          console.log(`   Creating profile for ${user.email}...`);
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
          console.log(`   ✅ Profile created for ${user.email}`);
        }
      }
    }
    
    // Check for users with weird roles
    const unknownRoles = allUsers.filter(user => !['farmer', 'adopter', 'expert', 'admin'].includes(user.role));
    if (unknownRoles.length > 0) {
      console.log('⚠️  Users with unknown roles:');
      unknownRoles.forEach(user => {
        console.log(`   ${user.email}: role="${user.role}"`);
      });
    }
    
    return { 
      success: true, 
      totalUsers: allUsers.length,
      roleGroups,
      expertUsers: expertUsers.length,
      unknownRoles: unknownRoles.length
    };
    
  } catch (error) {
    console.error('❌ Error debugging expert users:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Fix a specific user's role to expert
 */
const fixUserRole = async (email, newRole = 'expert') => {
  try {
    console.log(`🔧 Fixing user role for ${email} to ${newRole}...`);
    
    const user = await User.findOne({ email });
    if (!user) {
      console.log(`❌ User not found: ${email}`);
      return { success: false, message: 'User not found' };
    }
    
    console.log(`   Current role: ${user.role}`);
    user.role = newRole;
    await user.save();
    
    console.log(`   ✅ Role updated to: ${user.role}`);
    
    // Create expert profile if needed
    if (newRole === 'expert') {
      const existingProfile = await ExpertProfile.findOne({ user: user._id });
      if (!existingProfile) {
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
        console.log(`   ✅ Expert profile created`);
      }
    }
    
    return { success: true, message: `Role updated to ${newRole}` };
    
  } catch (error) {
    console.error('❌ Error fixing user role:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  debugExpertUsers,
  fixUserRole
};