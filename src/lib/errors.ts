
/**
 * Sistema de manejo de errores estandarizado
 *
 * Provee tipos de error específicos, códigos de error para tracking,
 * y helpers para formatear responses consistentes.
 */

import { logger } from './logger';

// ──────────────────────────────────────────────────────────────
// CÓDIGOS DE ERROR
// ──────────────────────────────────────────────────────────────

export const ErrorCodes = {
  // Errores de autenticación (AUTH_xxx)
  AUTH_UNAUTHORIZED: 'AUTH_UNAUTHORIZED',
  AUTH_INVALID_TOKEN: 'AUTH_INVALID_TOKEN',
  AUTH_INSUFFICIENT_PERMISSIONS: 'AUTH_INSUFFICIENT_PERMISSIONS',

  // Errores de validación (VAL_xxx)
  VAL_MISSING_FIELD: 'VAL_MISSING_FIELD',
  VAL_INVALID_FORMAT: 'VAL_INVALID_FORMAT',
  VAL_OUT_OF_RANGE: 'VAL_OUT_OF_RANGE',

  // Errores de datos (DATA_xxx)
  DATA_NOT_FOUND: 'DATA_NOT_FOUND',
  DATA_ALREADY_EXISTS: 'DATA_ALREADY_EXISTS',
  DATA_INTEGRITY_ERROR: 'DATA_INTEGRITY_ERROR',

  // Errores de IA (AI_xxx)
  AI_GENERATION_FAILED: 'AI_GENERATION_FAILED',
  AI_INVALID_RESPONSE: 'AI_INVALID_RESPONSE',
  AI_NO_CREDITS: 'AI_NO_CREDITS',
  AI_TIMEOUT: 'AI_TIMEOUT',

  // Errores de recursos (RES_xxx)
  RES_INSUFFICIENT_CREDITS: 'RES_INSUFFICIENT_CREDITS',
  RES_QUOTA_EXCEEDED: 'RES_QUOTA_EXCEEDED',
  RES_UPLOAD_FAILED: 'RES_UPLOAD_FAILED',

  // Errores del sistema (SYS_xxx)
  SYS_DATABASE_ERROR: 'SYS_DATABASE_ERROR',
  SYS_EXTERNAL_SERVICE_ERROR: 'SYS_EXTERNAL_SERVICE_ERROR',
  SYS_INTERNAL_ERROR: 'SYS_INTERNAL_ERROR',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

// ──────────────────────────────────────────────────────────────
// TIPOS DE ERROR
// ──────────────────────────────────────────────────────────────

export interface AppError {
  code: ErrorCode;
  message: string;
  userMessage?: string; // Mensaje amigable para mostrar al usuario
  context?: Record<string, any>; // Contexto adicional para debugging
  originalError?: any;
}

export interface ErrorResponse {
  error: string; // Mensaje para el usuario
  code?: ErrorCode; // Código de error para tracking
  details?: string; // Detalles técnicos (solo en dev)
}

// ──────────────────────────────────────────────────────────────
// MENSAJES DE ERROR PREDEFINIDOS
// ──────────────────────────────────────────────────────────────

const ERROR_MESSAGES: Record<ErrorCode, { user: string; technical: string }> = {
  // Auth errors
  [ErrorCodes.AUTH_UNAUTHORIZED]: {
    user: 'Necesitás estar logueado para realizar esta acción.',
    technical: 'User is not authenticated',
  },
  [ErrorCodes.AUTH_INVALID_TOKEN]: {
    user: 'Tu sesión expiró. Por favor, iniciá sesión nuevamente.',
    technical: 'Invalid authentication token',
  },
  [ErrorCodes.AUTH_INSUFFICIENT_PERMISSIONS]: {
    user: 'No tenés permisos para realizar esta acción.',
    technical: 'Insufficient permissions for this operation',
  },

  // Validation errors
  [ErrorCodes.VAL_MISSING_FIELD]: {
    user: 'Falta información requerida. Verificá los datos ingresados.',
    technical: 'Required field is missing',
  },
  [ErrorCodes.VAL_INVALID_FORMAT]: {
    user: 'El formato de los datos no es válido.',
    technical: 'Data format validation failed',
  },
  [ErrorCodes.VAL_OUT_OF_RANGE]: {
    user: 'El valor está fuera del rango permitido.',
    technical: 'Value is out of acceptable range',
  },

  // Data errors
  [ErrorCodes.DATA_NOT_FOUND]: {
    user: 'No se encontró la información solicitada.',
    technical: 'Requested resource not found',
  },
  [ErrorCodes.DATA_ALREADY_EXISTS]: {
    user: 'Esta información ya existe.',
    technical: 'Resource already exists',
  },
  [ErrorCodes.DATA_INTEGRITY_ERROR]: {
    user: 'Hubo un problema con la integridad de los datos.',
    technical: 'Data integrity constraint violated',
  },

  // AI errors
  [ErrorCodes.AI_GENERATION_FAILED]: {
    user: 'La IA no pudo generar el contenido. Intentalo de nuevo.',
    technical: 'AI generation failed',
  },
  [ErrorCodes.AI_INVALID_RESPONSE]: {
    user: 'La IA devolvió una respuesta inesperada. Intentalo de nuevo.',
    technical: 'AI returned invalid response format',
  },
  [ErrorCodes.AI_NO_CREDITS]: {
    user: 'No te quedan créditos para esta función.',
    technical: 'Insufficient AI generation credits',
  },
  [ErrorCodes.AI_TIMEOUT]: {
    user: 'La IA tardó demasiado en responder. Intentalo de nuevo.',
    technical: 'AI generation timeout',
  },

  // Resource errors
  [ErrorCodes.RES_INSUFFICIENT_CREDITS]: {
    user: 'No tenés suficientes créditos para esta acción.',
    technical: 'Insufficient credits',
  },
  [ErrorCodes.RES_QUOTA_EXCEEDED]: {
    user: 'Alcanzaste el límite de uso. Intentalo más tarde.',
    technical: 'Usage quota exceeded',
  },
  [ErrorCodes.RES_UPLOAD_FAILED]: {
    user: 'No se pudo subir el archivo. Verificá el formato y tamaño.',
    technical: 'File upload failed',
  },

  // System errors
  [ErrorCodes.SYS_DATABASE_ERROR]: {
    user: 'Hubo un problema con la base de datos. Intentalo de nuevo.',
    technical: 'Database operation failed',
  },
  [ErrorCodes.SYS_EXTERNAL_SERVICE_ERROR]: {
    user: 'Un servicio externo no está disponible. Intentalo de nuevo.',
    technical: 'External service error',
  },
  [ErrorCodes.SYS_INTERNAL_ERROR]: {
    user: 'Ocurrió un error inesperado. Por favor, intentalo de nuevo.',
    technical: 'Internal server error',
  },
};

// ──────────────────────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────────────────────

/**
 * Crea un error estandarizado con código y contexto
 */
export function createError(
  code: ErrorCode,
  context?: Record<string, any>,
  originalError?: any
): AppError {
  const messages = ERROR_MESSAGES[code];

  return {
    code,
    message: messages.technical,
    userMessage: messages.user,
    context,
    originalError,
  };
}

/**
 * Formatea un error para enviar al cliente
 * - En desarrollo: incluye detalles técnicos
 * - En producción: solo mensaje amigable
 */
export function formatErrorResponse(error: AppError): ErrorResponse {
  const isDevelopment = process.env.NODE_ENV === 'development';

  const response: ErrorResponse = {
    error: error.userMessage || error.message,
    code: error.code,
  };

  if (isDevelopment && error.message) {
    response.details = error.message;
  }

  // Log error para tracking
  logger.error(
    `[${error.code}] ${error.message}`,
    error.originalError,
    error.context
  );

  return response;
}

/**
 * Handler genérico para errores en Server Actions
 * Detecta el tipo de error y retorna response apropiado
 */
export function handleServerActionError(
  error: any,
  context?: Record<string, any>
): ErrorResponse {
  // Error de Firebase Auth
  if (error.code?.startsWith('auth/')) {
    const appError = createError(ErrorCodes.AUTH_UNAUTHORIZED, context, error);
    return formatErrorResponse(appError);
  }

  // Error de Firestore
  if (error.code?.startsWith('firestore/')) {
    const appError = createError(ErrorCodes.SYS_DATABASE_ERROR, context, error);
    return formatErrorResponse(appError);
  }

  // Error de validación (Zod, etc.)
  if (error.name === 'ZodError' || error.name === 'ValidationError') {
    const appError = createError(ErrorCodes.VAL_INVALID_FORMAT, context, error);
    return formatErrorResponse(appError);
  }

  // Error de IA (JSON parse, timeout)
  if (error instanceof SyntaxError || error.message?.includes('Unexpected token')) {
    const appError = createError(ErrorCodes.AI_INVALID_RESPONSE, context, error);
    return formatErrorResponse(appError);
  }

  // Error genérico
  const appError = createError(ErrorCodes.SYS_INTERNAL_ERROR, context, error);
  return formatErrorResponse(appError);
}

/**
 * Verifica si un objeto es un ErrorResponse
 */
export function isErrorResponse(obj: any): obj is ErrorResponse {
  return obj && typeof obj === 'object' && 'error' in obj;
}

    