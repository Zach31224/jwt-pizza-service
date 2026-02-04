const { describe, test, expect, beforeEach } = require('@jest/globals');
  const request = require('supertest');

  // Mock dependencies before requiring app
  jest.mock('../src/routes/authRouter.js', () => ({
    authRouter: require('express').Router(),
    setAuthUser: (req, res, next) => next(),
  }));
  jest.mock('../src/routes/orderRouter.js', () => require('express').Router());
  jest.mock('../src/routes/franchiseRouter.js', () => require('express').Router());
  jest.mock('../src/routes/userRouter.js', () => require('express').Router());

  const app = require('../src/service');

  describe('Service', () => {
    test('Returns welcome message on /?', async () => {
      const response = await request(app).get('/');
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('welcome to JWT Pizza');
      expect(response.body.version).toBeDefined();
    });

    test('returns 404 for unknown endpoints?', async () => {
      const response = await request(app).get('/unknown');
      expect(response.status).toBe(404);
      expect(response.body.message).toBe('unknown endpoint');
    });

    test('handle CORS headers?', async () => {
      const response = await request(app).get('/');
      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });
  });