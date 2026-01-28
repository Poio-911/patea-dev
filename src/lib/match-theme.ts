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
        gradient: 'from-primary/30 via-primary/20 to-transparent',
        badge: 'bg-primary/20 border border-primary/30',
        badgeText: 'text-primary',
        border: 'border-primary/40',
        icon: 'UserCheck',
        label: 'Manual',
        priority: 'casual',
    },
    collaborative: {
        gradient: 'from-accent/30 via-accent/20 to-transparent',
        badge: 'bg-accent/30 border border-accent',
        badgeText: 'text-accent-foreground',
        border: 'border-accent/40',
        icon: 'Users',
        label: 'Colaborativo',
        priority: 'casual',
    },
    by_teams: {
        gradient: 'from-secondary/30 via-secondary/20 to-transparent',
        badge: 'bg-secondary/30 border border-secondary',
        badgeText: 'text-secondary-foreground',
        border: 'border-secondary/40',
        icon: 'UsersRound',
        label: 'Por Equipos',
        priority: 'casual',
    },
    league: {
        gradient: 'from-warning/35 via-warning/25 to-transparent',
        badge: 'bg-warning/30 border border-warning font-bold',
        badgeText: 'text-warning-foreground',
        border: 'border-warning/50',
        icon: 'Trophy',
        label: 'Liga',
        priority: 'competitive',
    },
    cup: {
        gradient: 'from-destructive/35 via-destructive/25 to-transparent',
        badge: 'bg-destructive/30 border border-destructive font-bold',
        badgeText: 'text-destructive-foreground',
        border: 'border-destructive/50',
        icon: 'Trophy',
        label: 'Copa',
        priority: 'competitive',
    },
    league_final: {
        gradient: 'from-warning/50 via-destructive/50 to-warning/50',
        badge: 'bg-gradient-to-r from-warning via-destructive to-warning border-warning font-extrabold animate-pulse',
        badgeText: 'text-white',
        border: 'border-warning/50',
        icon: 'Trophy',
        label: '⚡ FINAL DECISIVA ⚡',
        animate: true,
        priority: 'competitive',
    },
    intergroup_friendly: {
        gradient: 'from-success/30 via-success/20 to-transparent',
        badge: 'bg-success/30 border border-success',
        badgeText: 'text-success-foreground',
        border: 'border-success/40',
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
