const paystack = require('paystack')(process.env.PAYSTACK_SECRET_KEY);
const crypto = require('crypto');

// Validate Paystack configuration
if (!process.env.PAYSTACK_SECRET_KEY) {
  console.error('PAYSTACK_SECRET_KEY is not set in environment variables');
}

console.log('Paystack service initialized with key:', process.env.PAYSTACK_SECRET_KEY ? 'Key present' : 'Key missing');

// Initialize Paystack payment
const initializePayment = async (paymentData) => {
  try {
    // Validate required fields
    if (!paymentData.email || !paymentData.amount || !paymentData.reference) {
      throw new Error('Missing required payment fields: email, amount, or reference');
    }

    // Validate amount is positive
    if (paymentData.amount <= 0) {
      throw new Error('Payment amount must be greater than 0');
    }

    console.log('Initializing Paystack payment with data:', {
      email: paymentData.email,
      amount: paymentData.amount,
      reference: paymentData.reference,
      currency: paymentData.currency
    });

    const response = await paystack.transaction.initialize({
      email: paymentData.email,
      amount: paymentData.amount * 100, // Convert to kobo (or smallest currency unit)
      reference: paymentData.reference,
      currency: paymentData.currency || 'KES', // Default to KES if not specified
      callback_url: paymentData.callback_url,
      metadata: paymentData.metadata,
      channels: ['card', 'bank', 'ussd', 'qr', 'mobile_money', 'bank_transfer']
    });

    console.log('Paystack response:', response);
    return response;
  } catch (error) {
    console.error('Paystack initialization error:', error);
    console.error('Error details:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    throw new Error(`Payment initialization failed: ${error.message}`);
  }
};

// Verify Paystack payment
const verifyPayment = async (reference) => {
  try {
    const response = await paystack.transaction.verify(reference);
    return response;
  } catch (error) {
    console.error('Paystack verification error:', error);
    throw new Error('Payment verification failed');
  }
};

// Verify webhook signature
const verifyWebhookSignature = (payload, signature) => {
  const hash = crypto
    .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
    .update(JSON.stringify(payload))
    .digest('hex');
  
  return hash === signature;
};

// Create payment plan for recurring payments
const createPaymentPlan = async (planData) => {
  try {
    const response = await paystack.plan.create({
      name: planData.name,
      interval: planData.interval, // daily, weekly, monthly, quarterly, annually
      amount: planData.amount * 100, // Convert to kobo
      description: planData.description,
      currency: 'KES'
    });

    return response;
  } catch (error) {
    console.error('Paystack plan creation error:', error);
    throw new Error('Payment plan creation failed');
  }
};

// Create subscription
const createSubscription = async (subscriptionData) => {
  try {
    const response = await paystack.subscription.create({
      customer: subscriptionData.customer,
      plan: subscriptionData.plan,
      authorization: subscriptionData.authorization,
      start_date: subscriptionData.start_date
    });

    return response;
  } catch (error) {
    console.error('Paystack subscription error:', error);
    throw new Error('Subscription creation failed');
  }
};

// Initiate refund
const initiateRefund = async (refundData) => {
  try {
    const response = await paystack.refund.create({
      transaction: refundData.transaction,
      amount: refundData.amount * 100, // Convert to kobo
      currency: 'KES',
      customer_note: refundData.reason,
      merchant_note: refundData.merchant_note
    });

    return response;
  } catch (error) {
    console.error('Paystack refund error:', error);
    throw new Error('Refund initiation failed');
  }
};

// Get supported banks
const getBanks = async () => {
  try {
    const response = await paystack.misc.list_banks({
      country: 'kenya'
    });

    return response;
  } catch (error) {
    console.error('Paystack banks error:', error);
    throw new Error('Failed to fetch banks');
  }
};

// Resolve bank account
const resolveBankAccount = async (accountData) => {
  try {
    const response = await paystack.misc.resolve_account_number({
      account_number: accountData.account_number,
      bank_code: accountData.bank_code
    });

    return response;
  } catch (error) {
    console.error('Paystack account resolution error:', error);
    throw new Error('Account resolution failed');
  }
};

// Calculate Paystack fees
const calculateFees = (amount) => {
  // Paystack Kenya fees structure
  let fee = 0;
  
  if (amount <= 2500) {
    fee = amount * 0.015; // 1.5%
  } else {
    fee = (amount * 0.015) + 100; // 1.5% + KES 100
  }
  
  // Cap at KES 2000
  fee = Math.min(fee, 2000);
  
  return {
    gateway: Math.round(fee),
    platform: Math.round(amount * 0.02) // 2% platform fee
  };
};

module.exports = {
  initializePayment,
  verifyPayment,
  verifyWebhookSignature,
  createPaymentPlan,
  createSubscription,
  initiateRefund,
  getBanks,
  resolveBankAccount,
  calculateFees
};