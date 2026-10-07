export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class Logger {
  private formatMessage(level: LogLevel, message: string, meta?: any) {
    const timestamp = new Date().toISOString();
    let sanitizedMeta = meta;
    if (meta && typeof meta === 'object') {
      try {
        sanitizedMeta = JSON.parse(
          JSON.stringify(meta, (key, value) => {
            if (/token|password|secret|authorization/i.test(key)) {
              return '***REDACTED***';
            }
            return value;
          })
        );
      } catch {
        sanitizedMeta = '[Unserializable Meta]';
      }
    }
    return JSON.stringify({
      timestamp,
      level,
      message,
      ...(sanitizedMeta !== undefined ? { meta: sanitizedMeta } : {})
    });
  }

  debug(message: string, meta?: any) {
    if (process.env.NODE_ENV !== 'test') {
      console.debug(this.formatMessage('debug', message, meta));
    }
  }

  info(message: string, meta?: any) {
    if (process.env.NODE_ENV !== 'test') {
      console.info(this.formatMessage('info', message, meta));
    }
  }

  warn(message: string, meta?: any) {
    if (process.env.NODE_ENV !== 'test') {
      console.warn(this.formatMessage('warn', message, meta));
    }
  }

  error(message: string, meta?: any) {
    console.error(this.formatMessage('error', message, meta));
  }
}

export const logger = new Logger();
