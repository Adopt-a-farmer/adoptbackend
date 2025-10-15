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
        filter.farmer = req.user._id; // Use user ID directly for farmer visits
      }
    } else if (req.user.role === 'adopter') {
      // Show visits where user is adopter or visitor
      filter.$or = [
        { adopter: req.user._id },
        { visitor: req.user._id, visitorRole: 'adopter' }
      ];
    } else if (req.user.role === 'expert') {
      // Show visits where expert is the visitor
      filter.visitor = req.user._id;
      filter.visitorRole = 'expert';
    }

    // Additional filters
    if (req.query.status) {
      filter.status = req.query.status;
    }
    
    if (req.query.date) {
      const date = new Date(req.query.date);
      filter.requestedDate = {
        $gte: new Date(date.setHours(0, 0, 0, 0)),
        $lt: new Date(date.setHours(23, 59, 59, 999))
      };
    }

    // Default to upcoming visits if no status filter
    if (!req.query.status && req.user.role === 'farmer') {
      filter.status = { $in: ['requested', 'confirmed'] };
      filter.requestedDate = { $gte: new Date() };
    }

    const visits = await FarmVisit.find(filter)
      .populate('adopter', 'firstName lastName email phone avatar')
      .populate('visitor', 'firstName lastName email phone avatar role')
      .populate('farmer', 'firstName lastName email phone')
      .populate('adoption', 'status duration')
      .sort({ requestedDate: 1 });

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
// @access  Private (Adopter or Expert)
const scheduleFarmVisit = async (req, res) => {
  try {
    if (!['adopter', 'expert'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Only adopters and experts can schedule farm visits'
      });
    }

    const { farmerId, requestedDate, duration, purpose, notes, groupSize } = req.body;

    // Validate farmer exists - farmerId should be the user ID, not profile ID
    const farmer = await FarmerProfile.findOne({ user: farmerId });
    if (!farmer) {
      return res.status(404).json({
        success: false,
        message: 'Farmer not found'
      });
    }

    // Check for scheduling conflicts
    const conflictingVisit = await FarmVisit.findOne({
      farmer: farmerId, // Use farmer user ID
      requestedDate: {
        $gte: new Date(new Date(requestedDate).setHours(0, 0, 0, 0)),
        $lt: new Date(new Date(requestedDate).setHours(23, 59, 59, 999))
      },
      status: { $in: ['requested', 'confirmed'] }
    });

    if (conflictingVisit) {
      return res.status(400).json({
        success: false,
        message: 'This date already has a visit scheduled'
      });
    }

    const visitData = {
      visitor: req.user._id, // Use visitor instead of adopter for both roles
      visitorRole: req.user.role, // Track visitor role
      farmer: farmerId, // Use farmer user ID
      requestedDate: new Date(requestedDate),
      duration: duration || 'half_day',
      purpose: purpose || 'general',
      notes,
      groupSize: {
        adults: groupSize?.adults || 1,
        children: groupSize?.children || 0
      },
      status: 'requested'
    };

    // For backwards compatibility, still set adopter field
    if (req.user.role === 'adopter') {
      visitData.adopter = req.user._id;
    }

    const visit = await FarmVisit.create(visitData);

    // Populate the created visit
    await visit.populate([
      { path: 'visitor', select: 'firstName lastName email phone role' },
      { path: 'farmer', select: 'firstName lastName email phone' }
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

    const visit = await FarmVisit.findById(visitId);

    if (!visit) {
      return res.status(404).json({
        success: false,
        message: 'Visit not found'
      });
    }

    // Check if user can update this visit
    const canUpdate = 
      req.user.role === 'admin' ||
      (req.user.role === 'farmer' && visit.farmer.toString() === req.user._id.toString()) ||
      (req.user.role === 'adopter' && visit.adopter.toString() === req.user._id.toString());

    if (!canUpdate) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this visit'
      });
    }

    visit.status = status;
    if (status === 'cancelled' && reason) {
      visit.cancellationReason = reason;
      visit.cancelledAt = new Date();
    }
    if (status === 'confirmed') {
      visit.confirmedDate = new Date();
    }
    if (status === 'completed') {
      if (!visit.visitReport) {
        visit.visitReport = {};
      }
      visit.visitReport.completedAt = new Date();
    }

    await visit.save();

    // Populate for response
    await visit.populate([
      { path: 'adopter', select: 'firstName lastName email phone' },
      { path: 'farmer', select: 'firstName lastName email phone' }
    ]);

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

    // Find farmer by user ID
    const farmer = await FarmerProfile.findOne({ user: farmerId });
    if (!farmer) {
      return res.status(404).json({
        success: false,
        message: 'Farmer not found'
      });
    }

    const targetDate = new Date(date);
    const isoDate = targetDate.toISOString().slice(0, 10);

    // Get farmer's set availability for this date
    const availability = await FarmerAvailability.findOne({
      farmer: farmer._id,
      date: isoDate
    });

    // Get existing bookings for the date
    const existingVisits = await FarmVisit.find({
      farmer: farmerId, // Use farmer user ID
      requestedDate: {
        $gte: new Date(targetDate.setHours(0, 0, 0, 0)),
        $lte: new Date(targetDate.setHours(23, 59, 59, 999))
      },
      status: { $in: ['requested', 'confirmed'] }
    }).select('requestedDate duration');

    let availableSlots = [];

    if (availability && availability.timeSlots.length > 0) {
      // Use farmer's custom availability
      availableSlots = availability.timeSlots
        .filter(slot => {
          // Check if this slot conflicts with existing visits
          const hasConflict = existingVisits.some(visit => {
            const visitHour = new Date(visit.requestedDate).getHours();
            const slotHour = parseInt(slot.split(':')[0]);
            return Math.abs(visitHour - slotHour) < 2; // 2-hour buffer
          });
          return !hasConflict;
        })
        .map(slot => ({
          time: slot,
          formattedTime: slot,
          available: true
        }));
    } else {
      // Default working hours if no custom availability
      const workingHours = [8, 9, 10, 11, 13, 14, 15, 16, 17];
      
      availableSlots = workingHours
        .filter(hour => {
          const hasConflict = existingVisits.some(visit => {
            const visitHour = new Date(visit.requestedDate).getHours();
            return Math.abs(visitHour - hour) < 2;
          });
          return !hasConflict;
        })
        .map(hour => ({
          time: `${hour.toString().padStart(2, '0')}:00`,
          formattedTime: `${hour}:00`,
          available: true
        }));
    }

    res.json({
      success: true,
      data: {
        date: isoDate,
        availableSlots,
        bookedSlots: existingVisits.length,
        hasCustomAvailability: !!(availability && availability.timeSlots.length > 0)
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
      // Use user ID directly for farmer visits
      filter.farmer = userId;
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
    const upcomingVisits = visits.filter(v => 
      v.status === 'confirmed' && new Date(v.requestedDate) > new Date()
    ).length;
    
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
        upcoming_visits: upcomingVisits,
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

// @desc    Set available time slots for a farmer for a date
// @route   POST /api/visits/availability
// @access  Private (Farmer)
const setFarmerAvailability = async (req, res) => {
  try {
    const userId = req.user._id;
    const { date, time_slots } = req.body;

    if (!date) {
      return res.status(400).json({ 
        success: false, 
        message: 'Date is required' 
      });
    }

    if (!Array.isArray(time_slots)) {
      return res.status(400).json({ 
        success: false, 
        message: 'time_slots must be an array' 
      });
    }

    // Use user ID directly instead of requiring farmer profile
    let farmer = await FarmerProfile.findOne({ user: userId });
    if (!farmer) {
      // Auto-create farmer profile if it doesn't exist
      farmer = await FarmerProfile.create({
        user: userId,
        farmName: req.user.firstName + "'s Farm",
        location: { type: 'Point', coordinates: [0, 0] }
      });
      console.log('✅ Auto-created farmer profile for user:', userId);
    }

    const normalizedDate = new Date(date);
    if (isNaN(normalizedDate.getTime())) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid date format' 
      });
    }
    
    // Ensure date is not in the past
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (normalizedDate < today) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot set availability for past dates' 
      });
    }

    const isoDate = normalizedDate.toISOString().slice(0, 10);

    // Validate time slots format
    const validTimeSlots = time_slots.filter(slot => {
      return typeof slot === 'string' && /^\d{2}:\d{2}$/.test(slot);
    });

    if (validTimeSlots.length !== time_slots.length) {
      return res.status(400).json({ 
        success: false, 
        message: 'All time slots must be in HH:mm format' 
      });
    }

    const uniqueSlots = [...new Set(validTimeSlots)];

    const availability = await FarmerAvailability.findOneAndUpdate(
      { farmer: farmer._id, date: isoDate },
      { $set: { timeSlots: uniqueSlots } },
      { upsert: true, new: true }
    );

    return res.json({ 
      success: true, 
      message: `Availability ${uniqueSlots.length > 0 ? 'updated' : 'cleared'} for ${isoDate}`, 
      data: { availability } 
    });
  } catch (error) {
    console.error('Set farmer availability error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

// @desc    Get saved availability for the authenticated farmer
// @route   GET /api/visits/availability?start=YYYY-MM-DD&end=YYYY-MM-DD
// @access  Private (Farmer)
const getAvailability = async (req, res) => {
  try {
    const userId = req.user._id;
    let farmer = await FarmerProfile.findOne({ user: userId });
    if (!farmer) {
      // Auto-create farmer profile if it doesn't exist
      farmer = await FarmerProfile.create({
        user: userId,
        farmName: req.user.firstName + "'s Farm",
        location: { type: 'Point', coordinates: [0, 0] }
      });
      console.log('✅ Auto-created farmer profile for user:', userId);
    }

    const { start, end, date } = req.query;
    const filter = { farmer: farmer._id };
    
    // Handle single date query
    if (date) {
      const queryDate = new Date(date);
      if (isNaN(queryDate.getTime())) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid date format' 
        });
      }
      filter.date = queryDate.toISOString().slice(0, 10);
    } else {
      // Handle date range query
      if (start && end) {
        const startDate = new Date(start);
        const endDate = new Date(end);
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
          return res.status(400).json({ 
            success: false, 
            message: 'Invalid date format in start or end parameter' 
          });
        }
        filter.date = { 
          $gte: startDate.toISOString().slice(0, 10), 
          $lte: endDate.toISOString().slice(0, 10) 
        };
      } else if (start) {
        const startDate = new Date(start);
        if (isNaN(startDate.getTime())) {
          return res.status(400).json({ 
            success: false, 
            message: 'Invalid start date format' 
          });
        }
        filter.date = { $gte: startDate.toISOString().slice(0, 10) };
      } else if (end) {
        const endDate = new Date(end);
        if (isNaN(endDate.getTime())) {
          return res.status(400).json({ 
            success: false, 
            message: 'Invalid end date format' 
          });
        }
        filter.date = { $lte: endDate.toISOString().slice(0, 10) };
      }
    }

    const items = await FarmerAvailability.find(filter).sort({ date: 1 });
    
    return res.json({ 
      success: true, 
      data: { 
        availability: items,
        count: items.length
      } 
    });
  } catch (error) {
    console.error('Get availability error:', error);
    return res.status(500).json({ 
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