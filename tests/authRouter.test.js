  const { describe, test, expect, beforeEach } = require('@jest/globals');
  const request = require('supertest');                                                           
  const express = require('express');
  const { authRouter, setAuthUser } = require('../src/routes/authRouter');

  // Mock the database
  jest.mock('../src/database/database.js');
  const { DB } = require('../src/database/database.js');

  // Mock jwt
  jest.mock('jsonwebtoken');
  const jwt = require('jsonwebtoken');

  // Create test app
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use(setAuthUser);
    app.use('/api/auth', authRouter);
    jest.clearAllMocks();
  });

  describe('authRouter', () => {
    describe('POST /api/auth (register)', () => {
      test('should register a new user', async () => {
        const mockUser = { id: 1, name: 'Test', email: 'test@test.com', roles: [{ role: 'diner' }]
   };
        DB.addUser.mockResolvedValue(mockUser);
        DB.loginUser.mockResolvedValue();
        jwt.sign.mockReturnValue('test-token');

        const response = await request(app)
          .post('/api/auth')
          .send({ name: 'Test', email: 'test@test.com', password: 'password' });

        expect(response.status).toBe(200);
        expect(response.body.user).toEqual(mockUser);
        expect(response.body.token).toBe('test-token');
      });

      test('should return 400 if missing fields', async () => {
        const response = await request(app)
          .post('/api/auth')
          .send({ name: 'Test' });

        expect(response.status).toBe(400);
        expect(response.body.message).toContain('required');
      });
    });

    describe('PUT /api/auth (login)', () => {
      test('should login existing user', async () => {
        const mockUser = { id: 1, name: 'Test', email: 'test@test.com', roles: [{ role: 'diner' }]
   };
        DB.getUser.mockResolvedValue(mockUser);
        DB.loginUser.mockResolvedValue();
        jwt.sign.mockReturnValue('test-token');

        const response = await request(app)
          .put('/api/auth')
          .send({ email: 'test@test.com', password: 'password' });

        expect(response.status).toBe(200);
        expect(response.body.user).toEqual(mockUser);
        expect(response.body.token).toBe('test-token');
      });
    });

    describe('DELETE /api/auth (logout)', () => {
      test('should logout user', async () => {
        DB.isLoggedIn.mockResolvedValue(true);
        DB.logoutUser.mockResolvedValue();
        jwt.verify.mockReturnValue({ id: 1, roles: [{ role: 'diner' }] });

        const response = await request(app)
          .delete('/api/auth')
          .set('Authorization', 'Bearer test-token');

        expect(response.status).toBe(200);
        expect(response.body.message).toBe('logout successful');
      });

      test('should return 401 if not authenticated', async () => {
        const response = await request(app).delete('/api/auth');

        expect(response.status).toBe(401);
      });
    });

    describe('setAuthUser middleware', () => {
      test('should set user if valid token', async () => {
        DB.isLoggedIn.mockResolvedValue(true);
        jwt.verify.mockReturnValue({ id: 1, roles: [{ role: 'diner' }] });

        const response = await request(app)
          .delete('/api/auth')
          .set('Authorization', 'Bearer test-token');

        expect(jwt.verify).toHaveBeenCalled();
      });
    });
  });