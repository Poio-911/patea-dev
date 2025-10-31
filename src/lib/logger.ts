
/**
 * Sistema de logging centralizado para la aplicación.
 *
 * - En desarrollo (`development`): Muestra todos los niveles de log (info, warn, error, debug).
 * - En producción (`production`): Solo muestra `warn` y `error` para mantener los logs limpios.
 *
 * Futura integración con servicios de monitoreo como Sentry se puede añadir aquí.
 */

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogContext {
  [key: string]: any;
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development';

  private log(level: LogLevel, message: string, error?: Error | unknown, context?: LogContext) {
    // En producción, solo mostrar warn y error.
    if (!this.isDevelopment && (level === 'info' || level === 'debug')) {
      return;
    }

    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;

    const contextStr = context ? ` | Context: ${JSON.stringify(context, null, 2)}` : '';
    let errorStr = '';

    if (error) {
        if (error instanceof Error) {
            errorStr = ` | Error: ${error.message}`;
        } else if (typeof error === 'object' && error !== null && 'message' in error) {
            errorStr = ` | Error: ${(error as { message: string }).message}`;
        } else {
            errorStr = ` | Error: ${String(error)}`;
        }
    }

    const fullMessage = `${prefix} ${message}${contextStr}${errorStr}`;

    switch (level) {
      case 'error':
        console.error(fullMessage);
        if (error instanceof Error && error.stack) {
          // Loggear el stack trace por separado para mejor legibilidad.
          console.error(error.stack);
        }
        break;
      case 'warn':
        console.warn(fullMessage);
        break;
      case 'debug':
        // El debug solo se muestra en desarrollo, incluso si se llama en producción.
        if (this.isDevelopment) {
            console.debug(fullMessage);
        }
        break;
      default:
        console.log(fullMessage);
    }
  }

  /**
   * Logs de información general. Solo visibles en desarrollo.
   */
  info(message: string, context?: LogContext) {
    this.log('info', message, undefined, context);
  }

  /**
   * Advertencias sobre posibles problemas que no son errores críticos. Visibles en producción.
   */
  warn(message: string, context?: LogContext) {
    this.log('warn', message, undefined, context);
  }

  /**
   * Errores que deben ser investigados. Visibles en producción.
   */
  error(message: string, error?: Error | unknown, context?: LogContext) {
    this.log('error', message, error, context);
  }

  /**
   * Logs detallados para debugging. Solo visibles en desarrollo.
   */
  debug(message: string, context?: LogContext) {
    this.log('debug', message, undefined, context);
  }
}

export const logger = new Logger();
