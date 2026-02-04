//More db tests until I hit 80% coverage...
const { describe, test, expect, beforeEach} = require('@jest/globals');
                                                                                          
  jest.mock('mysql2/promise');
  jest.mock('bcrypt');
  const mysql = require('mysql2/promise');
  const bcrypt = require('bcrypt');

  const { DB } = require('../src/database/database.js');

  let mockConnection;

  beforeEach(() => {
    mockConnection = {
      execute: jest.fn(),
      query: jest.fn(),
      end: jest.fn(),
      beginTransaction: jest.fn(),
      commit: jest.fn(),
      rollback: jest.fn(),
    };
    mysql.createConnection.mockResolvedValue(mockConnection);
    jest.clearAllMocks();
  });

  describe('database', () => {
    test('getMenu returns menu items?', async () => {
      mockConnection.execute.mockResolvedValue([[{ id: 1, title: 'Veggie' }]]);
      const menu = await DB.getMenu();
      expect(menu).toEqual([{ id: 1, title: 'Veggie' }]);
    });

    test('addMenuItem adds item?', async () => {
      mockConnection.execute.mockResolvedValue([{ insertId: 1 }]);
      const item = await DB.addMenuItem({ title: 'Pepperoni', price: 0.01 });
      expect(item.id).toBe(1);
    });

    test('addUser creates user?', async () => {
      bcrypt.hash.mockResolvedValue('hashedpwd');
      mockConnection.execute.mockResolvedValue([{ insertId: 1 }]);
      const user = await DB.addUser({ name: 'Test', email: 'test@test.com', password: 'pwd', roles: [{ role: 'diner' }] });
      expect(user.id).toBe(1);
    });

    test('getUser returns user?', async () => {
      bcrypt.compare.mockResolvedValue(true);
      mockConnection.execute
        .mockResolvedValueOnce([[{ id: 1, name: 'Test', email: 'test@test.com', password: 
  'hashedpwd' }]])
        .mockResolvedValueOnce([[{ role: 'diner', objectId: 0 }]]);
      const user = await DB.getUser('test@test.com', 'pwd');
      expect(user.id).toBe(1);
    });

    test('getUser throws on wrong password?', async () => {
      bcrypt.compare.mockResolvedValue(false);
      mockConnection.execute.mockResolvedValueOnce([[{ id: 1, password: 'hashedpwd' }]]); 
      await expect(DB.getUser('test@test.com', 'wrong')).rejects.toThrow('unknown user'); 
    });

    test('updateUser updates fields?', async () => {
      bcrypt.hash.mockResolvedValue('newhash');
      bcrypt.compare.mockResolvedValue(true);
      mockConnection.execute
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([[{ id: 1, name: 'New', email: 'new@test.com', password:   
  'newhash' }]])
        .mockResolvedValueOnce([[{ role: 'diner', objectId: 0 }]]);
      const user = await DB.updateUser(1, 'New', 'new@test.com', 'newpwd');
      expect(user.name).toBe('New');
    });

    test('loginUser stores token?', async () => {
      mockConnection.execute.mockResolvedValue([]);
      await DB.loginUser(1, 'header.payload.signature');
      expect(mockConnection.execute).toHaveBeenCalled();
    });

    test('isLoggedIn checks token?', async () => {
      mockConnection.execute.mockResolvedValue([[{ userId: 1 }]]);
      const loggedIn = await DB.isLoggedIn('header.payload.signature');
      expect(loggedIn).toBe(true);
    });

    test('logoutUser removes token?', async () => {
      mockConnection.execute.mockResolvedValue([]);
      await DB.logoutUser('header.payload.signature');
      expect(mockConnection.execute).toHaveBeenCalled();
    });

    test('getOrders returns orders?', async () => {
      mockConnection.execute
        .mockResolvedValueOnce([[{ id: 1, franchiseId: 1, storeId: 1, date: new Date()    
  }]])
        .mockResolvedValueOnce([[{ id: 1, menuId: 1, description: 'Veggie', price: 0.05   
  }]]);
      const orders = await DB.getOrders({ id: 1 }, 1);
      expect(orders.orders.length).toBe(1);
    });

    test('addDinerOrder creates order?', async () => {
      mockConnection.execute
        .mockResolvedValueOnce([{ insertId: 1 }])
        .mockResolvedValueOnce([[{ id: 1 }]])
        .mockResolvedValueOnce([]);
      const order = await DB.addDinerOrder({ id: 1 }, { franchiseId: 1, storeId: 1, items:
   [{ menuId: 1, description: 'Veggie', price: 0.05 }] });
      expect(order.id).toBe(1);
    });

    test('createFranchise creates franchise?', async () => {
      mockConnection.execute
        .mockResolvedValueOnce([[{ id: 1, name: 'Admin' }]])
        .mockResolvedValueOnce([{ insertId: 1 }])
        .mockResolvedValueOnce([]);
      const franchise = await DB.createFranchise({ name: 'Test', admins: [{ email:        
  'admin@test.com' }] });
      expect(franchise.id).toBe(1);
    });

    test('deleteFranchise removes franchise?', async () => {
      mockConnection.execute.mockResolvedValue([]);
      await DB.deleteFranchise(1);
      expect(mockConnection.commit).toHaveBeenCalled();
    });

    test('getFranchises returns list?', async () => {
      mockConnection.execute
        .mockResolvedValueOnce([[{ id: 1, name: 'Test' }]])
        .mockResolvedValueOnce([[{ id: 1, name: 'Store1' }]]);
      const [franchises, more] = await DB.getFranchises(null, 0, 10, '*');
      expect(franchises.length).toBe(1);
    });

    test('getUserFranchises returns user franchises?', async () => {
      mockConnection.execute
        .mockResolvedValueOnce([[{ objectId: 1 }]])
        .mockResolvedValueOnce([[{ id: 1, name: 'Test' }]])
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([[]]);
      const franchises = await DB.getUserFranchises(1);
      expect(franchises.length).toBe(1);
    });

    test('createStore creates store?', async () => {
      mockConnection.execute.mockResolvedValue([{ insertId: 1 }]);
      const store = await DB.createStore(1, { name: 'SLC' });
      expect(store.id).toBe(1);
    });

    test('deleteStore removes store?', async () => {
      mockConnection.execute.mockResolvedValue([]);
      await DB.deleteStore(1, 1);
      expect(mockConnection.execute).toHaveBeenCalled();
    });

    test('getOffset calculates offset?', () => {
      const offset = DB.getOffset(2, 10);
      expect(offset).toBe(10);
    });

    test('getTokenSignature extracts signature?', () => {
      const sig = DB.getTokenSignature('header.payload.signature');
      expect(sig).toBe('signature');
    });
  });