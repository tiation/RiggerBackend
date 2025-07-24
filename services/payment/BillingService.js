const { PaymentTransaction, Subscription, Invoice, PaymentMethod, EarningSummary } = require('../../models/payment/PaymentModels');
const { trackNGOContribution } = require('./StripeService');

class BillingService {
  
  // Process recruitment fee payment
  static async processRecruitmentFee(clientId, jobId, recruitmentAmount, paymentMethodId) {
    try {
      const platformFee = recruitmentAmount * 0.03; // 3% platform fee
      const ngoContribution = recruitmentAmount * 0.005; // 0.5% NGO contribution
      const netAmount = recruitmentAmount - platformFee - ngoContribution;

      const transaction = new PaymentTransaction({
        transactionId: `recruit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'recruitment_fee',
        amount: recruitmentAmount,
        netAmount: netAmount,
        fees: {
          platform: platformFee,
          processor: 0,
          total: platformFee
        },
        participants: {
          payer: { userId: clientId },
          platform: { feePercentage: 0.03 }
        },
        relatedEntities: { jobId },
        chaseWhiteRabbitNGO: {
          donationPercentage: 0.005,
          donationAmount: ngoContribution,
          transparencyTracked: true
        }
      });

      await transaction.save();
      
      // Track NGO contribution
      await trackNGOContribution(recruitmentAmount, 'recruitment_fee', transaction._id);
      
      return { success: true, transaction };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Create or update subscription billing
  static async createSubscriptionBilling(userId, plan, paymentMethodId) {
    try {
      const planPricing = this.getSubscriptionPlans()[plan.type];
      if (!planPricing) {
        throw new Error('Invalid subscription plan');
      }

      const subscription = new Subscription({
        subscriptionId: `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId,
        plan: {
          type: plan.type,
          name: planPricing.name,
          description: planPricing.description,
          features: planPricing.features
        },
        pricing: {
          amount: planPricing.amount,
          currency: 'USD',
          interval: plan.interval || 'monthly'
        },
        dates: {
          start: new Date(),
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + (30 * 24 * 60 * 60 * 1000)) // 30 days
        },
        paymentMethod: paymentMethodId
      });

      await subscription.save();
      
      // Create first invoice
      const invoice = await this.generateSubscriptionInvoice(subscription);
      
      return { success: true, subscription, invoice };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Generate invoice for subscription
  static async generateSubscriptionInvoice(subscription) {
    try {
      const invoiceNumber = `INV-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
      const ngoContribution = subscription.pricing.amount * 0.005;
      
      const invoice = new Invoice({
        invoiceNumber,
        userId: subscription.userId,
        type: 'subscription',
        items: [{
          description: `${subscription.plan.name} Subscription - ${subscription.pricing.interval}`,
          quantity: 1,
          unitPrice: subscription.pricing.amount,
          total: subscription.pricing.amount
        }],
        amounts: {
          subtotal: subscription.pricing.amount,
          total: subscription.pricing.amount,
          currency: subscription.pricing.currency
        },
        dates: {
          issued: new Date(),
          due: new Date(Date.now() + (7 * 24 * 60 * 60 * 1000)) // 7 days from now
        },
        chaseWhiteRabbitNGO: {
          contributionIncluded: true,
          contributionAmount: ngoContribution,
          transparencyNote: `0.5% of this payment supports ChaseWhiteRabbit NGO's worker safety and training programs`
        }
      });

