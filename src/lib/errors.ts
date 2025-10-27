/**
 * Códigos de error estandarizados para la aplicación
 */

export const ErrorCodes = {
  // Authentication (AUTH_*)
  AUTH_UNAUTHORIZED: 'AUTH_UNAUTHORIZED',
  AUTH_INVALID_USER: 'AUTH_INVALID_USER',
  AUTH_NO_ACTIVE_GROUP: 'AUTH_NO_ACTIVE_GROUP',
  AUTH_MISSING_TOKEN: 'AUTH_MISSING_TOKEN',

  // Validation (VAL_*)
  VAL_MISSING_REQUIRED_FIELD: 'VAL_MISSING_REQUIRED_FIELD',
  VAL_INVALID_FORMAT: 'VAL_INVALID_FORMAT',
  VAL_OUT_OF_RANGE: 'VAL_OUT_OF_RANGE',
  VAL_DUPLICATE_ENTRY: 'VAL_DUPLICATE_ENTRY',

  // Database (DB_*)
  DB_READ_FAILED: 'DB_READ_FAILED',
  DB_WRITE_FAILED: 'DB_WRITE_FAILED',
  DB_UPDATE_FAILED: 'DB_UPDATE_FAILED',
  DB_DELETE_FAILED: 'DB_DELETE_FAILED',
  DB_NOT_FOUND: 'DB_NOT_FOUND',

  // AI Operations (AI_*)
  AI_GENERATION_FAILED: 'AI_GENERATION_FAILED',
  AI_INVALID_RESPONSE: 'AI_INVALID_RESPONSE',
  AI_QUOTA_EXCEEDED: 'AI_QUOTA_EXCEEDED',
  AI_MODEL_ERROR: 'AI_MODEL_ERROR',

  // File Operations (FILE_*)
  FILE_UPLOAD_FAILED: 'FILE_UPLOAD_FAILED',
  FILE_INVALID_TYPE: 'FILE_INVALID_TYPE',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',

  // Match Operations (MATCH_*)
  MATCH_NOT_FOUND: 'MATCH_NOT_FOUND',
  MATCH_ALREADY_EVALUATED: 'MATCH_ALREADY_EVALUATED',
  MATCH_INVALID_STATUS: 'MATCH_INVALID_STATUS',

  // Player Operations (PLAYER_*)
  PLAYER_NOT_FOUND: 'PLAYER_NOT_FOUND',
  PLAYER_NOT_IN_MATCH: 'PLAYER_NOT_IN_MATCH',
  PLAYER_ALREADY_EXISTS: 'PLAYER_ALREADY_EXISTS',

  // Generic
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT: 'TIMEOUT',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

/**
 * Clase de error personalizada con código de error
 */
export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public statusCode: number = 500,
    public context?: Record<string, any>
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/**
 * Helper para crear errores con códigos
 */
export function createError(
  code: ErrorCode,
  message: string,
  statusCode?: number,
  context?: Record<string, any>
): AppError {
  return new AppError(code, message, statusCode, context);
}

/**
 * Mensajes de error user-friendly
 */
export const ErrorMessages: Record<ErrorCode, string> = {
  // Auth
  [ErrorCodes.AUTH_UNAUTHORIZED]: 'No tienes permiso para realizar esta acción',
  [ErrorCodes.AUTH_INVALID_USER]: 'Usuario inválido o no encontrado',
  [ErrorCodes.AUTH_NO_ACTIVE_GROUP]: 'No tienes un grupo activo',
  [ErrorCodes.AUTH_MISSING_TOKEN]: 'Token de autenticación faltante',

  // Validation
  [ErrorCodes.VAL_MISSING_REQUIRED_FIELD]: 'Falta un campo requerido',
  [ErrorCodes.VAL_INVALID_FORMAT]: 'Formato de datos inválido',
  [ErrorCodes.VAL_OUT_OF_RANGE]: 'Valor fuera del rango permitido',
  [ErrorCodes.VAL_DUPLICATE_ENTRY]: 'Este registro ya existe',

  // Database
  [ErrorCodes.DB_READ_FAILED]: 'Error al leer de la base de datos',
  [ErrorCodes.DB_WRITE_FAILED]: 'Error al escribir en la base de datos',
  [ErrorCodes.DB_UPDATE_FAILED]: 'Error al actualizar el registro',
  [ErrorCodes.DB_DELETE_FAILED]: 'Error al eliminar el registro',
  [ErrorCodes.DB_NOT_FOUND]: 'Registro no encontrado',

  // AI
  [ErrorCodes.AI_GENERATION_FAILED]: 'Error al generar contenido con IA',
  [ErrorCodes.AI_INVALID_RESPONSE]: 'Respuesta inválida de la IA',
  [ErrorCodes.AI_QUOTA_EXCEEDED]: 'Cuota de IA excedida',
  [ErrorCodes.AI_MODEL_ERROR]: 'Error en el modelo de IA',

  // File
  [ErrorCodes.FILE_UPLOAD_FAILED]: 'Error al subir el archivo',
  [ErrorCodes.FILE_INVALID_TYPE]: 'Tipo de archivo no permitido',
  [ErrorCodes.FILE_TOO_LARGE]: 'El archivo es demasiado grande',

  // Match
  [ErrorCodes.MATCH_NOT_FOUND]: 'Partido no encontrado',
  [ErrorCodes.MATCH_ALREADY_EVALUATED]: 'Este partido ya fue evaluado',
  [ErrorCodes.MATCH_INVALID_STATUS]: 'Estado del partido inválido',

  // Player
  [ErrorCodes.PLAYER_NOT_FOUND]: 'Jugador no encontrado',
  [ErrorCodes.PLAYER_NOT_IN_MATCH]: 'El jugador no participó en este partido',
  [ErrorCodes.PLAYER_ALREADY_EXISTS]: 'Este jugador ya existe',

  // Generic
  [ErrorCodes.UNKNOWN_ERROR]: 'Ocurrió un error inesperado',
  [ErrorCodes.NETWORK_ERROR]: 'Error de conexión',
  [ErrorCodes.TIMEOUT]: 'La operación tardó demasiado',
};
