import 'package:flutter_test/flutter_test.dart';
import 'package:patea_mobile/core/models/competition_model.dart';
import 'package:patea_mobile/features/competitions/competition_insights.dart';

void main() {
  test('tabla usa reglas propias y sólo marcadores finales válidos', () {
    final c = CompetitionModel(
      id: 'l',
      name: 'Liga',
      type: 'league',
      status: 'in_progress',
      ownerUid: 'o',
      teamIds: ['a', 'b'],
      rules: {'pointsForWin': 5, 'pointsForDraw': 2},
    );
    Map<String, dynamic> match(String status, int a, int b) => {
      'status': status,
      'participantTeamIds': ['a', 'b'],
      'finalScore': {'team1': a, 'team2': b},
    };
    final rows = competitionStandings(
      c,
      {'a': 'A', 'b': 'B'},
      [
        match('completed', 2, 0),
        match('evaluated', 1, 1),
        match('active', 99, 0),
        match('completed', -1, 0),
      ],
    );
    expect(rows.first.teamId, 'a');
    expect(rows.first.points, 7);
    expect(rows.first.played, 2);
    expect(rows.first.goalDiff, 2);
    expect(rows.last.points, 2);
  });
  test('penales nunca se suman al marcador y admite marcador legado', () {
    expect(
      competitionScore({
        'finalScore': {'team1': 1, 'team2': 1},
        'penaltyWinnerId': 'a',
      }),
      {'team1': 1, 'team2': 1},
    );
    expect(
      competitionScore({
        'teams': [
          {'score': 2},
          {'score': 0},
        ],
      }),
      {'team1': 2, 'team2': 0},
    );
    expect(
      competitionScore({
        'finalScore': {'team1': 1.5, 'team2': 1},
      }),
      isNull,
    );
  });
  test(
    'estadísticas no duplican eventos con resumen legado ni cuentan goles en contra',
    () {
      final stats = competitionPlayerStats([
        {
          'status': 'completed',
          'events': [
            {
              'type': 'goal',
              'playerId': 'a',
              'playerName': 'Ana',
              'assistId': 'b',
              'assistName': 'Beto',
            },
            {'type': 'goal', 'playerId': 'b', 'goalType': 'own_goal'},
            {'type': 'assist', 'playerId': 'b'},
            {'type': 'card', 'playerId': 'a', 'cardType': 'yellow'},
          ],
          'goalScorers': [
            {'playerId': 'a', 'goals': 9},
          ],
          'cards': [
            {'playerId': 'a', 'cardType': 'yellow'},
          ],
        },
        {
          'status': 'active',
          'events': [
            {'type': 'goal', 'playerId': 'a'},
          ],
        },
      ]);
      final a = stats.singleWhere((p) => p.id == 'a'),
          b = stats.singleWhere((p) => p.id == 'b');
      expect(a.goals, 1);
      expect(a.yellow, 1);
      expect(b.goals, 0);
      expect(b.assists, 1);
      expect(b.name, 'Beto');
    },
  );
}
