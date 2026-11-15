import 'dart:async';
import 'package:flutter_test/flutter_test.dart';
import 'package:patea_mobile/core/services/group_service.dart';
import 'package:patea_mobile/core/services/tournament_service.dart';
import 'package:patea_mobile/core/utils/bracket_generator.dart';

void main() {
  test('trofeos reciben cambios de ambas consultas y cancelan ambas', () async {
    var cancelled = 0;
    final cups = StreamController<List<TeamTrophy>>(
      onCancel: () {
        cancelled++;
      },
    );
    final leagues = StreamController<List<TeamTrophy>>(
      onCancel: () {
        cancelled++;
      },
    );
    final events = <List<TeamTrophy>>[];
    final sub = combineTeamTrophies(
      cups.stream,
      leagues.stream,
    ).listen(events.add);
    cups.add([const TeamTrophy(name: 'Copa 1', isCup: true)]);
    leagues.add([]);
    await Future<void>.delayed(Duration.zero);
    cups.add([const TeamTrophy(name: 'Copa 2', isCup: true)]);
    await Future<void>.delayed(Duration.zero);
    leagues.add([const TeamTrophy(name: 'Liga', isCup: false)]);
    await Future<void>.delayed(Duration.zero);
    expect(events.map((e) => e.map((t) => t.name).toList()).toList(), [
      ['Copa 1'],
      ['Copa 2'],
      ['Copa 2', 'Liga'],
    ]);
    await sub.cancel();
    expect(cancelled, 2);
    await cups.close();
    await leagues.close();
  });

  test(
    'resultados validan ganador, empate e intentos de alterar confirmados',
    () {
      final bracket = BracketGenerator.generateBracket(
        teams: [
          {'id': 'a', 'name': 'A'},
          {'id': 'b', 'name': 'B'},
        ],
        seedingType: 'ovr_based',
      );
      final matchId = bracket.single.id;
      expect(
        () => TournamentService.applyResult(
          bracket: bracket,
          matchId: matchId,
          winnerId: 'a',
          scoreTeam1: 1,
          scoreTeam2: 1,
        ),
        throwsArgumentError,
      );
      expect(
        () => TournamentService.applyResult(
          bracket: bracket,
          matchId: matchId,
          winnerId: 'b',
          scoreTeam1: 2,
          scoreTeam2: 1,
        ),
        throwsArgumentError,
      );
      expect(
        () => TournamentService.applyResult(
          bracket: bracket,
          matchId: matchId,
          winnerId: 'a',
          scoreTeam1: -1,
          scoreTeam2: 0,
        ),
        throwsArgumentError,
      );
      final updated = TournamentService.applyResult(
        bracket: bracket,
        matchId: matchId,
        winnerId: 'a',
        scoreTeam1: 2,
        scoreTeam2: 1,
      );
      expect(updated.single.winnerId, 'a');
      expect(
        TournamentService.applyResult(
          bracket: updated,
          matchId: matchId,
          winnerId: 'a',
          scoreTeam1: 2,
          scoreTeam2: 1,
        ),
        same(updated),
      );
      expect(
        () => TournamentService.applyResult(
          bracket: updated,
          matchId: matchId,
          winnerId: 'b',
          scoreTeam1: 1,
          scoreTeam2: 2,
        ),
        throwsStateError,
      );
    },
  );
  test('resultados sucesivos conservan semifinales y definen la final', () {
    final bracket = BracketGenerator.generateBracket(
      teams: [
        {'id': 'a', 'name': 'A'},
        {'id': 'b', 'name': 'B'},
        {'id': 'c', 'name': 'C'},
        {'id': 'd', 'name': 'D'},
      ],
      seedingType: 'ovr_based',
    );
    final first = TournamentService.applyResult(
      bracket: bracket,
      matchId: bracket[0].id,
      winnerId: 'a',
      scoreTeam1: 2,
      scoreTeam2: 0,
    );
    final second = TournamentService.applyResult(
      bracket: first,
      matchId: bracket[1].id,
      winnerId: 'd',
      scoreTeam1: 0,
      scoreTeam2: 1,
    );
    expect(second[0].winnerId, 'a');
    expect(second[0].scoreTeam1, 2);
    final finalMatch = second.firstWhere((m) => m.round == 'final');
    expect(finalMatch.team1Id, 'a');
    expect(finalMatch.team2Id, 'd');
    final finished = TournamentService.applyResult(
      bracket: second,
      matchId: finalMatch.id,
      winnerId: 'd',
      scoreTeam1: 0,
      scoreTeam2: 1,
    );
    expect(finished.last.winnerId, 'd');
  });
}
