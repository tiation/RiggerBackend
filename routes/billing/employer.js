const express = require('express');
const { body, query, validationResult } = require('express-validator');
const { authenticateToken, requireRole } = require('../../middleware/auth');
const { asyncHandler, AppError } = require('../../middleware/errorHandler');
const BillingService = require('../../services/payment/BillingService');
const { PaymentTransaction, Subscription, Invoice } = require('../../models/payment/PaymentModels');

const router = express.Router();

// Validation middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'Please check your input',
      details: errors.array()
    });
  }
  next();
};

// @route   GET /api/billing/employer/dashboard
// @desc    Get employer billing dashboard overview
// @access  Private (Employers only)
router.get('/dashboard', 
  authenticateToken, 
  requireRole(['client', 'employer']), 
  asyncHandler(async (req, res) => {
    const { period = 'monthly' } = req.query;
    
    const billingData = await BillingService.generateEmployerBillingSummary(req.user._id, period);
    
    if (!billingData.success) {
      throw new AppError('Failed to retrieve billing data', 500, 'Billing Error');
    }

    res.json({
      success: true,
      dashboard: {
        period,
        summary: billingData.summary,
        recentTransactions: billingData.transactions.slice(0, 5),
        activeSubscriptions: billingData.subscriptions,
        upcomingInvoices: billingData.invoices.filter(i => i.status === 'sent').slice(0, 3)
      }
    });
  })
);

// @route   POST /api/billing/employer/subscription
// @desc    Create or update employer subscription
// @access  Private (Employers only)
router.post('/subscription',
  authenticateToken,
  requireRole(['client', 'employer']),
  [
    body('planType').isIn(['basic', 'professional', 'enterprise']).withMessage('Invalid plan type'),
    body('interval').optional().isIn(['monthly', 'quarterly', 'yearly']).withMessage('Invalid billing interval'),
    body('paymentMethodId').notEmpty().withMessage('Payment method is required')
  ],
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { planType, interval = 'monthly', paymentMethodId } = req.body;

    const result = await BillingService.createSubscriptionBilling(
      req.user._id,
      { type: planType, interval },
      paymentMethodId
    );

    if (!result.success) {
      throw new AppError(result.error, 400, 'Subscription Error');
    }

    res.status(201).json({
      success: true,
      message: 'Subscription created successfully',
      subscription: result.subscription,
      invoice: result.invoice
    });
  })
);

// @route   GET /api/billing/employer/subscriptions
// @desc    Get all employer subscriptions
// @access  Private (Employers only)
router.get('/subscriptions',
  authenticateToken,
  requireRole(['client', 'employer']),
  asyncHandler(async (req, res) => {
    const subscriptions = await Subscription.find({ userId: req.user._id })
      .populate('paymentMethod')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      subscriptions
    });
  })
);

// @route   PUT /api/billing/employer/subscription/:subscriptionId
// @desc    Update subscription (pause/resume/cancel)
// @access  Private (Employers only)
router.put('/subscription/:subscriptionId',
  authenticateToken,
  requireRole(['client', 'employer']),
  [
    body('action').isIn(['pause', 'resume', 'cancel', 'upgrade', 'downgrade']).withMessage('Invalid action'),
    body('newPlanType').optional().isIn(['basic', 'professional', 'enterprise']).withMessage('Invalid plan type')
  ],
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { subscriptionId } = req.params;
    const { action, newPlanType } = req.body;

    const subscription = await Subscription.findOne({
      _id: subscriptionId,
      userId: req.user._id
    });

    if (!subscription) {
      throw new AppError('Subscription not found', 404, 'Subscription Not Found');
    }

    switch (action) {
      case 'pause':
        subscription.status = 'paused';
        break;
      case 'resume':
        subscription.status = 'active';
        break;
      case 'cancel':
        subscription.status = 'cancelled';
        subscription.dates.cancelled = new Date();
        break;
      case 'upgrade':
      case 'downgrade':
        if (!newPlanType) {
          throw new AppError('New plan type required for plan changes', 400, 'Missing Plan Type');
        }
        const planDetails = BillingService.getSubscriptionPlans()[newPlanType];
        subscription.plan.type = newPlanType;
        subscription.plan.name = planDetails.name;
        subscription.plan.description = planDetails.description;
        subscription.plan.features = planDetails.features;
        subscription.pricing.amount = planDetails.amount;
        break;
    }

    await subscription.save();

    res.json({
      success: true,
      message: `Subscription ${action} successful`,
      subscription
    });
  })
);

// @route   POST /api/billing/employer/recruitment-fee
// @desc    Process recruitment fee payment
// @access  Private (Employers only)
router.post('/recruitment-fee',
  authenticateToken,
  requireRole(['client', 'employer']),
  [
    body('jobId').isMongoId().withMessage('Valid job ID required'),
    body('amount').isFloat({ min: 1 }).withMessage('Amount must be greater than 0'),
    body('paymentMethodId').notEmpty().withMessage('Payment method is required')
  ],
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { jobId, amount, paymentMethodId } = req.body;

    const result = await BillingService.processRecruitmentFee(
      req.user._id,
      jobId,
      amount,
      paymentMethodId
    );

    if (!result.success) {
      throw new AppError(result.error, 400, 'Payment Error');
    }

    res.status(201).json({
      success: true,
      message: 'Recruitment fee processed successfully',
      transaction: result.transaction
    });
  })
);

