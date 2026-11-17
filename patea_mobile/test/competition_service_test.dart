import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:patea_mobile/core/models/competition_model.dart';
import 'package:patea_mobile/core/services/competition_service.dart';

class _Db extends Fake implements FirebaseFirestore {}

void main() {
  test(
    'cierre usa una operación atómica y solicita sincronización idempotente',
    () async {
      final calls = <Map<String, dynamic>>[];
      final service = CompetitionService(
        _Db(),
        gateway: (name, data) async {
          expect(name, 'manageCompetition');
          calls.add(data);
          return {'ok': true};
        },
      );
      await service.recordResult(
        'cups',
        'cup',
        'match',
        1,
        1,
        penaltyWinnerId: 'a',
      );
      expect(calls.map((c) => c['action']), ['recordResult', 'syncResult']);
      expect(calls.first['penaltyWinnerId'], 'a');
      expect(calls.first['team1'], 1);
    },
  );
  test('cruce ya vinculado conserva el partido y no crea otro', () async {
    final service = CompetitionService(
      _Db(),
      gateway: (_, _) async => throw StateError('No debe crear otro'),
    );
    final id = await service.prepareCupMatch(
      'cup',
      BracketMatchModel(
        id: 'final',
        round: 'final',
        matchNumber: 1,
        matchId: 'existing',
      ),
    );
    expect(id, 'existing');
  });
  test('error de cierre no inicia una segunda mutación', () async {
    var calls = 0;
    final service = CompetitionService(
      _Db(),
      gateway: (_, _) async {
        calls++;
        throw StateError('Reintentar');
      },
    );
    await expectLater(
      service.recordResult('leagues', 'l', 'm', 2, 0),
      throwsStateError,
    );
    expect(calls, 1);
  });
}
