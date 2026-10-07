import { Request, Response, NextFunction } from 'express';
import { config } from '../config/env';
import { sendError } from '../utils/response';

export function internalAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];

  if (!authHeader) {
    sendError(res, 401, 'INVALID_BRR_TOKEN', 'Authorization header is required');
    return;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    sendError(res, 401, 'INVALID_BRR_TOKEN', 'Malformed Authorization header format. Expected Bearer token');
    return;
  }

  const token = parts[1];
  if (token !== config.brrToken) {
    sendError(res, 401, 'INVALID_BRR_TOKEN', 'Invalid internal token');
    return;
  }

  next();
}
