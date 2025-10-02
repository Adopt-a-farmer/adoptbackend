const Payment = require('../models/Payment');
const Adoption = require('../models/Adoption');
const FarmVisit = require('../models/FarmVisit');
const FarmUpdate = require('../models/FarmUpdate');
const FarmerProfile = require('../models/FarmerProfile');
const AdopterProfile = require('../models/AdopterProfile');
const ExpertProfile = require('../models/ExpertProfile');
const ExpertMentorship = require('../models/ExpertMentorship');
const User = require('../models/User');
const { Parser } = require('json2csv');

// Helper function to calculate date range
const getDateRange = (period) => {
  const now = new Date();
  let startDate;
  
  switch (period) {
    case 'week':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'quarter':
      startDate = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
      break;
    case 'year':
      startDate = new Date(now.getFullYear(), 0, 1);
      break;
    case 'all':
      startDate = new Date(2020, 0, 1); // Beginning of platform
      break;
    default:
      startDate = new Date(now.getFullYear(), now.getMonth(), 1); // Default to month
  }
  
  return { startDate, endDate: now };
};

// @desc    Generate farmer report (payments, visits, yields, adoptions)
// @route   GET /api/reports/farmer
// @access  Private (Farmer only)
const generateFarmerReport = async (req, res) => {
  try {
    const userId = req.user._id;
    const { period = 'month', format = 'json' } = req.query;
    
    const farmer = await FarmerProfile.findOne({ user: userId });
    if (!farmer) {
      return res.status(404).json({
        success: false,
        message: 'Farmer profile not found'
      });
    }

    const { startDate, endDate } = getDateRange(period);

    // Payments received
    const payments = await Payment.find({
      status: { $in: ['success', 'completed'] },
      createdAt: { $gte: startDate, $lte: endDate }
    }).populate('user', 'firstName lastName email');

    // Filter payments related to this farmer (via adoption metadata)
    const farmerPayments = payments.filter(p => 
      p.metadata?.farmerId === farmer._id.toString() || 
      p.metadata?.farmerName === farmer.farmName
    );

    // Adoptions
    const adoptions = await Adoption.find({ 
      farmer: userId,
      createdAt: { $gte: startDate, $lte: endDate }
    }).populate('adopter', 'firstName lastName email phone');

    // Farm visits
    const visits = await FarmVisit.find({
      farmer: farmer._id,
      createdAt: { $gte: startDate, $lte: endDate }
    }).populate('visitor', 'firstName lastName email role')
     .populate('adopter', 'firstName lastName email');

    // Farm updates
    const updates = await FarmUpdate.find({
      farmer: farmer._id,
      createdAt: { $gte: startDate, $lte: endDate }
    });

    // Calculate metrics
    const totalRevenue = farmerPayments.reduce((sum, p) => sum + p.amount, 0);
    const totalFees = farmerPayments.reduce((sum, p) => 
      sum + (p.fees?.gateway || 0) + (p.fees?.platform || 0), 0
    );
    const netRevenue = totalRevenue - totalFees;
    
    const completedVisits = visits.filter(v => v.status === 'completed').length;
    const visitSatisfaction = visits.filter(v => v.feedback?.rating).length > 0
      ? visits
          .filter(v => v.feedback?.rating)
          .reduce((sum, v) => sum + v.feedback.rating, 0) / visits.filter(v => v.feedback?.rating).length
      : 0;

    // Yield data from updates
    const yieldData = updates
      .filter(u => u.yieldData && u.yieldData.amount)
      .map(u => ({
        crop: u.yieldData.crop,
        amount: u.yieldData.amount,
        unit: u.yieldData.unit,
        date: u.createdAt,
        quality: u.yieldData.quality
      }));

    const totalYield = yieldData.reduce((sum, y) => sum + (y.amount || 0), 0);

    const report = {
      generatedAt: new Date(),
      period,
      dateRange: { startDate, endDate },
      farmer: {
        name: farmer.farmName,
        location: `${farmer.location?.subCounty}, ${farmer.location?.county}`,
        farmSize: `${farmer.farmSize?.value} ${farmer.farmSize?.unit}`,
        crops: farmer.cropTypes
      },
      financialSummary: {
        totalRevenue,
        totalFees,
        netRevenue,
        paymentCount: farmerPayments.length,
        averagePayment: farmerPayments.length > 0 ? totalRevenue / farmerPayments.length : 0
      },
      adoptionSummary: {
        totalAdoptions: adoptions.length,
        activeAdoptions: adoptions.filter(a => a.status === 'active').length,
        totalFundingReceived: totalRevenue,
        averageFundingPerAdoption: adoptions.length > 0 ? totalRevenue / adoptions.length : 0
      },
      visitSummary: {
        totalVisits: visits.length,
        completedVisits,
        pendingVisits: visits.filter(v => v.status === 'requested').length,
        confirmedVisits: visits.filter(v => v.status === 'confirmed').length,
        cancelledVisits: visits.filter(v => v.status === 'cancelled').length,
        averageSatisfaction: Math.round(visitSatisfaction * 10) / 10
      },
      yieldSummary: {
        totalYield,
        yieldRecords: yieldData.length,
        averageYield: yieldData.length > 0 ? totalYield / yieldData.length : 0,
        yieldByCrop: yieldData.reduce((acc, y) => {
          if (!acc[y.crop]) {
            acc[y.crop] = { total: 0, count: 0, unit: y.unit };
          }
          acc[y.crop].total += y.amount;
          acc[y.crop].count++;
          return acc;
        }, {})
      },
      detailedData: {
        payments: farmerPayments.map(p => ({
          date: p.createdAt,
          amount: p.amount,
          fees: (p.fees?.gateway || 0) + (p.fees?.platform || 0),
          netAmount: p.amount - (p.fees?.gateway || 0) - (p.fees?.platform || 0),
          from: `${p.user?.firstName} ${p.user?.lastName}`,
          type: p.paymentType,
          reference: p.gatewayResponse?.reference
        })),
        visits: visits.map(v => ({
          date: v.scheduledDate,
          visitor: v.visitor ? `${v.visitor.firstName} ${v.visitor.lastName}` : 
                   v.adopter ? `${v.adopter.firstName} ${v.adopter.lastName}` : 'Unknown',
          visitorType: v.visitorRole || 'adopter',
          status: v.status,
          duration: v.duration,
          rating: v.feedback?.rating,
          feedback: v.feedback?.comment
        })),
        yields: yieldData
      }
    };

    // Format as CSV if requested
    if (format === 'csv') {
      try {
        const fields = [
          { label: 'Date', value: 'date' },
          { label: 'Type', value: 'type' },
          { label: 'Description', value: 'description' },
          { label: 'Amount', value: 'amount' },
          { label: 'Status', value: 'status' }
        ];

        const data = [
          ...farmerPayments.map(p => ({
            date: p.createdAt.toISOString().split('T')[0],
            type: 'Payment',
            description: `Payment from ${p.user?.firstName} ${p.user?.lastName}`,
            amount: p.amount,
            status: p.status
          })),
          ...visits.map(v => ({
            date: v.scheduledDate.toISOString().split('T')[0],
            type: 'Visit',
            description: `Farm visit by ${v.visitor?.firstName || v.adopter?.firstName || 'Unknown'}`,
            amount: 0,
            status: v.status
          })),
          ...yieldData.map(y => ({
            date: y.date.toISOString().split('T')[0],
            type: 'Yield',
            description: `${y.crop} - ${y.amount} ${y.unit}`,
            amount: y.amount,
            status: 'Recorded'
          }))
        ].sort((a, b) => new Date(b.date) - new Date(a.date));

        const json2csvParser = new Parser({ fields });
        const csv = json2csvParser.parse(data);

        res.header('Content-Type', 'text/csv');
        res.attachment(`farmer-report-${period}-${Date.now()}.csv`);
        return res.send(csv);
      } catch (err) {
        console.error('CSV generation error:', err);
        return res.status(500).json({
          success: false,
          message: 'Failed to generate CSV report'
        });
      }
    }

    // Return JSON format
    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('Generate farmer report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate farmer report'
    });
  }
};

