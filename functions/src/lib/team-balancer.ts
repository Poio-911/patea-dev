/** Shared, network-free team balancing used by Cloud Functions and the web. */
export type PlayerPosition = 'POR' | 'DEF' | 'MED' | 'DEL';
export type BalancedPlayer = {
  uid: string; displayName: string; position: PlayerPosition; ovr: number; photoURL?: string;
};
export type BalancedTeam = {
  name: string; players: BalancedPlayer[]; totalOVR: number; averageOVR: number;
  suggestedFormation: string; tags: string[];
  jersey: { type: 'plain'; primaryColor: string; secondaryColor: string };
};
export type BalancedTeamsOutput = {
  teams: BalancedTeam[];
  balanceMetrics: { ovrDifference: number; fairnessPercentage: number };
};

const POSITIONS: PlayerPosition[] = ['POR', 'DEF', 'MED', 'DEL'];
const POSITION_ALIASES: Record<string, PlayerPosition> = {
  POR: 'POR', ARQUERO: 'POR', PORTERO: 'POR', GK: 'POR', GOALKEEPER: 'POR',
  DEF: 'DEF', DEFENSA: 'DEF', DEFENSOR: 'DEF',
  MED: 'MED', MEDIO: 'MED', MEDIOCAMPISTA: 'MED', VOLANTE: 'MED',
  DEL: 'DEL', DELANTERO: 'DEL',
};
const PRIMARY = ['#F97316', '#1E3A8A', '#16A34A', '#DC2626', '#7C3AED', '#EAB308', '#0891B2', '#DB2777'];
const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const compareUid = (left: BalancedPlayer, right: BalancedPlayer) => left.uid < right.uid ? -1 : left.uid > right.uid ? 1 : 0;

export function normalizePlayers(raw: unknown): BalancedPlayer[] {
  if (!Array.isArray(raw) || raw.length < 2 || raw.length > 100) {
    throw new Error('Se necesitan entre 2 y 100 jugadores para armar los equipos.');
  }
  const ids = new Set<string>();
  return raw.map(value => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Jugador inválido.');
    const player = value as Record<string, unknown>;
    if (typeof player.uid !== 'string' || !player.uid || player.uid.length > 128 || player.uid.includes('/')
        || player.uid === '.' || player.uid === '..' || ids.has(player.uid)) {
      throw new Error('Cada jugador debe tener un identificador válido y aparecer una sola vez.');
    }
    ids.add(player.uid);
    if (typeof player.ovr !== 'number' || !Number.isFinite(player.ovr) || player.ovr < 0 || player.ovr > 99) {
      throw new Error('El OVR de cada jugador debe ser un número entre 0 y 99.');
    }
    const position = typeof player.position === 'string' ? POSITION_ALIASES[player.position.trim().toUpperCase()] : undefined;
    if (!position) throw new Error('La posición debe ser POR, DEF, MED o DEL.');
    if (typeof player.displayName !== 'string' || !player.displayName.trim() || player.displayName.length > 200) {
      throw new Error('Cada jugador debe tener un nombre válido.');
    }
    return {
      uid: player.uid,
      displayName: player.displayName.trim(),
      position,
      ovr: player.ovr,
      ...(typeof player.photoURL === 'string' && player.photoURL ? { photoURL: player.photoURL } : {}),
    };
  }).sort(compareUid);
}

function validateTeamCount(count: number, players: number): void {
  if (!Number.isInteger(count) || count < 2 || count > 8 || count > players) {
    throw new Error('La cantidad de equipos debe ser un entero entre 2 y 8, con al menos un jugador por equipo.');
  }
}

