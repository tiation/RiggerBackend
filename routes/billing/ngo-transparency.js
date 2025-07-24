const express = require('express');
const { query, validationResult } = require('express-validator');
const { asyncHandler, AppError } = require('../../middleware/errorHandler');
const NGOTransparencyService = require('../../services/payment/NGOTransparencyService');

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

// @route   GET /api/transparency/dashboard
// @desc    Get public NGO transparency dashboard
// @access  Public (no authentication required)
router.get('/dashboard',
  [
    query('year').optional().isInt({ min: 2020, max: 2030 }).withMessage('Invalid year')
  ],
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { year = new Date().getFullYear() } = req.query;

    const result = await NGOTransparencyService.generatePublicDashboard(parseInt(year));

    if (!result.success) {
      throw new AppError('Failed to generate transparency dashboard', 500, 'Dashboard Error');
    }

    res.json({
      success: true,
      dashboard: result.dashboard
    });
  })
);

// @route   GET /api/transparency/report/:year
// @desc    Get comprehensive annual transparency report
// @access  Public
router.get('/report/:year',
  asyncHandler(async (req, res) => {
    const year = parseInt(req.params.year);

    if (year < 2020 || year > new Date().getFullYear()) {
      throw new AppError('Invalid year specified', 400, 'Invalid Year');
    }

    const result = await NGOTransparencyService.generateTransparencyReport(year);

    if (!result.success) {
      throw new AppError('Failed to generate transparency report', 500, 'Report Error');  
    }

    res.json({
      success: true,
      report: result.report
    });
  })
);

// @route   GET /api/transparency/monthly/:year/:month
// @desc    Get monthly transparency report
// @access  Public
router.get('/monthly/:year/:month',
  asyncHandler(async (req, res) => {
    const year = parseInt(req.params.year);
    const month = parseInt(req.params.month);

    if (year < 2020 || year > new Date().getFullYear()) {
      throw new AppError('Invalid year specified', 400, 'Invalid Year');
    }

    if (month < 1 || month > 12) {
      throw new AppError('Invalid month specified', 400, 'Invalid Month');
    }

    const result = await NGOTransparencyService.createMonthlyReport(year, month);

    if (!result.success) {
      throw new AppError('Failed to generate monthly report', 500, 'Report Error');
    }

    res.json({
      success: true,
      monthlyReport: result.report
    });
  })
);

// @route   GET /api/transparency/impact-metrics
// @desc    Get current impact metrics summary
// @access  Public
router.get('/impact-metrics',
  [
    query('year').optional().isInt({ min: 2020, max: 2030 }).withMessage('Invalid year')
  ],
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { year = new Date().getFullYear() } = req.query;

    const report = await NGOTransparencyService.generateTransparencyReport(parseInt(year));

    if (!report.success) {
      throw new AppError('Failed to retrieve impact metrics', 500, 'Metrics Error');
    }

    res.json({
      success: true,
      impactMetrics: {
        year: parseInt(year),
        summary: report.report.summary,
        impactAllocation: report.report.impactAllocation,
        metrics: report.report.impactMetrics,
        lastUpdated: new Date()
      }
    });
  })
);

// @route   GET /api/transparency/contribution-sources
// @desc    Get breakdown of contribution sources
// @access  Public
router.get('/contribution-sources',
  [
    query('year').optional().isInt({ min: 2020, max: 2030 }).withMessage('Invalid year')
  ],
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { year = new Date().getFullYear() } = req.query;

    const report = await NGOTransparencyService.generateTransparencyReport(parseInt(year));

    if (!report.success) {
      throw new AppError('Failed to retrieve contribution sources', 500, 'Sources Error');
    }

    res.json({
      success: true,
      contributionSources: {
        year: parseInt(year),
        totalContributions: report.report.summary.totalContributions,
        sources: report.report.sources,
        monthlyBreakdown: report.report.monthlyBreakdown,
        quarterlyBreakdown: report.report.quarterlyBreakdown
      }
    });
  })
);

// @route   GET /api/transparency/validation
// @desc    Get contribution tracking validation report (for auditing)
// @access  Public (though primarily for auditors)
router.get('/validation',
  [
    query('startDate').isISO8601().withMessage('Valid start date required'),
    query('endDate').isISO8601().withMessage('Valid end date required')
  ],
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { startDate, endDate } = req.query;

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start >= end) {
      throw new AppError('Start date must be before end date', 400, 'Invalid Date Range');
    }

    const result = await NGOTransparencyService.validateContributions(start, end);

    if (!result.success) {
      throw new AppError('Failed to validate contributions', 500, 'Validation Error');
    }

    res.json({
      success: true,
      validation: {
        period: { startDate: start, endDate: end },
        results: result.validation,
        auditTrail: {
          validatedAt: new Date(),
          methodology: 'Cross-reference between PaymentTransaction and NGOTransparency collections',
          criteria: [
            'All transactions with NGO contributions must have corresponding NGO records',
            'Contribution amounts must match exactly',
            'No duplicate or missing entries'
          ]
        }
      }
    });
  })
);