// @desc    Generate adopter report (payments, visits, adoptions)
// @route   GET /api/reports/adopter
// @access  Private (Adopter only)
const generateAdopterReport = async (req, res) => {
  try {
    const userId = req.user._id;
    const { period = 'month', format = 'json' } = req.query;
    
    const adopter = await AdopterProfile.findOne({ user: userId });
    if (!adopter) {
      return res.status(404).json({
        success: false,
        message: 'Adopter profile not found'
      });
    }

    const { startDate, endDate } = getDateRange(period);

    // Payments made
    const payments = await Payment.find({
      user: userId,
      status: { $in: ['success', 'completed'] },
      createdAt: { $gte: startDate, $lte: endDate }
    });

    // Adoptions
    const adoptions = await Adoption.find({ 
      adopter: userId,
      createdAt: { $gte: startDate, $lte: endDate }
    }).populate({
      path: 'farmer',
      populate: {
        path: 'user',
        select: 'firstName lastName email'
      }
    });

    // Farm visits
    const visits = await FarmVisit.find({
      $or: [
        { adopter: userId },
        { visitor: userId, visitorRole: 'adopter' }
      ],
      createdAt: { $gte: startDate, $lte: endDate }
    }).populate({
      path: 'farmer',
      populate: {
        path: 'user',
        select: 'firstName lastName'
      }
    });

    // Calculate metrics
    const totalSpent = payments.reduce((sum, p) => sum + p.amount, 0);
    const totalFees = payments.reduce((sum, p) => 
      sum + (p.fees?.gateway || 0) + (p.fees?.platform || 0), 0
    );
    const netContribution = totalSpent;

    const report = {
      generatedAt: new Date(),
      period,
      dateRange: { startDate, endDate },
      adopter: {
        name: `${req.user.firstName} ${req.user.lastName}`,
        email: req.user.email,
        memberSince: adopter.createdAt
      },
      financialSummary: {
        totalSpent,
        totalFees,
        netContribution,
        paymentCount: payments.length,
        averageContribution: payments.length > 0 ? totalSpent / payments.length : 0
      },
      adoptionSummary: {
        totalAdoptions: adoptions.length,
        activeAdoptions: adoptions.filter(a => a.status === 'active').length,
        completedAdoptions: adoptions.filter(a => a.status === 'completed').length,
        farmersSupported: [...new Set(adoptions.map(a => a.farmer?._id?.toString()))].length
      },
      visitSummary: {
        totalVisits: visits.length,
        completedVisits: visits.filter(v => v.status === 'completed').length,
        upcomingVisits: visits.filter(v => 
          v.status === 'confirmed' && new Date(v.scheduledDate) > new Date()
        ).length,
        averageRating: visits.filter(v => v.feedback?.rating).length > 0
          ? visits
              .filter(v => v.feedback?.rating)
              .reduce((sum, v) => sum + v.feedback.rating, 0) / visits.filter(v => v.feedback?.rating).length
          : 0
      },
      detailedData: {
        payments: payments.map(p => ({
          date: p.createdAt,
          amount: p.amount,
          fees: (p.fees?.gateway || 0) + (p.fees?.platform || 0),
          type: p.paymentType,
          farmer: p.metadata?.farmerName,
          reference: p.gatewayResponse?.reference,
          status: p.status
        })),
        adoptions: adoptions.map(a => ({
          farmer: a.farmer?.user ? `${a.farmer.user.firstName} ${a.farmer.user.lastName}` : 'Unknown',
          farmName: a.farmer?.farmName,
          startDate: a.startDate,
          status: a.status,
          totalPaid: a.paymentPlan?.totalPaid || 0
        })),
        visits: visits.map(v => ({
          date: v.scheduledDate,
          farmer: v.farmer?.user ? `${v.farmer.user.firstName} ${v.farmer.user.lastName}` : 'Unknown',
          farmName: v.farmer?.farmName,
          status: v.status,
          duration: v.duration,
          rating: v.feedback?.rating,
          feedback: v.feedback?.comment
        }))
      }
    };

    // Format as CSV if requested
    if (format === 'csv') {
      try {
        const fields = [
          { label: 'Date', value: 'date' },
          { label: 'Type', value: 'type' },
          { label: 'Description', value: 'description' },
          { label: 'Amount', value: 'amount' },
          { label: 'Status', value: 'status' }
        ];

        const data = [
          ...payments.map(p => ({
            date: p.createdAt.toISOString().split('T')[0],
            type: 'Payment',
            description: `Payment for ${p.paymentType} - ${p.metadata?.farmerName || 'Unknown'}`,
            amount: p.amount,
            status: p.status
          })),
          ...visits.map(v => ({
            date: v.scheduledDate.toISOString().split('T')[0],
            type: 'Visit',
            description: `Visit to ${v.farmer?.farmName || 'Unknown farm'}`,
            amount: 0,
            status: v.status
          }))
        ].sort((a, b) => new Date(b.date) - new Date(a.date));

        const json2csvParser = new Parser({ fields });
        const csv = json2csvParser.parse(data);

        res.header('Content-Type', 'text/csv');
        res.attachment(`adopter-report-${period}-${Date.now()}.csv`);
        return res.send(csv);
      } catch (err) {
        console.error('CSV generation error:', err);
        return res.status(500).json({
          success: false,
          message: 'Failed to generate CSV report'
        });
      }
    }

    // Return JSON format
    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('Generate adopter report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate adopter report'
    });
  }
};

