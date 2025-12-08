/**
 * Validation utilities for user inputs
 * Centralized validation logic with clear error messages
 */

import { OVR_SYSTEM, EVALUATION_SYSTEM, MATCH_SYSTEM } from './constants';

/**
 * Validation result type
 */
export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Email validation
 */
export function validateEmail(email: string): ValidationResult {
  if (!email || email.trim().length === 0) {
    return { isValid: false, error: 'El email es requerido' };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { isValid: false, error: 'El email no es válido' };
  }

  if (email.length > 254) {
    return { isValid: false, error: 'El email es demasiado largo' };
  }

  return { isValid: true };
}

/**
 * Phone number validation (Argentina format)
 */
export function validatePhone(phone: string): ValidationResult {
  if (!phone || phone.trim().length === 0) {
    return { isValid: false, error: 'El teléfono es requerido' };
  }

  // Remove spaces, dashes, and parentheses
  const cleaned = phone.replace(/[\s\-()]/g, '');

  // Argentina phone: 10 digits (with area code) or international format
  const phoneRegex = /^(\+549?)?[1-9]\d{9,10}$/;
  if (!phoneRegex.test(cleaned)) {
    return { isValid: false, error: 'El teléfono no es válido (debe tener 10 dígitos)' };
  }

  return { isValid: true };
}

/**
 * OVR (Overall Rating) validation
 */
export function validateOvr(ovr: number): ValidationResult {
  if (typeof ovr !== 'number' || isNaN(ovr)) {
    return { isValid: false, error: 'El OVR debe ser un número' };
  }

  if (ovr < OVR_SYSTEM.MIN || ovr > OVR_SYSTEM.MAX) {
    return {
      isValid: false,
      error: `El OVR debe estar entre ${OVR_SYSTEM.MIN} y ${OVR_SYSTEM.MAX}`
    };
  }

  if (!Number.isInteger(ovr)) {
    return { isValid: false, error: 'El OVR debe ser un número entero' };
  }

  return { isValid: true };
}

/**
 * Attribute value validation (PAC, SHO, PAS, DRI, DEF, PHY)
 */
export function validateAttribute(value: number, attributeName: string): ValidationResult {
  if (typeof value !== 'number' || isNaN(value)) {
    return { isValid: false, error: `${attributeName} debe ser un número` };
  }

  if (value < OVR_SYSTEM.MIN || value > OVR_SYSTEM.MAX) {
    return {
      isValid: false,
      error: `${attributeName} debe estar entre ${OVR_SYSTEM.MIN} y ${OVR_SYSTEM.MAX}`
    };
  }

  if (!Number.isInteger(value)) {
    return { isValid: false, error: `${attributeName} debe ser un número entero` };
  }

  return { isValid: true };
}

/**
 * Rating validation (evaluation system 1-10)
 */
export function validateRating(rating: number): ValidationResult {
  if (typeof rating !== 'number' || isNaN(rating)) {
    return { isValid: false, error: 'La calificación debe ser un número' };
  }

  if (rating < EVALUATION_SYSTEM.MIN_RATING || rating > EVALUATION_SYSTEM.MAX_RATING) {
    return {
      isValid: false,
      error: `La calificación debe estar entre ${EVALUATION_SYSTEM.MIN_RATING} y ${EVALUATION_SYSTEM.MAX_RATING}`
    };
  }

  if (!Number.isInteger(rating)) {
    return { isValid: false, error: 'La calificación debe ser un número entero' };
  }

  return { isValid: true };
}

/**
 * Player name validation
 */
export function validatePlayerName(name: string): ValidationResult {
  if (!name || name.trim().length === 0) {
    return { isValid: false, error: 'El nombre es requerido' };
  }

  if (name.trim().length < 2) {
    return { isValid: false, error: 'El nombre debe tener al menos 2 caracteres' };
  }

  if (name.length > 50) {
    return { isValid: false, error: 'El nombre es demasiado largo (máximo 50 caracteres)' };
  }

  // Only letters, spaces, hyphens, and apostrophes
  const nameRegex = /^[a-zA-ZÀ-ÿ\s'-]+$/;
  if (!nameRegex.test(name)) {
    return { isValid: false, error: 'El nombre contiene caracteres inválidos' };
  }

  return { isValid: true };
}

/**
 * Match size validation
 */
export function validateMatchSize(size: number): ValidationResult {
  if (typeof size !== 'number' || isNaN(size)) {
    return { isValid: false, error: 'El tamaño del partido debe ser un número' };
  }

  if (!MATCH_SYSTEM.SIZES.includes(size as any)) {
    return {
      isValid: false,
      error: `El tamaño del partido debe ser uno de: ${MATCH_SYSTEM.SIZES.join(', ')}`
    };
  }

  return { isValid: true };
}

/**
 * Date validation (future date for matches)
 */
export function validateFutureDate(dateString: string): ValidationResult {
  if (!dateString || dateString.trim().length === 0) {
    return { isValid: false, error: 'La fecha es requerida' };
  }

  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    return { isValid: false, error: 'La fecha no es válida' };
  }

  const now = new Date();
  now.setHours(0, 0, 0, 0); // Reset to start of day

  if (date < now) {
    return { isValid: false, error: 'La fecha no puede ser en el pasado' };
  }

  return { isValid: true };
}

/**
 * Time validation (HH:MM format)
 */
export function validateTime(time: string): ValidationResult {
  if (!time || time.trim().length === 0) {
    return { isValid: false, error: 'La hora es requerida' };
  }

  const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
  if (!timeRegex.test(time)) {
    return { isValid: false, error: 'La hora debe estar en formato HH:MM (ej: 20:00)' };
  }

  return { isValid: true };
}

