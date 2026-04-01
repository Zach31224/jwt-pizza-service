const os = require('os');
const config = require('./config.js');

const metricsConfig = config.metrics || {};

class Metrics {
  constructor() {
    this.source = metricsConfig.source || 'jwt-pizza-service';
    this.endpointUrl = metricsConfig.endpointUrl || '';
    this.accountId = metricsConfig.accountId || '';
    this.apiKey = metricsConfig.apiKey || '';

    this.httpCounts = { total: 0, GET: 0, POST: 0, PUT: 0, DELETE: 0 };
    this.authCounts = { success: 0, failure: 0 };
    this.purchase = { sold: 0, failures: 0, revenue: 0, totalLatencyMs: 0, samples: 0 };
    this.endpointLatency = {};
    this.activeUsers = new Set();

    this.systemTimer = null;
    this.sendTimer = null;
    this.metricBuffer = [];
  }

  requestTracker = (req, res, next) => {
    const start = Date.now();
    this.httpCounts.total += 1;
    if (this.httpCounts[req.method] !== undefined) {
      this.httpCounts[req.method] += 1;
    }

    res.on('finish', () => {
      const latencyMs = Date.now() - start;
      const endpoint = `${req.method} ${req.baseUrl || ''}${req.path || ''}`;
      const entry = this.endpointLatency[endpoint] || { totalLatencyMs: 0, samples: 0 };
      entry.totalLatencyMs += latencyMs;
      entry.samples += 1;
      this.endpointLatency[endpoint] = entry;
    });

    next();
  };

  recordAuthAttempt(success) {
    if (success) {
      this.authCounts.success += 1;
    } else {
      this.authCounts.failure += 1;
    }
  }

  addActiveUser(userId) {
    if (userId !== undefined && userId !== null) {
      this.activeUsers.add(userId);
    }
  }

  removeActiveUser(userId) {
    if (userId !== undefined && userId !== null) {
      this.activeUsers.delete(userId);
    }
  }

  pizzaPurchase(success, latencyMs, revenue = 0, pizzasSold = 0) {
    if (success) {
      this.purchase.sold += pizzasSold;
      this.purchase.revenue += revenue;
    } else {
      this.purchase.failures += 1;
    }

    this.purchase.totalLatencyMs += latencyMs;
    this.purchase.samples += 1;
  }

  getCpuUsagePercentage() {
    const cpuUsage = os.loadavg()[0] / os.cpus().length;
    return Number((cpuUsage * 100).toFixed(2));
  }

  getMemoryUsagePercentage() {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    return Number(((usedMemory / totalMemory) * 100).toFixed(2));
  }

  captureSystemMetrics() {
    this.metricBuffer.push({
      metric: 'system',
      cpuUsagePercent: this.getCpuUsagePercentage(),
      memoryUsagePercent: this.getMemoryUsagePercentage(),
      source: this.source,
      ts: new Date().toISOString(),
    });
  }

  flushAggregatesToBuffer() {
    this.metricBuffer.push({
      metric: 'http',
      ...this.httpCounts,
      source: this.source,
      ts: new Date().toISOString(),
    });

    this.metricBuffer.push({
      metric: 'auth',
      success: this.authCounts.success,
      failure: this.authCounts.failure,
      activeUsers: this.activeUsers.size,
      source: this.source,
      ts: new Date().toISOString(),
    });

    const avgPizzaLatency = this.purchase.samples
      ? Number((this.purchase.totalLatencyMs / this.purchase.samples).toFixed(2))
      : 0;

    this.metricBuffer.push({
      metric: 'pizza',
      sold: this.purchase.sold,
      failures: this.purchase.failures,
      revenue: Number(this.purchase.revenue.toFixed(2)),
      latencyMs: avgPizzaLatency,
      source: this.source,
      ts: new Date().toISOString(),
    });

    Object.entries(this.endpointLatency).forEach(([endpoint, stats]) => {
      const averageLatencyMs = stats.samples ? Number((stats.totalLatencyMs / stats.samples).toFixed(2)) : 0;
      this.metricBuffer.push({
        metric: 'latency',
        endpoint,
        averageLatencyMs,
        samples: stats.samples,
        source: this.source,
        ts: new Date().toISOString(),
      });
    });

    this.httpCounts = { total: 0, GET: 0, POST: 0, PUT: 0, DELETE: 0 };
    this.authCounts = { success: 0, failure: 0 };
    this.purchase = { sold: 0, failures: 0, revenue: 0, totalLatencyMs: 0, samples: 0 };
    this.endpointLatency = {};
  }

  async sendToGrafana() {
    if (!this.endpointUrl || !this.accountId || !this.apiKey || this.metricBuffer.length === 0) {
      this.metricBuffer = [];
      return;
    }

    const nowNs = `${Date.now()}000000`;
    const streams = this.metricBuffer.map((item) => ({
      stream: {
        source: this.source,
        metric: item.metric,
      },
      values: [[nowNs, JSON.stringify(item)]],
    }));

    try {
      await fetch(this.endpointUrl, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${this.accountId}:${this.apiKey}`).toString('base64')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ streams }),
      });
    } catch (error) {
      console.log('Error sending metrics', error.message);
    } finally {
      this.metricBuffer = [];
    }
  }

  startPeriodicReporting(periodMs = 60000) {
    if (!this.systemTimer) {
      this.systemTimer = setInterval(() => this.captureSystemMetrics(), 15000);
      this.systemTimer.unref();
    }

    if (!this.sendTimer) {
      this.sendTimer = setInterval(async () => {
        this.flushAggregatesToBuffer();
        await this.sendToGrafana();
      }, periodMs);
      this.sendTimer.unref();
    }
  }
}

module.exports = new Metrics();