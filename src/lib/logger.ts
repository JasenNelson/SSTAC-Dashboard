/**
 * Structured Logging Utility for Server Actions
 * 
 * Provides consistent, structured logging for admin and non-poll operations.
 * Logs are formatted as JSON in production for easy parsing by log aggregation services.
 */

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogContext {
  [key: string]: unknown;
}

/**
 * Structured logger for server-side operations
 */
class Logger {
  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      ...context,
    };

    // In development, use readable format
    if (process.env.NODE_ENV === 'development') {
      return JSON.stringify(logEntry, null, 2);
    }

    // In production, use compact JSON for log aggregation
    return JSON.stringify(logEntry);
  }

  private shouldLog(level: LogLevel): boolean {
    // Always log errors
    if (level === 'error') return true;

    // Only log other levels in development
    if (process.env.NODE_ENV === 'development') {
      return true;
    }

    return false;
  }

  info(message: string, context?: LogContext): void {
    if (this.shouldLog('info')) {
      console.log(this.formatMessage('info', message, context));
    }
  }

  warn(message: string, context?: LogContext): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message, context));
    }
  }

  error(message: string, error?: Error | unknown, context?: LogContext): void {
    if (!this.shouldLog('error')) return;

    const errorContext: LogContext = {
      ...context,
    };

    if (error instanceof Error) {
      errorContext.errorName = error.name;
      errorContext.errorMessage = error.message;
      errorContext.errorStack = error.stack;
    } else if (error) {
      errorContext.error = String(error);
    }

    console.error(this.formatMessage('error', message, errorContext));
  }

  debug(message: string, context?: LogContext): void {
    if (this.shouldLog('debug')) {
      console.debug(this.formatMessage('debug', message, context));
    }
  }
}

// Export singleton instance
export const logger = new Logger();

// Export types for use in other files
export type { LogLevel, LogContext };

