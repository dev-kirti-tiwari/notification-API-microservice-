import { Request, Response, NextFunction } from 'express';
import { internalAuthMiddleware } from '../../src/middleware/internalAuth';
import { config } from '../../src/config/env';

describe('internalAuthMiddleware Unit Tests', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction;

  beforeEach(() => {
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    nextFunction = jest.fn();
  });

  it('should call next() if valid BRR Bearer token is provided', () => {
    mockRequest = {
      headers: {
        authorization: `Bearer ${config.brrToken}`,
      },
    };

    internalAuthMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(nextFunction).toHaveBeenCalledTimes(1);
    expect(mockResponse.status).not.toHaveBeenCalled();
  });

  it('should return 401 INVALID_BRR_TOKEN if Authorization header is missing', () => {
    mockRequest = {
      headers: {},
    };

    internalAuthMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(nextFunction).not.toHaveBeenCalled();
    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: 'INVALID_BRR_TOKEN',
        }),
      })
    );
  });

  it('should return 401 INVALID_BRR_TOKEN if token format is not Bearer', () => {
    mockRequest = {
      headers: {
        authorization: 'Basic dXNlcjpwYXNz',
      },
    };

    internalAuthMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(nextFunction).not.toHaveBeenCalled();
    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: 'INVALID_BRR_TOKEN',
          message: expect.stringContaining('Malformed Authorization header'),
        }),
      })
    );
  });

  it('should return 401 INVALID_BRR_TOKEN if token does not match config', () => {
    mockRequest = {
      headers: {
        authorization: 'Bearer wrong-secret-token',
      },
    };

    internalAuthMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(nextFunction).not.toHaveBeenCalled();
    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: 'INVALID_BRR_TOKEN',
          message: 'Invalid internal token',
        }),
      })
    );
  });
});
