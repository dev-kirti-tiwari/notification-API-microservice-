import { Pool, PoolConfig, types } from 'pg';
import { config } from './env';
import { logger } from '../utils/logger';

// Force PostgreSQL BIGINT (OID 20) to always be returned as a string to prevent precision loss
types.setTypeParser(20, (val: string) => val);

const poolConfig: PoolConfig = {
  host: config.database.host,
  port: config.database.port,
  user: config.database.user,
  password: config.database.password,
  database: config.database.database,
  ssl: config.database.ssl ? { rejectUnauthorized: false } : undefined,
  min: config.database.poolMin,
  max: config.database.poolMax,
  connectionTimeoutMillis: config.database.timeoutMs,
  idleTimeoutMillis: 30000,
};

export const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  logger.error('Unexpected error on idle PostgreSQL client pool', { error: err.message });
});

export async function query<T = any>(text: string, params?: any[]): Promise<{ rows: T[]; rowCount: number | null }> {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  logger.debug('Executed query', { duration, rowCount: res.rowCount });
  return res;
}

export async function checkDatabaseReady(): Promise<boolean> {
  try {
    const res = await pool.query('SELECT 1 as ready');
    return res.rows && res.rows.length > 0 && res.rows[0].ready === 1;
  } catch (error) {
    logger.warn('Database readiness check failed', { error: error instanceof Error ? error.message : String(error) });
    return false;
  }
}
