import type { MatchType } from './types';

/**
 * Match Theme Configuration
 * Provides visual identity for each match type.
 * Cards are always dark (FIFA FUT / Sofascore style) — independent of the app theme.
 */

export interface MatchTheme {
    // Tailwind logic for gradients (e.g., 'from-blue-500/10 ...')
    gradient: string;
    // Tailwind classes for the glow orb
    glow: string;
    // Tailwind classes for the main action button
    button: string;

    badge: string;
    badgeText: string;
    border: string;

    // Badge content
    icon: string;
    label: string;

    // Special effects
    animate?: boolean;
    priority: 'casual' | 'competitive' | 'social';
    // Brand color (e.g., 'blue-500')
    brandColor: string;
    // Solid top border class
    topAccent: string;
    // Gradient overlay for banner
    bannerOverlay: string;
    // Badge color class (full bg-xxx)
    badgeColor: string;
}

const matchThemes: Record<MatchType, MatchTheme> = {
    manual: {
        gradient: 'from-blue-500/10 via-blue-500/5 to-transparent dark:from-blue-600/20 dark:via-blue-600/10',
        glow: 'bg-blue-500/20 dark:bg-blue-500/40',
        badge: 'bg-blue-100/50 border-blue-200 text-blue-700 dark:bg-blue-500/20 dark:border-blue-500/40 dark:text-blue-200',
        badgeText: '', // merged into badge for simplicity if needed, or kept separate
        button: 'bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-500 dark:hover:bg-blue-400 dark:text-white shadow-md',
        border: 'border-blue-500/20 dark:border-blue-500/30',
        icon: 'UserCheck',
        label: 'Manual',
        priority: 'casual',
        brandColor: 'blue-500',
        topAccent: 'border-t-blue-500',
        bannerOverlay: 'bg-gradient-to-br from-blue-500/40 via-blue-500/20 to-background/60',
        badgeColor: 'bg-blue-500',
    },
    collaborative: {
        gradient: 'from-teal-500/10 via-teal-500/5 to-transparent dark:from-teal-600/20 dark:via-teal-600/10',
        glow: 'bg-teal-500/20 dark:bg-teal-500/40',
        badge: 'bg-teal-100/50 border-teal-200 text-teal-700 dark:bg-teal-500/20 dark:border-teal-500/40 dark:text-teal-200',
        badgeText: '',
        button: 'bg-teal-600 hover:bg-teal-700 text-white dark:bg-teal-500 dark:hover:bg-teal-400 dark:text-white shadow-md',
        border: 'border-teal-500/20 dark:border-teal-500/30',
        icon: 'Users',
        label: 'Colaborativo',
        priority: 'casual',
        brandColor: 'teal-500',
        topAccent: 'border-t-teal-500',
        bannerOverlay: 'bg-gradient-to-br from-teal-500/40 via-teal-500/20 to-background/60',
        badgeColor: 'bg-teal-500',
    },
    by_teams: {
        gradient: 'from-indigo-500/10 via-indigo-500/5 to-transparent dark:from-indigo-600/20 dark:via-indigo-600/10',
        glow: 'bg-indigo-500/20 dark:bg-indigo-500/40',
        badge: 'bg-indigo-100/50 border-indigo-200 text-indigo-700 dark:bg-indigo-500/20 dark:border-indigo-500/40 dark:text-indigo-200',
        badgeText: '',
        button: 'bg-indigo-600 hover:bg-indigo-700 text-white dark:bg-indigo-500 dark:hover:bg-indigo-400 dark:text-white shadow-md',
        border: 'border-indigo-500/20 dark:border-indigo-500/30',
        icon: 'Shirt',
        label: 'Por Equipos',
        priority: 'casual',
        brandColor: 'indigo-500',
        topAccent: 'border-t-indigo-500',
        bannerOverlay: 'bg-gradient-to-br from-indigo-500/40 via-indigo-500/20 to-background/60',
        badgeColor: 'bg-indigo-500',
    },
    league: {
        gradient: 'from-amber-500/10 via-amber-500/5 to-transparent dark:from-amber-600/20 dark:via-amber-600/10',
        glow: 'bg-amber-500/20 dark:bg-amber-500/40',
        badge: 'bg-amber-100/50 border-amber-200 text-amber-700 dark:bg-amber-500/20 dark:border-amber-500/40 dark:text-amber-200 font-bold',
        badgeText: '',
        button: 'bg-amber-600 hover:bg-amber-700 text-white dark:bg-amber-500 dark:hover:bg-amber-400 dark:text-white shadow-md',
        border: 'border-amber-500/20 dark:border-amber-500/30',
        icon: 'Trophy',
        label: 'Liga',
        priority: 'competitive',
        brandColor: 'amber-500',
        topAccent: 'border-t-amber-500',
        bannerOverlay: 'bg-gradient-to-br from-amber-500/40 via-amber-500/20 to-background/60',
        badgeColor: 'bg-amber-500',
    },
    cup: {
        gradient: 'from-red-500/10 via-red-500/5 to-transparent dark:from-red-600/20 dark:via-red-600/10',
        glow: 'bg-red-500/20 dark:bg-red-500/40',
        badge: 'bg-red-100/50 border-red-200 text-red-700 dark:bg-red-500/20 dark:border-red-500/40 dark:text-red-200 font-bold',
        badgeText: '',
        button: 'bg-red-600 hover:bg-red-700 text-white dark:bg-red-500 dark:hover:bg-red-400 dark:text-white shadow-md',
        border: 'border-red-500/20 dark:border-red-500/30',
        icon: 'Trophy',
        label: 'Copa',
        priority: 'competitive',
        brandColor: 'red-500',
        topAccent: 'border-t-red-500',
        bannerOverlay: 'bg-gradient-to-br from-red-500/40 via-red-500/20 to-background/60',
        badgeColor: 'bg-red-500',
    },
    league_final: {
        gradient: 'from-yellow-500/20 via-red-500/20 to-transparent dark:from-yellow-500/30 dark:via-red-500/30',
        glow: 'bg-yellow-400/30 dark:bg-yellow-400/50',
        badge: 'bg-gradient-to-r from-yellow-100 via-red-100 to-yellow-100 border-yellow-200 text-red-900 dark:from-yellow-500/30 dark:via-red-500/30 dark:to-yellow-500/30 dark:border-yellow-400/50 dark:text-yellow-100 font-extrabold',
        badgeText: '',
        button: 'bg-gradient-to-r from-yellow-500 to-red-500 hover:from-yellow-600 hover:to-red-600 text-white dark:from-yellow-500 dark:to-red-500 dark:hover:from-yellow-400 dark:hover:to-red-400 dark:text-white shadow-lg font-bold',
        border: 'border-yellow-500/40 dark:border-yellow-500/50',
        icon: 'Trophy',
        label: '⚡ FINAL DECISIVA ⚡',
        animate: true,
        priority: 'competitive',
        brandColor: 'amber-400',
        topAccent: 'border-t-amber-400 shadow-2xl shadow-amber-500/50',
        bannerOverlay: 'bg-gradient-to-br from-amber-400/50 via-orange-500/30 to-background/60',
        badgeColor: 'bg-amber-400',
    },
    intergroup_friendly: {
        gradient: 'from-green-500/10 via-green-500/5 to-transparent dark:from-green-600/20 dark:via-green-600/10',
        glow: 'bg-green-500/20 dark:bg-green-500/40',
        badge: 'bg-green-100/50 border-green-200 text-green-700 dark:bg-green-500/20 dark:border-green-500/40 dark:text-green-200',
        badgeText: '',
        button: 'bg-green-600 hover:bg-green-700 text-white dark:bg-green-500 dark:hover:bg-green-400 dark:text-white shadow-md',
        border: 'border-green-500/20 dark:border-green-500/30',
        icon: 'Globe',
        label: 'Inter-grupos',
        priority: 'social',
        brandColor: 'green-500',
        topAccent: 'border-t-green-500',
        bannerOverlay: 'bg-gradient-to-br from-green-500/40 via-green-500/20 to-background/60',
        badgeColor: 'bg-green-500',
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
            return 'text-foreground';
        case 'social':
            return 'text-muted-foreground';
        case 'casual':
        default:
            return 'text-muted-foreground';
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
