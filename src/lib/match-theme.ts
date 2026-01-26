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
        gradient: 'from-muted/20 via-muted/10 to-transparent',
        badge: 'bg-card/70 border border-border',
        badgeText: 'text-foreground',
        border: 'border-border',
        icon: 'UserCheck',
        label: 'Manual',
        priority: 'casual',
    },

    collaborative: {
        gradient: 'from-muted/20 via-muted/10 to-transparent',
        badge: 'bg-card/70 border border-border',
        badgeText: 'text-foreground',
        border: 'border-border',
        icon: 'Users',
        label: 'Colaborativo',
        priority: 'casual',
    },

    by_teams: {
        gradient: 'from-muted/20 via-muted/10 to-transparent',
        badge: 'bg-card/70 border border-border',
        badgeText: 'text-foreground',
        border: 'border-border',
        icon: 'UsersRound',
        label: 'Por Equipos',
        priority: 'casual',
    },

    league: {
        gradient: 'from-muted/25 via-muted/10 to-transparent',
        badge: 'bg-card/70 border border-border',
        badgeText: 'text-foreground',
        border: 'border-border',
        glow: 'shadow-lg shadow-foreground/10',
        icon: 'Trophy',
        label: 'Liga',
        priority: 'competitive',
    },

    cup: {
        gradient: 'from-muted/25 via-muted/10 to-transparent',
        badge: 'bg-card/70 border border-border',
        badgeText: 'text-foreground',
        border: 'border-border',
        glow: 'shadow-lg shadow-foreground/10',
        icon: 'Trophy',
        label: 'Copa',
        priority: 'competitive',
    },

    league_final: {
        gradient: 'from-muted/30 via-muted/15 to-transparent',
        badge: 'bg-card/80 border border-border',
        badgeText: 'text-foreground font-semibold uppercase',
        border: 'border-border',
        glow: 'shadow-2xl shadow-foreground/15',
        icon: 'Trophy',
        label: '⚡ FINAL DECISIVA ⚡',
        animate: true,
        priority: 'competitive',
    },

    intergroup_friendly: {
        gradient: 'from-muted/20 via-muted/10 to-transparent',
        badge: 'bg-card/70 border border-border',
        badgeText: 'text-foreground',
        border: 'border-border',
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
