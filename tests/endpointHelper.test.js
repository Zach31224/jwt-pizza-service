const {describe, test, expect} = require('@jest/globals');
  const { StatusCodeError, asyncHandler } = require('../src/endpointHelper');

  describe('endpointHelper', () => {
    describe('StatusCodeError', () => {
      test('error message and status code', () => {
        const error = new StatusCodeError('Test error', 404);
        expect(error.message).toBe('Test error');
        expect(error.statusCode).toBe(404);
        expect(error).toBeInstanceOf(Error);
      });
    });

    describe('asyncHandler', () => {
      test('successful async function?', async () => {
        const mockFn = jest.fn().mockResolvedValue('success');
        const mockReq = {};
        const mockRes = {};
        const mockNext = jest.fn();

        const handler = asyncHandler(mockFn);
        await handler(mockReq, mockRes, mockNext);
        });
      });
    });