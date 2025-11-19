/**
 * Google Fit API Configuration
 *
 * Setup instructions:
 * 1. Go to Google Cloud Console: https://console.cloud.google.com/
 * 2. Enable Google Fitness API
 * 3. Create OAuth 2.0 credentials (Web application)
 * 4. Add authorized redirect URIs:
 *    - http://localhost:3000/api/auth/google-fit/callback (development)
 *    - https://yourdomain.com/api/auth/google-fit/callback (production)
 * 5. Add environment variables to .env.local:
 *    GOOGLE_FIT_CLIENT_ID=your_client_id
 *    GOOGLE_FIT_CLIENT_SECRET=your_client_secret
 *    GOOGLE_FIT_REDIRECT_URI=http://localhost:3000/api/auth/google-fit/callback
 */

export const GOOGLE_FIT_CONFIG = {
  // OAuth2 endpoints
  authEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',

  // API endpoints
  fitnessApiBase: 'https://www.googleapis.com/fitness/v1/users/me',

  // OAuth scopes needed
  scopes: [
    'https://www.googleapis.com/auth/fitness.activity.read',
    'https://www.googleapis.com/auth/fitness.heart_rate.read',
    'https://www.googleapis.com/auth/fitness.location.read',
  ],

  // Activity type codes (from Google Fit)
  activityTypes: {
    SOCCER: 9, // Football/Soccer
    RUNNING: 8,
    WALKING: 7,
    BIKING: 1,
  } as const,

  // Data source IDs for different metrics
  dataSources: {
    DISTANCE: 'derived:com.google.distance.delta:com.google.android.gms:merge_distance_delta',
    STEPS: 'derived:com.google.step_count.delta:com.google.android.gms:estimated_steps',
    CALORIES: 'derived:com.google.calories.expended:com.google.android.gms:merge_calories_expended',
    HEART_RATE: 'derived:com.google.heart_rate.bpm:com.google.android.gms:merge_heart_rate_bpm',
  } as const,
};

// Thresholds for attribute bonuses
// IMPORTANTE: Estos son BONUSES PEQUEÑOS Y OPCIONALES
// El sistema de evaluación normal (puntos/tags) es la forma PRINCIPAL de progresar
export const PERFORMANCE_THRESHOLDS = {
  // Distance thresholds (km)
  DISTANCE_EXCELLENT: 10, // +1 PAC
  DISTANCE_GOOD: 8, // +0.5 PAC (redondeado)
  DISTANCE_AVERAGE: 6, // No bonus

  // Heart rate thresholds (bpm)
  HR_ZONE_EXCELLENT_MIN: 140, // Maintaining high intensity
  HR_ZONE_EXCELLENT_MAX: 175, // But not overexerting
  HR_ZONE_GOOD_MIN: 120,

  // Steps thresholds
  STEPS_EXCELLENT: 15000, // Contribuye a PHY
  STEPS_GOOD: 12000,

  // Calories thresholds (kcal)
  CALORIES_EXCELLENT: 800, // Contribuye a PHY
  CALORIES_GOOD: 600,

  // Bonus caps (para evitar desventaja para quienes no tienen smartwatch)
  MAX_PAC_BONUS: 1, // Máximo +1 PAC por partido
  MAX_PHY_BONUS: 1, // Máximo +1 PHY por partido
} as const;

/**
 * Calculate attribute bonuses based on physical performance
 *
 * IMPORTANTE: Los valores son PEQUEÑOS E INTENCIONALMENTE LIMITADOS
 * - No tener smartwatch NO debe generar desventaja significativa
 * - El sistema de evaluación normal es la forma principal de progresar
 * - Esto es un complemento opcional, no un requisito
 *
 * @param performance - Physical metrics from smartwatch or manual entry
 * @returns Small attribute bonuses (max +1 per attribute)
 */
export function calculateAttributeImpact(performance: {
  distance?: number;
  avgHeartRate?: number;
  maxHeartRate?: number;
  steps?: number;
  calories?: number;
}): { pac?: number; phy?: number } {
  const impact: { pac?: number; phy?: number } = {};

  // Distance impact on PAC (Pace/Speed)
  // Reducido: Máximo +1 PAC
  if (performance.distance) {
    if (performance.distance >= PERFORMANCE_THRESHOLDS.DISTANCE_EXCELLENT) {
      impact.pac = 1; // Antes era +2, ahora +1
    } else if (performance.distance >= PERFORMANCE_THRESHOLDS.DISTANCE_GOOD) {
      impact.pac = 0.5; // Antes era +1, ahora +0.5 (se redondea en evaluación)
    }
  }

  // Heart rate and endurance impact on PHY (Physical)
  // Reducido: Máximo +1 PHY
  let phyBonus = 0;

  // Heart rate zone bonus
  if (performance.avgHeartRate && performance.maxHeartRate) {
    if (
      performance.avgHeartRate >= PERFORMANCE_THRESHOLDS.HR_ZONE_EXCELLENT_MIN &&
      performance.maxHeartRate <= PERFORMANCE_THRESHOLDS.HR_ZONE_EXCELLENT_MAX
    ) {
      phyBonus += 0.5; // Antes era +2
    } else if (performance.avgHeartRate >= PERFORMANCE_THRESHOLDS.HR_ZONE_GOOD_MIN) {
      phyBonus += 0.25; // Antes era +1
    }
  }

  // Steps bonus
  if (performance.steps) {
    if (performance.steps >= PERFORMANCE_THRESHOLDS.STEPS_EXCELLENT) {
      phyBonus += 0.25;
    }
  }

  // Calories bonus
  if (performance.calories) {
    if (performance.calories >= PERFORMANCE_THRESHOLDS.CALORIES_EXCELLENT) {
      phyBonus += 0.25;
    }
  }

  // Cap PHY bonus at +1 (antes era +3)
  if (phyBonus > 0) {
    impact.phy = Math.min(phyBonus, PERFORMANCE_THRESHOLDS.MAX_PHY_BONUS);
  }

  // Ensure PAC is also capped
  if (impact.pac) {
    impact.pac = Math.min(impact.pac, PERFORMANCE_THRESHOLDS.MAX_PAC_BONUS);
  }

  return impact;
}
