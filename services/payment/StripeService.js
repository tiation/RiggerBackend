const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { PaymentTransaction, Subscription, Invoice, NGOTransparency } = require('../../models/payment/PaymentModels');

// Wrapper for Stripe's PaymentIntent API
async function createPaymentIntent(amount, currency = 'USD', metadata = {}) {
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert amount to cents
      currency: currency,
      metadata: metadata
    });
    return { success: true, paymentIntent };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Process a captured payment from Stripe
async function capturePaymentIntent(paymentIntentId, amountToCapture) {
  try {
    const paymentIntent = await stripe.paymentIntents.capture(paymentIntentId, {
      amount_to_capture: Math.round(amountToCapture * 100) // Convert to cents
    });
    return { success: true, paymentIntent };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Refund a payment processed through Stripe
async function refundPayment(transactionId, amount, reason = 'requested_by_customer') {
  try {
    const refund = await stripe.refunds.create({
      payment_intent: transactionId,
      amount: Math.round(amount * 100), // Convert amount to cents
      reason: reason
    });
    return { success: true, refund };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Logic to handle subscriptions within Stripe
async function createOrUpdateSubscription(userId, planId, paymentMethodId) {
  try {
    const subscription = await stripe.subscriptions.create({
      customer: userId,
      items: [{ plan: planId }],
      default_payment_method: paymentMethodId
    });
    return { success: true, subscription };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Helper function for tracking ChaseWhiteRabbit NGO contributions
async function trackNGOContribution(amount, type, transactionId, description = '') {
  try {
    const contributionAmount = amount * 0.005; // 0.5% of the transaction

    const ngoRecord = new NGOTransparency({
      transactionId,
      period: {
        year: new Date().getFullYear(),
        month: new Date().getMonth() + 1,
        quarter: Math.floor((new Date().getMonth() + 3) / 3)
      },
      contribution: {
        amount: contributionAmount,
        currency: 'USD',
        percentage: 0.5,
        sourceType: type
      },
      impact: {},
      allocation: {
        workerSafety: 0.4,
        trainingPrograms: 0.3,
        communitySupport: 0.2,
        operations: 0.1
      }
    });

    await ngoRecord.save();
    return { success: true, ngoRecord };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

module.exports = {
  createPaymentIntent,
  capturePaymentIntent,
  refundPayment,
  createOrUpdateSubscription,
  trackNGOContribution
};
