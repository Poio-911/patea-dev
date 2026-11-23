import 'package:flutter/material.dart';

import '../../../core/models/match_model.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/theme/patea_colors.dart';
import '../../../core/utils/match_calendar.dart';

const _weekdayInitials = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const _weekdayNames = [
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado',
  'domingo',
];

/// Los partidos del mes, día por día. Tocar un día muestra sus partidos abajo,
/// con la misma tarjeta que la lista ([cardBuilder]).
class MatchesCalendarView extends StatefulWidget {
  final List<MatchModel> matches;
  final Widget Function(MatchModel match) cardBuilder;

  /// Para probarlo con una fecha fija; por defecto es hoy.
  final DateTime? today;

  const MatchesCalendarView({
    super.key,
    required this.matches,
    required this.cardBuilder,
    this.today,
  });

  @override
  State<MatchesCalendarView> createState() => _MatchesCalendarViewState();
}

class _MatchesCalendarViewState extends State<MatchesCalendarView> {
  late DateTime _month;
  late DateTime _selected;

  DateTime get _today => dateOnly(widget.today ?? DateTime.now());

  @override
  void initState() {
    super.initState();
    _selected = _today;
    _month = DateTime(_today.year, _today.month, 1);
  }

  void _go(int delta) =>
      setState(() => _month = DateTime(_month.year, _month.month + delta, 1));

  void _goToday() => setState(() {
    _selected = _today;
    _month = DateTime(_today.year, _today.month, 1);
  });

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final byDay = groupByDay(widget.matches);
    final days = monthGrid(_month);
    final selectedMatches = byDay[_selected] ?? const <MatchModel>[];
    final label = monthLabel(_month);

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              IconButton(
                tooltip: 'Mes anterior',
                onPressed: () => _go(-1),
                icon: const Icon(Icons.chevron_left_rounded),
              ),
              Expanded(
                child: Text(
                  label[0].toUpperCase() + label.substring(1),
                  textAlign: TextAlign.center,
                  style: AppTypography.headline(size: 18, weight: FontWeight.w800),
                ),
              ),
              IconButton(
                tooltip: 'Mes siguiente',
                onPressed: () => _go(1),
                icon: const Icon(Icons.chevron_right_rounded),
              ),
              TextButton(onPressed: _goToday, child: const Text('Hoy')),
            ],
          ),
          const SizedBox(height: 6),
          Row(
            children: [
              for (final initial in _weekdayInitials)
                Expanded(
                  child: Center(
                    child: Text(
                      initial,
                      style: AppTypography.body(
                        size: 12,
                        weight: FontWeight.w700,
                        color: c.textSecondary,
                      ),
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 4),
          for (var week = 0; week < days.length ~/ 7; week++)
            Row(
              children: [
                for (final day in days.sublist(week * 7, week * 7 + 7))
                  Expanded(
                    child: _DayCell(
                      day: day,
                      inMonth: day.month == _month.month,
                      isToday: day == _today,
                      isSelected: day == _selected,
                      matches: byDay[day] ?? const [],
                      onTap: () => setState(() => _selected = day),
                    ),
                  ),
              ],
            ),
          const SizedBox(height: 18),
          Text(
            '${_weekdayNames[_selected.weekday - 1][0].toUpperCase()}${_weekdayNames[_selected.weekday - 1].substring(1)} ${_selected.day}',
            style: AppTypography.headline(size: 16, weight: FontWeight.w700),
          ),
          const SizedBox(height: 10),
          if (selectedMatches.isEmpty)
            Text(
              'No hay partidos este día.',
              style: AppTypography.body(size: 14, color: c.textSecondary),
            )
          else
            for (final m in selectedMatches)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: widget.cardBuilder(m),
              ),
        ],
      ),
    );
  }
}

class _DayCell extends StatelessWidget {
  final DateTime day;
  final bool inMonth;
  final bool isToday;
  final bool isSelected;
  final List<MatchModel> matches;
  final VoidCallback onTap;

  const _DayCell({
    required this.day,
    required this.inMonth,
    required this.isToday,
    required this.isSelected,
    required this.matches,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final hasMatches = matches.isNotEmpty;
    return Semantics(
      button: true,
      selected: isSelected,
      label: hasMatches
          ? '${day.day}, ${matches.length} ${matches.length == 1 ? 'partido' : 'partidos'}'
          : '${day.day}',
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onTap,
        child: AspectRatio(
          aspectRatio: 1,
          child: Container(
            margin: const EdgeInsets.all(2),
            decoration: BoxDecoration(
              color: isSelected ? c.primary.withValues(alpha: 0.18) : null,
              border: isToday ? Border.all(color: c.primary, width: 1.5) : null,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  '${day.day}',
                  style: AppTypography.body(
                    size: 14,
                    weight: isSelected || hasMatches
                        ? FontWeight.w800
                        : FontWeight.w500,
                    color: inMonth ? null : c.textSecondary.withValues(alpha: 0.45),
                  ),
                ),
                const SizedBox(height: 3),
                SizedBox(
                  height: 6,
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      for (final m in matches.take(3))
                        Container(
                          width: 5,
                          height: 5,
                          margin: const EdgeInsets.symmetric(horizontal: 1),
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: isPendingMatch(m)
                                ? c.primary
                                : c.textSecondary.withValues(alpha: 0.6),
                          ),
                        ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
