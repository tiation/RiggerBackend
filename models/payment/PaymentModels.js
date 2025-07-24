const mongoose = require('mongoose');

// Payment Transaction Schema
const paymentTransactionSchema = new mongoose.Schema({
  transactionId: {
    type: String,
    required: true,
    unique: true
  },
  type: {
    type: String,
    enum: ['job_payment', 'subscription', 'recruitment_fee', 'platform_fee', 'refund', 'chargeback'],
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded'],
    default: 'pending'
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    default: 'USD',
    enum: ['USD', 'AUD', 'CAD', 'GBP', 'EUR']
  },
  fees: {
    platform: { type: Number, default: 0 },
    processor: { type: Number, default: 0 },
    total: { type: Number, default: 0 }
  },
  netAmount: {
    type: Number,
    required: true
  },
  paymentMethod: {
    type: {
      type: String,
      enum: ['credit_card', 'debit_card', 'bank_transfer', 'paypal', 'stripe_connect', 'escrow'],
      required: true
    },
    last4: String,
    brand: String,
    expiryMonth: Number,
    expiryYear: Number
  },
  processor: {
    name: {
      type: String,
      enum: ['stripe', 'paypal', 'square', 'adyen'],
      default: 'stripe'
    },
    transactionId: String,
    processorFee: Number,
    metadata: mongoose.Schema.Types.Mixed
  },
  participants: {
    payer: {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      email: String,
      name: String
    },
    payee: {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      email: String,
      name: String
    },
    platform: {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      feePercentage: { type: Number, default: 0.03 }
    }
  },
  relatedEntities: {
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'Job' },
    subscriptionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subscription' },
    invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice' }
  },
  metadata: {
    description: String,
    customData: mongoose.Schema.Types.Mixed,
    internalNotes: String
  },
  timestamps: {
    initiated: { type: Date, default: Date.now },
    processed: Date,
    completed: Date,
    failed: Date
  },
  compliance: {
    taxReported: { type: Boolean, default: false },
    amlChecked: { type: Boolean, default: false },
    fraudScore: { type: Number, min: 0, max: 100 },
    riskLevel: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'low'
    }
  },
  chaseWhiteRabbitNGO: {
    donationPercentage: { type: Number, default: 0.005 }, // 0.5% to NGO
    donationAmount: { type: Number, default: 0 },
    transparencyTracked: { type: Boolean, default: true }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Subscription Schema
const subscriptionSchema = new mongoose.Schema({
  subscriptionId: {
    type: String,
    required: true,
    unique: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  plan: {
    type: {
      type: String,
      enum: ['basic', 'professional', 'enterprise', 'rigger_premium'],
      required: true
    },
    name: String,
    description: String,
    features: [String]
  },
  pricing: {
    amount: { type: Number, required: true },
    currency: { type: String, default: 'USD' },
    interval: {
      type: String,
      enum: ['monthly', 'quarterly', 'yearly'],
      default: 'monthly'
    },
    intervalCount: { type: Number, default: 1 }
  },
  status: {
    type: String,
    enum: ['active', 'past_due', 'cancelled', 'paused', 'trialing'],
    default: 'active'
  },
  dates: {
    start: { type: Date, required: true },
    currentPeriodStart: { type: Date, required: true },
    currentPeriodEnd: { type: Date, required: true },
    trialEnd: Date,
    cancelled: Date,
    ended: Date
  },
  paymentMethod: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PaymentMethod'
  },
  discounts: [{
    code: String,
    type: { type: String, enum: ['percentage', 'fixed'] },
    value: Number,
    validUntil: Date
  }],
  usage: {
    currentPeriodJobs: { type: Number, default: 0 },
    maxJobs: { type: Number, default: -1 }, // -1 = unlimited
    currentPeriodConnections: { type: Number, default: 0 },
    maxConnections: { type: Number, default: -1 }
  }
}, {
  timestamps: true
});

// Invoice Schema
const invoiceSchema = new mongoose.Schema({
  invoiceNumber: {
    type: String,
    required: true,
    unique: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['subscription', 'job_fee', 'recruitment_fee', 'platform_fee', 'one_time'],
    required: true
  },
  status: {
    type: String,
    enum: ['draft', 'sent', 'paid', 'overdue', 'cancelled', 'refunded'],
    default: 'draft'
  },
  items: [{
    description: { type: String, required: true },
    quantity: { type: Number, default: 1 },
    unitPrice: { type: Number, required: true },
    total: { type: Number, required: true },
    metadata: mongoose.Schema.Types.Mixed
  }],
  amounts: {
    subtotal: { type: Number, required: true },
    tax: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    total: { type: Number, required: true },
    currency: { type: String, default: 'USD' }
  },
  dates: {
    issued: { type: Date, default: Date.now },
    due: { type: Date, required: true },
    paid: Date,
    sent: Date
  },
  billing: {
    name: String,
    email: String,
    address: {
      line1: String,
      line2: String,
      city: String,
      state: String,
      postalCode: String,
      country: String
    },
    taxId: String
  },
  payment: {
    transactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'PaymentTransaction' },
    method: String,
    paidAmount: Number,
    paidDate: Date
  },
  chaseWhiteRabbitNGO: {
    contributionIncluded: { type: Boolean, default: true },
    contributionAmount: { type: Number, default: 0 },
    transparencyNote: String
  }
}, {
  timestamps: true
});

