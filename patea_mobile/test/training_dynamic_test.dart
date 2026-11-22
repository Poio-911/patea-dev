import 'package:flutter_test/flutter_test.dart';
import 'package:patea_mobile/core/models/player_model.dart';
import 'package:patea_mobile/features/coach/training_focus.dart';

PlayerModel _player() => PlayerModel(
  id: 'p1',
  name: 'Aurelio',
  position: 'DEL',
  ovr: 60,
  pac: 70,
  sho: 40,
  pas: 45,
  dri: 80,
  def: 60,
  phy: 65,
);

void main() {
  // Miércoles 19 de noviembre de 2026.
  final now = DateTime(2026, 11, 19, 20);
  TrainingEntry at(String focus, int daysAgo, {int hour = 18}) =>
      TrainingEntry(focus, DateTime(2026, 11, 19 - daysAgo, hour));

  group('resumen', () {
    test('cuenta sólo la semana en curso (desde el lunes)', () {
      final summary = summarizeTraining(
        [at('sho', 0), at('pas', 1), at('sho', 2), at('dri', 5)],
        now,
      );
      expect(summary.sessionsThisWeek, 3, reason: 'lunes, martes y miércoles');
      expect(summary.goalReached, isTrue);
    });

    test('la racha cuenta días seguidos hasta hoy o hasta ayer', () {
      expect(summarizeTraining([at('sho', 0), at('pas', 1), at('sho', 2)], now).streakDays, 3);
      expect(summarizeTraining([at('sho', 1), at('pas', 2)], now).streakDays, 2, reason: 'hoy todavía puede sumar');
      expect(summarizeTraining([at('sho', 3)], now).streakDays, 0);
      expect(summarizeTraining([at('sho', 0), at('sho', 0, hour: 9)], now).streakDays, 1);
    });

    test('guarda la última vez de cada objetivo', () {
      final summary = summarizeTraining([at('sho', 4), at('sho', 1), at('pas', 2)], now);
      expect(trainedAgoLabel(summary.lastByFocus['sho'], now), 'ayer');
      expect(trainedAgoLabel(summary.lastByFocus['pas'], now), 'hace 2 días');
      expect(trainedAgoLabel(summary.lastByFocus['dri'], now), isNull);
      expect(trainedAgoLabel(now, now), 'hoy');
    });
  });

  group('sugerencia', () {
    final focuses = trainingFocusFor(_player());

    test('sin registro es el atributo más bajo', () {
      expect(suggestedFocusFor(focuses, const []).id, 'sho');
    });

    test('rota: no repite lo que trabajaste en las dos últimas sesiones', () {
      expect(suggestedFocusFor(focuses, [at('sho', 1)]).id, 'pas');
      final third = suggestedFocusFor(focuses, [at('sho', 1), at('pas', 2)]);
      expect(['sho', 'pas'].contains(third.id), isFalse);
      expect(third.id, 'def', reason: 'el siguiente más bajo (empate def/phy)');
    });

    test('el orden del registro no importa: cuentan las dos más recientes', () {
      final log = [at('pas', 2), at('sho', 1), at('dri', 9)];
      expect(suggestedFocusFor(focuses, log).id, isNot(anyOf('sho', 'pas')));
    });
  });
}
