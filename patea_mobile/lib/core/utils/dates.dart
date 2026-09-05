/// Cómo se escribe una fecha en Pateá. Un solo lugar.
///
/// Estaba escrito siete veces, y las copias no coincidían: la misma fecha
/// salía **"05 de sep"** en el Panel y en Grupos, y **"05 sep"** en Explorar y
/// en el detalle del partido. Las tablas de meses estaban declaradas seis
/// veces y las de días de la semana, tres.
///
/// Gana la forma corta, sin "de", porque es la que usa la web
/// (`format(d, 'dd MMM')` en `match-card.tsx` y compañía).
///
/// **Por qué a mano y no con `intl`.** El paquete está en el pubspec, pero la
/// app nunca inicializa los datos de locale, así que `DateFormat(..., 'es')`
/// tira `LocaleDataException` en tiempo de ejecución. Cargar los datos por una
/// docena de fechas cortas es más peso y más arranque del que ahorra; el día
/// que haya que traducir la app, esto se reemplaza por `intl` de una sola vez
/// y en un solo archivo — que es justamente lo que este archivo hace posible.
///
/// Ver `docs/technical/AUDITORIA_DE_ESTILOS_Y_MODO_CLARO.md`.
library;

const _mesesCortos = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
];

const _mesesLargos = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

const _diasLargos = [
  'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo',
];

const _diasCortos = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

/// Los textos crudos que llegan de Firestore no siempre son fechas ISO: hay
/// partidos viejos guardados como "19 de Abril". Cuando no parsea, se devuelve
/// el texto tal cual en vez de un "Invalid Date".
DateTime? _parse(String? raw) {
  if (raw == null || raw.isEmpty) return null;
  return DateTime.tryParse(raw)?.toLocal();
}

/// `05 sep` — el formato corriente de la app.
String fmtDate(String? raw) {
  final d = _parse(raw);
  if (d == null) return raw ?? '';
  return '${_dd(d.day)} ${_mesesCortos[d.month - 1]}';
}

/// `05 sep, 21:00`
String fmtDateTime(String? raw) {
  final d = _parse(raw);
  if (d == null) return raw ?? '';
  return '${fmtDate(raw)}, ${fmtTime(d)}';
}

/// `21:00`
String fmtTime(DateTime d) => '${_dd(d.hour)}:${_dd(d.minute)}';

/// `Sábado 5 de septiembre` — para titulares, no para listas.
String fmtLongDate(String? raw) {
  final d = _parse(raw);
  if (d == null) return raw ?? '';
  return fmtLongDateOf(d);
}

/// Igual que [fmtLongDate] pero desde un `DateTime` ya resuelto.
String fmtLongDateOf(DateTime? d) {
  if (d == null) return 'Sin fecha';
  return '${_diasLargos[d.weekday - 1]} ${d.day} de '
      '${_mesesLargos[d.month - 1]}';
}

/// `5 de septiembre`, sin el día de la semana.
String fmtDayAndMonth(String? raw) {
  final d = _parse(raw);
  if (d == null) return raw ?? '';
  return '${d.day} de ${_mesesLargos[d.month - 1]}';
}

/// Sólo el número del día, con cero adelante: `05`.
String fmtDayNumber(String? raw) {
  final d = _parse(raw);
  if (d == null) return '';
  return _dd(d.day);
}

/// Sólo el mes, en mayúsculas: `SEP`.
String fmtMonthShort(String? raw) {
  final d = _parse(raw);
  if (d == null) return '';
  return _mesesCortos[d.month - 1].toUpperCase();
}

/// `Lun`, `Mar`… por número de día de la semana (1 = lunes).
String weekdayShort(int weekday) => _diasCortos[weekday - 1];

String _dd(int n) => n.toString().padLeft(2, '0');
