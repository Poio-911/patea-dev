import '../../../core/models/match_model.dart';

/// Reloj del partido en vivo, reconstruido desde Firestore.
///
/// El minuto no se guarda tickeando: se deriva. `currentMinute` es el minuto
/// base del tramo actual y `periodStartTs` cuándo arrancó a correr ese tramo,
/// así que
///
///     minuto = currentMinute + (ahora - periodStartTs)
///
/// Es el mismo contrato que usa la web (`live-match-dashboard.tsx`). La
/// consecuencia importante: el tiempo avanza aunque nadie tenga la pantalla
/// abierta, y si el organizador cierra la app y vuelve, el partido está donde
/// tiene que estar. Antes el móvil mandaba el minuto a mano con un botón de
/// "+5 min" y el partido se congelaba.
class LiveClock {
  final int minute;
  final int second;
  final bool isRunning;
  final String status;

  const LiveClock({
    required this.minute,
    required this.second,
    required this.isRunning,
    required this.status,
  });

  /// Períodos en los que el cronómetro corre solo.
  static const _runningPeriods = {
    'first_half',
    'second_half',
    'extra_time_first',
    'extra_time_second',
  };

  factory LiveClock.of(MatchModel match) {
    final status = match.liveStatus ?? 'not_started';
    final base = match.currentMinute ?? 0;

    final ticking = match.status == 'active' &&
        _runningPeriods.contains(status) &&
        !match.timerPaused &&
        match.periodStartTs != null;

    if (!ticking) {
      return LiveClock(
        minute: base,
        second: 0,
        // "Corriendo" acá quiere decir "el partido está en juego", que es lo
        // que habilita cargar eventos: un partido en entretiempo sigue
        // estando en curso aunque el reloj esté detenido.
        isRunning: match.status == 'active' && status != 'not_started',
        status: status,
      );
    }

    var elapsed = DateTime.now().difference(match.periodStartTs!);
    // Un reloj del dispositivo atrasado respecto del servidor daría negativo.
    if (elapsed.isNegative) elapsed = Duration.zero;

    return LiveClock(
      minute: base + elapsed.inMinutes,
      second: elapsed.inSeconds % 60,
      isRunning: true,
      status: status,
    );
  }

  String get display => "$minute'${second.toString().padLeft(2, '0')}";

  String periodLabel(MatchModel match) {
    if (match.status == 'completed' || match.status == 'evaluated') return 'Finalizado';
    switch (status) {
      case 'first_half':
        return 'Primer tiempo';
      case 'half_time':
        return 'Entretiempo';
      case 'second_half':
        return 'Segundo tiempo';
      case 'extra_time_first':
        return 'Alargue, primer tiempo';
      case 'extra_time_break':
        return 'Alargue, descanso';
      case 'extra_time_second':
        return 'Alargue, segundo tiempo';
      case 'penalty_shootout':
        return 'Penales';
      default:
        return match.status == 'upcoming' ? 'Todavía no empezó' : 'En vivo';
    }
  }
}
