const mongoose = require('mongoose');
const FarmerProfile = require('../models/FarmerProfile');

// Cleanup script to remove default values from existing farmer profiles
const cleanupFarmerProfiles = async () => {
  try {
    console.log('Starting farmer profile cleanup...');

    // Find all farmer profiles with default values
    const profiles = await FarmerProfile.find({
      $or: [
        { description: 'New farmer profile - please update your information' },
        { 'location.county': 'Default County' },
        { 'location.subCounty': 'Default Sub-County' }
      ]
    });

    console.log(`Found ${profiles.length} profiles to clean up`);

    let updatedCount = 0;
    for (const profile of profiles) {
      const updates = {};
      
      // Clear default description
      if (profile.description === 'New farmer profile - please update your information') {
        updates.description = '';
      }
      
      // Clear default location values
      if (profile.location?.county === 'Default County') {
        updates['location.county'] = '';
      }
      
      if (profile.location?.subCounty === 'Default Sub-County') {
        updates['location.subCounty'] = '';
      }

      // Apply updates if any
      if (Object.keys(updates).length > 0) {
        await FarmerProfile.findByIdAndUpdate(profile._id, { $set: updates });
        updatedCount++;
        console.log(`Updated profile ${profile._id} - Farm: ${profile.farmName}`);
      }
    }

    console.log(`Cleanup completed. Updated ${updatedCount} profiles.`);
    return { success: true, updated: updatedCount };
  } catch (error) {
    console.error('Error during farmer profile cleanup:', error);
    return { success: false, error: error.message };
  }
};

// Function to run the cleanup
const runCleanup = async () => {
  try {
    // Connect to MongoDB if not already connected
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/adopt_a_farmer');
      console.log('Connected to database for cleanup');
    }

    const result = await cleanupFarmerProfiles();
    console.log('Cleanup result:', result);

    // Close connection if we opened it
    if (process.env.NODE_ENV !== 'production') {
      await mongoose.connection.close();
      console.log('Database connection closed');
    }

    return result;
  } catch (error) {
    console.error('Failed to run cleanup:', error);
    throw error;
  }
};

module.exports = { cleanupFarmerProfiles, runCleanup };

// Allow running this script directly
if (require.main === module) {
  runCleanup()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}