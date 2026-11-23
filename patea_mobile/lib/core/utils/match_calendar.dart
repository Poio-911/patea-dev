import '../models/match_model.dart';

/// Lógica del calendario de partidos, sin widgets, para probarla sola.

const _months = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

/// «noviembre 2026».
String monthLabel(DateTime month) => '${_months[month.month - 1]} ${month.year}';

DateTime dateOnly(DateTime d) => DateTime(d.year, d.month, d.day);

/// Los días que se dibujan para [month]: semanas completas, de lunes a domingo,
/// desde la que contiene el día 1 hasta la que contiene el último día.
List<DateTime> monthGrid(DateTime month) {
  final first = DateTime(month.year, month.month, 1);
  final last = DateTime(month.year, month.month + 1, 0);
  // `weekday`: lunes = 1 … domingo = 7.
  final start = first.subtract(Duration(days: first.weekday - 1));
  final end = last.add(Duration(days: 7 - last.weekday));
  final days = <DateTime>[];
  // Se avanza por fecha del calendario (no sumando 24 h) para no tropezar con
  // un cambio de hora.
  for (
    var d = start;
    !d.isAfter(end);
    d = DateTime(d.year, d.month, d.day + 1)
  ) {
    days.add(d);
  }
  return days;
}

/// El día (en hora local) en que se juega el partido; null si no tiene fecha.
DateTime? matchDayOf(MatchModel m) {
  final d = DateTime.tryParse(m.date);
  return d == null ? null : dateOnly(d.toLocal());
}

/// Los partidos agrupados por día, cada día ordenado por hora de inicio.
Map<DateTime, List<MatchModel>> groupByDay(Iterable<MatchModel> matches) {
  final map = <DateTime, List<MatchModel>>{};
  for (final m in matches) {
    final day = matchDayOf(m);
    if (day != null) map.putIfAbsent(day, () => []).add(m);
  }
  for (final list in map.values) {
    list.sort((a, b) => _minutesOfDay(a).compareTo(_minutesOfDay(b)));
  }
  return map;
}

/// Minutos desde medianoche, mirando el campo `time` («21:00» o «21:00 hs»);
/// sin hora, el partido va al final del día.
int _minutesOfDay(MatchModel m) {
  final match = RegExp(r'(\d{1,2}):(\d{2})').firstMatch(m.time ?? '');
  if (match == null) return 24 * 60;
  return int.parse(match.group(1)!) * 60 + int.parse(match.group(2)!);
}

/// ¿El partido todavía está por jugarse (o en juego)? Decide el color del punto.
bool isPendingMatch(MatchModel m) =>
    m.status == 'upcoming' || m.status == 'active' || m.status == 'planning';
