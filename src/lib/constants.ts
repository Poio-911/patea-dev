/**
 * Application-wide constants
 * Centralized configuration values to avoid magic numbers
 */

/**
 * Credit system constants
 */
export const CREDITS = {
  /** Free monthly credits given to all players on the 1st of each month */
  MONTHLY_FREE: 3,

  /** Minimum credits required to generate an AI image */
  MIN_FOR_GENERATION: 1,
} as const;

/**
 * OVR (Overall Rating) system constants
 */
export const OVR_SYSTEM = {
  /** Minimum possible OVR value */
  MIN: 40,

  /** Maximum possible OVR value */
  MAX: 99,

  /** Default OVR for new players */
  DEFAULT: 70,

  /** OVR thresholds for tier classification */
  THRESHOLDS: {
    ELITE: 86,
    GOLD: 76,
    SILVER: 66,
    BRONZE: 0,
  },
} as const;

/**
 * Match system constants
 */
export const MATCH_SYSTEM = {
  /** Supported match sizes (number of players) */
  SIZES: [10, 14, 22] as const,

  /** Default match duration in minutes */
  DEFAULT_DURATION: 90,

  /** Minimum players required per team */
  MIN_PLAYERS_PER_TEAM: 5,
} as const;

/**
 * Evaluation system constants
 */
export const EVALUATION_SYSTEM = {
  /** Minimum rating value */
  MIN_RATING: 1,

  /** Maximum rating value */
  MAX_RATING: 10,

  /** Number of evaluations each player must provide */
  EVALUATIONS_PER_PLAYER: 2,
} as const;

/**
 * Animation timing constants (in seconds)
 */
export const ANIMATION_TIMING = {
  /** Base stagger delay for list animations */
  STAGGER_BASE: 0.03,

  /** Card entrance animation duration */
  CARD_ENTRANCE: 0.5,

  /** Hover transition duration */
  HOVER_TRANSITION: 0.2,
} as const;

/**
 * Firestore batch operation limits
 */
export const FIRESTORE_LIMITS = {
  /** Maximum operations per batch */
  MAX_BATCH_SIZE: 500,

  /** Maximum documents per 'in' query */
  MAX_IN_QUERY: 30,
} as const;

/**
 * Time zone configuration
 */
export const TIMEZONE = 'America/Argentina/Buenos_Aires' as const;
