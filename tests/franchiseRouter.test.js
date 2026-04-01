const { describe, test, expect, beforeEach } = require('@jest/globals');
const request = require('supertest');
const express = require('express');
const { setAuthUser } = require('../src/routes/authRouter');
const franchiseRouter = require('../src/routes/franchiseRouter');

jest.mock('../src/database/database.js');
const { DB } = require('../src/database/database.js');

jest.mock('jsonwebtoken');
const jwt = require('jsonwebtoken');

const adminUser = { id: 1, name: 'Admin', email: 'admin@jwt.com', roles: [{ role: 'admin' }] };
const dinerUser = { id: 2, name: 'Diner', email: 'diner@jwt.com', roles: [{ role: 'diner' }] };

function mockAdmin() {
  jwt.verify.mockReturnValue(adminUser);
  DB.isLoggedIn.mockResolvedValue(true);
}

function mockDiner() {
  jwt.verify.mockReturnValue(dinerUser);
  DB.isLoggedIn.mockResolvedValue(true);
}

let app;

beforeEach(() => {
  app = express();
  app.use(express.json());
  app.use(setAuthUser);
  app.use('/api/franchise', franchiseRouter);
  app.use((err, req, res, next) => {
    res.status(err.statusCode ?? 500).json({ message: err.message });
    next();
  });
  jest.clearAllMocks();
});

describe('franchiseRouter', () => {
  describe('POST /api/franchise', () => {
    test('allows admin to create franchise with valid payload', async () => {
      mockAdmin();
      const created = { id: 10, name: 'pizzaPocket', admins: [{ email: 'f@jwt.com', id: 4, name: 'Franchisee' }] };
      DB.createFranchise.mockResolvedValue(created);

      const res = await request(app)
        .post('/api/franchise')
        .set('Authorization', 'Bearer token')
        .send({ name: ' pizzaPocket ', admins: [{ email: ' f@jwt.com ' }] });

      expect(res.status).toBe(200);
      expect(DB.createFranchise).toHaveBeenCalledWith({ name: 'pizzaPocket', admins: [{ email: 'f@jwt.com' }] });
      expect(res.body.id).toBe(10);
    });

    test('returns 403 for non-admin', async () => {
      mockDiner();

      const res = await request(app)
        .post('/api/franchise')
        .set('Authorization', 'Bearer token')
        .send({ name: 'pizzaPocket', admins: [{ email: 'f@jwt.com' }] });

      expect(res.status).toBe(403);
      expect(res.body.message).toBe('unable to create a franchise');
      expect(DB.createFranchise).not.toHaveBeenCalled();
    });

    test('returns 400 when payload is missing admins', async () => {
      mockAdmin();

      const res = await request(app)
        .post('/api/franchise')
        .set('Authorization', 'Bearer token')
        .send({ name: 'pizzaPocket' });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('franchise name and at least one admin email are required');
      expect(DB.createFranchise).not.toHaveBeenCalled();
    });

    test('returns 400 when admin email is empty', async () => {
      mockAdmin();

      const res = await request(app)
        .post('/api/franchise')
        .set('Authorization', 'Bearer token')
        .send({ name: 'pizzaPocket', admins: [{ email: '   ' }] });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('franchise name and at least one admin email are required');
      expect(DB.createFranchise).not.toHaveBeenCalled();
    });
  });

  describe('DELETE /api/franchise/:franchiseId', () => {
    test('allows admin to delete franchise', async () => {
      mockAdmin();
      DB.deleteFranchise.mockResolvedValue();

      const res = await request(app)
        .delete('/api/franchise/42')
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('franchise deleted');
      expect(DB.deleteFranchise).toHaveBeenCalledWith(42);
    });

    test('returns 403 for non-admin delete attempt', async () => {
      mockDiner();

      const res = await request(app)
        .delete('/api/franchise/42')
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(403);
      expect(res.body.message).toBe('unable to delete a franchise');
      expect(DB.deleteFranchise).not.toHaveBeenCalled();
    });

    test('returns 401 when deleting franchise while unauthenticated', async () => {
      const res = await request(app).delete('/api/franchise/42');

      expect(res.status).toBe(401);
      expect(res.body.message).toBe('unauthorized');
      expect(DB.deleteFranchise).not.toHaveBeenCalled();
    });
  });
});
