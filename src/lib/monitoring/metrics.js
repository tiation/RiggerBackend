const { logger } = require('../logging/logger');

class BackendMetrics {
  constructor() {
    this.metrics = new Map();
    this.counters = new Map();
    this.histograms = new Map();
    this.flushInterval = 30000; // 30 seconds
    this.isEnabled = process.env.NODE_ENV !== 'test';
    
    if (this.isEnabled) {
      this.startFlushTimer();
    }
  }

  // Counter metrics (incrementing values)
  incrementCounter(name, labels = {}, value = 1) {
    if (!this.isEnabled) return;
    
    const key = this.createKey(name, labels);
    const current = this.counters.get(key) || 0;
    this.counters.set(key, current + value);
    
    logger.debug('Counter incremented', { name, labels, value, total: current + value });
  }

  // Gauge metrics (current value)
  setGauge(name, value, labels = {}) {
    if (!this.isEnabled) return;
    
    const key = this.createKey(name, labels);
    this.metrics.set(key, {
      type: 'gauge',
      name,
      value,
      labels,
      timestamp: Date.now(),
    });
    
    logger.debug('Gauge set', { name, value, labels });
  }

  // Histogram metrics (for tracking distributions)
  recordHistogram(name, value, labels = {}) {
    if (!this.isEnabled) return;
    
    const key = this.createKey(name, labels);
    const histogram = this.histograms.get(key) || {
      name,
      labels,
      values: [],
      count: 0,
      sum: 0,
    };
    
    histogram.values.push(value);
    histogram.count += 1;
    histogram.sum += value;
    histogram.timestamp = Date.now();
    
    this.histograms.set(key, histogram);
    
    logger.debug('Histogram recorded', { name, value, labels, count: histogram.count });
  }

  // Business-specific metrics
  recordApiRequest(method, endpoint, statusCode, duration, userId = null) {
    this.incrementCounter('api_requests_total', {
      method,
      endpoint: this.sanitizeEndpoint(endpoint),
      status_code: statusCode.toString(),
    });
    
    this.recordHistogram('api_request_duration_ms', duration, {
      method,
      endpoint: this.sanitizeEndpoint(endpoint),
    });

    if (statusCode >= 400) {
      this.incrementCounter('api_errors_total', {
        method,
        endpoint: this.sanitizeEndpoint(endpoint),
        status_code: statusCode.toString(),
      });
    }

    if (userId) {
      this.incrementCounter('user_requests_total', { user_id: userId });
    }
  }

  recordDatabaseQuery(operation, table, duration, rowsAffected = 0) {
    this.incrementCounter('database_queries_total', {
      operation,
      table,
    });
    
    this.recordHistogram('database_query_duration_ms', duration, {
      operation,
      table,
    });

    if (rowsAffected > 0) {
      this.recordHistogram('database_rows_affected', rowsAffected, {
        operation,
        table,
      });
    }
  }

  recordUserAction(action, userId, success = true) {
    this.incrementCounter('user_actions_total', {
      action,
      success: success.toString(),
    });

    if (userId) {
      this.incrementCounter('user_activity_total', { user_id: userId });
    }
  }

  recordBusinessEvent(event, entity, entityId = null) {
    this.incrementCounter('business_events_total', {
      event,
      entity,
    });

    logger.businessEvent(event, entity, entityId);
  }

  // System metrics
  recordMemoryUsage() {
    const memoryUsage = process.memoryUsage();
    
    this.setGauge('memory_usage_bytes', memoryUsage.rss, { type: 'rss' });
    this.setGauge('memory_usage_bytes', memoryUsage.heapUsed, { type: 'heap_used' });
    this.setGauge('memory_usage_bytes', memoryUsage.heapTotal, { type: 'heap_total' });
    this.setGauge('memory_usage_bytes', memoryUsage.external, { type: 'external' });
  }

  recordCpuUsage() {
    const cpuUsage = process.cpuUsage();
    
    this.setGauge('cpu_usage_microseconds', cpuUsage.user, { type: 'user' });
    this.setGauge('cpu_usage_microseconds', cpuUsage.system, { type: 'system' });
  }

  recordActiveConnections(count) {
    this.setGauge('active_connections_total', count);
  }

