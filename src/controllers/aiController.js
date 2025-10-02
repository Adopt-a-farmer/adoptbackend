const {
  generateFarmingAdvice,
  generateImpactReport,
  predictYield,
  generateOnboardingGuide,
  generateComplianceReport,
  chatWithAssistant
} = require('../services/geminiService');

// @desc    Get AI-powered farming advice
// @route   POST /api/ai/farming-advice
// @access  Private (Farmer)
const getFarmingAdvice = async (req, res) => {
  try {
    const { crops, location, farmSize, challenges } = req.body;

    if (!crops || !location || !farmSize) {
      return res.status(400).json({
        success: false,
        message: 'Please provide crops, location, and farm size'
      });
    }

    const advice = await generateFarmingAdvice({
      crops: Array.isArray(crops) ? crops : [crops],
      location,
      farmSize,
      challenges
    });

    res.json({
      success: true,
      data: {
        advice,
        generatedAt: new Date()
      }
    });
  } catch (error) {
    console.error('Get farming advice error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate farming advice'
    });
  }
};

// @desc    Generate impact report for adoption
// @route   POST /api/ai/impact-report
// @access  Private
const getImpactReport = async (req, res) => {
  try {
    const {
      farmerName,
      adoptionDuration,
      funding,
      achievements,
      challenges
    } = req.body;

    if (!farmerName || !adoptionDuration || !funding) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields for impact report'
      });
    }

    const report = await generateImpactReport({
      farmerName,
      adoptionDuration,
      funding,
      achievements: achievements || 'Ongoing agricultural improvements',
      challenges: challenges || 'Various seasonal challenges'
    });

    res.json({
      success: true,
      data: {
        report,
        generatedAt: new Date()
      }
    });
  } catch (error) {
    console.error('Generate impact report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate impact report'
    });
  }
};

// @desc    Predict crop yield using AI
// @route   POST /api/ai/predict-yield
// @access  Private (Farmer)
const getYieldPrediction = async (req, res) => {
  try {
    const {
      cropType,
      farmSize,
      historicalYields,
      weather,
      soilCondition
    } = req.body;

    if (!cropType || !farmSize) {
      return res.status(400).json({
        success: false,
        message: 'Crop type and farm size are required'
      });
    }

    const prediction = await predictYield({
      cropType,
      farmSize,
      historicalYields: historicalYields || [],
      weather: weather || 'Normal seasonal conditions',
      soilCondition: soilCondition || 'Average fertility'
    });

    res.json({
      success: true,
      data: {
        prediction,
        generatedAt: new Date()
      }
    });
  } catch (error) {
    console.error('Yield prediction error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to predict yield'
    });
  }
};

// @desc    Generate personalized onboarding guide
// @route   POST /api/ai/onboarding-guide
// @access  Private (New Farmer)
const getOnboardingGuide = async (req, res) => {
  try {
    const { name, experience, crops, goals } = req.body;

    if (!name || !crops) {
      return res.status(400).json({
        success: false,
        message: 'Name and crops are required'
      });
    }

    const guide = await generateOnboardingGuide({
      name,
      experience: experience || 'beginner',
      crops: Array.isArray(crops) ? crops : [crops],
      goals: goals || 'Improve farm productivity and income'
    });

    res.json({
      success: true,
      data: {
        guide,
        generatedAt: new Date()
      }
    });
  } catch (error) {
    console.error('Generate onboarding guide error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate onboarding guide'
    });
  }
};

// @desc    Generate EUDR compliance report
// @route   POST /api/ai/compliance-report
// @access  Private
const getComplianceReport = async (req, res) => {
  try {
    const {
      farmerId,
      farmName,
      geoLocation,
      crops,
      certifications,
      activities
    } = req.body;

    if (!farmerId || !farmName || !geoLocation || !crops) {
      return res.status(400).json({
        success: false,
        message: 'Farm details, geolocation, and crops are required'
      });
    }

    const report = await generateComplianceReport({
      farmerId,
      farmName,
      geoLocation,
      crops: Array.isArray(crops) ? crops : [crops],
      certifications: certifications || [],
      activities: activities || 'Regular farming activities'
    });

    res.json({
      success: true,
      data: {
        report,
        generatedAt: new Date()
      }
    });
  } catch (error) {
    console.error('Generate compliance report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate compliance report'
    });
  }
};

// @desc    Chat with AI assistant
// @route   POST /api/ai/chat
// @access  Private
const chatWithAI = async (req, res) => {
  try {
    const { message, userRole } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        message: 'Message is required'
      });
    }

    const context = userRole ? `User Role: ${userRole}` : '';
    const response = await chatWithAssistant(message, context);

    res.json({
      success: true,
      data: {
        response,
        timestamp: new Date()
      }
    });
  } catch (error) {
    console.error('AI chat error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get AI response'
    });
  }
};

module.exports = {
  getFarmingAdvice,
  getImpactReport,
  getYieldPrediction,
  getOnboardingGuide,
  getComplianceReport,
  chatWithAI
};
