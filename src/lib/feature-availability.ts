export const FEATURE_AVAILABILITY = {
  payments: false,
  aiImageGeneration: false,
} as const;

export const FEATURE_DISABLED_MESSAGES = {
  payments: 'Mercado Pago está temporalmente deshabilitado.',
  aiImageGeneration: 'La generación de imágenes con IA está temporalmente desactivada.',
} as const;

export type FeatureKey = keyof typeof FEATURE_AVAILABILITY;

export function isFeatureEnabled(feature: FeatureKey): boolean {
  return FEATURE_AVAILABILITY[feature];
}
