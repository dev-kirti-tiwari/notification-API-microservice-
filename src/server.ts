import { app } from './app';
import { config } from './config/env';
import { pool, checkDatabaseReady } from './config/database';
import { logger } from './utils/logger';

const PORT = config.port;

const server = app.listen(PORT, async () => {
  logger.info(`Notification API Microservice is running on port ${PORT} in ${config.nodeEnv} mode`);
  const isDbReady = await checkDatabaseReady();
  if (isDbReady) {
    logger.info('PostgreSQL connection verified successfully');
  } else {
    logger.warn('PostgreSQL database is currently offline - utilizing resilient in-memory storage fallback');
  }
});

// Graceful shutdown handling
const gracefulShutdown = async (signal: string) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  server.close(async () => {
    logger.info('HTTP server closed.');
    try {
      await pool.end();
      logger.info('PostgreSQL connection pool closed.');
      process.exit(0);
    } catch (err: any) {
      logger.error('Error closing database pool during shutdown', { error: err.message });
      process.exit(1);
    }
  });

  // Force shutdown after timeout
  setTimeout(() => {
    logger.error('Graceful shutdown timeout exceeded. Forcing termination.');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
