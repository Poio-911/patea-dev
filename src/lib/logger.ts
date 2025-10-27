/**
 * Sistema de logging centralizado
 * - En desarrollo: muestra todos los logs
 * - En producción: solo errors
 */

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogContext {
  [key: string]: any;
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development';

  private log(level: LogLevel, message: string, error?: Error | unknown, context?: LogContext) {
    // En producción, solo mostrar errors
    if (!this.isDevelopment && level !== 'error') {
      return;
    }

    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;

    const contextStr = context ? ` | Context: ${JSON.stringify(context)}` : '';
    const errorStr = error ? ` | Error: ${error instanceof Error ? error.message : String(error)}` : '';

    const fullMessage = `${prefix} ${message}${contextStr}${errorStr}`;

    switch (level) {
      case 'error':
        console.error(fullMessage);
        if (error instanceof Error && error.stack) {
          console.error(error.stack);
        }
        break;
      case 'warn':
        console.warn(fullMessage);
        break;
      case 'debug':
        if (this.isDevelopment) {
            console.debug(fullMessage);
        }
        break;
      default:
        console.log(fullMessage);
    }
  }

  info(message: string, context?: LogContext) {
    this.log('info', message, undefined, context);
  }

  warn(message: string, context?: LogContext) {
    this.log('warn', message, undefined, context);
  }

  error(message: string, error?: Error | unknown, context?: LogContext) {
    this.log('error', message, error, context);
  }

  debug(message: string, context?: LogContext) {
    this.log('debug', message, undefined, context);
  }
}

export const logger = new Logger();
