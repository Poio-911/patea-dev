/**
 * Logros: catálogo y reglas, sin tocar Firestore (la parte con datos está en
 * `callable/achievements.ts`).
 *
 * Los ids son los mismos que usa la web, así que los logros ya desbloqueados
 * (`playerAchievements/{uid}_{id}`) siguen valiendo.
 */

export type AchievementRequirement =
  | 'goals'
  | 'goals_in_match'
  | 'matches'
  | 'wins'
  | 'ovr'
  | 'followers'
  | 'organized'
  | 'champion';

export type AchievementCategory = 'performance' | 'milestones' | 'competition' | 'social';

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: AchievementCategory;
  requirement: { type: AchievementRequirement; count: number };
}

const def = (
  id: string,
  name: string,
  description: string,
  icon: string,
  category: AchievementCategory,
  type: AchievementRequirement,
  count: number,
): AchievementDef => ({ id, name, description, icon, category, requirement: { type, count } });

export const ACHIEVEMENTS: readonly AchievementDef[] = [
  def('first_goal', 'Primer Gol', 'Marcaste tu primer gol', 'target', 'performance', 'goals', 1),
  def('hat_trick', 'Hat-trick', '3 o más goles en un partido', 'trophy', 'performance', 'goals_in_match', 3),
  def('ten_goals', 'Goleador', 'Marcaste 10 goles en total', 'flame', 'performance', 'goals', 10),
  def('fifty_goals', 'Leyenda', 'Marcaste 50 goles en total', 'crown', 'performance', 'goals', 50),
  def('first_match', 'Debut', 'Jugaste tu primer partido', 'play', 'milestones', 'matches', 1),
  def('ten_matches', 'Regular', 'Jugaste 10 partidos', 'calendar', 'milestones', 'matches', 10),
  def('fifty_matches', 'Veterano', 'Jugaste 50 partidos', 'award', 'milestones', 'matches', 50),
  def('first_win', 'Victoria', 'Ganaste tu primer partido', 'medal', 'competition', 'wins', 1),
  def('ten_wins', 'Ganador', 'Ganaste 10 partidos', 'star', 'competition', 'wins', 10),
  def('champion', 'Campeón', 'Ganaste una liga o copa', 'trophy', 'competition', 'champion', 1),
  def('ovr_70', 'Promesa', 'Alcanzaste OVR 70', 'trending-up', 'milestones', 'ovr', 70),
  def('ovr_80', 'Crack', 'Alcanzaste OVR 80', 'zap', 'milestones', 'ovr', 80),
  def('ovr_90', 'Élite', 'Alcanzaste OVR 90', 'gem', 'milestones', 'ovr', 90),
  def('first_follower', 'Conocido', 'Conseguiste tu primer seguidor', 'user-plus', 'social', 'followers', 1),
  def('ten_followers', 'Popular', 'Tenés 10 seguidores', 'users', 'social', 'followers', 10),
  def('organizer', 'Organizador', 'Creaste 5 partidos', 'clipboard-list', 'social', 'organized', 5),
];

export type AchievementProgress = Record<AchievementRequirement, number>;

export const emptyProgress = (): AchievementProgress => ({
  goals: 0,
  goals_in_match: 0,
  matches: 0,
  wins: 0,
  ovr: 0,
  followers: 0,
  organized: 0,
  champion: 0,
});

/** Logros que ya se cumplen y todavía no estaban desbloqueados. */
export function newlyEarned(progress: AchievementProgress, unlockedIds: ReadonlySet<string>): AchievementDef[] {
  return ACHIEVEMENTS.filter(
    (a) => !unlockedIds.has(a.id) && (progress[a.requirement.type] ?? 0) >= a.requirement.count,
  );
}

/**
 * Resultado de un partido para una persona: si su equipo ganó y cuántos goles
 * hizo (sin contar los en contra). Un partido sin resultado final o sin dos
 * equipos no cuenta como victoria.
 */
export function matchOutcomeFor(match: any, uid: string): { won: boolean; goals: number } {
  const events: any[] = Array.isArray(match?.events) ? match.events : [];
  const goals = events.filter(
    (e) => e?.type === 'goal' && e?.playerId === uid && e?.goalType !== 'own_goal',
  ).length;

  const teams: any[] = Array.isArray(match?.teams) ? match.teams : [];
  const score = match?.finalScore;
  if (teams.length !== 2 || !score) return { won: false, goals };
  const side = teams.findIndex((t) => (t?.players ?? []).some((p: any) => (p?.uid ?? p?.id) === uid));
  if (side === -1) return { won: false, goals };
  const mine = Number(side === 0 ? score.team1 : score.team2);
  const theirs = Number(side === 0 ? score.team2 : score.team1);
  return { won: mine > theirs, goals };
}
