import { Request, Response, NextFunction } from 'express';
import { tenantContextMiddleware } from '../../src/middleware/context';

describe('tenantContextMiddleware Unit Tests', () => {
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

  it('should parse valid X-Tenant-Id, X-Organization-Id, X-Software-Id and optional X-User-Id', () => {
    mockRequest = {
      headers: {
        'x-tenant-id': '1001',
        'x-organization-id': '5001',
        'x-software-id': '10',
        'x-user-id': '9001',
      },
      body: {
        tenant_id: '9999', // must be stripped/ignored
      },
    };

    tenantContextMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(nextFunction).toHaveBeenCalledTimes(1);
    expect(mockRequest.context).toBeDefined();
    expect(mockRequest.context?.tenantId).toBe('1001');
    expect(mockRequest.context?.organizationId).toBe('5001');
    expect(mockRequest.context?.softwareId).toBe('10');
    expect(mockRequest.context?.userId).toBe('9001');
    expect((mockRequest.body as any).tenant_id).toBeUndefined();
  });

  it('should reject missing X-Tenant-Id header with 400 INVALID_CONTEXT_HEADERS', () => {
    mockRequest = {
      headers: {
        'x-organization-id': '5001',
        'x-software-id': '10',
      },
    };

    tenantContextMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(nextFunction).not.toHaveBeenCalled();
    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: 'INVALID_CONTEXT_HEADERS',
          message: expect.stringContaining('X-Tenant-Id'),
        }),
      })
    );
  });

  it('should reject non-numeric X-Tenant-Id header', () => {
    mockRequest = {
      headers: {
        'x-tenant-id': 'abc-invalid',
        'x-organization-id': '5001',
        'x-software-id': '10',
      },
    };

    tenantContextMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(nextFunction).not.toHaveBeenCalled();
    expect(mockResponse.status).toHaveBeenCalledWith(400);
  });

  it('should reject missing X-Organization-Id header', () => {
    mockRequest = {
      headers: {
        'x-tenant-id': '1001',
        'x-software-id': '10',
      },
    };

    tenantContextMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(nextFunction).not.toHaveBeenCalled();
    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: 'INVALID_CONTEXT_HEADERS',
          message: expect.stringContaining('X-Organization-Id'),
        }),
      })
    );
  });
});
