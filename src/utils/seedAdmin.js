const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
require('dotenv').config();

const seedAdmin = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Check if admin already exists
    const existingAdmin = await User.findOne({ role: 'admin' });
    if (existingAdmin) {
      console.log('Admin user already exists:', existingAdmin.email);
      process.exit(0);
    }

    // Create default admin user
    const adminData = {
      firstName: 'System',
      lastName: 'Administrator',
      email: 'admin@adoptafarmer.com',
      password: 'Admin@123456', // This will be hashed by the model pre-save hook
      role: 'admin',
      phone: '+254700000000',
      isVerified: true,
      isEmailVerified: true,
      verificationStatus: 'verified',
      isActive: true,
      avatar: {
        url: 'https://res.cloudinary.com/default/image/upload/v1/admin-avatar.jpg',
        publicId: 'admin-avatar'
      }
    };

    const admin = await User.create(adminData);
    console.log('Default admin created successfully!');
    console.log('Email:', admin.email);
    console.log('Password: Admin@123456');
    console.log('IMPORTANT: Please change the password after first login!');

    process.exit(0);
  } catch (error) {
    console.error('Error seeding admin:', error);
    process.exit(1);
  }
};

// Run the seeding function if called directly
if (require.main === module) {
  seedAdmin();
}

module.exports = seedAdmin;