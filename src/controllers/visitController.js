const FarmVisit = require('../models/FarmVisit');
const FarmerProfile = require('../models/FarmerProfile');
const FarmerAvailability = require('../models/FarmerAvailability');

// @desc    Get all farm visits
// @route   GET /api/visits
// @access  Private
const getFarmVisits = async (req, res) => {
  try {
    const filter = {};

    // Filter based on user role
    if (req.user.role === 'farmer') {
      // Get farmer profile to get visits to their farm
      const farmerProfile = await FarmerProfile.findOne({ user: req.user._id });
      if (farmerProfile) {
        filter.farmer = farmerProfile._id;
      }
    } else if (req.user.role === 'adopter') {
      filter.adopter = req.user._id;
    }

    // Additional filters
    if (req.query.status) {
      filter.status = req.query.status;
    }
    
    if (req.query.date) {
      const date = new Date(req.query.date);
      filter.scheduledDate = {
        $gte: new Date(date.setHours(0, 0, 0, 0)),
        $lt: new Date(date.setHours(23, 59, 59, 999))
      };
    }

    const visits = await FarmVisit.find(filter)
      .populate('adopter', 'firstName lastName email phone avatar')
      .populate('farmer', 'farmName location contactInfo user')
      .populate('farmer.user', 'firstName lastName')
      .sort({ scheduledDate: 1 });

    res.json({
      success: true,
      data: { visits }
    });
  } catch (error) {
    console.error('Get farm visits error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get single farm visit
// @route   GET /api/visits/:id
// @access  Private
const getFarmVisit = async (req, res) => {
  try {
    const visit = await FarmVisit.findById(req.params.id)
      .populate('adopter', 'firstName lastName email phone avatar')
      .populate('farmer', 'farmName location contactInfo user')
      .populate('farmer.user', 'firstName lastName');

    if (!visit) {
      return res.status(404).json({
        success: false,
        message: 'Visit not found'
      });
    }

    // Check if user has access to this visit
    const farmerProfile = await FarmerProfile.findOne({ user: req.user._id });
    const hasAccess = 
      visit.adopter._id.toString() === req.user._id.toString() ||
      (farmerProfile && visit.farmer._id.toString() === farmerProfile._id.toString()) ||
      req.user.role === 'admin';

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.json({
      success: true,
      data: { visit }
    });
  } catch (error) {
    console.error('Get farm visit error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Schedule farm visit
// @route   POST /api/visits
// @access  Private (Adopter only)
const scheduleFarmVisit = async (req, res) => {
  try {
    if (req.user.role !== 'adopter') {
      return res.status(403).json({
        success: false,
        message: 'Only adopters can schedule farm visits'
      });
    }

    const { farmerId, scheduledDate, duration, purpose, notes, visitors } = req.body;

    // Validate farmer exists
    const farmer = await FarmerProfile.findById(farmerId);
    if (!farmer) {
      return res.status(404).json({
        success: false,
        message: 'Farmer not found'
      });
    }

    // Check for scheduling conflicts
    const conflictingVisit = await FarmVisit.findOne({
      farmer: farmerId,
      scheduledDate: new Date(scheduledDate),
      status: { $in: ['pending', 'confirmed'] }
    });

    if (conflictingVisit) {
      return res.status(400).json({
        success: false,
        message: 'This time slot is already booked'
      });
    }

    const visitData = {
      adopter: req.user._id,
      farmer: farmerId,
      scheduledDate: new Date(scheduledDate),
      duration: duration || 2, // Default 2 hours
      purpose: purpose || 'general_visit',
      notes,
      visitors: visitors || 1,
      status: 'pending'
    };

    const visit = await FarmVisit.create(visitData);

    // Populate the created visit
    await visit.populate([
      { path: 'adopter', select: 'firstName lastName email phone' },
      { path: 'farmer', select: 'farmName location contactInfo user', 
        populate: { path: 'user', select: 'firstName lastName' } }
    ]);

    res.status(201).json({
      success: true,
      message: 'Farm visit scheduled successfully',
      data: { visit }
    });
  } catch (error) {
    console.error('Schedule farm visit error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Update visit status
// @route   PUT /api/visits/:id/status
// @access  Private (Farmer/Admin only)
const updateVisitStatus = async (req, res) => {
  try {
    const { status, reason } = req.body;
    const visitId = req.params.id;

    const visit = await FarmVisit.findById(visitId)
      .populate('farmer', 'user');

    if (!visit) {
      return res.status(404).json({
        success: false,
        message: 'Visit not found'
      });
    }

    // Check if user can update this visit
    const canUpdate = 
      req.user.role === 'admin' ||
      (req.user.role === 'farmer' && visit.farmer.user.toString() === req.user._id.toString());

    if (!canUpdate) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this visit'
      });
    }

    visit.status = status;
    if (status === 'cancelled' && reason) {
      visit.cancellationReason = reason;
    }
    if (status === 'confirmed') {
      visit.confirmedAt = new Date();
    }

    await visit.save();

    res.json({
      success: true,
      message: `Visit ${status} successfully`,
      data: { visit }
    });
  } catch (error) {
    console.error('Update visit status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Add visit feedback
// @route   POST /api/visits/:id/feedback
// @access  Private (Adopter only)
const addVisitFeedback = async (req, res) => {
  try {
    const { rating, comment, highlights, suggestions } = req.body;
    const visitId = req.params.id;

    const visit = await FarmVisit.findById(visitId);

    if (!visit) {
      return res.status(404).json({
        success: false,
        message: 'Visit not found'
      });
    }

    // Check if user is the adopter for this visit
    if (visit.adopter.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only the visit adopter can add feedback'
      });
    }

    // Check if visit is completed
    if (visit.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Can only add feedback to completed visits'
      });
    }

    visit.feedback = {
      rating,
      comment,
      highlights: highlights || [],
      suggestions: suggestions || [],
      submittedAt: new Date()
    };

    await visit.save();

    res.json({
      success: true,
      message: 'Feedback added successfully',
      data: { feedback: visit.feedback }
    });
  } catch (error) {
    console.error('Add visit feedback error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get available time slots for farmer
// @route   GET /api/visits/farmer/:farmerId/availability
// @access  Public
const getFarmerAvailability = async (req, res) => {
  try {
    const { farmerId } = req.params;
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({
        success: false,
        message: 'Date parameter is required'
      });
    }

    const farmer = await FarmerProfile.findById(farmerId);
    if (!farmer) {
      return res.status(404).json({
        success: false,
        message: 'Farmer not found'
      });
    }

    const targetDate = new Date(date);
    const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
    const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));

    // Get existing bookings for the date
    const existingVisits = await FarmVisit.find({
      farmer: farmerId,
      scheduledDate: {
        $gte: startOfDay,
        $lte: endOfDay
      },
      status: { $in: ['pending', 'confirmed'] }
    }).select('scheduledDate duration');

    // Generate available time slots (assuming 8 AM to 6 PM working hours)
    const availableSlots = [];
    const workingHours = [8, 9, 10, 11, 13, 14, 15, 16, 17]; // Skip 12 PM for lunch

    workingHours.forEach(hour => {
      const slotTime = new Date(targetDate);
      slotTime.setHours(hour, 0, 0, 0);
      
      // Check if this slot conflicts with existing visits
      const hasConflict = existingVisits.some(visit => {
        const visitStart = new Date(visit.scheduledDate);
        const visitEnd = new Date(visitStart.getTime() + (visit.duration * 60 * 60 * 1000));
        const slotEnd = new Date(slotTime.getTime() + (2 * 60 * 60 * 1000)); // Assume 2-hour slots
        
        return (slotTime >= visitStart && slotTime < visitEnd) ||
               (slotEnd > visitStart && slotEnd <= visitEnd);
      });

      if (!hasConflict) {
        availableSlots.push({
          time: slotTime,
          formattedTime: slotTime.toLocaleTimeString('en-US', { 
            hour: 'numeric', 
            minute: '2-digit',
            hour12: true 
          })
        });
      }
    });

    res.json({
      success: true,
      data: {
        date: targetDate.toDateString(),
        availableSlots,
        bookedSlots: existingVisits.length
      }
    });
  } catch (error) {
    console.error('Get farmer availability error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get visit statistics for farmer
// @route   GET /api/visits/stats
// @access  Private (Farmer)
const getVisitStats = async (req, res) => {
  try {
    const userId = req.user._id;
    
    let filter = {};
    if (req.user.role === 'farmer') {
      // Get farmer profile
      const farmerProfile = await FarmerProfile.findOne({ user: userId });
      if (farmerProfile) {
        filter.farmer = farmerProfile._id;
      }
    } else if (req.user.role === 'adopter') {
      filter.adopter = userId;
    }

    // Get all visits for this farmer/adopter
    const visits = await FarmVisit.find(filter);
    
    // Calculate statistics
    const totalVisits = visits.length;
    const pendingRequests = visits.filter(v => v.status === 'requested').length;
    const completedVisits = visits.filter(v => v.status === 'completed').length;
    const confirmedVisits = visits.filter(v => v.status === 'confirmed').length;
    
    // Calculate average rating from completed visits with feedback
    const ratedVisits = visits.filter(v => 
      v.status === 'completed' && 
      v.visitReport?.adopterFeedback?.rating
    );
    const averageRating = ratedVisits.length > 0 
      ? ratedVisits.reduce((sum, v) => sum + v.visitReport.adopterFeedback.rating, 0) / ratedVisits.length
      : 0;

    // Calculate total revenue from visit fees
    const totalRevenue = visits
      .filter(v => v.status === 'completed')
      .reduce((sum, v) => sum + (v.costs?.visitFee || 0), 0);

    // Get this month's visits
    const currentMonth = new Date();
    currentMonth.setDate(1);
    currentMonth.setHours(0, 0, 0, 0);
    
    const nextMonth = new Date(currentMonth);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    
    const thisMonthVisits = visits.filter(v => {
      const visitDate = new Date(v.requestedDate);
      return visitDate >= currentMonth && visitDate < nextMonth;
    }).length;

    res.json({
      success: true,
      data: {
        total_visits: totalVisits,
        pending_requests: pendingRequests,
        completed_visits: completedVisits,
        confirmed_visits: confirmedVisits,
        average_rating: parseFloat(averageRating.toFixed(1)),
        total_revenue: totalRevenue,
        this_month_visits: thisMonthVisits
      }
    });
  } catch (error) {
    console.error('Get visit stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

module.exports = {
  getFarmVisits,
  getFarmVisit,
  scheduleFarmVisit,
  updateVisitStatus,
  addVisitFeedback,
  getFarmerAvailability,
  getVisitStats,
  setFarmerAvailability,
  getAvailability
};

// @desc    Set available time slots for a farmer for a date
// @route   POST /api/visits/availability
// @access  Private (Farmer)
async function setFarmerAvailability(req, res) {
  try {
    const userId = req.user._id;
    const { date, time_slots } = req.body;

    if (!date || !Array.isArray(time_slots) || time_slots.length === 0) {
      return res.status(400).json({ success: false, message: 'date and time_slots are required' });
    }

    const farmer = await FarmerProfile.findOne({ user: userId });
    if (!farmer) {
      return res.status(404).json({ success: false, message: 'Farmer profile not found' });
    }

    const normalizedDate = new Date(date);
    if (isNaN(normalizedDate.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid date format' });
    }
    const isoDate = normalizedDate.toISOString().slice(0, 10);

    const uniqueSlots = [...new Set(time_slots)];

    const availability = await FarmerAvailability.findOneAndUpdate(
      { farmer: farmer._id, date: isoDate },
      { $set: { timeSlots: uniqueSlots } },
      { upsert: true, new: true }
    );

    return res.json({ success: true, message: 'Availability updated', data: { availability } });
  } catch (error) {
    console.error('Set farmer availability error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}

// @desc    Get saved availability for the authenticated farmer
// @route   GET /api/visits/availability?start=YYYY-MM-DD&end=YYYY-MM-DD
// @access  Private (Farmer)
async function getAvailability(req, res) {
  try {
    const userId = req.user._id;
    const farmer = await FarmerProfile.findOne({ user: userId });
    if (!farmer) {
      return res.status(404).json({ success: false, message: 'Farmer profile not found' });
    }

    const { start, end } = req.query;
    const filter = { farmer: farmer._id };
    if (start && end) {
      filter.date = { $gte: start, $lte: end };
    } else if (start) {
      filter.date = { $gte: start };
    } else if (end) {
      filter.date = { $lte: end };
    }

    const items = await FarmerAvailability.find(filter).sort({ date: 1 });
    return res.json({ success: true, data: { availability: items } });
  } catch (error) {
    console.error('Get availability error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}