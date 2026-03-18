#!/usr/bin/env node
/**
 * Populate Grafana Loki with fake JWT Pizza metrics data.
 *
 * Usage:
 *   node populateGrafana.js
 *
 * Environment variables (or .env):
 *   METRICS_ENDPOINT_URL - Grafana Loki endpoint
 *   METRICS_ACCOUNT_ID - Grafana account/user ID
 *   METRICS_API_KEY - Grafana API key
 *   METRICS_SOURCE - metric source name (default: jwt-pizza-service)
 */

try {
  require('dotenv').config();
} catch (e) {
  // dotenv not installed, proceed with env vars only
}

const endpointUrl = process.env.METRICS_ENDPOINT_URL || '';
const accountId = process.env.METRICS_ACCOUNT_ID || '';
const apiKey = process.env.METRICS_API_KEY || '';
const source = process.env.METRICS_SOURCE || 'jwt-pizza-service';

if (!endpointUrl || !accountId || !apiKey) {
  console.error('Missing required environment variables:');
  console.error('  METRICS_ENDPOINT_URL, METRICS_ACCOUNT_ID, METRICS_API_KEY');
  process.exit(1);
}

console.log(`Sending fake metrics to: ${endpointUrl}`);
console.log(`Source: ${source}`);

function generateFakeMetrics() {
  const metrics = [];
  const now = Date.now();
  const oneHourMs = 60 * 60 * 1000;

  // Generate historical data for the last 24 hours
  for (let i = 24; i > 0; i--) {
    const timestamp = now - i * oneHourMs;
    const timestampNs = `${timestamp}000000`;

    // HTTP metrics
    metrics.push({
      ts: timestampNs,
      metric: {
        metric: 'http',
        total: Math.floor(Math.random() * 500) + 100,
        GET: Math.floor(Math.random() * 300) + 50,
        POST: Math.floor(Math.random() * 150) + 20,
        PUT: Math.floor(Math.random() * 80) + 10,
        DELETE: Math.floor(Math.random() * 50) + 5,
        source,
        ts: new Date(timestamp).toISOString(),
      },
    });

    // Auth metrics
    metrics.push({
      ts: timestampNs,
      metric: {
        metric: 'auth',
        success: Math.floor(Math.random() * 80) + 20,
        failure: Math.floor(Math.random() * 10) + 1,
        activeUsers: Math.floor(Math.random() * 200) + 50,
        source,
        ts: new Date(timestamp).toISOString(),
      },
    });

    // Pizza purchase metrics
    metrics.push({
      ts: timestampNs,
      metric: {
        metric: 'pizza',
        sold: Math.floor(Math.random() * 300) + 50,
        failures: Math.floor(Math.random() * 5),
        revenue: Number((Math.random() * 10 + 2).toFixed(2)),
        latencyMs: Number((Math.random() * 500 + 100).toFixed(2)),
        source,
        ts: new Date(timestamp).toISOString(),
      },
    });

    // System metrics
    metrics.push({
      ts: timestampNs,
      metric: {
        metric: 'system',
        cpuUsagePercent: Number((Math.random() * 60 + 10).toFixed(2)),
        memoryUsagePercent: Number((Math.random() * 50 + 20).toFixed(2)),
        source,
        ts: new Date(timestamp).toISOString(),
      },
    });

    // Endpoint latency metrics (sample endpoints)
    const endpoints = [
      'GET /api/order/menu',
      'POST /api/auth',
      'PUT /api/auth',
      'POST /api/order',
      'GET /api/franchise',
      'POST /api/franchise',
      'GET /api/user',
    ];

    endpoints.forEach((endpoint) => {
      metrics.push({
        ts: timestampNs,
        metric: {
          metric: 'latency',
          endpoint,
          averageLatencyMs: Number((Math.random() * 300 + 50).toFixed(2)),
          samples: Math.floor(Math.random() * 100) + 10,
          source,
          ts: new Date(timestamp).toISOString(),
        },
      });
    });
  }

  return metrics;
}

async function sendMetricsToGrafana(metrics) {
  const streams = metrics.map((item) => ({
    stream: {
      source: item.metric.source,
      metric: item.metric.metric,
    },
    values: [[item.ts, JSON.stringify(item.metric)]],
  }));

  console.log(`Sending ${streams.length} metric entries...`);

  try {
    const response = await fetch(endpointUrl, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountId}:${apiKey}`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ streams }),
    });

    if (response.ok) {
      console.log(`✓ Successfully sent ${streams.length} metrics to Grafana`);
      return true;
    } else {
      console.error(`✗ Grafana returned ${response.status}: ${response.statusText}`);
      const body = await response.text();
      if (body) console.error(`Response: ${body}`);
      return false;
    }
  } catch (error) {
    console.error(`✗ Failed to send metrics: ${error.message}`);
    return false;
  }
}

async function main() {
  const metrics = generateFakeMetrics();
  console.log(`Generated ${metrics.length} fake metric samples`);
  const success = await sendMetricsToGrafana(metrics);
  process.exit(success ? 0 : 1);
}

main();