      await invoice.save();
      return invoice;
    } catch (error) {
      throw new Error(`Failed to generate invoice: ${error.message}`);
    }
  }

  // Update worker earnings summary
  static async updateWorkerEarnings(workerId, jobPayment) {
    try {
      let earningSummary = await EarningSummary.findOne({ workerId });
      
      if (!earningSummary) {
        earningSummary = new EarningSummary({ workerId });
      }

      // Update summary totals
      earningSummary.summary.totalEarnings += jobPayment.amount;
      earningSummary.summary.totalJobs += 1;
      earningSummary.summary.averageJobValue = earningSummary.summary.totalEarnings / earningSummary.summary.totalJobs;
      
      if (jobPayment.hours) {
        earningSummary.summary.totalHours += jobPayment.hours;
        earningSummary.summary.averageHourlyRate = earningSummary.summary.totalEarnings / earningSummary.summary.totalHours;
      }

      // Update monthly summary
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();
      
      let monthlyRecord = earningSummary.monthly.find(m => m.year === currentYear && m.month === currentMonth);
      if (!monthlyRecord) {
        monthlyRecord = { year: currentYear, month: currentMonth, earnings: 0, jobs: 0, hours: 0 };
        earningSummary.monthly.push(monthlyRecord);
      }
      
      monthlyRecord.earnings += jobPayment.amount;
      monthlyRecord.jobs += 1;
      if (jobPayment.hours) monthlyRecord.hours += jobPayment.hours;
      monthlyRecord.lastUpdated = new Date();

      // Update yearly summary
      let yearlyRecord = earningSummary.yearly.find(y => y.year === currentYear);
      if (!yearlyRecord) {
        yearlyRecord = { year: currentYear, earnings: 0, jobs: 0, hours: 0 };
        earningSummary.yearly.push(yearlyRecord);
      }
      
      yearlyRecord.earnings += jobPayment.amount;
      yearlyRecord.jobs += 1;
      if (jobPayment.hours) yearlyRecord.hours += jobPayment.hours;
      yearlyRecord.lastUpdated = new Date();

      await earningSummary.save();
      return { success: true, earningSummary };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Get subscription plans
  static getSubscriptionPlans() {
    return {
      basic: {
        name: 'Basic Plan',
        description: 'Essential features for individual riggers',
        amount: 29.99,
        features: ['Basic job matching', 'Profile creation', 'Basic safety resources']
      },
      professional: {
        name: 'Professional Plan', 
        description: 'Advanced features for experienced riggers',
        amount: 79.99,
        features: ['Advanced job matching', 'Premium profile', 'Priority support', 'Certification tracking']
      },
      enterprise: {
        name: 'Enterprise Plan',
        description: 'Full-featured plan for companies',
        amount: 199.99,
        features: ['Unlimited job postings', 'Team management', 'Advanced analytics', 'Custom integrations']
      },
      rigger_premium: {
        name: 'Rigger Premium',
        description: 'Premium features for professional riggers',
        amount: 49.99,
        features: ['Priority job visibility', 'Enhanced safety tools', 'Training resources', 'Earnings analytics']
      }
    };
  }

  // Calculate platform fees based on transaction type
  static calculatePlatformFees(amount, transactionType) {
    const feeStructure = {
      job_payment: 0.03, // 3%
      recruitment_fee: 0.05, // 5%
      subscription: 0.0, // No additional fees for subscriptions
      platform_fee: 0.0 // Pure platform fee
    };

    const feePercentage = feeStructure[transactionType] || 0.03;
    const platformFee = amount * feePercentage;
    const ngoContribution = amount * 0.005; // 0.5% to NGO
    
    return {
      platformFee,
      ngoContribution,
      totalFees: platformFee + ngoContribution,
      netAmount: amount - platformFee - ngoContribution
    };
  }

  // Generate earnings report for workers
  static async generateWorkerEarningsReport(workerId, period = 'monthly') {
    try {
      const earningSummary = await EarningSummary.findOne({ workerId }).populate('workerId', 'firstName lastName email');
      
      if (!earningSummary) {
        return { success: false, error: 'No earnings data found' };
      }

      let periodData;
      if (period === 'monthly') {
        periodData = earningSummary.monthly;
      } else if (period === 'yearly') {
        periodData = earningSummary.yearly;
      } else {
        periodData = [earningSummary.summary];
      }

      const report = {
        worker: earningSummary.workerId,
        summary: earningSummary.summary,
        periodData,
        taxInfo: earningSummary.taxInfo,
        generatedAt: new Date()
      };

      return { success: true, report };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Generate employer billing summary
  static async generateEmployerBillingSummary(employerId, period = 'monthly') {
    try {
      const startDate = new Date();
      if (period === 'monthly') {
        startDate.setMonth(startDate.getMonth() - 1);
      } else if (period === 'yearly') {
        startDate.setFullYear(startDate.getFullYear() - 1);
      }

      const transactions = await PaymentTransaction.find({
        'participants.payer.userId': employerId,
        createdAt: { $gte: startDate }
      }).populate('relatedEntities.jobId');

      const subscriptions = await Subscription.find({
        userId: employerId,
        status: 'active'
      });

      const invoices = await Invoice.find({
        userId: employerId,
        'dates.issued': { $gte: startDate }
      });

      const summary = {
        totalSpent: transactions.reduce((sum, t) => sum + t.amount, 0),
        totalTransactions: transactions.length,
        activeSubscriptions: subscriptions.length,
        monthlySubscriptionCost: subscriptions.reduce((sum, s) => sum + s.pricing.amount, 0),
        outstandingInvoices: invoices.filter(i => i.status !== 'paid').length,
        ngoContributions: transactions.reduce((sum, t) => sum + (t.chaseWhiteRabbitNGO?.donationAmount || 0), 0)
      };

      return { success: true, summary, transactions, subscriptions, invoices };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = BillingService;
