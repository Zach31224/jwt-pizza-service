const { describe, test, expect, beforeEach } = require('@jest/globals');                  const request = require('supertest');
  const express = require('express');                                                     
  const orderRouter = require('../src/routes/orderRouter');

  jest.mock('../src/database/database.js');
  const { DB } = require('../src/database/database.js');

  jest.mock('../src/routes/authRouter.js', () => ({
    authRouter: {
      authenticateToken: (req, res, next) => {
        req.user = { id: 1, isRole: () => true };
        next();
      },
    },
  }));

  global.fetch = jest.fn();

  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/order', orderRouter);
    jest.clearAllMocks();
  });

  describe('orderRouter', () => {
    test('Get /menu return menu?', async () => {
      DB.getMenu.mockResolvedValue([{ id: 1, title: 'Veggie' }]);
      const res = await request(app).get('/api/order/menu');
      expect(res.status).toBe(200);
    });

    test('PUT /menu adds item?', async () => {
      DB.addMenuItem.mockResolvedValue();
      DB.getMenu.mockResolvedValue([]);
      const res = await request(app).put('/api/order/menu').send({ title: 'Pepperoni' }); 
      expect(res.status).toBe(200);
    });

    test('GET / returns orders?', async () => {
      DB.getOrders.mockResolvedValue({ orders: [] });
      const res = await request(app).get('/api/order');
      expect(res.status).toBe(200);
    });

    test('POST / creates order?', async () => {
      DB.addDinerOrder.mockResolvedValue({ id: 1 });
      fetch.mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ jwt: 'token', reportUrl: 'url' }),
      });
      const res = await request(app).post('/api/order').send({ items: [] });
      expect(res.status).toBe(200);
    });

    test('POST / returns 502 with upstream diagnostics when factory rejects order', async () => {
      DB.addDinerOrder.mockResolvedValue({ id: 1, items: [] });
      fetch.mockResolvedValue({
        ok: false,
        status: 500,
        headers: { get: () => 'application/json' },
        json: async () => ({ message: 'factory exploded', reportUrl: 'https://factory/report' }),
      });

      const res = await request(app).post('/api/order').send({ items: [] });

      expect(res.status).toBe(502);
      expect(res.body.message).toBe('Failed to fulfill order at factory');
      expect(res.body.upstreamStatus).toBe(500);
      expect(res.body.upstreamMessage).toBe('factory exploded');
      expect(res.body.followLinkToEndChaos).toBe('https://factory/report');
    });

    test('POST / returns 502 when factory cannot be reached', async () => {
      DB.addDinerOrder.mockResolvedValue({ id: 1, items: [] });
      fetch.mockRejectedValue(new Error('connect ECONNREFUSED'));

      const res = await request(app).post('/api/order').send({ items: [] });

      expect(res.status).toBe(502);
      expect(res.body.message).toBe('Failed to contact pizza factory');
      expect(res.body.upstreamMessage).toContain('ECONNREFUSED');
    });
  });