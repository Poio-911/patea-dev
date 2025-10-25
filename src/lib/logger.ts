/**
 * Sistema de logging condicional para desarrollo y producción
 *
 * - log(): Solo se muestra en desarrollo
 * - warn(): Se muestra siempre
 * - error(): Se muestra siempre (en futuro se puede integrar con Sentry)
 */

const isDevelopment = process.env.NODE_ENV === 'development';

export const logger = {
  /**
   * Log normal - solo en desarrollo
   */
  log: (...args: any[]) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },

  /**
   * Warning - siempre se muestra
   */
  warn: (...args: any[]) => {
    console.warn(...args);
  },

  /**
   * Error - siempre se muestra y se puede enviar a servicio de tracking
   */
  error: (message: string, error?: any, context?: Record<string, any>) => {
    console.error(`[ERROR] ${message}`, error, context);

    // TODO: Integrar con servicio de error tracking (ej: Sentry)
    // if (typeof window !== 'undefined' && window.Sentry) {
    //   window.Sentry.captureException(error, {
    //     extra: { message, ...context }
    //   });
    // }
  },

  /**
   * Info - solo en desarrollo
   */
  info: (...args: any[]) => {
    if (isDevelopment) {
      console.info(...args);
    }
  },

  /**
   * Debug - solo en desarrollo
   */
  debug: (...args: any[]) => {
    if (isDevelopment) {
      console.debug(...args);
    }
  },
};
