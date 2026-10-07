import fs from 'fs';
import path from 'path';
import { pool } from '../config/database';
import { logger } from '../utils/logger';

export async function runMigrations() {
  logger.info('Running database migrations...');
  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const file of files) {
      logger.info(`Applying migration: ${file}`);
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf-8');
      await client.query(sql);
    }
    await client.query('COMMIT');
    logger.info('All database migrations applied successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Failed to apply migrations', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  runMigrations()
    .then(() => {
      logger.info('Migration process finished.');
      process.exit(0);
    })
    .catch((err) => {
      logger.error('Migration process failed.', { error: err.message });
      process.exit(1);
    });
}