/**
 * Text input sanitization (removes dangerous characters)
 */
export function sanitizeText(text: string): string {
  if (!text) return '';

  // Remove HTML tags
  let sanitized = text.replace(/<[^>]*>/g, '');

  // Remove script-like content
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // Trim whitespace
  sanitized = sanitized.trim();

  return sanitized;
}

/**
 * URL validation
 */
export function validateUrl(url: string): ValidationResult {
  if (!url || url.trim().length === 0) {
    return { isValid: false, error: 'La URL es requerida' };
  }

  try {
    const urlObj = new URL(url);
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return { isValid: false, error: 'La URL debe usar HTTP o HTTPS' };
    }
    return { isValid: true };
  } catch {
    return { isValid: false, error: 'La URL no es válida' };
  }
}

/**
 * Credit amount validation
 */
export function validateCreditAmount(amount: number): ValidationResult {
  if (typeof amount !== 'number' || isNaN(amount)) {
    return { isValid: false, error: 'La cantidad de créditos debe ser un número' };
  }

  if (amount < 0) {
    return { isValid: false, error: 'La cantidad de créditos no puede ser negativa' };
  }

  if (!Number.isInteger(amount)) {
    return { isValid: false, error: 'La cantidad de créditos debe ser un número entero' };
  }

  return { isValid: true };
}

/**
 * Price validation (Argentina pesos)
 */
export function validatePrice(price: number): ValidationResult {
  if (typeof price !== 'number' || isNaN(price)) {
    return { isValid: false, error: 'El precio debe ser un número' };
  }

  if (price < 0) {
    return { isValid: false, error: 'El precio no puede ser negativo' };
  }

  if (price > 1000000) {
    return { isValid: false, error: 'El precio es demasiado alto' };
  }

  return { isValid: true };
}

/**
 * GPS coordinates validation (lat/lng)
 */
export function validateCoordinates(lat: number, lng: number): ValidationResult {
  if (typeof lat !== 'number' || isNaN(lat) || typeof lng !== 'number' || isNaN(lng)) {
    return { isValid: false, error: 'Las coordenadas deben ser números' };
  }

  if (lat < -90 || lat > 90) {
    return { isValid: false, error: 'La latitud debe estar entre -90 y 90' };
  }

  if (lng < -180 || lng > 180) {
    return { isValid: false, error: 'La longitud debe estar entre -180 y 180' };
  }

  return { isValid: true };
}

/**
 * Jersey configuration validation
 */
export function validateJersey(jersey: any): ValidationResult {
  if (!jersey || typeof jersey !== 'object') {
    return { isValid: false, error: 'La camiseta debe ser un objeto' };
  }

  // Validate primary color (hex format)
  if (!jersey.primaryColor || !/^#[0-9A-F]{6}$/i.test(jersey.primaryColor)) {
    return { isValid: false, error: 'El color primario debe ser un código hex válido (ej: #FF0000)' };
  }

  // Validate secondary color (hex format)
  if (!jersey.secondaryColor || !/^#[0-9A-F]{6}$/i.test(jersey.secondaryColor)) {
    return { isValid: false, error: 'El color secundario debe ser un código hex válido' };
  }

  // Validate pattern
  const validPatterns = ['solid', 'stripes', 'horizontal', 'diagonal', 'checkered'];
  if (!jersey.pattern || !validPatterns.includes(jersey.pattern)) {
    return { isValid: false, error: `El patrón debe ser uno de: ${validPatterns.join(', ')}` };
  }

  return { isValid: true };
}

/**
 * Cup bracket structure validation
 */
export function validateBracketStructure(teams: number): ValidationResult {
  if (typeof teams !== 'number' || isNaN(teams)) {
    return { isValid: false, error: 'La cantidad de equipos debe ser un número' };
  }

  if (teams < 2) {
    return { isValid: false, error: 'Debe haber al menos 2 equipos' };
  }

  if (teams > 64) {
    return { isValid: false, error: 'Máximo 64 equipos permitidos' };
  }

  // Check if power of 2
  const isPowerOfTwo = (n: number) => n > 0 && (n & (n - 1)) === 0;
  if (!isPowerOfTwo(teams)) {
    return { isValid: false, error: 'La cantidad de equipos debe ser potencia de 2 (2, 4, 8, 16, 32, 64)' };
  }

  return { isValid: true };
}

/**
 * Match score validation
 */
export function validateMatchScore(score: number): ValidationResult {
  if (typeof score !== 'number' || isNaN(score)) {
    return { isValid: false, error: 'El marcador debe ser un número' };
  }

  if (score < 0) {
    return { isValid: false, error: 'El marcador no puede ser negativo' };
  }

  if (!Number.isInteger(score)) {
    return { isValid: false, error: 'El marcador debe ser un número entero' };
  }

  if (score > 99) {
    return { isValid: false, error: 'El marcador no puede ser mayor a 99' };
  }

  return { isValid: true };
}

/**
 * League/Cup name validation
 */
export function validateCompetitionName(name: string): ValidationResult {
  if (!name || name.trim().length === 0) {
    return { isValid: false, error: 'El nombre de la competencia es requerido' };
  }

  if (name.trim().length < 3) {
    return { isValid: false, error: 'El nombre debe tener al menos 3 caracteres' };
  }

  if (name.length > 100) {
    return { isValid: false, error: 'El nombre es demasiado largo (máximo 100 caracteres)' };
  }

  return { isValid: true };
}