// @desc    Generate expert report (mentorships, visits, farmers helped)
// @route   GET /api/reports/expert
// @access  Private (Expert only)
const generateExpertReport = async (req, res) => {
  try {
    const userId = req.user._id;
    const { period = 'month', format = 'json' } = req.query;
    
    const expert = await ExpertProfile.findOne({ user: userId });
    if (!expert) {
      return res.status(404).json({
        success: false,
        message: 'Expert profile not found'
      });
    }

    const { startDate, endDate } = getDateRange(period);

    // Mentorships
    const mentorships = await ExpertMentorship.find({
      expert: userId,
      createdAt: { $gte: startDate, $lte: endDate }
    }).populate({
      path: 'farmer',
      populate: {
        path: 'user',
        select: 'firstName lastName email'
      }
    });

    // Farm visits
    const visits = await FarmVisit.find({
      visitor: userId,
      visitorRole: 'expert',
      createdAt: { $gte: startDate, $lte: endDate }
    }).populate({
      path: 'farmer',
      populate: {
        path: 'user',
        select: 'firstName lastName'
      }
    });

    const report = {
      generatedAt: new Date(),
      period,
      dateRange: { startDate, endDate },
      expert: {
        name: `${req.user.firstName} ${req.user.lastName}`,
        specializations: expert.specializations || [],
        yearsOfExperience: expert.yearsOfExperience,
        memberSince: expert.createdAt
      },
      mentorshipSummary: {
        totalMentorships: mentorships.length,
        activeMentorships: mentorships.filter(m => m.status === 'active').length,
        completedMentorships: mentorships.filter(m => m.status === 'completed').length,
        farmersHelped: [...new Set(mentorships.map(m => m.farmer?._id?.toString()))].length,
        averageRating: mentorships.filter(m => m.progress?.overallRating).length > 0
          ? mentorships
              .filter(m => m.progress?.overallRating)
              .reduce((sum, m) => sum + m.progress.overallRating, 0) / 
            mentorships.filter(m => m.progress?.overallRating).length
          : 0
      },
      visitSummary: {
        totalVisits: visits.length,
        completedVisits: visits.filter(v => v.status === 'completed').length,
        upcomingVisits: visits.filter(v => 
          v.status === 'confirmed' && new Date(v.scheduledDate) > new Date()
        ).length,
        averageRating: visits.filter(v => v.feedback?.rating).length > 0
          ? visits
              .filter(v => v.feedback?.rating)
              .reduce((sum, v) => sum + v.feedback.rating, 0) / visits.filter(v => v.feedback?.rating).length
          : 0
      },
      impactMetrics: {
        farmersReached: [...new Set([
          ...mentorships.map(m => m.farmer?._id?.toString()),
          ...visits.map(v => v.farmer?._id?.toString())
        ])].filter(Boolean).length,
        totalSessions: mentorships.reduce((sum, m) => 
          sum + (m.progress?.sessionsCompleted || 0), 0
        ),
        knowledgeAreasShared: [...new Set(
          mentorships.flatMap(m => m.focusAreas || [])
        )].length
      },
      detailedData: {
        mentorships: mentorships.map(m => ({
          farmer: m.farmer?.user ? `${m.farmer.user.firstName} ${m.farmer.user.lastName}` : 'Unknown',
          farmName: m.farmer?.farmName,
          startDate: m.createdAt,
          status: m.status,
          focusAreas: m.focusAreas,
          sessionsCompleted: m.progress?.sessionsCompleted,
          rating: m.progress?.overallRating
        })),
        visits: visits.map(v => ({
          date: v.scheduledDate,
          farmer: v.farmer?.user ? `${v.farmer.user.firstName} ${v.farmer.user.lastName}` : 'Unknown',
          farmName: v.farmer?.farmName,
          status: v.status,
          purpose: v.purpose,
          duration: v.duration,
          rating: v.feedback?.rating
        }))
      }
    };

    // Format as CSV if requested
    if (format === 'csv') {
      try {
        const fields = [
          { label: 'Date', value: 'date' },
          { label: 'Type', value: 'type' },
          { label: 'Farmer', value: 'farmer' },
          { label: 'Description', value: 'description' },
          { label: 'Status', value: 'status' },
          { label: 'Rating', value: 'rating' }
        ];

        const data = [
          ...mentorships.map(m => ({
            date: m.createdAt.toISOString().split('T')[0],
            type: 'Mentorship',
            farmer: m.farmer?.user ? `${m.farmer.user.firstName} ${m.farmer.user.lastName}` : 'Unknown',
            description: (m.focusAreas || []).join(', '),
            status: m.status,
            rating: m.progress?.overallRating || 'N/A'
          })),
          ...visits.map(v => ({
            date: v.scheduledDate.toISOString().split('T')[0],
            type: 'Visit',
            farmer: v.farmer?.user ? `${v.farmer.user.firstName} ${v.farmer.user.lastName}` : 'Unknown',
            description: v.purpose || 'Farm visit',
            status: v.status,
            rating: v.feedback?.rating || 'N/A'
          }))
        ].sort((a, b) => new Date(b.date) - new Date(a.date));

        const json2csvParser = new Parser({ fields });
        const csv = json2csvParser.parse(data);

        res.header('Content-Type', 'text/csv');
        res.attachment(`expert-report-${period}-${Date.now()}.csv`);
        return res.send(csv);
      } catch (err) {
        console.error('CSV generation error:', err);
        return res.status(500).json({
          success: false,
          message: 'Failed to generate CSV report'
        });
      }
    }

    // Return JSON format
    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('Generate expert report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate expert report'
    });
  }
};

