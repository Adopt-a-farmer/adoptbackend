const { body, validationResult } = require('express-validator');

// Validation middleware
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => ({
      field: error.path,
      message: error.msg,
      value: error.value
    }));

    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errorMessages
    });
  }
  next();
};

// User registration validation
const validateRegister = [
  body('firstName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters'),
  
  body('lastName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters'),
  
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  
  body('role')
    .isIn(['farmer', 'adopter'])
    .withMessage('Role must be either farmer or adopter'),
  
  body('phone')
    .optional()
    .matches(/^\+?[1-9]\d{1,14}$/)
    .withMessage('Please provide a valid phone number')
];

// User login validation
const validateLogin = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

// Profile update validation
const validateProfileUpdate = [
  body('firstName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters'),
  
  body('lastName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters'),
  
  body('phone')
    .optional()
    .matches(/^\+?[1-9]\d{1,14}$/)
    .withMessage('Please provide a valid phone number')
];

// Password change validation
const validatePasswordChange = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('New password must be at least 6 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('New password must contain at least one uppercase letter, one lowercase letter, and one number')
];

// Farmer profile validation
const validateFarmerProfile = [
  body('farmName')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Farm name must be between 2 and 100 characters'),
  
  body('description')
    .trim()
    .isLength({ min: 10, max: 1000 })
    .withMessage('Description must be between 10 and 1000 characters'),
  
  body('location.county')
    .notEmpty()
    .withMessage('County is required'),
  
  body('location.subCounty')
    .notEmpty()
    .withMessage('Sub-county is required'),
  
  body('farmSize.value')
    .isFloat({ min: 0.1 })
    .withMessage('Farm size must be at least 0.1'),
  
  body('farmingType')
    .isArray({ min: 1 })
    .withMessage('At least one farming type is required')
];

// Farmer profile partial validation (for PATCH)
const validateFarmerProfilePartial = [
  body('farmName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Farm name must be between 2 and 100 characters'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ min: 10, max: 1000 })
    .withMessage('Description must be between 10 and 1000 characters'),
  
  body('location.county')
    .optional()
    .notEmpty()
    .withMessage('County is required'),
  
  body('location.subCounty')
    .optional()
    .notEmpty()
    .withMessage('Sub-county is required'),
  
  body('farmSize.value')
    .optional()
    .isFloat({ min: 0.1 })
    .withMessage('Farm size must be at least 0.1'),
  // Optional crop types array
  body('cropTypes')
    .optional()
    .isArray()
    .withMessage('Crop types must be an array'),
  body('cropTypes.*')
    .optional()
    .isIn([
      'maize','beans','rice','wheat','vegetables','fruits',
      'coffee','tea','sugarcane','cotton','sunflower','sorghum','millet'
    ])
    .withMessage('Invalid crop type'),
  // Optional farming methods array
  body('farmingMethods')
    .optional()
    .isArray()
    .withMessage('Farming methods must be an array'),
  body('farmingMethods.*')
    .optional()
    .isIn([
      'organic','conventional','permaculture','hydroponics','agroforestry',
      'conservation_agriculture','precision_farming','sustainable_agriculture'
    ])
    .withMessage('Invalid farming method'),
  
  body('farmingType')
    .optional()
    .isArray({ min: 1 })
    .withMessage('At least one farming type is required')
];

// Payment validation
const validatePayment = [
  body('amount')
    .isFloat({ min: 1 })
    .withMessage('Amount must be greater than 0'),
  
  body('paymentType')
    .isIn(['adoption', 'crowdfunding', 'visit'])
    .withMessage('Invalid payment type'),
  
  body('paymentMethod')
    .isIn(['card', 'mobile_money', 'bank_transfer'])
    .withMessage('Invalid payment method')
];

// Message validation
const validateMessage = [
  body('content.text')
    .optional()
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage('Message text must be between 1 and 1000 characters'),
  
  body('recipient')
    .isMongoId()
    .withMessage('Invalid recipient ID'),
  
  body('messageType')
    .isIn(['text', 'image', 'video', 'file'])
    .withMessage('Invalid message type')
];

// Knowledge article validation
const validateKnowledgeArticle = [
  body('title')
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('Title must be between 5 and 200 characters'),
  
  body('content')
    .trim()
    .isLength({ min: 100 })
    .withMessage('Content must be at least 100 characters'),
  
  body('category')
    .isIn([
      'crop_farming', 'livestock', 'pest_control', 'soil_management',
      'irrigation', 'harvesting', 'post_harvest', 'marketing',
      'finance', 'technology', 'climate', 'sustainability'
    ])
    .withMessage('Invalid category')
];

module.exports = {
  validate,
  validateRegister,
  validateLogin,
  validateProfileUpdate,
  validatePasswordChange,
  validateFarmerProfile,
  validateFarmerProfilePartial,
  validatePayment,
  validateMessage,
  validateKnowledgeArticle
};