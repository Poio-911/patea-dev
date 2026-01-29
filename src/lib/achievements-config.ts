import type { Achievement } from './types';

/**
 * Configuration for all achievements in the app.
 * Icons use Lucide icon names.
 */
export const ACHIEVEMENTS: Achievement[] = [
  // Performance category - Goals
  {
    id: 'first_goal',
    name: 'Primer Gol',
    description: 'Marcaste tu primer gol',
    icon: 'target',
    category: 'performance',
    requirement: { type: 'goals', count: 1 },
  },
  {
    id: 'hat_trick',
    name: 'Hat-trick',
    description: '3+ goles en un partido',
    icon: 'trophy',
    category: 'performance',
    requirement: { type: 'goals_in_match', count: 3 },
  },
  {
    id: 'ten_goals',
    name: 'Goleador',
    description: 'Marcaste 10 goles en total',
    icon: 'flame',
    category: 'performance',
    requirement: { type: 'goals', count: 10 },
  },
  {
    id: 'fifty_goals',
    name: 'Leyenda',
    description: 'Marcaste 50 goles en total',
    icon: 'crown',
    category: 'performance',
    requirement: { type: 'goals', count: 50 },
  },

  // Milestones category - Matches
  {
    id: 'first_match',
    name: 'Debut',
    description: 'Jugaste tu primer partido',
    icon: 'play',
    category: 'milestones',
    requirement: { type: 'matches', count: 1 },
  },
  {
    id: 'ten_matches',
    name: 'Regular',
    description: 'Jugaste 10 partidos',
    icon: 'calendar',
    category: 'milestones',
    requirement: { type: 'matches', count: 10 },
  },
  {
    id: 'fifty_matches',
    name: 'Veterano',
    description: 'Jugaste 50 partidos',
    icon: 'award',
    category: 'milestones',
    requirement: { type: 'matches', count: 50 },
  },

  // Competition category - Wins
  {
    id: 'first_win',
    name: 'Victoria',
    description: 'Ganaste tu primer partido',
    icon: 'medal',
    category: 'competition',
    requirement: { type: 'wins', count: 1 },
  },
  {
    id: 'ten_wins',
    name: 'Ganador',
    description: 'Ganaste 10 partidos',
    icon: 'star',
    category: 'competition',
    requirement: { type: 'wins', count: 10 },
  },
  {
    id: 'champion',
    name: 'Campeón',
    description: 'Ganaste una liga o copa',
    icon: 'trophy',
    category: 'competition',
    requirement: { type: 'champion', count: 1 },
  },

  // Milestones category - OVR
  {
    id: 'ovr_70',
    name: 'Promesa',
    description: 'Alcanzaste OVR 70',
    icon: 'trending-up',
    category: 'milestones',
    requirement: { type: 'ovr', count: 70 },
  },
  {
    id: 'ovr_80',
    name: 'Crack',
    description: 'Alcanzaste OVR 80',
    icon: 'zap',
    category: 'milestones',
    requirement: { type: 'ovr', count: 80 },
  },
  {
    id: 'ovr_90',
    name: 'Elite',
    description: 'Alcanzaste OVR 90',
    icon: 'gem',
    category: 'milestones',
    requirement: { type: 'ovr', count: 90 },
  },

  // Social category - Followers
  {
    id: 'first_follower',
    name: 'Conocido',
    description: 'Conseguiste tu primer seguidor',
    icon: 'user-plus',
    category: 'social',
    requirement: { type: 'followers', count: 1 },
  },
  {
    id: 'ten_followers',
    name: 'Popular',
    description: 'Tienes 10 seguidores',
    icon: 'users',
    category: 'social',
    requirement: { type: 'followers', count: 10 },
  },

  // Social category - Organizing
  {
    id: 'organizer',
    name: 'Organizador',
    description: 'Creaste 5 partidos',
    icon: 'clipboard-list',
    category: 'social',
    requirement: { type: 'organized', count: 5 },
  },
];

// Helper to get achievement by ID
export function getAchievementById(id: string): Achievement | undefined {
  return ACHIEVEMENTS.find(a => a.id === id);
}

// Helper to get achievements by category
export function getAchievementsByCategory(category: Achievement['category']): Achievement[] {
  return ACHIEVEMENTS.filter(a => a.category === category);
}

// All category labels for UI
export const ACHIEVEMENT_CATEGORIES: { value: Achievement['category']; label: string }[] = [
  { value: 'performance', label: 'Rendimiento' },
  { value: 'milestones', label: 'Hitos' },
  { value: 'competition', label: 'Competición' },
  { value: 'social', label: 'Social' },
];
