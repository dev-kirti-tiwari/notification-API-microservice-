import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/response';
import { logger } from '../utils/logger';

export class AppError extends Error {
  public statusCode: number;
  public code: string;
  public details?: any;

  constructor(statusCode: number, code: string, message: string, details?: any) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  logger.error('Unhandled Error caught in middleware', {
    message: err?.message,
    code: err?.code,
    stack: process.env.NODE_ENV === 'development' ? err?.stack : undefined,
  });

  // Body parser syntax error (invalid JSON)
  if (err instanceof SyntaxError && 'body' in err) {
    sendError(res, 400, 'INVALID_JSON', 'Malformed JSON payload');
    return;
  }

  // PostgreSQL unique constraint violation (idempotency key)
  if (err?.code === '23505') {
    sendError(
      res,
      409,
      'DUPLICATE_IDEMPOTENCY_KEY',
      'A notification with this idempotency key already exists for the given scope'
    );
    return;
  }

  if (err instanceof AppError) {
    sendError(res, err.statusCode, err.code, err.message, err.details);
    return;
  }

  sendError(
    res,
    500,
    'INTERNAL_SERVER_ERROR',
    'An unexpected internal server error occurred'
  );
}

export function notFoundHandler(req: Request, res: Response): void {
  sendError(res, 404, 'NOT_FOUND', `Route ${req.method} ${req.originalUrl} not found`);
}
