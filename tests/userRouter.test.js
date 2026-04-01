const { describe, test, expect, beforeEach } = require('@jest/globals');
const request = require('supertest');
const express = require('express');
const { setAuthUser } = require('../src/routes/authRouter');
const userRouter = require('../src/routes/userRouter');

// Mock the database
jest.mock('../src/database/database.js');
const { DB } = require('../src/database/database.js');

// Mock jwt
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
  app.use('/api/user', userRouter);
  jest.clearAllMocks();
});

describe('userRouter', () => {
  describe('GET /api/user/me', () => {
    test('returns authenticated user', async () => {
      mockDiner();
      const res = await request(app)
        .get('/api/user/me')
        .set('Authorization', 'Bearer token');
      expect(res.status).toBe(200);
      expect(res.body.email).toBe(dinerUser.email);
    });

    test('returns 401 when not authenticated', async () => {
      const res = await request(app).get('/api/user/me');
      expect(res.status).toBe(401);
    });
  });

  describe('PUT /api/user/:userId', () => {
    test('allows user to update their own account', async () => {
      mockDiner();
      const updated = { ...dinerUser, name: 'New Name' };
      DB.updateUser.mockResolvedValue(updated);
      jwt.sign.mockReturnValue('new-token');

      const res = await request(app)
        .put(`/api/user/${dinerUser.id}`)
        .set('Authorization', 'Bearer token')
        .send({ name: 'New Name' });

      expect(res.status).toBe(200);
      expect(res.body.user.name).toBe('New Name');
      expect(res.body.token).toBe('new-token');
    });

    test('allows admin to update another user', async () => {
      mockAdmin();
      const updated = { ...dinerUser, name: 'Updated' };
      DB.updateUser.mockResolvedValue(updated);
      jwt.sign.mockReturnValue('admin-token');

      const res = await request(app)
        .put(`/api/user/${dinerUser.id}`)
        .set('Authorization', 'Bearer token')
        .send({ name: 'Updated' });

      expect(res.status).toBe(200);
      expect(res.body.user.name).toBe('Updated');
    });

    test('returns 403 when diner tries to update another user', async () => {
      mockDiner();
      const res = await request(app)
        .put('/api/user/999')
        .set('Authorization', 'Bearer token')
        .send({ name: 'Hacker' });

      expect(res.status).toBe(403);
      expect(res.body.message).toBe('unauthorized');
    });

    test('returns 401 when not authenticated', async () => {
      const res = await request(app)
        .put('/api/user/1')
        .send({ name: 'Test' });
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/user (listUsers)', () => {
    test('returns user list for admin', async () => {
      mockAdmin();
      const mockResult = {
        users: [
          { id: 1, name: 'Admin', email: 'admin@jwt.com', roles: [{ role: 'admin' }] },
          { id: 2, name: 'Diner', email: 'diner@jwt.com', roles: [{ role: 'diner' }] },
        ],
        more: false,
      };
      DB.listUsers.mockResolvedValue(mockResult);

      const res = await request(app)
        .get('/api/user')
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(res.body.users).toHaveLength(2);
      expect(res.body.more).toBe(false);
    });

    test('passes page/limit/name query params to DB', async () => {
      mockAdmin();
      const mockResult = { users: [], more: true };
      DB.listUsers.mockResolvedValue(mockResult);

      const res = await request(app)
        .get('/api/user?page=2&limit=5&name=test*')
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(DB.listUsers).toHaveBeenCalledWith(2, 5, 'test*');
    });

    test('uses defaults when no query params provided', async () => {
      mockAdmin();
      DB.listUsers.mockResolvedValue({ users: [], more: false });

      await request(app)
        .get('/api/user')
        .set('Authorization', 'Bearer token');

      expect(DB.listUsers).toHaveBeenCalledWith(1, 10, '*');
    });

    test('returns 403 for non-admin', async () => {
      mockDiner();
      const res = await request(app)
        .get('/api/user')
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(403);
      expect(res.body.message).toBe('unauthorized');
    });

    test('returns 401 when not authenticated', async () => {
      const res = await request(app).get('/api/user');
      expect(res.status).toBe(401);
    });

    test('returns more=true when there are additional pages', async () => {
      mockAdmin();
      DB.listUsers.mockResolvedValue({ users: [{ id: 1 }], more: true });

      const res = await request(app)
        .get('/api/user')
        .set('Authorization', 'Bearer token');

      expect(res.body.more).toBe(true);
    });
  });

  describe('DELETE /api/user/:userId', () => {
    test('admin can delete a user', async () => {
      mockAdmin();
      DB.deleteUser.mockResolvedValue();

      const res = await request(app)
        .delete('/api/user/42')
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('user deleted');
      expect(DB.deleteUser).toHaveBeenCalledWith(42);
    });

    test('passes numeric userId to DB.deleteUser', async () => {
      mockAdmin();
      DB.deleteUser.mockResolvedValue();

      await request(app)
        .delete('/api/user/99')
        .set('Authorization', 'Bearer token');

      const calledWith = DB.deleteUser.mock.calls[0][0];
      expect(typeof calledWith).toBe('number');
      expect(calledWith).toBe(99);
    });

    test('returns 403 for non-admin', async () => {
      mockDiner();
      const res = await request(app)
        .delete('/api/user/1')
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(403);
      expect(res.body.message).toBe('unauthorized');
    });

    test('returns 401 when not authenticated', async () => {
      const res = await request(app).delete('/api/user/1');
      expect(res.status).toBe(401);
    });
  });
});
