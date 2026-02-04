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
        json: async () => ({ jwt: 'token', reportUrl: 'url' }),
      });
      const res = await request(app).post('/api/order').send({ items: [] });
      expect(res.status).toBe(200);
    });
  });