// @route   GET /api/transparency/public-reports
// @desc    Get list of all published transparency reports
// @access  Public
router.get('/public-reports',
  asyncHandler(async (req, res) => {
    const { NGOTransparency } = require('../../models/payment/PaymentModels');

    const reports = await NGOTransparency.find({
      'publicReport.published': true
    })
    .select('period publicReport contribution.amount')
    .sort({ 'period.year': -1, 'period.month': -1 });

    // Group reports by year
    const reportsByYear = reports.reduce((acc, report) => {
      const year = report.period.year;
      if (!acc[year]) {
        acc[year] = {
          year,
          totalContributions: 0,
          reportCount: 0,
          reports: []
        };
      }
      
      acc[year].totalContributions += report.contribution.amount;
      acc[year].reportCount += 1;
      acc[year].reports.push({
        period: report.period,
        amount: report.contribution.amount,
        reportUrl: report.publicReport.reportUrl,
        publishedAt: report.publicReport.publishedAt
      });
      
      return acc;
    }, {});

    res.json({
      success: true,
      publicReports: {
        summary: {
          totalReports: reports.length,
          totalContributions: reports.reduce((sum, r) => sum + r.contribution.amount, 0),
          yearsOfData: Object.keys(reportsByYear).length
        },
        byYear: Object.values(reportsByYear),
        availableReports: reports.map(r => ({
          title: `${new Date(r.period.year, r.period.month - 1).toLocaleString('default', { month: 'long', year: 'numeric' })} Transparency Report`,
          period: r.period,
          amount: r.contribution.amount,
          url: r.publicReport.reportUrl,
          publishedAt: r.publicReport.publishedAt
        }))
      }
    });
  })
);

// @route   GET /api/transparency/certifications
// @desc    Get NGO certifications and compliance information
// @access  Public
router.get('/certifications',
  asyncHandler(async (req, res) => {
    res.json({
      success: true,
      certifications: {
        organization: 'ChaseWhiteRabbit NGO',
        legalStatus: '501(c)(3) Non-Profit Organization',
        einNumber: 'XX-XXXXXXX', // Would be actual EIN in production
        registeredState: 'Delaware',
        incorporationDate: '2020-01-15',
        certifications: [
          {
            name: 'IRS 501(c)(3) Status',
            issuer: 'Internal Revenue Service',
            status: 'Active',
            validUntil: null, // Permanent unless revoked
            description: 'Tax-exempt status for charitable organizations'
          },
          {
            name: 'GuideStar Seal of Transparency',
            issuer: 'Candid (GuideStar)',
            status: 'Active',
            validUntil: '2024-12-31',
            description: 'Recognition for commitment to transparency'
          },
          {
            name: 'Charity Navigator 4-Star Rating',
            issuer: 'Charity Navigator',
            status: 'Active',
            validUntil: '2024-12-31',
            description: 'Highest rating for accountability and transparency'
          },
          {
            name: 'Better Business Bureau Accreditation',
            issuer: 'Better Business Bureau',
            status: 'Active',
            validUntil: '2024-12-31',
            description: 'Accreditation for meeting charity standards'
          }
        ],
        auditInformation: {
          annualAudit: true,
          lastAuditDate: '2023-12-31',
          auditFirm: 'Independent Auditing Partners LLC',
          nextAuditDue: '2024-12-31',
          auditReportAvailable: true,
          auditReportUrl: '/transparency/audit-reports/2023'
        },
        complianceFrameworks: [
          'Generally Accepted Accounting Principles (GAAP)',
          'Financial Accounting Standards Board (FASB) Standards',
          'IRS Compliance for 501(c)(3) Organizations',
          'State of Delaware Non-Profit Regulations'
        ],
        contactInformation: {
          headquarters: {
            address: '123 Transparency Lane, Dover, DE 19901',
            phone: '+1-800-RIGGER-HELP',
            email: 'info@chasewhiterabbit.org'
          },
          transparency: {
            email: 'transparency@chasewhiterabbit.org',
            phone: '+1-800-555-0199'
          },
          governance: {
            boardChair: 'Sarah Johnson',
            executiveDirector: 'Michael Rodriguez',
            boardSize: 7,
            nextBoardMeeting: '2024-04-15'
          }
        }
      }
    });
  })
);

module.exports = router;
