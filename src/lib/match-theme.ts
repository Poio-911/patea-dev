import type { MatchType } from './types';

/**
 * Match Theme Configuration
 * Provides visual identity for each match type
 */

export interface MatchTheme {
    // Colors
    gradient: string;
    badge: string;
    badgeText: string;
    border: string;
    glow?: string;

    // Badge content
    icon: string;
    label: string;

    // Special effects
    animate?: boolean;
    priority: 'casual' | 'competitive' | 'social';
}

const matchThemes: Record<MatchType, MatchTheme> = {
    manual: {
        gradient: 'from-blue-500/20 via-blue-400/10 to-transparent',
        badge: 'bg-blue-100 dark:bg-blue-900/50',
        badgeText: 'text-blue-800 dark:text-blue-300',
        border: 'border-blue-300 dark:border-blue-700',
        icon: 'UserCheck',
        label: 'Manual',
        priority: 'casual',
    },

    collaborative: {
        gradient: 'from-violet-500/20 via-violet-400/10 to-transparent',
        badge: 'bg-violet-100 dark:bg-violet-900/50',
        badgeText: 'text-violet-800 dark:text-violet-300',
        border: 'border-violet-300 dark:border-violet-700',
        icon: 'Users',
        label: 'Colaborativo',
        priority: 'casual',
    },

    by_teams: {
        gradient: 'from-emerald-500/20 via-emerald-400/10 to-transparent',
        badge: 'bg-emerald-100 dark:bg-emerald-900/50',
        badgeText: 'text-emerald-800 dark:text-emerald-300',
        border: 'border-emerald-300 dark:border-emerald-700',
        icon: 'UsersRound',
        label: 'Por Equipos',
        priority: 'casual',
    },

    league: {
        gradient: 'from-amber-500/30 via-orange-400/20 to-transparent',
        badge: 'border-2 border-amber-600 bg-amber-50 dark:bg-amber-950/30',
        badgeText: 'text-amber-700 dark:text-amber-400 font-semibold',
        border: 'border-amber-400 dark:border-amber-500',
        glow: 'shadow-lg shadow-amber-500/50',
        icon: 'Trophy',
        label: 'Liga',
        priority: 'competitive',
    },

    cup: {
        gradient: 'from-red-500/30 via-orange-500/20 to-transparent',
        badge: 'border-2 border-red-600 bg-red-50 dark:bg-red-950/30',
        badgeText: 'text-red-700 dark:text-red-400 font-semibold',
        border: 'border-red-400 dark:border-red-500',
        glow: 'shadow-lg shadow-red-500/50',
        icon: 'Trophy',
        label: 'Copa',
        priority: 'competitive',
    },

    league_final: {
        gradient: 'from-amber-400/50 via-orange-500/30 to-red-500/20',
        badge: 'bg-gradient-to-r from-yellow-400 via-amber-500 to-orange-600',
        badgeText: 'text-white font-black uppercase',
        border: 'border-amber-400 dark:border-amber-300',
        glow: 'shadow-2xl shadow-amber-500',
        icon: 'Trophy',
        label: '⚡ FINAL DECISIVA ⚡',
        animate: true,
        priority: 'competitive',
    },

    intergroup_friendly: {
        gradient: 'from-teal-500/20 via-teal-400/10 to-transparent',
        badge: 'bg-teal-100 dark:bg-teal-900/50',
        badgeText: 'text-teal-800 dark:text-teal-300',
        border: 'border-teal-300 dark:border-teal-700',
        icon: 'Handshake',
        label: 'Inter-grupos',
        priority: 'social',
    },
};

/**
 * Get theme configuration for a match type
 */
export function getMatchTheme(type: MatchType): MatchTheme {
    return matchThemes[type];
}

/**
 * Get category color for filtering/grouping
 */
export function getMatchCategoryColor(type: MatchType): string {
    const theme = matchThemes[type];

    switch (theme.priority) {
        case 'competitive':
            return 'text-amber-600 dark:text-amber-400';
        case 'social':
            return 'text-teal-600 dark:text-teal-400';
        case 'casual':
        default:
            return 'text-blue-600 dark:text-blue-400';
    }
}

/**
 * Check if match type is competitive
 */
export function isCompetitiveMatch(type: MatchType): boolean {
    return matchThemes[type].priority === 'competitive';
}

/**
 * Get display name for match type
 */
export function getMatchTypeLabel(type: MatchType): string {
    return matchThemes[type].label;
}
