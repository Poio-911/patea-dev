import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:patea_mobile/core/utils/match_photography.dart';

void main() {
  test('la selección permanece estable y reparte partidos entre ambientes distintos', () {
    final first = [for (var i = 0; i < 100; i++) MatchPhotography.forMatch('match-$i')];
    final second = [for (var i = 0; i < 100; i++) MatchPhotography.forMatch('match-$i')];
    expect(first, second);
    expect(first.toSet(), MatchPhotography.assets.toSet());
    expect(MatchPhotography.forMatch(''), isIn(MatchPhotography.assets));
  });
  test('cada portada seleccionable existe en el bundle local', () {
    for (final asset in MatchPhotography.assets) {
      expect(File(asset).existsSync(), isTrue, reason: asset);
    }
  });
}
