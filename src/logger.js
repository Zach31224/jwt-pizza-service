const config = require('./config.js');

class Logger {
  constructor() {
    const metrics = config.metrics || {};
    const logging = config.logging || {};
    const isProduction = process.env.NODE_ENV === 'production';

    this.source = isProduction ? 'jwt-pizza-service' : 'jwt-pizza-service-dev';
    this.endpointUrl = logging.endpointUrl || '';
    this.accountId = metrics.accountId || '';
    this.apiKey = metrics.apiKey || '';
  }

  redactKeys = ['authorization', 'password', 'token', 'apikey', 'apiKey', 'jwt', 'cookie', 'set-cookie', 'email'];

  sanitize(value) {
    if (value === null || value === undefined) {
      return value;
    }

    if (Array.isArray(value)) {
      return value.map((entry) => this.sanitize(entry));
    }

    if (Buffer.isBuffer(value)) {
      return '[BINARY_DATA]';
    }

    if (typeof value === 'object') {
      const out = {};
      for (const [key, entryValue] of Object.entries(value)) {
        if (this.redactKeys.includes(key.toLowerCase())) {
          out[key] = '[REDACTED]';
        } else {
          out[key] = this.sanitize(entryValue);
        }
      }
      return out;
    }

    return value;
  }

  normalizeBody(body) {
    if (body === undefined) {
      return undefined;
    }

    if (typeof body === 'string') {
      try {
        return JSON.parse(body);
      } catch {
        return body;
      }
    }

    return body;
  }

  async log(eventType, payload = {}) {
    if (!this.endpointUrl || !this.accountId || !this.apiKey) {
      return;
    }

    const logEvent = {
      ts: new Date().toISOString(),
      source: this.source,
      eventType,
      ...this.sanitize(payload),
    };

    const nowNs = `${Date.now()}000000`;
    const body = {
      streams: [
        {
          stream: {
            source: this.source,
            eventType,
          },
          values: [[nowNs, JSON.stringify(logEvent)]],
        },
      ],
    };

    try {
      await fetch(this.endpointUrl, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${this.accountId}:${this.apiKey}`).toString('base64')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
    } catch (err) {
      console.log('Failed to send log to Grafana', err.message);
    }
  }

  httpLogger = (req, res, next) => {
    const start = Date.now();
    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);
    let responseBody;

    res.json = (body) => {
      responseBody = body;
      return originalJson(body);
    };

    res.send = (body) => {
      responseBody = body;
      return originalSend(body);
    };

    res.on('finish', () => {
      this.log('http_request', {
        method: req.method,
        path: `${req.baseUrl || ''}${req.path || ''}`,
        statusCode: res.statusCode,
        hasAuthorizationHeader: Boolean(req.headers.authorization),
        requestBody: this.normalizeBody(req.body),
        responseBody: this.normalizeBody(responseBody),
        latencyMs: Date.now() - start,
      });
    });

    next();
  };

  installUnhandledExceptionLogging() {
    process.on('uncaughtException', (err) => {
      this.log('unhandled_exception', {
        message: err.message,
        stack: err.stack,
      });
    });

    process.on('unhandledRejection', (reason) => {
      this.log('unhandled_rejection', {
        reason: String(reason),
      });
    });
  }
}

module.exports = new Logger();