/** Exact minimum average-OVR gap among role-balanced splits, bounded at 22 players. */
function exactTwoTeams(players: BalancedPlayer[]): BalancedPlayer[][] {
  const size = Math.floor(players.length / 2);
  const otherSize = players.length - size;
  const totals = POSITIONS.map(position => players.filter(player => player.position === position).length);
  const minimum = totals.map(count => Math.floor(count / 2));
  const maximum = totals.map(count => Math.ceil(count / 2));
  const totalOvr = players.reduce((sum, player) => sum + player.ovr, 0);
  const roleTotals = POSITIONS.map(position => players.filter(player => player.position === position).reduce((sum, player) => sum + player.ovr, 0));
  const suffix: number[][] = Array.from({ length: players.length + 1 }, () => [0, 0, 0, 0]);
  for (let index = players.length - 1; index >= 0; index--) {
    suffix[index] = [...suffix[index + 1]];
    suffix[index][POSITIONS.indexOf(players[index].position)]++;
  }
  const counts = [0, 0, 0, 0];
  const sums = [0, 0, 0, 0];
  const selected: number[] = [];
  let best: number[] = [];
  let bestGap = Infinity;
  let bestRoleGap = Infinity;
  function visit(index: number, sum: number): void {
    if (selected.length > size || selected.length + players.length - index < size) return;
    for (let role = 0; role < POSITIONS.length; role++) {
      if (counts[role] > maximum[role] || counts[role] + suffix[index][role] < minimum[role]) return;
    }
    if (selected.length === size) {
      if (counts.some((count, role) => count < minimum[role])) return;
      // Integer cross-product when OVRs are integral avoids rounded comparisons.
      const gap = Math.abs(sum * otherSize - (totalOvr - sum) * size);
      let roleGap = 0;
      for (let role = 0; role < POSITIONS.length; role++) {
        if (counts[role] && totals[role] - counts[role]) {
          roleGap += Math.abs(sums[role] / counts[role] - (roleTotals[role] - sums[role]) / (totals[role] - counts[role]));
        }
      }
      if (gap < bestGap - 1e-8 || (Math.abs(gap - bestGap) < 1e-8 && roleGap < bestRoleGap - 1e-8)) {
        bestGap = gap; bestRoleGap = roleGap; best = [...selected];
      }
      return;
    }
    if (index === players.length) return;
    const role = POSITIONS.indexOf(players[index].position);
    selected.push(index); counts[role]++; sums[role] += players[index].ovr;
    visit(index + 1, sum + players[index].ovr);
    sums[role] -= players[index].ovr; counts[role]--; selected.pop();
    // Equal-size halves are interchangeable; pin the first UID to one side.
    if (!(players.length % 2 === 0 && index === 0)) visit(index + 1, sum);
  }
  visit(0, 0);
  if (!best.length) throw new Error('No se pudo repartir el plantel.');
  const chosen = new Set(best);
  return [players.filter((_, index) => chosen.has(index)), players.filter((_, index) => !chosen.has(index))];
}

function strengthScore(teams: BalancedPlayer[][]): [number, number] {
  const averages = teams.map(team => team.reduce((sum, player) => sum + player.ovr, 0) / team.length);
  const average = averages.reduce((sum, value) => sum + value, 0) / averages.length;
  return [Math.max(...averages) - Math.min(...averages), averages.reduce((sum, value) => sum + (value - average) ** 2, 0)];
}
function less(left: [number, number], right: [number, number]): boolean {
  return left[0] < right[0] - 1e-8 || (Math.abs(left[0] - right[0]) < 1e-8 && left[1] < right[1] - 1e-8);
}
function roleSpread(teams: BalancedPlayer[][], position: PlayerPosition): number {
  const counts = teams.map(team => team.filter(player => player.position === position).length);
  return Math.max(...counts) - Math.min(...counts);
}

/** Capacity-aware greedy draft, followed by improving swaps with role safeguards. */
function heuristicTeams(players: BalancedPlayer[], count: number): BalancedPlayer[][] {
  const capacities = Array.from({ length: count }, (_, index) => Math.floor(players.length / count) + (index < players.length % count ? 1 : 0));
  const teams: BalancedPlayer[][] = Array.from({ length: count }, () => []);
  // Plan role quotas before drafting. Havel-Hakimi on the four role rows
  // distributes remainder slots without letting an early role fill all space.
  const roleCounts = POSITIONS.map(position => players.filter(player => player.position === position).length);
  const quotas = roleCounts.map(total => Array(count).fill(Math.floor(total / count)) as number[]);
  const baseSize = roleCounts.reduce((sum, total) => sum + Math.floor(total / count), 0);
  const remaining = capacities.map(capacity => capacity - baseSize);
  const roles = POSITIONS.map((_, role) => role).sort((a, b) => roleCounts[b] % count - roleCounts[a] % count || a - b);
  for (const role of roles) {
    const recipients = remaining.map((slots, index) => ({ slots, index }))
      .sort((a, b) => b.slots - a.slots || a.index - b.index)
      .slice(0, roleCounts[role] % count);
    for (const recipient of recipients) { quotas[role][recipient.index]++; remaining[recipient.index]--; }
  }
  for (let role = 0; role < POSITIONS.length; role++) {
    const rolePlayers = players.filter(player => player.position === POSITIONS[role]).sort((a, b) => b.ovr - a.ovr || compareUid(a, b));
    for (const player of rolePlayers) {
      const choices = teams.map((team, index) => ({
        index,
        strength: team.reduce((sum, member) => sum + member.ovr, 0) / capacities[index],
      })).filter(choice => quotas[role][choice.index] > 0);
      choices.sort((a, b) => a.strength - b.strength || a.index - b.index);
      teams[choices[0].index].push(player);
      quotas[role][choices[0].index]--;
    }
  }
  // With N<=100 and <=40 rounds the work is bounded, even for unusual inputs.
  for (let roundIndex = 0; roundIndex < 40; roundIndex++) {
    const current = strengthScore(teams);
    let best = current;
    let swap: [number, number, number, number] | undefined;
    const spreads = POSITIONS.map(position => roleSpread(teams, position));
    for (let left = 0; left < teams.length; left++) for (let right = left + 1; right < teams.length; right++) {
      for (let a = 0; a < teams[left].length; a++) for (let b = 0; b < teams[right].length; b++) {
        [teams[left][a], teams[right][b]] = [teams[right][b], teams[left][a]];
        const permitted = POSITIONS.every((position, role) => roleSpread(teams, position) <= Math.max(1, spreads[role]));
        if (permitted) {
          const score = strengthScore(teams);
          if (less(score, best)) { best = score; swap = [left, right, a, b]; }
        }
        [teams[left][a], teams[right][b]] = [teams[right][b], teams[left][a]];
      }
    }
    if (!swap) break;
    const [left, right, a, b] = swap;
    [teams[left][a], teams[right][b]] = [teams[right][b], teams[left][a]];
  }
  return teams;
}