  // Utility methods
  createKey(name, labels) {
    const labelString = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}="${value}"`)
      .join(',');
    
    return `${name}{${labelString}}`;
  }

  sanitizeEndpoint(endpoint) {
    // Replace dynamic segments with placeholders
    return endpoint
      .replace(/\/\d+/g, '/:id')
      .replace(/\/[a-f0-9-]{36}/g, '/:uuid')
      .replace(/\/[a-f0-9]{24}/g, '/:objectid');
  }

  // Export metrics in Prometheus format
  exportPrometheusMetrics() {
    const lines = [];
    
    // Export counters
    for (const [key, value] of this.counters.entries()) {
      const [name, labels] = this.parseKey(key);
      lines.push(`# TYPE ${name} counter`);
      lines.push(`${name}${labels} ${value}`);
    }
    
    // Export gauges
    for (const [key, metric] of this.metrics.entries()) {
      if (metric.type === 'gauge') {
        const labels = this.formatLabels(metric.labels);
        lines.push(`# TYPE ${metric.name} gauge`);
        lines.push(`${metric.name}${labels} ${metric.value}`);
      }
    }
    
    // Export histograms
    for (const [key, histogram] of this.histograms.entries()) {
      const labels = this.formatLabels(histogram.labels);
      const baseName = histogram.name;
      
      lines.push(`# TYPE ${baseName} histogram`);
      lines.push(`${baseName}_count${labels} ${histogram.count}`);
      lines.push(`${baseName}_sum${labels} ${histogram.sum}`);
      
      // Calculate percentiles
      const sortedValues = histogram.values.sort((a, b) => a - b);
      const percentiles = [0.5, 0.9, 0.95, 0.99];
      
      for (const percentile of percentiles) {
        const index = Math.ceil(percentile * sortedValues.length) - 1;
        const value = sortedValues[index] || 0;
        const quantileLabels = this.formatLabels({ ...histogram.labels, quantile: percentile });
        lines.push(`${baseName}${quantileLabels} ${value}`);
      }
    }
    
    return lines.join('\n');
  }

  parseKey(key) {
    const [name, labelString] = key.split('{');
    const labels = labelString ? `{${labelString}` : '';
    return [name, labels];
  }

  formatLabels(labels) {
    if (!labels || Object.keys(labels).length === 0) {
      return '';
    }
    
    const labelString = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}="${value}"`)
      .join(',');
    
    return `{${labelString}}`;
  }

  // Flush metrics to monitoring systems
  async flush() {
    if (!this.isEnabled) return;
    
    try {
      // Record system metrics
      this.recordMemoryUsage();
      this.recordCpuUsage();
      
      // Prepare metrics for export
      const prometheusMetrics = this.exportPrometheusMetrics();
      const metricsCount = this.counters.size + this.metrics.size + this.histograms.size;
      
      // Log metrics summary
      logger.info('Metrics flushed', {
        type: 'METRICS_FLUSH',
        metricsCount,
        counters: this.counters.size,
        gauges: Array.from(this.metrics.values()).filter(m => m.type === 'gauge').length,
        histograms: this.histograms.size,
        timestamp: new Date().toISOString(),
      });
      
      // In production, send to monitoring systems
      if (process.env.NODE_ENV === 'production') {
        await this.sendToMonitoringSystems(prometheusMetrics);
      }
      
      // Clear histograms after flush to prevent memory buildup
      this.histograms.clear();
      
    } catch (error) {
      logger.error('Failed to flush metrics', error);
    }
  }

  async sendToMonitoringSystems(prometheusMetrics) {
    // Integration points for external monitoring systems
    
    // Example: Send to Prometheus Push Gateway
    // if (process.env.PROMETHEUS_PUSHGATEWAY_URL) {
    //   await this.sendToPrometheusPushGateway(prometheusMetrics);
    // }
    
    // Example: Send to Grafana
    // if (process.env.GRAFANA_URL) {
    //   await this.sendToGrafana(prometheusMetrics);
    // }
    
    // Example: Send to ElasticSearch
    // if (process.env.ELASTICSEARCH_URL) {
    //   await this.sendToElasticSearch(prometheusMetrics);
    // }
    
    logger.debug('Metrics prepared for monitoring systems', {
      metricsSize: prometheusMetrics.length,
    });
  }

  startFlushTimer() {
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.flushInterval);
  }

  stopFlushTimer() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  // Get current metrics (for debugging/health checks)
  getCurrentMetrics() {
    return {
      counters: Object.fromEntries(this.counters),
      gauges: Array.from(this.metrics.values()).filter(m => m.type === 'gauge'),
      histograms: Array.from(this.histograms.values()).map(h => ({
        name: h.name,
        labels: h.labels,
        count: h.count,
        sum: h.sum,
        avg: h.count > 0 ? h.sum / h.count : 0,
      })),
    };
  }

  // Enable/disable metrics collection
  setEnabled(enabled) {
    this.isEnabled = enabled;
    if (enabled) {
      this.startFlushTimer();
    } else {
      this.stopFlushTimer();
    }
  }
}

// Singleton instance
const metrics = new BackendMetrics();

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, flushing metrics...');
  await metrics.flush();
  metrics.stopFlushTimer();
});

process.on('SIGINT', async () => {
  logger.info('Received SIGINT, flushing metrics...');
  await metrics.flush();
  metrics.stopFlushTimer();
});

module.exports = {
  metrics,
  BackendMetrics,
};
