const express = require('express');
const { query, validationResult } = require('express-validator');
const { authenticateToken, requireRole } = require('../../middleware/auth');
const { asyncHandler, AppError } = require('../../middleware/errorHandler');
const BillingService = require('../../services/payment/BillingService');
const { PaymentTransaction, EarningSummary, Invoice } = require('../../models/payment/PaymentModels');

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

// @route   GET /api/billing/worker/earnings-dashboard
// @desc    Get worker earnings dashboard
// @access  Private (Workers only)
router.get('/earnings-dashboard',
  authenticateToken,
  requireRole(['rigger', 'worker']),
  asyncHandler(async (req, res) => {
    const { period = 'monthly' } = req.query;
    
    const earningsReport = await BillingService.generateWorkerEarningsReport(req.user._id, period);
    
    if (!earningsReport.success) {
      throw new AppError('Failed to retrieve earnings data', 500, 'Earnings Error');
    }

    // Get recent transactions
    const recentTransactions = await PaymentTransaction.find({
      'participants.payee.userId': req.user._id,
      status: 'completed'
    })
    .populate('relatedEntities.jobId', 'title')
    .populate('participants.payer.userId', 'firstName lastName clientProfile.companyName')
    .sort({ createdAt: -1 })
    .limit(5);

    // Get pending payments
    const pendingPayments = await PaymentTransaction.find({
      'participants.payee.userId': req.user._id,
      status: { $in: ['pending', 'processing'] }
    })
    .populate('relatedEntities.jobId', 'title')
    .populate('participants.payer.userId', 'firstName lastName clientProfile.companyName')
    .sort({ createdAt: -1 });

    res.json({
      success: true,
      dashboard: {
        period,
        summary: earningsReport.report.summary,
        periodData: earningsReport.report.periodData,
        recentTransactions: recentTransactions.slice(0, 5),
        pendingPayments,
        taxInfo: earningsReport.report.taxInfo
      }
    });
  })
);

// @route   GET /api/billing/worker/earnings-summary
// @desc    Get detailed earnings summary
// @access  Private (Workers only)
router.get('/earnings-summary',
  authenticateToken,
  requireRole(['rigger', 'worker']),
  [
    query('year').optional().isInt({ min: 2020, max: 2030 }).withMessage('Invalid year'),
    query('month').optional().isInt({ min: 1, max: 12 }).withMessage('Invalid month')
  ],
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { year, month } = req.query;
    
    let earningSummary = await EarningSummary.findOne({ workerId: req.user._id })
      .populate('workerId', 'firstName lastName email');

    if (!earningSummary) {
      // Create initial earning summary if it doesn't exist
      earningSummary = new EarningSummary({ workerId: req.user._id });
      await earningSummary.save();
    }

    let filteredData = earningSummary;

    // Filter by specific year/month if requested
    if (year || month) {
      const currentYear = year || new Date().getFullYear();
      
      if (month) {
        filteredData.monthly = earningSummary.monthly.filter(m => 
          m.year === parseInt(currentYear) && m.month === parseInt(month)
        );
      } else {
        filteredData.monthly = earningSummary.monthly.filter(m => 
          m.year === parseInt(currentYear)
        );
        filteredData.yearly = earningSummary.yearly.filter(y => 
          y.year === parseInt(currentYear)
        );
      }
    }

    res.json({
      success: true,
      earnings: filteredData
    });
  })
);