// @route   GET /api/billing/employer/invoices
// @desc    Get employer invoices
// @access  Private (Employers only)
router.get('/invoices',
  authenticateToken,
  requireRole(['client', 'employer']),
  [
    query('status').optional().isIn(['draft', 'sent', 'paid', 'overdue', 'cancelled']).withMessage('Invalid status'),
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be positive integer'),
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1-50')
  ],
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { status, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    let query = { userId: req.user._id };
    if (status) query.status = status;

    const invoices = await Invoice.find(query)
      .sort({ 'dates.issued': -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalInvoices = await Invoice.countDocuments(query);

    // Calculate summary
    const paidInvoices = await Invoice.find({ ...query, status: 'paid' });
    const totalPaid = paidInvoices.reduce((sum, inv) => sum + inv.amounts.total, 0);
    const outstanding = await Invoice.find({ ...query, status: { $in: ['sent', 'overdue'] } });
    const totalOutstanding = outstanding.reduce((sum, inv) => sum + inv.amounts.total, 0);

    res.json({
      success: true,
      invoices,
      summary: {
        totalPaid,
        totalOutstanding,
        overdueCount: outstanding.filter(inv => inv.status === 'overdue').length
      },
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalInvoices / parseInt(limit)),
        totalInvoices,
        hasNext: skip + invoices.length < totalInvoices,
        hasPrev: parseInt(page) > 1
      }
    });
  })
);

// @route   GET /api/billing/employer/invoice/:invoiceId
// @desc    Get specific invoice details
// @access  Private (Employers only)
router.get('/invoice/:invoiceId',
  authenticateToken,
  requireRole(['client', 'employer']),
  asyncHandler(async (req, res) => {
    const invoice = await Invoice.findOne({
      _id: req.params.invoiceId,
      userId: req.user._id
    }).populate('payment.transactionId');

    if (!invoice) {
      throw new AppError('Invoice not found', 404, 'Invoice Not Found');
    }

    res.json({
      success: true,
      invoice
    });
  })
);

// @route   GET /api/billing/employer/transactions
// @desc    Get employer payment transaction history
// @access  Private (Employers only)
router.get('/transactions',
  authenticateToken,
  requireRole(['client', 'employer']),
  [
    query('type').optional().isIn(['job_payment', 'subscription', 'recruitment_fee', 'platform_fee']).withMessage('Invalid transaction type'),
    query('status').optional().isIn(['pending', 'processing', 'completed', 'failed', 'cancelled']).withMessage('Invalid status'),
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be positive integer'),
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1-50')
  ],
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { type, status, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    let query = { 'participants.payer.userId': req.user._id };
    if (type) query.type = type;
    if (status) query.status = status;

    const transactions = await PaymentTransaction.find(query)
      .populate('relatedEntities.jobId', 'title')
      .populate('participants.payee.userId', 'firstName lastName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalTransactions = await PaymentTransaction.countDocuments(query);

    res.json({
      success: true,
      transactions,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalTransactions / parseInt(limit)),
        totalTransactions,
        hasNext: skip + transactions.length < totalTransactions,
        hasPrev: parseInt(page) > 1
      }
    });
  })
);

// @route   GET /api/billing/employer/ngo-contributions
// @desc    Get NGO contribution transparency report
// @access  Private (Employers only)
router.get('/ngo-contributions',
  authenticateToken,
  requireRole(['client', 'employer']),
  asyncHandler(async (req, res) => {
    const { year = new Date().getFullYear() } = req.query;

    const transactions = await PaymentTransaction.find({
      'participants.payer.userId': req.user._id,
      'chaseWhiteRabbitNGO.transparencyTracked': true,
      createdAt: {
        $gte: new Date(`${year}-01-01`),
        $lte: new Date(`${year}-12-31`)
      }
    });

    const totalContributions = transactions.reduce((sum, t) => 
      sum + (t.chaseWhiteRabbitNGO?.donationAmount || 0), 0
    );

    const contributionsByType = transactions.reduce((acc, t) => {
      const type = t.type;
      if (!acc[type]) acc[type] = 0;
      acc[type] += t.chaseWhiteRabbitNGO?.donationAmount || 0;
      return acc;
    }, {});

    const monthlyBreakdown = transactions.reduce((acc, t) => {
      const month = t.createdAt.getMonth() + 1;
      if (!acc[month]) acc[month] = 0;
      acc[month] += t.chaseWhiteRabbitNGO?.donationAmount || 0;
      return acc;
    }, {});

    res.json({
      success: true,
      ngoContributions: {
        year: parseInt(year),
        totalContributions,
        contributionsByType,
        monthlyBreakdown,
        impactStatement: {
          workerSafety: totalContributions * 0.4,
          trainingPrograms: totalContributions * 0.3,
          communitySupport: totalContributions * 0.2,
          operations: totalContributions * 0.1
        },
        transparencyNote: 'ChaseWhiteRabbit NGO uses these contributions to improve worker safety, provide training programs, and support the rigger community.'
      }
    });
  })
);

module.exports = router;
