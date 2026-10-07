import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '4010', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  brrToken: process.env.BRR_TOKEN || 'triostack_secret_notification_token_2026',
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'triostack_notifications',
    ssl: process.env.DB_SSL === 'true',
    poolMin: parseInt(process.env.DB_POOL_MIN || '2', 10),
    poolMax: parseInt(process.env.DB_POOL_MAX || '20', 10),
    timeoutMs: parseInt(process.env.DB_TIMEOUT_MS || '10000', 10),
  },
  cors: {
    allowedOrigins: (process.env.CORS_ALLOWED_ORIGINS || '*').split(',').map((o) => o.trim()),
  },
};