// @route   GET /api/billing/worker/payment-history
// @desc    Get worker payment transaction history
// @access  Private (Workers only)
router.get('/payment-history',
  authenticateToken,
  requireRole(['rigger', 'worker']),
  [
    query('status').optional().isIn(['pending', 'processing', 'completed', 'failed', 'cancelled']).withMessage('Invalid status'),
    query('type').optional().isIn(['job_payment', 'bonus', 'tip', 'refund']).withMessage('Invalid transaction type'),
    query('startDate').optional().isISO8601().withMessage('Invalid start date'),
    query('endDate').optional().isISO8601().withMessage('Invalid end date'),
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be positive integer'),
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1-50')
  ],
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { status, type, startDate, endDate, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    let query = { 'participants.payee.userId': req.user._id };
    
    if (status) query.status = status;
    if (type) query.type = type;
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const transactions = await PaymentTransaction.find(query)
      .populate('relatedEntities.jobId', 'title description')
      .populate('participants.payer.userId', 'firstName lastName clientProfile.companyName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalTransactions = await PaymentTransaction.countDocuments(query);

    // Calculate summary for the filtered results
    const summary = {
      totalEarnings: transactions.filter(t => t.status === 'completed').reduce((sum, t) => sum + t.netAmount, 0),
      totalTransactions: transactions.length,
      pendingAmount: transactions.filter(t => t.status === 'pending').reduce((sum, t) => sum + t.netAmount, 0),
      completedCount: transactions.filter(t => t.status === 'completed').length
    };

    res.json({
      success: true,
      transactions,
      summary,
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

// @route   GET /api/billing/worker/invoices
// @desc    Get worker-generated invoices (for contractors)
// @access  Private (Workers only)
router.get('/invoices',
  authenticateToken,
  requireRole(['rigger', 'worker']),
  [
    query('status').optional().isIn(['draft', 'sent', 'paid', 'overdue', 'cancelled']).withMessage('Invalid status'),
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be positive integer'),
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1-50')
  ],
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { status, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // For workers, we look for invoices where they are the service provider
    let query = { 
      type: 'job_fee',
      // This would need to be adjusted based on how worker invoices are tracked
      'metadata.workerId': req.user._id 
    };
    
    if (status) query.status = status;

    const invoices = await Invoice.find(query)
      .populate('userId', 'firstName lastName clientProfile.companyName')
      .sort({ 'dates.issued': -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalInvoices = await Invoice.countDocuments(query);

    const summary = {
      totalBilled: invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + i.amounts.total, 0),
      outstanding: invoices.filter(i => i.status === 'sent').reduce((sum, i) => sum + i.amounts.total, 0),
      overdue: invoices.filter(i => i.status === 'overdue').length
    };

    res.json({
      success: true,
      invoices,
      summary,
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

// @route   GET /api/billing/worker/tax-documents
// @desc    Get tax-related documents and summaries
// @access  Private (Workers only)
router.get('/tax-documents',
  authenticateToken,
  requireRole(['rigger', 'worker']),
  [
    query('year').optional().isInt({ min: 2020, max: 2030 }).withMessage('Invalid year')
  ],
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { year = new Date().getFullYear() } = req.query;

    const earningSummary = await EarningSummary.findOne({ workerId: req.user._id });
    
    if (!earningSummary) {
      return res.json({
        success: true,
        taxDocuments: {
          year: parseInt(year),
          totalEarnings: 0,
          requires1099: false,
          documents: []
        }
      });
    }

    // Get transactions for the tax year
    const yearTransactions = await PaymentTransaction.find({
      'participants.payee.userId': req.user._id,
      status: 'completed',
      createdAt: {
        $gte: new Date(`${year}-01-01`),
        $lte: new Date(`${year}-12-31`)
      }
    }).populate('participants.payer.userId', 'firstName lastName clientProfile.companyName');

    const totalEarnings = yearTransactions.reduce((sum, t) => sum + t.netAmount, 0);
    const requires1099 = totalEarnings >= (earningSummary.taxInfo?.tax1099Threshold || 600);

    // Group earnings by payer for 1099 purposes
    const earningsByPayer = yearTransactions.reduce((acc, t) => {
      const payerInfo = t.participants.payer.userId;
      const payerId = payerInfo._id.toString();
      
      if (!acc[payerId]) {
        acc[payerId] = {
          payer: payerInfo,
          totalPaid: 0,
          transactionCount: 0
        };
      }
      
      acc[payerId].totalPaid += t.netAmount;
      acc[payerId].transactionCount += 1;
      
      return acc;
    }, {});

    // Filter payers who paid more than $600 (1099 threshold)
    const significant1099Payers = Object.values(earningsByPayer)
      .filter(payer => payer.totalPaid >= (earningSummary.taxInfo?.tax1099Threshold || 600));

    res.json({
      success: true,
      taxDocuments: {
        year: parseInt(year),
        totalEarnings,
        requires1099,
        threshold1099: earningSummary.taxInfo?.tax1099Threshold || 600,
        earningsByPayer: Object.values(earningsByPayer),
        significant1099Payers,
        taxInfo: earningSummary.taxInfo,
        summary: {
          totalTransactions: yearTransactions.length,
          averageJobValue: yearTransactions.length > 0 ? totalEarnings / yearTransactions.length : 0,
          largestPayment: Math.max(...yearTransactions.map(t => t.netAmount), 0)
        }
      }
    });
  })
);

// @route   GET /api/billing/worker/earnings-analytics
// @desc    Get detailed earnings analytics and trends
// @access  Private (Workers only)
router.get('/earnings-analytics',
  authenticateToken,
  requireRole(['rigger', 'worker']),
  asyncHandler(async (req, res) => {
    const { months = 12 } = req.query;
    
    const earningSummary = await EarningSummary.findOne({ workerId: req.user._id });
    
    if (!earningSummary) {
      return res.json({
        success: true,
        analytics: {
          trends: [],
          projections: {},
          insights: []
        }
      });
    }

    // Get recent months data for trend analysis
    const currentDate = new Date();
    const recentMonths = earningSummary.monthly
      .filter(m => {
        const monthDate = new Date(m.year, m.month - 1);
        const monthsAgo = new Date();
        monthsAgo.setMonth(monthsAgo.getMonth() - parseInt(months));
        return monthDate >= monthsAgo;
      })
      .sort((a, b) => new Date(a.year, a.month - 1) - new Date(b.year, b.month - 1));

    // Calculate trends
    const earningsTrend = recentMonths.map((month, index) => ({
      period: `${month.year}-${month.month.toString().padStart(2, '0')}`,
      earnings: month.earnings,
      jobs: month.jobs,
      hours: month.hours,
      averageHourlyRate: month.hours > 0 ? month.earnings / month.hours : 0,
      growthRate: index > 0 ? ((month.earnings - recentMonths[index - 1].earnings) / recentMonths[index - 1].earnings * 100) : 0
    }));

    // Calculate projections
    const avgMonthlyEarnings = recentMonths.reduce((sum, m) => sum + m.earnings, 0) / Math.max(recentMonths.length, 1);
    const projections = {
      nextMonth: avgMonthlyEarnings,
      nextQuarter: avgMonthlyEarnings * 3,
      nextYear: avgMonthlyEarnings * 12
    };

    // Generate insights
    const insights = [];
    
    if (recentMonths.length >= 2) {
      const lastMonth = recentMonths[recentMonths.length - 1];
      const previousMonth = recentMonths[recentMonths.length - 2];
      
      if (lastMonth.earnings > previousMonth.earnings) {
        insights.push({
          type: 'positive',
          message: `Your earnings increased by ${((lastMonth.earnings - previousMonth.earnings) / previousMonth.earnings * 100).toFixed(1)}% last month`
        });
      }
      
      if (lastMonth.hours > 0 && previousMonth.hours > 0) {
        const currentRate = lastMonth.earnings / lastMonth.hours;
        const previousRate = previousMonth.earnings / previousMonth.hours;
        
        if (currentRate > previousRate) {
          insights.push({
            type: 'positive',
            message: `Your hourly rate improved by $${(currentRate - previousRate).toFixed(2)} last month`
          });
        }
      }
    }

    res.json({
      success: true,
      analytics: {
        trends: earningsTrend,
        projections,
        insights,
        summary: earningSummary.summary
      }
    });
  })
);

module.exports = router;