// Payment Method Schema
const paymentMethodSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['credit_card', 'debit_card', 'bank_account', 'paypal', 'apple_pay', 'google_pay'],
    required: true
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  card: {
    last4: String,
    brand: String,
    expiryMonth: Number,
    expiryYear: Number,
    fingerprint: String
  },
  bankAccount: {
    last4: String,
    bankName: String,
    accountType: { type: String, enum: ['checking', 'savings'] }
  },
  processor: {
    name: { type: String, default: 'stripe' },
    customerId: String,
    paymentMethodId: String,
    metadata: mongoose.Schema.Types.Mixed
  },
  verification: {
    status: {
      type: String,
      enum: ['pending', 'verified', 'failed'],
      default: 'pending'
    },
    verifiedAt: Date,
    failureReason: String
  }
}, {
  timestamps: true
});

// Earning Summary Schema for Workers
const earningSummarySchema = new mongoose.Schema({
  workerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  summary: {
    totalEarnings: { type: Number, default: 0 },
    totalJobs: { type: Number, default: 0 },
    averageJobValue: { type: Number, default: 0 },
    totalHours: { type: Number, default: 0 },
    averageHourlyRate: { type: Number, default: 0 }
  },
  monthly: [{
    year: Number,
    month: Number,
    earnings: Number,
    jobs: Number,
    hours: Number,
    lastUpdated: { type: Date, default: Date.now }
  }],
  yearly: [{
    year: Number,
    earnings: Number,
    jobs: Number,
    hours: Number,
    lastUpdated: { type: Date, default: Date.now }
  }],
  paymentMethods: [{
    type: String,
    isDefault: Boolean,
    last4: String,
    verified: Boolean
  }],
  taxInfo: {
    taxId: String,
    businessType: String,
    w9OnFile: Boolean,
    tax1099Threshold: { type: Number, default: 600 }
  }
}, {
  timestamps: true
});

// NGO Transparency Tracking Schema
const ngoTransparencySchema = new mongoose.Schema({
  transactionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PaymentTransaction',
    required: true
  },
  period: {
    year: { type: Number, required: true },
    month: { type: Number, required: true },
    quarter: { type: Number, required: true }
  },
  contribution: {
    amount: { type: Number, required: true },
    currency: { type: String, default: 'USD' },
    percentage: { type: Number, required: true },
    sourceType: {
      type: String,
      enum: ['job_payment', 'subscription', 'platform_fee'],
      required: true
    }
  },
  allocation: {
    workerSafety: { type: Number, default: 0.4 }, // 40%
    trainingPrograms: { type: Number, default: 0.3 }, // 30%
    communitySupport: { type: Number, default: 0.2 }, // 20%
    operations: { type: Number, default: 0.1 } // 10%
  },
  impact: {
    workersHelped: Number,
    trainingHours: Number,
    safetyIncidents: Number,
    communityEvents: Number
  },
  publicReport: {
    published: { type: Boolean, default: false },
    reportUrl: String,
    publishedAt: Date
  }
}, {
  timestamps: true
});

// Add indexes for better performance
paymentTransactionSchema.index({ 'participants.payer.userId': 1, status: 1 });
paymentTransactionSchema.index({ 'participants.payee.userId': 1, status: 1 });
paymentTransactionSchema.index({ createdAt: -1 });
paymentTransactionSchema.index({ transactionId: 1 });

subscriptionSchema.index({ userId: 1, status: 1 });
invoiceSchema.index({ userId: 1, status: 1 });
invoiceSchema.index({ 'dates.due': 1, status: 1 });

paymentMethodSchema.index({ userId: 1, isDefault: 1 });
earningSummarySchema.index({ workerId: 1 });
ngoTransparencySchema.index({ 'period.year': 1, 'period.month': 1 });

// Create models
const PaymentTransaction = mongoose.model('PaymentTransaction', paymentTransactionSchema);
const Subscription = mongoose.model('Subscription', subscriptionSchema);
const Invoice = mongoose.model('Invoice', invoiceSchema);
const PaymentMethod = mongoose.model('PaymentMethod', paymentMethodSchema);
const EarningSummary = mongoose.model('EarningSummary', earningSummarySchema);
const NGOTransparency = mongoose.model('NGOTransparency', ngoTransparencySchema);

module.exports = {
  PaymentTransaction,
  Subscription,
  Invoice,
  PaymentMethod,
  EarningSummary,
  NGOTransparency
};
