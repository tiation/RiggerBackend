# RiggerBackend Payment and Billing System

A comprehensive payment processing and billing management system with integrated NGO transparency tracking for ChaseWhiteRabbit NGO.

## Features Implemented

### 🏢 Employer-Focused Billing Interface (RiggerConnect)

**Subscription Management:**
- Multiple subscription tiers (Basic, Professional, Enterprise)
- Monthly, quarterly, and yearly billing cycles
- Automatic renewal with Stripe integration
- Usage tracking and limits

**Recruitment Fee Processing:**
- Automated fee calculation with platform charges
- Transparent fee breakdown showing NGO contributions
- Real-time payment processing with Stripe

**Billing Dashboard:**
- Comprehensive spending analytics
- Transaction history with detailed filtering
- Invoice management and download
- NGO contribution transparency report

### 💰 Worker Earnings Platform (RiggerHub)

**Earnings Management:**
- Real-time earnings tracking and summaries
- Monthly, quarterly, and yearly earning reports
- Tax document generation (1099 preparation)
- Payment method management

**Analytics and Insights:**
- Earnings trend analysis with growth projections
- Hourly rate tracking and optimization suggestions
- Job completion analytics
- Payment history with detailed transaction logs

### 🏛️ NGO Transparency System (ChaseWhiteRabbit)

**Public Transparency Dashboard:**
- Real-time funding allocation display (40% Safety, 30% Training, 20% Community, 10% Operations)
- Impact metrics and success stories
- Monthly and quarterly contribution reports
- Public audit trail and compliance information

**Automated Contribution Tracking:**
- 0.5% of all transactions automatically allocated to NGO
- Real-time contribution processing
- Impact measurement and reporting
- Compliance with non-profit transparency requirements

## API Endpoints

### Employer Billing Routes
```
GET    /api/billing/employer/dashboard           - Billing dashboard overview
POST   /api/billing/employer/subscription       - Create/update subscription
GET    /api/billing/employer/subscriptions      - List all subscriptions
PUT    /api/billing/employer/subscription/:id   - Modify subscription
POST   /api/billing/employer/recruitment-fee    - Process recruitment payment
GET    /api/billing/employer/invoices          - List invoices with filtering
GET    /api/billing/employer/invoice/:id       - Get specific invoice
GET    /api/billing/employer/transactions      - Transaction history
GET    /api/billing/employer/ngo-contributions - NGO contribution report
```

### Worker Earnings Routes
```
GET    /api/billing/worker/earnings-dashboard   - Earnings overview dashboard
GET    /api/billing/worker/earnings-summary     - Detailed earnings breakdown
GET    /api/billing/worker/payment-history     - Payment transaction history
GET    /api/billing/worker/invoices            - Worker-generated invoices
GET    /api/billing/worker/tax-documents       - Tax-related documents and 1099s
GET    /api/billing/worker/earnings-analytics  - Advanced analytics and trends
```

### NGO Transparency Routes (Public Access)
```
GET    /api/transparency/dashboard             - Public transparency dashboard
GET    /api/transparency/report/:year          - Annual transparency report
GET    /api/transparency/monthly/:year/:month  - Monthly contribution report
GET    /api/transparency/impact-metrics        - Current impact metrics
GET    /api/transparency/contribution-sources  - Contribution source breakdown
GET    /api/transparency/validation            - Audit validation report
GET    /api/transparency/public-reports        - List of published reports
GET    /api/transparency/certifications        - NGO certifications and compliance
```

## Database Models

### PaymentTransaction
Comprehensive transaction tracking with:
- Multi-party support (payer, payee, platform)
- Fee breakdown and NGO contribution tracking
- Compliance and fraud detection fields
- Automatic ChaseWhiteRabbit NGO contribution calculation

### Subscription
Subscription management with:
- Flexible pricing and billing intervals
- Usage tracking and limits
- Discount and promo code support
- Automatic renewal handling

### Invoice
Professional invoicing system with:
- Multi-item support with tax calculations
- NGO contribution transparency notes
- Automatic numbering and tracking
- Payment status management

### EarningSummary
Worker earnings aggregation with:
- Monthly and yearly breakdowns
- Tax information and 1099 threshold tracking
- Payment method verification
- Performance analytics