function describeTeams(groups: BalancedPlayer[][]): BalancedTeamsOutput {
  const teams: BalancedTeam[] = groups.map((group, index): BalancedTeam => {
    const players = [...group].sort(compareUid);
    const count = (position: PlayerPosition) => players.filter(player => player.position === position).length;
    const keeperCount = count('POR');
    const outfield = ['DEF', 'MED', 'DEL'] as PlayerPosition[];
    const strongestRole = [...outfield].sort((a, b) => count(b) - count(a))[0];
    const name = groups.length === 2 ? ['Con chaleco', 'Sin chaleco'][index] : `Equipo ${index + 1}`;
    const totalOVR = round(players.reduce((sum, player) => sum + player.ovr, 0));
    return {
      name, players, totalOVR, averageOVR: round(totalOVR / players.length),
      suggestedFormation: outfield.map(position => count(position)).join('-'),
      tags: [keeperCount === 0 ? 'Sin golero fijo' : keeperCount > 1 ? 'Rotación de goleros' : 'Arco cubierto',
        strongestRole === 'DEF' ? 'Base defensiva' : strongestRole === 'MED' ? 'Control del mediocampo' : 'Vocación ofensiva'],
      jersey: { type: 'plain', primaryColor: PRIMARY[index], secondaryColor: index === 0 ? '#EA580C' : index === 1 ? '#1E40AF' : PRIMARY[index] },
    };
  });
  const averages = teams.map(team => team.averageOVR);
  const maximum = Math.max(...averages);
  const minimum = Math.min(...averages);
  return { teams, balanceMetrics: {
    ovrDifference: round(maximum - minimum),
    fairnessPercentage: maximum === 0 ? 100 : round(minimum / maximum * 100),
  } };
}

/**
 * Goalkeepers and each outfield role are split as evenly as possible. With one
 * keeper one side necessarily has none; with two each gets one; surplus keepers
 * rotate evenly. Odd rosters retain everyone, with team sizes differing by one.
 * Same IDs/ratings produce the same result regardless of request order.
 */
export function balanceTeams(rawPlayers: unknown, teamCount = 2): BalancedTeamsOutput {
  const players = normalizePlayers(rawPlayers);
  validateTeamCount(teamCount, players.length);
  return describeTeams(teamCount === 2 && players.length <= 22
    ? exactTwoTeams(players) : heuristicTeams(players, teamCount));
}

/** Validate any imported/AI/cached partition; never accept invented metrics or players. */
export function normalizeTeamPartition(raw: unknown, rawPlayers: unknown, teamCount = 2): BalancedTeamsOutput {
  const players = normalizePlayers(rawPlayers);
  validateTeamCount(teamCount, players.length);
  const candidate = raw as { teams?: Array<{ players?: Array<{ uid?: unknown }> }> } | null;
  if (!candidate || !Array.isArray(candidate.teams) || candidate.teams.length !== teamCount) throw new Error('Cantidad de equipos inválida.');
  const byId = new Map(players.map(player => [player.uid, player]));
  const used = new Set<string>();
  const groups = candidate.teams.map(team => {
    if (!team || !Array.isArray(team.players) || team.players.length === 0) throw new Error('Equipo vacío o inválido.');
    return team.players.map(player => {
      if (!player || typeof player.uid !== 'string' || !byId.has(player.uid) || used.has(player.uid)) throw new Error('El reparto agrega, repite o pierde jugadores.');
      used.add(player.uid);
      return byId.get(player.uid)!;
    });
  });
  if (used.size !== players.length || Math.max(...groups.map(group => group.length)) - Math.min(...groups.map(group => group.length)) > 1) {
    throw new Error('Los equipos deben conservar todo el plantel y tener tamaños parejos.');
  }
  if (roleSpread(groups, 'POR') > 1) throw new Error('Los goleros deben repartirse entre los equipos.');
  return describeTeams(groups);
}
