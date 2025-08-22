const mongoose = require('mongoose');

const farmerAvailabilitySchema = new mongoose.Schema({
  farmer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FarmerProfile',
    required: true,
    index: true
  },
  date: {
    type: String, // ISO date string in format YYYY-MM-DD
    required: true,
    index: true
  },
  timeSlots: [{
    type: String, // HH:mm
    match: /^\d{2}:\d{2}$/
  }]
}, { timestamps: true });

farmerAvailabilitySchema.index({ farmer: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('FarmerAvailability', farmerAvailabilitySchema);