// @desc    Generate admin report (platform-wide metrics)
// @route   GET /api/reports/admin
// @access  Private (Admin only)
const generateAdminReport = async (req, res) => {
  try {
    const { period = 'month', format = 'json', reportType = 'overview' } = req.query;
    const { startDate, endDate } = getDateRange(period);

    let report = {
      generatedAt: new Date(),
      period,
      dateRange: { startDate, endDate },
      reportType
    };

    switch (reportType) {
      case 'payments':
        const payments = await Payment.find({
          status: { $in: ['success', 'completed'] },
          createdAt: { $gte: startDate, $lte: endDate }
        }).populate('user', 'firstName lastName email role');

        const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0);
        const totalFees = payments.reduce((sum, p) => 
          sum + (p.fees?.gateway || 0) + (p.fees?.platform || 0), 0
        );
        const platformRevenue = payments.reduce((sum, p) => 
          sum + (p.fees?.platform || 0), 0
        );

        report.paymentsSummary = {
          totalPayments: payments.length,
          totalRevenue,
          totalFees,
          platformRevenue,
          averagePayment: payments.length > 0 ? totalRevenue / payments.length : 0,
          paymentsByType: payments.reduce((acc, p) => {
            acc[p.paymentType] = (acc[p.paymentType] || 0) + 1;
            return acc;
          }, {}),
          paymentsByStatus: payments.reduce((acc, p) => {
            acc[p.status] = (acc[p.status] || 0) + 1;
            return acc;
          }, {}),
          detailedPayments: payments.map(p => ({
            date: p.createdAt,
            user: `${p.user?.firstName} ${p.user?.lastName}`,
            userRole: p.user?.role,
            amount: p.amount,
            fees: (p.fees?.gateway || 0) + (p.fees?.platform || 0),
            type: p.paymentType,
            reference: p.gatewayResponse?.reference,
            status: p.status
          }))
        };
        break;

      case 'visits':
        const visits = await FarmVisit.find({
          createdAt: { $gte: startDate, $lte: endDate }
        }).populate('visitor', 'firstName lastName role')
         .populate('adopter', 'firstName lastName')
         .populate({
           path: 'farmer',
           populate: { path: 'user', select: 'firstName lastName' }
         });

        report.visitsSummary = {
          totalVisits: visits.length,
          byStatus: visits.reduce((acc, v) => {
            acc[v.status] = (acc[v.status] || 0) + 1;
            return acc;
          }, {}),
          byVisitorType: visits.reduce((acc, v) => {
            const type = v.visitorRole || 'adopter';
            acc[type] = (acc[type] || 0) + 1;
            return acc;
          }, {}),
          averageRating: visits.filter(v => v.feedback?.rating).length > 0
            ? visits
                .filter(v => v.feedback?.rating)
                .reduce((sum, v) => sum + v.feedback.rating, 0) / visits.filter(v => v.feedback?.rating).length
            : 0,
          detailedVisits: visits.map(v => ({
            date: v.scheduledDate,
            farmer: v.farmer?.user ? `${v.farmer.user.firstName} ${v.farmer.user.lastName}` : 'Unknown',
            farmName: v.farmer?.farmName,
            visitor: v.visitor ? `${v.visitor.firstName} ${v.visitor.lastName}` : 
                     v.adopter ? `${v.adopter.firstName} ${v.adopter.lastName}` : 'Unknown',
            visitorType: v.visitorRole || 'adopter',
            status: v.status,
            duration: v.duration,
            rating: v.feedback?.rating
          }))
        };
        break;

      case 'yields':
        const farmers = await FarmerProfile.find({});
        const updates = await FarmUpdate.find({
          createdAt: { $gte: startDate, $lte: endDate },
          yieldData: { $exists: true, $ne: null }
        }).populate({
          path: 'farmer',
          populate: { path: 'user', select: 'firstName lastName' }
        });

        const yieldData = updates
          .filter(u => u.yieldData && u.yieldData.amount)
          .map(u => ({
            farmer: u.farmer?.user ? `${u.farmer.user.firstName} ${u.farmer.user.lastName}` : 'Unknown',
            farmName: u.farmer?.farmName,
            crop: u.yieldData.crop,
            amount: u.yieldData.amount,
            unit: u.yieldData.unit,
            quality: u.yieldData.quality,
            date: u.createdAt
          }));

        report.yieldsSummary = {
          totalRecords: yieldData.length,
          farmersReporting: [...new Set(yieldData.map(y => y.farmer))].length,
          totalYield: yieldData.reduce((sum, y) => sum + (y.amount || 0), 0),
          yieldByCrop: yieldData.reduce((acc, y) => {
            if (!acc[y.crop]) {
              acc[y.crop] = { total: 0, count: 0, unit: y.unit };
            }
            acc[y.crop].total += y.amount;
            acc[y.crop].count++;
            return acc;
          }, {}),
          detailedYields: yieldData
        };
        break;

      default: // overview
        const users = await User.countDocuments({ createdAt: { $gte: startDate, $lte: endDate } });
        const farmersCount = await FarmerProfile.countDocuments({ 
          verificationStatus: 'verified',
          createdAt: { $gte: startDate, $lte: endDate }
        });
        const adoptersCount = await AdopterProfile.countDocuments({ 
          createdAt: { $gte: startDate, $lte: endDate }
        });
        const expertsCount = await ExpertProfile.countDocuments({ 
          createdAt: { $gte: startDate, $lte: endDate }
        });

        const allPayments = await Payment.find({
          status: { $in: ['success', 'completed'] },
          createdAt: { $gte: startDate, $lte: endDate }
        });

        const adoptions = await Adoption.find({
          createdAt: { $gte: startDate, $lte: endDate }
        });

        const allVisits = await FarmVisit.find({
          createdAt: { $gte: startDate, $lte: endDate }
        });

        report.overviewSummary = {
          users: {
            total: users,
            farmers: farmersCount,
            adopters: adoptersCount,
            experts: expertsCount
          },
          financial: {
            totalRevenue: allPayments.reduce((sum, p) => sum + p.amount, 0),
            platformRevenue: allPayments.reduce((sum, p) => sum + (p.fees?.platform || 0), 0),
            paymentCount: allPayments.length
          },
          activity: {
            adoptions: adoptions.length,
            activeAdoptions: adoptions.filter(a => a.status === 'active').length,
            visits: allVisits.length,
            completedVisits: allVisits.filter(v => v.status === 'completed').length
          }
        };
    }

    // Format as CSV if requested
    if (format === 'csv' && report.paymentsSummary) {
      try {
        const json2csvParser = new Parser();
        const csv = json2csvParser.parse(report.paymentsSummary.detailedPayments || []);

        res.header('Content-Type', 'text/csv');
        res.attachment(`admin-${reportType}-report-${period}-${Date.now()}.csv`);
        return res.send(csv);
      } catch (err) {
        console.error('CSV generation error:', err);
        return res.status(500).json({
          success: false,
          message: 'Failed to generate CSV report'
        });
      }
    }

    // Return JSON format
    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('Generate admin report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate admin report'
    });
  }
};

module.exports = {
  generateFarmerReport,
  generateAdopterReport,
  generateExpertReport,
  generateAdminReport
};
