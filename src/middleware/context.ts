import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/response';

export interface RequestContext {
  tenantId: string;
  organizationId: string;
  softwareId: string;
  userId?: string | null;
  requestId?: string;
}

declare global {
  namespace Express {
    interface Request {
      context?: RequestContext;
    }
  }
}

export const BIGINT_REGEX = /^[1-9]\d*$/;

export function tenantContextMiddleware(req: Request, res: Response, next: NextFunction): void {
  const tenantIdHeader = req.headers['x-tenant-id'];
  const organizationIdHeader = req.headers['x-organization-id'];
  const softwareIdHeader = req.headers['x-software-id'];
  const userIdHeader = req.headers['x-user-id'];
  const requestIdHeader = req.headers['x-request-id'];

  const tenantId = Array.isArray(tenantIdHeader) ? tenantIdHeader[0] : tenantIdHeader;
  const organizationId = Array.isArray(organizationIdHeader) ? organizationIdHeader[0] : organizationIdHeader;
  const softwareId = Array.isArray(softwareIdHeader) ? softwareIdHeader[0] : softwareIdHeader;
  const userId = Array.isArray(userIdHeader) ? userIdHeader[0] : userIdHeader;
  const requestId = Array.isArray(requestIdHeader) ? requestIdHeader[0] : requestIdHeader;

  if (!tenantId || !BIGINT_REGEX.test(tenantId.trim())) {
    sendError(res, 400, 'INVALID_CONTEXT_HEADERS', 'Valid positive numeric X-Tenant-Id header is required');
    return;
  }

  if (!organizationId || !BIGINT_REGEX.test(organizationId.trim())) {
    sendError(res, 400, 'INVALID_CONTEXT_HEADERS', 'Valid positive numeric X-Organization-Id header is required');
    return;
  }

  if (!softwareId || !softwareId.trim()) {
    sendError(res, 400, 'INVALID_CONTEXT_HEADERS', 'Valid X-Software-Id header is required');
    return;
  }

  if (userId && !BIGINT_REGEX.test(userId.trim())) {
    sendError(res, 400, 'INVALID_CONTEXT_HEADERS', 'X-User-Id must be a valid positive numeric string when provided');
    return;
  }

  // Ensure untrusted body parameters do not override context headers
  if (req.body && typeof req.body === 'object') {
    delete req.body.tenant_id;
    delete req.body.organization_id;
    delete req.body.software_id;
  }

  req.context = {
    tenantId: tenantId.trim(),
    organizationId: organizationId.trim(),
    softwareId: softwareId.trim(),
    userId: userId ? userId.trim() : null,
    requestId: requestId?.trim(),
  };

  next();
}

export function requireUserContext(req: Request, res: Response, next: NextFunction): void {
  if (!req.context?.userId) {
    sendError(res, 400, 'INVALID_CONTEXT_HEADERS', 'Valid positive numeric X-User-Id header is required for this operation');
    return;
  }
  next();
}
