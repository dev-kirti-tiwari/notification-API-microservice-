import express, { Express, Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { config } from './config/env';
import { checkDatabaseReady } from './config/database';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import notificationRoutes from './modules/notification/routes';

export function createApp(): Express {
  const app = express();

  // Security headers & CORS
  app.use(helmet());
  app.use(
    cors({
      origin: (origin, callback) => {
        if (
          !origin ||
          config.cors.allowedOrigins.includes('*') ||
          config.cors.allowedOrigins.includes(origin)
        ) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Tenant-Id',
        'X-Organization-Id',
        'X-Software-Id',
        'X-User-Id',
        'X-Request-Id',
        'Idempotency-Key',
      ],
      credentials: true,
    })
  );

  // Body parser
  app.use(express.json({ limit: '1mb' }));

  // Unauthenticated Liveness probe
  app.get('/health', (req: Request, res: Response) => {
    res.status(200).json({
      status: 'ok',
      service: 'triostack-notification-service',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  // Unauthenticated Readiness probe
  app.get('/ready', async (req: Request, res: Response) => {
    const isDbReady = await checkDatabaseReady();
    if (isDbReady) {
      res.status(200).json({
        status: 'ready',
        database: 'connected',
        timestamp: new Date().toISOString(),
      });
    } else {
      res.status(200).json({
        status: 'ready',
        database: 'in-memory-storage (PostgreSQL not connected)',
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Business Routes
  app.use('/api/v1/notifications', notificationRoutes);

  // 404 & Global Error Handling
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export const app = createApp();