### NGOTransparency
Public transparency tracking with:
- Quarterly and annual reporting
- Impact allocation and measurement
- Public report publishing
- Audit trail maintenance

## Payment Processing

### Stripe Integration
- Secure payment processing with PCI compliance
- Support for credit cards, bank transfers, and digital wallets
- Automatic retry logic for failed payments
- Webhook handling for real-time updates

### Platform Fees
- Configurable fee structure by transaction type:
  - Job payments: 3% platform fee
  - Recruitment fees: 5% platform fee
  - Subscriptions: No additional fees
- Automatic NGO contribution: 0.5% of all transactions

### Security Features
- Fraud detection and risk assessment
- AML (Anti-Money Laundering) compliance checks
- Transaction monitoring and alerting
- Secure tokenization of payment methods

## NGO Transparency Implementation

### Automated Contribution Tracking
Every transaction automatically:
1. Calculates 0.5% NGO contribution
2. Creates NGOTransparency record
3. Updates impact allocation tracking
4. Generates public transparency data

### Impact Allocation (ChaseWhiteRabbit NGO)
- **40% Worker Safety**: Training programs, safety equipment, incident prevention
- **30% Training Programs**: Skills development, certifications, career advancement
- **20% Community Support**: Family assistance, emergency support, community events
- **10% Operations**: Administrative costs, technology, infrastructure

### Public Accountability
- Real-time public dashboard showing all contributions
- Monthly and quarterly transparency reports
- Independent audit trails and validation
- Compliance with 501(c)(3) requirements

## Installation and Setup

### Environment Variables
```bash
# Payment Processing
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...

# Database
MONGODB_URI=mongodb://localhost:27017/riggerhire

# NGO Configuration
NGO_CONTRIBUTION_RATE=0.005  # 0.5%
NGO_NAME=ChaseWhiteRabbit
```

### Database Initialization
```bash
# Create indexes for optimal performance
node scripts/create-payment-indexes.js

# Initialize NGO transparency tracking
node scripts/initialize-ngo-tracking.js
```

## Usage Examples

### Processing a Recruitment Fee
```javascript
const result = await BillingService.processRecruitmentFee(
  employerId,
  jobId,
  250.00,  // Recruitment fee amount
  paymentMethodId
);
```

### Updating Worker Earnings
```javascript
const earningsUpdate = await BillingService.updateWorkerEarnings(
  workerId,
  {
    amount: 800.00,
    hours: 40,
    jobId: jobId
  }
);
```

### Generating NGO Report
```javascript
const report = await NGOTransparencyService.generateTransparencyReport(2024);
```

## Monitoring and Analytics

### Business Metrics Tracked
- Transaction volume and success rates
- Platform fee collection
- NGO contribution accuracy
- User engagement with billing features
- Payment method preferences

### Compliance Monitoring
- AML flag detection and reporting
- Tax reporting thresholds (1099)
- NGO contribution validation
- Audit trail completeness

## Security and Compliance

### Data Protection
- PCI DSS compliance for payment data
- Encryption of sensitive financial information
- Secure API endpoints with authentication
- Regular security audits and penetration testing

### Financial Compliance
- SOX compliance for financial reporting
- NGO transparency requirements (IRS Form 990)
- State and federal tax reporting
- Anti-fraud measures and monitoring

## Future Enhancements

### Planned Features
- Multi-currency support
- Advanced payment analytics
- Automated tax filing integration
- Enhanced fraud detection with ML
- Mobile payment SDKs
- Cryptocurrency payment options

### NGO Expansion
- Real-time impact measurement
- Donor portal for additional contributions
- Grant management system
- Volunteer hour tracking
- Community impact visualization

## Support and Documentation

### API Documentation
- Full OpenAPI/Swagger documentation available at `/api/docs`
- Postman collection for testing
- Code examples in multiple languages

### Support Channels
- Technical support: dev@riggerhire.com
- Billing inquiries: billing@riggerhire.com
- NGO transparency: transparency@chasewhiterabbit.org

---

This comprehensive payment and billing system provides enterprise-grade financial management while maintaining transparency and supporting the ChaseWhiteRabbit NGO's mission to improve worker safety and community support in the rigging industry.
