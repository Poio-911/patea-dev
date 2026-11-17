const _week = [
  'lunes',
  'martes',
  'miercoles',
  'jueves',
  'viernes',
  'sabado',
  'domingo',
];
const _names = [
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
  'Domingo',
];
const _short = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const _slots = ['mañana', 'tarde', 'noche'];

String _normalize(String value) => value
    .toLowerCase()
    .trim()
    .replaceAll('á', 'a')
    .replaceAll('é', 'e')
    .replaceAll('í', 'i')
    .replaceAll('ó', 'o')
    .replaceAll('ú', 'u');

Map<String, List<String>> _clean(Map<String, List<String>> schedule) {
  final result = <String, List<String>>{};
  for (final entry in schedule.entries) {
    final day = _normalize(entry.key);
    final slots =
        entry.value
            .map((v) => v.toLowerCase().trim().replaceAll('manana', 'mañana'))
            .where((v) => _slots.contains(v))
            .toSet()
            .toList()
          ..sort((a, b) => _slots.indexOf(a).compareTo(_slots.indexOf(b)));
    if (_week.contains(day) && slots.isNotEmpty) {
      result[day] = {...?result[day], ...slots}.toList()
        ..sort((a, b) => _slots.indexOf(a).compareTo(_slots.indexOf(b)));
    }
  }
  return result;
}

String _join(List<String> items) => items.length < 2
    ? items.first
    : '${items.take(items.length - 1).join(', ')} y ${items.last}';

String availabilitySummary(Map<String, List<String>> schedule) {
  final clean = _clean(schedule);
  final days = _week.where(clean.containsKey).toList();
  if (days.isEmpty) return 'Consultá sus horarios';
  final dayText = days.length == 7
      ? 'Todos los días'
      : days.length <= 2
      ? _join(days.map((d) => _short[_week.indexOf(d)]).toList())
      : '${days.take(2).map((d) => _short[_week.indexOf(d)]).join(', ')} +${days.length - 2} días';
  final patterns = clean.values.map((v) => v.join('|')).toSet();
  if (patterns.length != 1) return '$dayText · Horarios variados';
  final times = clean.values.first;
  final timeText = times.length == 3
      ? 'Cualquier horario'
      : _join(times.map((t) => t[0].toUpperCase() + t.substring(1)).toList());
  return '$dayText · $timeText';
}

List<String> availabilityDescriptions(Map<String, List<String>> schedule) {
  final clean = _clean(schedule);
  final groups = <String, List<String>>{};
  for (final day in _week.where(clean.containsKey)) {
    groups.putIfAbsent(clean[day]!.join('|'), () => []).add(day);
  }
  return [
    for (final group in groups.entries)
      (group.value.length == 7
              ? 'Todos los días'
              : _join(
                  group.value.asMap().entries.map((e) {
                    final name = _names[_week.indexOf(e.value)];
                    return e.key == 0 ? name : name.toLowerCase();
                  }).toList(),
                )) +
          (group.key.split('|').length == 3
              ? ' en cualquier horario.'
              : ' por la ${_join(group.key.split('|'))}.'),
  ];
}
