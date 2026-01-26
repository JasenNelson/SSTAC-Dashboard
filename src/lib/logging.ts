/**
 * Structured Logging Utility
 *
 * Provides consistent, JSON-structured logging across the application.
 * Logs are formatted for easy parsing by log aggregation services
 * (LogRocket, Datadog, CloudWatch, etc.)
 *
 * Usage:
 * ```typescript
 * import { logger } from '@/lib/logging';
 *
 * logger.info('User logged in', {
 *   userId: user.id,
 *   timestamp: new Date(),
 * });
 *
 * logger.error('Database connection failed', {
 *   error: err.message,
 *   database: 'production',
 *   retryCount: 3,
 * });
 * ```
 */

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL',
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context: Record<string, unknown>;
  environment: string;
  version: string;
  requestId?: string;
  userId?: string;
  sessionId?: string;
  tags?: string[];
  source: 'server' | 'client' | 'api' | 'database';
}

class Logger {
  private environment: string;
  private version: string;
  private requestId?: string;

  constructor() {
    this.environment = process.env.NODE_ENV || 'development';
    this.version = process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0';
  }

  setRequestId(id: string): void {
    this.requestId = id;
  }

  clearRequestId(): void {
    this.requestId = undefined;
  }

  private formatLog(
    level: LogLevel,
    message: string,
    context: Record<string, unknown> = {},
    source: 'server' | 'client' | 'api' | 'database' = 'server'
  ): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      environment: this.environment,
      version: this.version,
      requestId: this.requestId,
      source,
    };
  }

  private output(entry: LogEntry): void {
    const json = JSON.stringify(entry);

    // Always log to console in development
    if (this.environment === 'development') {
      const colors: Record<LogLevel, string> = {
        [LogLevel.DEBUG]: '\x1b[36m', // cyan
        [LogLevel.INFO]: '\x1b[32m', // green
        [LogLevel.WARN]: '\x1b[33m', // yellow
        [LogLevel.ERROR]: '\x1b[31m', // red
        [LogLevel.CRITICAL]: '\x1b[35m', // magenta
      };
      const reset = '\x1b[0m';
      const color = colors[entry.level] || '';
      console.log(`${color}[${entry.level}]${reset} ${entry.message}`, entry.context);
    } else {
      // Production: use appropriate console method for proper severity handling
      switch (entry.level) {
        case LogLevel.DEBUG:
          console.debug(json);
          break;
        case LogLevel.INFO:
          console.log(json);
          break;
        case LogLevel.WARN:
          console.warn(json);
          break;
        case LogLevel.ERROR:
        case LogLevel.CRITICAL:
          console.error(json);
          break;
      }
    }

    // Send to log aggregation service (if configured)
    if (typeof window === 'undefined') {
      // Server-side: send to server logs
      this.sendToAggregationService(entry);
    }
  }

  private async sendToAggregationService(entry: LogEntry): Promise<void> {
    // Log to database for persistence and searching
    // This is completely free and you own the data
    if (typeof window === 'undefined' && entry.level === LogLevel.ERROR) {
      try {
        // Send error logs to database for audit trail
        // Uses Supabase which you already have
        await fetch('/api/logs/store', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(entry),
        }).catch(() => {
          // Silently fail - don't let logging errors break the app
        });
      } catch (error) {
        console.error('Failed to persist log to database', error);
      }
    }
  }

  debug(message: string, context?: Record<string, unknown>): void {
    const entry = this.formatLog(LogLevel.DEBUG, message, context);
    this.output(entry);
  }

  info(message: string, context?: Record<string, unknown>): void {
    const entry = this.formatLog(LogLevel.INFO, message, context);
    this.output(entry);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    const entry = this.formatLog(LogLevel.WARN, message, context);
    this.output(entry);
  }

  error(message: string, context?: Record<string, unknown>): void {
    const entry = this.formatLog(LogLevel.ERROR, message, context);
    this.output(entry);
  }

  critical(message: string, context?: Record<string, unknown>): void {
    const entry = this.formatLog(LogLevel.CRITICAL, message, context);
    this.output(entry);
  }

  // API-specific logging
  logApiRequest(
    method: string,
    path: string,
    statusCode: number,
    duration: number,
    context?: Record<string, unknown>
  ): void {
    const message = `API ${method} ${path}`;
    const level = statusCode >= 500 ? LogLevel.ERROR : statusCode >= 400 ? LogLevel.WARN : LogLevel.INFO;

    this.formatLog(level, message, {
      method,
      path,
      statusCode,
      duration,
      ...context,
    }, 'api');
  }

  // Database-specific logging
  logDatabaseQuery(
    query: string,
    duration: number,
    success: boolean,
    context?: Record<string, unknown>
  ): void {
    const level = success ? LogLevel.DEBUG : LogLevel.ERROR;
    const message = success ? 'Database query executed' : 'Database query failed';

    this.formatLog(level, message, {
      query: query.substring(0, 200), // Truncate for privacy
      duration,
      success,
      ...context,
    }, 'database');
  }

  // Authentication-specific logging
  logAuthEvent(
    event: 'login' | 'logout' | 'signup' | 'failed_login',
    userId?: string,
    context?: Record<string, unknown>
  ): void {
    const message = `Authentication: ${event}`;
    const entry = this.formatLog(LogLevel.INFO, message, {
      event,
      userId,
      ...context,
    });
    entry.userId = userId;
    this.output(entry);
  }

  // Security-specific logging
  logSecurityEvent(
    event: 'unauthorized_access' | 'rate_limit' | 'suspicious_activity' | 'config_change',
    severity: 'info' | 'warn' | 'critical',
    context?: Record<string, unknown>
  ): void {
    const levelMap = {
      info: LogLevel.INFO,
      warn: LogLevel.WARN,
      critical: LogLevel.CRITICAL,
    };

    const message = `Security: ${event}`;
    this.formatLog(levelMap[severity], message, {
      event,
      severity,
      ...context,
    });
  }
}

// Export singleton instance
export const logger = new Logger();
