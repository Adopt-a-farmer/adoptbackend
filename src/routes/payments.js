const express = require('express');
const {
  initializePaymentController,
  verifyPaymentController,
  handleWebhook,
  getPaymentHistory
} = require('../controllers/paymentController');
const { protect } = require('../middleware/auth');
const { validatePayment, validate } = require('../middleware/validation');

const router = express.Router();

// Public routes (webhooks)
router.post('/webhook', express.raw({ type: 'application/json' }), handleWebhook);

// Protected routes
router.post('/initialize', protect, validatePayment, validate, initializePaymentController);
router.post('/verify', protect, verifyPaymentController);
router.get('/history', protect, getPaymentHistory);

module.exports = router;