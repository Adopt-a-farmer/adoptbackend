const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Generate AI content using Gemini
 * @param {string} prompt - The prompt to send to Gemini
 * @param {string} model - Model to use (default: gemini-pro)
 * @returns {Promise<string>} Generated content
 */
const generateContent = async (prompt, model = 'gemini-pro') => {
  try {
    const generativeModel = genAI.getGenerativeModel({ model });
    const result = await generativeModel.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error('Gemini AI error:', error);
    throw new Error('Failed to generate AI content');
  }
};

/**
 * Generate farming advice using AI
 * @param {Object} farmerData - Farmer information
 * @returns {Promise<string>} AI-generated advice
 */
const generateFarmingAdvice = async (farmerData) => {
  const { crops, location, farmSize, challenges } = farmerData;
  
  const prompt = `As an agricultural expert, provide specific advice for a farmer with the following details:
- Location: ${location}
- Farm Size: ${farmSize} acres
- Crops: ${crops.join(', ')}
- Current Challenges: ${challenges || 'General farming improvement'}

Provide practical, actionable advice on:
1. Best practices for their specific crops
2. Seasonal considerations for their location
3. Solutions to their challenges
4. Yield improvement strategies

Keep the advice concise and farmer-friendly.`;

  return await generateContent(prompt);
};

/**
 * Generate impact report summary
 * @param {Object} adoptionData - Adoption metrics and data
 * @returns {Promise<string>} AI-generated impact summary
 */
const generateImpactReport = async (adoptionData) => {
  const { farmerName, adoptionDuration, funding, achievements, challenges } = adoptionData;
  
  const prompt = `Generate a professional impact report summary for:
- Farmer: ${farmerName}
- Adoption Duration: ${adoptionDuration} months
- Total Funding: KES ${funding}
- Key Achievements: ${achievements}
- Challenges Overcome: ${challenges}

Create a concise, impactful summary highlighting:
1. Social and economic impact
2. Agricultural improvements
3. Sustainability outcomes
4. Future potential

Keep it professional and data-driven.`;

  return await generateContent(prompt);
};

/**
 * Analyze farm data and predict yield
 * @param {Object} farmData - Historical and current farm data
 * @returns {Promise<Object>} Yield prediction and recommendations
 */
const predictYield = async (farmData) => {
  const { cropType, farmSize, historicalYields, weather, soilCondition } = farmData;
  
  const prompt = `As an agricultural data analyst, analyze this farm data and provide yield prediction:
- Crop: ${cropType}
- Farm Size: ${farmSize} acres
- Historical Yields: ${JSON.stringify(historicalYields)}
- Weather Conditions: ${weather}
- Soil Condition: ${soilCondition}

Provide:
1. Estimated yield for the current season
2. Confidence level (high/medium/low)
3. Key factors affecting yield
4. Recommendations to optimize yield

Format as JSON with fields: estimatedYield, confidence, factors, recommendations`;

  const result = await generateContent(prompt);
  
  try {
    // Try to parse as JSON, otherwise return structured text
    return JSON.parse(result);
  } catch {
    return { rawAnalysis: result };
  }
};

/**
 * Generate personalized farmer onboarding content
 * @param {Object} farmerProfile - New farmer information
 * @returns {Promise<string>} Personalized onboarding guide
 */
const generateOnboardingGuide = async (farmerProfile) => {
  const { name, experience, crops, goals } = farmerProfile;
  
  const prompt = `Create a personalized onboarding guide for a new farmer on the Adopt-A-Farmer platform:
- Name: ${name}
- Experience Level: ${experience}
- Crops to Grow: ${crops.join(', ')}
- Goals: ${goals}

Include:
1. Welcome message
2. Key steps to get started
3. Best practices for their crop selection
4. Tips for engaging with adopters
5. Platform resources to explore

Keep it welcoming, concise, and actionable.`;

  return await generateContent(prompt);
};

/**
 * Generate compliance and traceability report
 * @param {Object} farmData - Farm geolocation and activity data
 * @returns {Promise<string>} Compliance report
 */
const generateComplianceReport = async (farmData) => {
  const { farmerId, farmName, geoLocation, crops, certifications, activities } = farmData;
  
  const prompt = `Generate an EUDR-compliant traceability report for:
- Farm: ${farmName} (Farmer ID: ${farmerId})
- Location: ${JSON.stringify(geoLocation)}
- Crops: ${crops.join(', ')}
- Certifications: ${certifications.join(', ')}
- Recent Activities: ${activities}

Create a report covering:
1. Deforestation-free status verification
2. Legal compliance summary
3. Geolocation traceability
4. Certification status
5. Recommendations for export readiness

Format professionally for regulatory review.`;

  return await generateContent(prompt);
};

/**
 * Chat with AI assistant
 * @param {string} userMessage - User's question
 * @param {string} context - Additional context (user role, etc.)
 * @returns {Promise<string>} AI response
 */
const chatWithAssistant = async (userMessage, context = '') => {
  const prompt = `You are a helpful assistant for the Adopt-A-Farmer platform, connecting adopters with smallholder farmers in Kenya.

${context}

User Question: ${userMessage}

Provide a helpful, accurate, and friendly response. If the question is about:
- Adoption process: Explain how adopters support farmers
- Payment: Mention Paystack integration and secure transactions
- Impact: Highlight traceability, transparency, and ESG benefits
- Farming: Provide relevant agricultural advice

Keep responses concise and actionable.`;

  return await generateContent(prompt);
};

module.exports = {
  generateContent,
  generateFarmingAdvice,
  generateImpactReport,
  predictYield,
  generateOnboardingGuide,
  generateComplianceReport,
  chatWithAssistant
};
