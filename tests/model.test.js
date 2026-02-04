const { describe, test, expect } = require('@jest/globals');
  const { Role } = require('../src/model/model');

  describe('model', () => {
    describe('Role', () => {
      test('should have correct role values', () => {
        expect(Role.Diner).toBe('diner');
        expect(Role.Franchisee).toBe('franchisee');
        expect(Role.Admin).toBe('admin');
      });

      test('should have all three roles defined', () => {
        expect(Object.keys(Role).length).toBe(3);
      });
    });
  });