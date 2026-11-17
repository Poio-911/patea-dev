import '../../core/models/competition_model.dart';

Map<String, int>? competitionScore(Map<String, dynamic> match) {
  final raw = match['finalScore'] as Map?;
  final teams = match['teams'] as List? ?? [];
  final a =
      raw?['team1'] ?? (teams.isNotEmpty ? (teams[0] as Map)['score'] : null);
  final b =
      raw?['team2'] ?? (teams.length > 1 ? (teams[1] as Map)['score'] : null);
  if (a is! num ||
      b is! num ||
      a < 0 ||
      b < 0 ||
      a.toInt() != a ||
      b.toInt() != b) {
    return null;
  }
  return {'team1': a.toInt(), 'team2': b.toInt()};
}

bool confirmedMatch(Map<String, dynamic> m) =>
    const ['completed', 'evaluated'].contains(m['status']);
String roundLabel(String? round) => switch (round) {
  'round_of_32' => 'Dieciseisavos',
  'round_of_16' => 'Octavos',
  'round_of_8' => 'Cuartos',
  'semifinals' => 'Semifinales',
  'final' => 'Final',
  _ => 'Por definir',
};
String matchState(String? state) => switch (state) {
  'active' => 'En vivo',
  'planning' => 'Por programar',
  'upcoming' => 'Programado',
  'completed' || 'evaluated' => 'Finalizado',
  'cancelled' => 'Cancelado',
  _ => 'Por definir',
};
List<StandingRow> competitionStandings(
  CompetitionModel comp,
  Map<String, String> names,
  List<Map<String, dynamic>> matches,
) {
  final rows = {
    for (final id in comp.teamIds) id: <int>[0, 0, 0, 0, 0, 0, 0],
  };
  final win = (comp.rules['pointsForWin'] as num?)?.toInt() ?? 3,
      draw = (comp.rules['pointsForDraw'] as num?)?.toInt() ?? 1;
  for (final m in matches) {
    if (!confirmedMatch(m)) continue;
    final ids = m['participantTeamIds'] as List? ?? [],
        score = competitionScore(m);
    if (ids.length != 2 || ids[0] == ids[1] || score == null) continue;
    final a = rows[ids[0]], b = rows[ids[1]];
    if (a == null || b == null) continue;
    final x = score['team1']!, y = score['team2']!;
    a[0]++;
    b[0]++;
    a[4] += x;
    a[5] += y;
    b[4] += y;
    b[5] += x;
    if (x == y) {
      a[2]++;
      b[2]++;
      a[6] += draw;
      b[6] += draw;
    } else if (x > y) {
      a[1]++;
      b[3]++;
      a[6] += win;
    } else {
      b[1]++;
      a[3]++;
      b[6] += win;
    }
  }
  final result = [
    for (final entry in rows.entries)
      StandingRow(
        teamId: entry.key,
        teamName: names[entry.key] ?? 'Equipo no disponible',
        played: entry.value[0],
        won: entry.value[1],
        drawn: entry.value[2],
        lost: entry.value[3],
        goalsFor: entry.value[4],
        goalsAgainst: entry.value[5],
        goalDiff: entry.value[4] - entry.value[5],
        points: entry.value[6],
      ),
  ];
  result.sort(
    (a, b) => b.points.compareTo(a.points) != 0
        ? b.points.compareTo(a.points)
        : b.goalDiff.compareTo(a.goalDiff) != 0
        ? b.goalDiff.compareTo(a.goalDiff)
        : b.goalsFor.compareTo(a.goalsFor) != 0
        ? b.goalsFor.compareTo(a.goalsFor)
        : a.teamName.compareTo(b.teamName),
  );
  return result;
}

class CompetitionPlayerStat {
  final String id;
  String name;
  int goals = 0, assists = 0, yellow = 0, red = 0;
  CompetitionPlayerStat(this.id, this.name);
}

List<CompetitionPlayerStat> competitionPlayerStats(
  List<Map<String, dynamic>> matches,
) {
  final stats = <String, CompetitionPlayerStat>{};
  for (final m in matches.where(confirmedMatch)) {
    final names = <String, String>{};
    for (final team in (m['teams'] as List? ?? [])) {
      for (final p in ((team as Map)['players'] as List? ?? [])) {
        final raw = p as Map;
        final id = raw['uid'] ?? raw['id'];
        if (id is String) {
          names[id] = (raw['displayName'] ?? raw['name'] ?? 'Jugador')
              .toString();
        }
      }
    }
    CompetitionPlayerStat? player(dynamic rawId, dynamic rawName) {
      if (rawId is! String || rawId.isEmpty) return null;
      return stats.putIfAbsent(
        rawId,
        () => CompetitionPlayerStat(
          rawId,
          (rawName ?? names[rawId] ?? 'Jugador').toString(),
        ),
      );
    }

    final events = (m['events'] as List? ?? []).whereType<Map>().toList();
    final goals = events.where((e) => e['type'] == 'goal').toList(),
        cards = events.where((e) => e['type'] == 'card').toList();
    if (goals.isNotEmpty) {
      for (final e in goals) {
        if (e['goalType'] == 'own_goal' || e['isOwnGoal'] == true) continue;
        final p = player(e['playerId'] ?? e['playerUid'], e['playerName']);
        if (p != null) p.goals++;
        final assist = player(
          e['assistPlayerId'] ?? e['assistId'],
          e['assistPlayerName'] ?? e['assistName'],
        );
        if (assist != null) assist.assists++;
      }
    } else {
      for (final raw in (m['goalScorers'] as List? ?? [])) {
        final e = raw as Map;
        if (e['goalType'] == 'own_goal') continue;
        final p = player(e['playerId'], e['playerName']);
        if (p != null) {
          p.goals += ((e['goals'] as num?)?.toInt() ?? 1).clamp(0, 999);
        }
      }
    }
    for (final e in events.where((e) => e['type'] == 'assist')) {
      final p = player(e['playerId'], e['playerName']);
      if (p != null &&
          !goals.any((g) => (g['assistPlayerId'] ?? g['assistId']) == p.id)) {
        p.assists++;
      }
    }
    final source = cards.isNotEmpty
        ? cards
        : (m['cards'] as List? ?? []).whereType<Map>();
    for (final e in source) {
      final p = player(e['playerId'], e['playerName']);
      if (p == null) continue;
      if (e['cardType'] == 'red') {
        p.red++;
      } else if (e['cardType'] == 'yellow')
        p.yellow++;
    }
  }
  return stats.values.toList()..sort(
    (a, b) => b.goals.compareTo(a.goals) != 0
        ? b.goals.compareTo(a.goals)
        : b.assists.compareTo(a.assists) != 0
        ? b.assists.compareTo(a.assists)
        : a.name.compareTo(b.name),
  );
}
