import 'package:flutter_test/flutter_test.dart';
import 'package:patea_mobile/core/models/match_model.dart';
import 'package:patea_mobile/core/utils/match_calendar.dart';

MatchModel match(String id, String date, {String? time, String status = 'upcoming'}) =>
    MatchModel(id: id, title: id, date: date, time: time, status: status, type: 'manual');

void main() {
  test('la grilla va de lunes a domingo con semanas completas', () {
    // Noviembre 2026: el 1 es domingo y el 30 es lunes.
    final days = monthGrid(DateTime(2026, 11, 15));
    expect(days.first, DateTime(2026, 10, 26));
    expect(days.last, DateTime(2026, 12, 6));
    expect(days.length % 7, 0);
    expect(days.length, 42);
    expect(days.first.weekday, DateTime.monday);
    expect(days.last.weekday, DateTime.sunday);
    expect(days.where((d) => d.month == 11).length, 30);
  });

  test('un mes que arranca en lunes y termina en domingo no suma semanas de más', () {
    // Febrero 2027: del lunes 1 al domingo 28.
    final days = monthGrid(DateTime(2027, 2, 10));
    expect(days.length, 28);
    expect(days.first, DateTime(2027, 2, 1));
    expect(days.last, DateTime(2027, 2, 28));
  });

  test('cruza el cambio de año y de hora sin saltear ni repetir días', () {
    final days = monthGrid(DateTime(2026, 12, 1));
    final keys = days.map((d) => '${d.year}-${d.month}-${d.day}').toSet();
    expect(keys.length, days.length);
    expect(days.last, DateTime(2027, 1, 3));
    for (final month in [3, 4, 9, 10, 11]) {
      final g = monthGrid(DateTime(2026, month, 1));
      expect(g.map((d) => d.day).toSet().length, lessThanOrEqualTo(31));
      for (var i = 1; i < g.length; i++) {
        expect(
          DateTime(g[i].year, g[i].month, g[i].day - 1),
          DateTime(g[i - 1].year, g[i - 1].month, g[i - 1].day),
        );
      }
    }
  });

  test('etiqueta del mes en castellano', () {
    expect(monthLabel(DateTime(2026, 11, 3)), 'noviembre 2026');
    expect(monthLabel(DateTime(2027, 1, 1)), 'enero 2027');
  });

  test('agrupa por día y ordena por hora; sin hora va al final', () {
    final grouped = groupByDay([
      match('tarde', '2026-11-22T00:00:00.000', time: '21:00 hs'),
      match('sin', '2026-11-22T00:00:00.000'),
      match('temprano', '2026-11-22T00:00:00.000', time: '9:30'),
      match('otro', '2026-11-23T00:00:00.000', time: '20:00'),
      match('sinfecha', ''),
    ]);
    expect(grouped.keys.length, 2);
    expect(
      grouped[DateTime(2026, 11, 22)]!.map((m) => m.id).toList(),
      ['temprano', 'tarde', 'sin'],
    );
    expect(grouped[DateTime(2026, 11, 23)]!.single.id, 'otro');
  });

  test('qué partidos se consideran pendientes', () {
    for (final s in ['upcoming', 'active', 'planning']) {
      expect(isPendingMatch(match('m', '2026-11-22', status: s)), isTrue, reason: s);
    }
    for (final s in ['completed', 'evaluated', 'cancelled']) {
      expect(isPendingMatch(match('m', '2026-11-22', status: s)), isFalse, reason: s);
    }
  });
}
