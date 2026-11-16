import 'package:fake_cloud_firestore/fake_cloud_firestore.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:patea_mobile/core/models/competition_model.dart';
import 'package:patea_mobile/core/services/tournament_service.dart';

void main() {
  late FakeFirebaseFirestore db;
  late TournamentService service;
  setUp(() async {
    db = FakeFirebaseFirestore();
    service = TournamentService(db, currentUid: 'owner');
    for (final id in ['a', 'b', 'c', 'd']) {
      await db.collection('teams').doc(id).set({
        'name': id,
        'groupId': 'group',
      });
    }
  });
  Future<String> create({
    bool cup = false,
    List<String> teams = const ['a', 'b'],
  }) => service.createCompetition(
    isCup: cup,
    name: '  Torneo del grupo  ',
    groupId: 'group',
    teamIds: teams,
    homeAndAway: true,
  );

  test(
    'liga y copa conservan el contrato web y el organizador autenticado',
    () async {
      for (final cup in [false, true]) {
        final id = await create(cup: cup);
        final data =
            (await db.collection(cup ? 'cups' : 'leagues').doc(id).get())
                .data()!;
        expect(data['name'], 'Torneo del grupo');
        expect(
          data['format'],
          cup ? 'single_elimination' : 'double_round_robin',
        );
        expect(data['teams'], ['a', 'b']);
        expect(data['ownerUid'], 'owner');
        expect(data['status'], 'draft');
        expect(data['isPublic'], false);
      }
    },
  );
  test(
    'rechaza equipos repetidos, faltantes, ajenos y cantidades inválidas',
    () async {
      await expectLater(create(teams: ['a', 'a']), throwsArgumentError);
      await expectLater(create(teams: ['a', 'missing']), throwsStateError);
      await db.collection('teams').doc('b').update({'groupId': 'other'});
      await expectLater(create(), throwsStateError);
      await expectLater(
        create(cup: true, teams: ['a', 'c', 'd']),
        throwsArgumentError,
      );
      expect((await db.collection('cups').get()).docs, isEmpty);
      expect((await db.collection('leagues').get()).docs, isEmpty);
    },
  );
  test('no crea sin sesión ni con nombre inválido', () async {
    await expectLater(
      TournamentService(db).createCompetition(
        isCup: false,
        name: 'Liga',
        groupId: 'group',
        teamIds: ['a', 'b'],
      ),
      throwsStateError,
    );
    await expectLater(
      service.createCompetition(
        isCup: false,
        name: '  ',
        groupId: 'group',
        teamIds: ['a', 'b'],
      ),
      throwsArgumentError,
    );
  });
  test(
    'elimina configuración propia y conserva partidos e integrantes',
    () async {
      final id = await create();
      final doc = db.collection('leagues').doc(id);
      await doc.collection('fixtures').doc('round').set({'roundNumber': 1});
      await doc.collection('referees').doc('ref').set({'name': 'Árbitro'});
      await db.collection('matches').doc('played').set({
        'leagueInfo': {'leagueId': id},
      });
      await service.deleteCompetition(id: id, isCup: false);
      expect((await doc.get()).exists, false);
      expect((await doc.collection('fixtures').get()).docs, isEmpty);
      expect((await doc.collection('referees').get()).docs, isEmpty);
      expect((await db.collection('matches').doc('played').get()).exists, true);
      expect((await db.collection('teams').get()).docs.length, 4);
    },
  );
  test('otro usuario no puede eliminar ni iniciar la copa', () async {
    final id = await create(cup: true);
    final other = TournamentService(db, currentUid: 'other');
    await expectLater(
      other.deleteCompetition(id: id, isCup: true),
      throwsStateError,
    );
    await expectLater(
      other.startCupTournament(
        cupId: id,
        teams: [
          {'id': 'a', 'name': 'A'},
          {'id': 'b', 'name': 'B'},
        ],
      ),
      throwsStateError,
    );
    expect((await db.collection('cups').doc(id).get()).exists, true);
  });
  test('copa genera llaves una sola vez y finaliza con el resultado', () async {
    final id = await create(cup: true);
    final teams = [
      {'id': 'a', 'name': 'A'},
      {'id': 'b', 'name': 'B'},
    ];
    await service.startCupTournament(cupId: id, teams: teams);
    await expectLater(
      service.startCupTournament(cupId: id, teams: teams),
      throwsStateError,
    );
    final doc = db.collection('cups').doc(id);
    final cup = CompetitionModel.fromFirestore(
      (await doc.get()).data()!,
      id,
      'cup',
    );
    final match = cup.bracket.single;
    await service.saveBracketMatchResult(
      cupId: id,
      matchId: match.id,
      winnerId: match.team1Id!,
      winnerName: match.team1Name!,
      scoreTeam1: 2,
      scoreTeam2: 1,
    );
    expect((await doc.get()).data()!['status'], 'completed');
  });
  test('no inicia con selección distinta a la guardada', () async {
    final id = await create(cup: true);
    await expectLater(
      service.startCupTournament(
        cupId: id,
        teams: [
          {'id': 'a', 'name': 'A'},
          {'id': 'c', 'name': 'C'},
        ],
      ),
      throwsStateError,
    );
    expect(
      (await db.collection('cups').doc(id).get()).data()!['status'],
      'draft',
    );
  });
  test('lee posiciones web y equipos legados', () {
    final row = StandingRow.fromMap({
      'teamId': 'a',
      'matchesPlayed': 3,
      'wins': 2,
      'draws': 1,
      'losses': 0,
      'goalDifference': 4,
      'points': 7,
    });
    expect(row.played, 3);
    expect(row.won, 2);
    expect(row.drawn, 1);
    expect(row.goalDiff, 4);
    final comp = CompetitionModel.fromFirestore(
      {
        'teams': [
          'a',
          {'id': 'b'},
        ],
      },
      'id',
      'league',
    );
    expect(comp.teamIds, ['a', 'b']);
  });
  test(
    'tabla usa resultados finales, ignora partidos en vivo y ordena desempates',
    () {
      Map<String, dynamic> match(
        String a,
        String b,
        int x,
        int y,
        String status,
      ) => {
        'participantTeamIds': [a, b],
        'finalScore': {'team1': x, 'team2': y},
        'status': status,
      };
      final rows = TournamentService.calculateStandings(
        ['a', 'b', 'c'],
        {'a': 'A', 'b': 'B', 'c': 'C'},
        [
          match('a', 'b', 2, 0, 'completed'),
          match('a', 'c', 1, 1, 'evaluated'),
          match('b', 'c', 5, 0, 'active'),
          match('b', 'c', 0, 1, 'completed'),
        ],
      );
      expect(rows.map((r) => r.teamId), ['a', 'c', 'b']);
      expect(rows.map((r) => r.points), [4, 4, 0]);
      expect(rows.first.played, 2);
      expect(rows.first.goalDiff, 2);
      expect(rows.last.lost, 2);
    },
  );
}
