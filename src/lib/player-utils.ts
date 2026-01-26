/**
 * Player utility functions
 * Centralized logic for player-related calculations and classifications
 */

import { OVR_SYSTEM } from './constants';

/**
 * OVR level classification type
 */
export type OvrLevel = 'elite' | 'gold' | 'silver' | 'bronze';

/**
 * Get OVR level classification based on player overall rating
 * @param ovr - Player overall rating (0-99)
 * @returns OVR level: elite (86+), gold (76-85), silver (66-75), bronze (<66)
 */
export function getOvrLevel(ovr: number): OvrLevel {
  if (ovr >= OVR_SYSTEM.THRESHOLDS.ELITE) return 'elite';
  if (ovr >= OVR_SYSTEM.THRESHOLDS.GOLD) return 'gold';
  if (ovr >= OVR_SYSTEM.THRESHOLDS.SILVER) return 'silver';
  return 'bronze';
}

/**
 * OVR thresholds for each level (re-exported from constants for convenience)
 */
export const OVR_THRESHOLDS = OVR_SYSTEM.THRESHOLDS;

/**
 * Get color class based on OVR level
 */
export function getOvrColorClass(ovr: number): string {
  const level = getOvrLevel(ovr);
  const colorMap: Record<OvrLevel, string> = {
    elite: 'text-[hsl(var(--ovr-elite))]',
    gold: 'text-[hsl(var(--ovr-gold))]',
    silver: 'text-[hsl(var(--ovr-silver))]',
    bronze: 'text-[hsl(var(--ovr-bronze))]',
  };
  return colorMap[level];
}

/**
 * Get badge/border color for OVR level
 */
export function getOvrBorderClass(ovr: number): string {
  const level = getOvrLevel(ovr);
  const borderMap: Record<OvrLevel, string> = {
    elite: 'border-[hsl(var(--ovr-elite))]',
    gold: 'border-[hsl(var(--ovr-gold))]',
    silver: 'border-[hsl(var(--ovr-silver))]',
    bronze: 'border-[hsl(var(--ovr-bronze))]',
  };
  return borderMap[level];
}
