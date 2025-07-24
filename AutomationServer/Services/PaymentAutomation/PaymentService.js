const { PaymentTransaction, EarningSummary } = require('../../../models/payment/PaymentModels');
const { createPaymentIntent, capturePaymentIntent, trackNGOContribution } = require('../../../services/payment/StripeService');
const BillingService = require('../../../services/payment/BillingService');
const Job = require('../../../models/Job');

class PaymentAutomationService {
  
  // Automatically process job completion payments
  static async processJobCompletionPayment(jobId) {
    try {
      const job = await Job.findById(jobId)
        .populate('postedBy')
        .populate('assignedTo');
        
      if (!job || job.status !== 'completed') {
        throw new Error('Job not found or not completed');
      }
      
      if (job.paymentStatus === 'paid') {
        return { success: false, error: 'Payment already processed' };
      }
      
      const paymentAmount = (job.completionDetails?.actualHours || job.duration.estimatedHours) * job.hourlyRate;
      const platformFees = BillingService.calculatePlatformFees(paymentAmount, 'job_payment');
      
      // Create payment transaction record
      const transaction = new PaymentTransaction({
        transactionId: `job_${jobId}_${Date.now()}`,
        type: 'job_payment',
        amount: paymentAmount,
        netAmount: platformFees.netAmount,
        fees: {
          platform: platformFees.platformFee,
          processor: 0,
          total: platformFees.totalFees
        },
        participants: {
          payer: {
            userId: job.postedBy._id,
            email: job.postedBy.email,
            name: `${job.postedBy.firstName} ${job.postedBy.lastName}`
          },
          payee: {
            userId: job.assignedTo._id,
            email: job.assignedTo.email,
            name: `${job.assignedTo.firstName} ${job.assignedTo.lastName}`
          }
        },
        relatedEntities: { jobId },
        chaseWhiteRabbitNGO: {
          donationPercentage: 0.005,
          donationAmount: platformFees.ngoContribution,
          transparencyTracked: true
        }
      });
      
      await transaction.save();
      
      // Update job payment status
      job.paymentStatus = 'processing';
      job.paymentDetails = {
        transactionId: transaction._id,
        amount: paymentAmount,
        netAmount: platformFees.netAmount,
        platformFee: platformFees.platformFee,
        ngoContribution: platformFees.ngoContribution,
        processedAt: new Date()
      };
      await job.save();
      
      // Update worker earnings
      await BillingService.updateWorkerEarnings(job.assignedTo._id, {
        amount: platformFees.netAmount,
        hours: job.completionDetails?.actualHours || job.duration.estimatedHours
      });
      
      // Track NGO contribution
      await trackNGOContribution(paymentAmount, 'job_payment', transaction._id);
      
      return {
        success: true,
        transaction,
        jobUpdated: job
      };
      
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  
  // Automatically handle subscription renewals
  static async processSubscriptionRenewal(subscriptionId) {
    try {
      const { Subscription } = require('../../../models/payment/PaymentModels');
      
      const subscription = await Subscription.findById(subscriptionId)
        .populate('userId')
        .populate('paymentMethod');
        
      if (!subscription || subscription.status !== 'active') {
        return { success: false, error: 'Subscription not found or inactive' };
      }
      
      // Check if renewal is due
      const now = new Date();
      if (now < subscription.dates.currentPeriodEnd) {
        return { success: false, error: 'Renewal not yet due' };
      }
      
      // Create payment intent for renewal
      const paymentResult = await createPaymentIntent(
        subscription.pricing.amount,
        subscription.pricing.currency,
        {
          subscriptionId: subscription._id,
          userId: subscription.userId._id,
          type: 'subscription_renewal'
        }
      );
      
      if (!paymentResult.success) {
        subscription.status = 'past_due';
        await subscription.save();
        return { success: false, error: 'Payment failed' };
      }
      
      // Update subscription period
      const intervalDays = {
        monthly: 30,
        quarterly: 90,
        yearly: 365
      };
      
      const days = intervalDays[subscription.pricing.interval] || 30;
      subscription.dates.currentPeriodStart = subscription.dates.currentPeriodEnd;
      subscription.dates.currentPeriodEnd = new Date(subscription.dates.currentPeriodEnd.getTime() + (days * 24 * 60 * 60 * 1000));
      subscription.usage.currentPeriodJobs = 0;
      subscription.usage.currentPeriodConnections = 0;
      
      await subscription.save();
      
      // Create transaction record
      const transaction = new PaymentTransaction({
        transactionId: `sub_renewal_${subscriptionId}_${Date.now()}`,
        type: 'subscription',
        amount: subscription.pricing.amount,
        netAmount: subscription.pricing.amount * 0.995, // 0.5% to NGO
        participants: {
          payer: {
            userId: subscription.userId._id,
            email: subscription.userId.email,
            name: `${subscription.userId.firstName} ${subscription.userId.lastName}`
          }
        },
        relatedEntities: { subscriptionId },
        chaseWhiteRabbitNGO: {
          donationPercentage: 0.005,
          donationAmount: subscription.pricing.amount * 0.005,
          transparencyTracked: true
        }
      });
      
      await transaction.save();
      
      // Track NGO contribution
      await trackNGOContribution(subscription.pricing.amount, 'subscription', transaction._id);
      
      return {
        success: true,
        subscription,
        transaction
      };
      
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  
  // Monitor and flag suspicious payment activity
  static async monitorPaymentActivity(userId, transactionAmount) {
    try {
      const recentTransactions = await PaymentTransaction.find({
        $or: [
          { 'participants.payer.userId': userId },
          { 'participants.payee.userId': userId }
        ],
        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
      });
      
      const totalAmount = recentTransactions.reduce((sum, t) => sum + t.amount, 0);
      const transactionCount = recentTransactions.length;
      
      let riskLevel = 'low';
      let fraudScore = 0;
      
      // Risk assessment logic
      if (transactionAmount > 10000) fraudScore += 20;
      if (totalAmount > 50000) fraudScore += 30;
      if (transactionCount > 10) fraudScore += 25;
      
      // Check for rapid-fire transactions
      const rapidTransactions = recentTransactions.filter(t => {
        const timeDiff = Date.now() - t.createdAt.getTime();
        return timeDiff < (5 * 60 * 1000); // Within 5 minutes
      });
      
      if (rapidTransactions.length > 3) fraudScore += 35;
      
      if (fraudScore >= 70) riskLevel = 'critical';
      else if (fraudScore >= 50) riskLevel = 'high';
      else if (fraudScore >= 30) riskLevel = 'medium';
      
      return {
        riskLevel,
        fraudScore,
        flags: {
          highAmount: transactionAmount > 10000,
          highVolume: totalAmount > 50000,
          frequentTransactions: transactionCount > 10,
          rapidFire: rapidTransactions.length > 3
        },
        recommendations: fraudScore > 50 ? [
          'Manual review required',
          'Enhanced verification needed',
          'Consider transaction limits'
        ] : []
      };
      
    } catch (error) {
      return { riskLevel: 'unknown', error: error.message };
    }
  }
  
  // Generate automated payment reports
  static async generatePaymentReport(period = 'monthly') {
    try {
      const startDate = new Date();
      if (period === 'weekly') {
        startDate.setDate(startDate.getDate() - 7);
      } else if (period === 'monthly') {
        startDate.setMonth(startDate.getMonth() - 1);
      } else if (period === 'yearly') {
        startDate.setFullYear(startDate.getFullYear() - 1);
      }
      
      const transactions = await PaymentTransaction.find({
        createdAt: { $gte: startDate },
        status: 'completed'
      });
      
      const report = {
        period,
        dateRange: { start: startDate, end: new Date() },
        summary: {
          totalTransactions: transactions.length,
          totalVolume: transactions.reduce((sum, t) => sum + t.amount, 0),
          averageTransaction: transactions.length > 0 ? transactions.reduce((sum, t) => sum + t.amount, 0) / transactions.length : 0,
          platformFees: transactions.reduce((sum, t) => sum + (t.fees?.platform || 0), 0),
          ngoContributions: transactions.reduce((sum, t) => sum + (t.chaseWhiteRabbitNGO?.donationAmount || 0), 0)
        },
        breakdown: {
          byType: this.groupTransactionsByType(transactions),
          byStatus: this.groupTransactionsByStatus(transactions),
          topPayers: this.getTopPayers(transactions, 10),
          topPayees: this.getTopPayees(transactions, 10)
        }
      };
      
      return { success: true, report };
      
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  
  // Helper methods
  static groupTransactionsByType(transactions) {
    return transactions.reduce((acc, t) => {
      acc[t.type] = (acc[t.type] || 0) + t.amount;
      return acc;
    }, {});
  }
  
  static groupTransactionsByStatus(transactions) {
    return transactions.reduce((acc, t) => {
      acc[t.status] = (acc[t.status] || 0) + 1;
      return acc;
    }, {});
  }
  
  static getTopPayers(transactions, limit) {
    const payers = transactions.reduce((acc, t) => {
      if (t.participants?.payer?.userId) {
        const payerId = t.participants.payer.userId.toString();
        if (!acc[payerId]) {
          acc[payerId] = {
            userId: payerId,
            name: t.participants.payer.name,
            totalPaid: 0,
            transactionCount: 0
          };
        }
        acc[payerId].totalPaid += t.amount;
        acc[payerId].transactionCount += 1;
      }
      return acc;
    }, {});
    
    return Object.values(payers)
      .sort((a, b) => b.totalPaid - a.totalPaid)
      .slice(0, limit);
  }
  
  static getTopPayees(transactions, limit) {
    const payees = transactions.reduce((acc, t) => {
      if (t.participants?.payee?.userId) {
        const payeeId = t.participants.payee.userId.toString();
        if (!acc[payeeId]) {
          acc[payeeId] = {
            userId: payeeId,
            name: t.participants.payee.name,
            totalReceived: 0,
            transactionCount: 0
          };
        }
        acc[payeeId].totalReceived += t.netAmount;
        acc[payeeId].transactionCount += 1;
      }
      return acc;
    }, {});
    
    return Object.values(payees)
      .sort((a, b) => b.totalReceived - a.totalReceived)
      .slice(0, limit);
  }
}

module.exports = PaymentAutomationService;
