import 'package:flutter_test/flutter_test.dart';
import 'package:patea_mobile/core/services/ai_service.dart';

void main() {
  Map<String, dynamic> response(List<String> a, List<String> b) => {
    'teams': [
      for (final ids in [a, b])
        {
          'players': [
            for (final id in ids) {'uid': id},
          ],
        },
    ],
  };
  test('armado acepta plantel impar completo una vez en dos cupos parejos', () {
    expect(
      () => AiService.validateBalancedTeams(response(['a', 'b'], ['c']), {
        'a',
        'b',
        'c',
      }),
      returnsNormally,
    );
  });
  test('armado rechaza omisiones, duplicados, intrusos y equipos vacíos', () {
    for (final invalid in [
      response(['a'], ['b']),
      response(['a', 'b'], ['a']),
      response(['a', 'b'], ['stranger']),
      response(['a', 'b', 'c'], []),
    ]) {
      expect(
        () => AiService.validateBalancedTeams(invalid, {'a', 'b', 'c'}),
        throwsStateError,
      );
    }
  });
}
