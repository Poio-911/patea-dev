import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/models/match_model.dart';
import '../../../core/services/auth_service.dart';
import '../../../core/services/match_service.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_typography.dart';
import '../live_match_screen.dart' show kTeamAId, kTeamBId;

/// Carga de un evento en vivo. Port de `event-logger.tsx`.
///
/// La pantalla vieja sólo sabía de goles, y ni siquiera guardaba la
/// asistencia. Acá está el formulario completo por tipo: gol (autor,
/// asistencia, tipo de gol), tarjeta (amarilla o roja + motivo), cambio (quién
/// sale y quién entra + motivo), y falta/córner (equipo y jugador).
class EventLoggerSheet extends ConsumerStatefulWidget {
  final MatchModel match;
  final String eventType;
  final int currentMinute;

  const EventLoggerSheet({
    super.key,
    required this.match,
    required this.eventType,
    required this.currentMinute,
  });

  @override
  ConsumerState<EventLoggerSheet> createState() => _EventLoggerSheetState();
}

class _EventLoggerSheetState extends ConsumerState<EventLoggerSheet> {
  bool _teamA = true;
  late int _minute;

  String? _playerId;
  String? _playerName;
  String? _assistId;
  String? _assistName;
  String? _outId;
  String? _outName;
  String? _inId;
  String? _inName;

  String _goalType = 'regular';
  String _cardType = 'yellow';
  String _cardReason = 'foul';
  String _subReason = 'tactical';

  bool _saving = false;

  static const _goalTypes = {
    'regular': 'De jugada',
    'penalty': 'De penal',
    'free_kick': 'De tiro libre',
    'header': 'De cabeza',
    'volley': 'De volea',
    'own_goal': 'En contra',
  };

  static const _cardReasons = {
    'foul': 'Falta',
    'unsporting_behavior': 'Antideportiva',
    'dissent': 'Protestar',
    'persistent_fouling': 'Faltas reiteradas',
    'delaying_game': 'Demorar el juego',
    'other': 'Otro',
  };

  static const _subReasons = {
    'tactical': 'Táctico',
    'injury': 'Lesión',
    'tired': 'Cansancio',
    'poor_performance': 'Bajo rendimiento',
    'disciplinary': 'Disciplinario',
  };

  @override
  void initState() {
    super.initState();
    _minute = widget.currentMinute;
  }

  /// Plantel del lado elegido. Los partidos armados con IA traen el detalle en
  /// `teams[].players`; los más viejos sólo guardan `playerIds`, así que hay
  /// que cruzarlo contra la lista general del partido.
  List<MatchPlayerEntry> get _roster {
    final team = _teamA ? widget.match.teamA : widget.match.teamB;
    if (team == null) return widget.match.players;
    if (team.players.isNotEmpty) return team.players;
    if (team.playerIds.isNotEmpty) {
      final ids = team.playerIds.toSet();
      final found = widget.match.players.where((p) => ids.contains(p.uid)).toList();
      if (found.isNotEmpty) return found;
    }
    return widget.match.players;
  }

  String get _title {
    switch (widget.eventType) {
      case 'goal':
        return 'Gol';
      case 'card':
        return 'Tarjeta';
      case 'substitution':
        return 'Cambio';
      case 'foul':
        return 'Falta';
      case 'corner':
        return 'Córner';
      default:
        return 'Evento';
    }
  }

  bool get _canSave {
    if (_saving) return false;
    if (widget.eventType == 'substitution') return _outId != null && _inId != null;
    return _playerId != null;
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    final messenger = ScaffoldMessenger.of(context);
    final navigator = Navigator.of(context);
    final match = widget.match;
    final uid = ref.read(authStateProvider).value?.uid;

    final isOwnGoal = widget.eventType == 'goal' && _goalType == 'own_goal';
    // Un gol en contra lo anota el otro equipo.
    final scoringA = isOwnGoal ? !_teamA : _teamA;

    final event = MatchEvent(
      id: DateTime.now().microsecondsSinceEpoch.toString(),
      type: widget.eventType,
      minute: _minute,
      playerId: widget.eventType == 'substitution' ? (_outId ?? '') : (_playerId ?? ''),
      playerName: widget.eventType == 'substitution' ? (_outName ?? '') : (_playerName ?? ''),
      teamId: _teamA ? kTeamAId : kTeamBId,
      assistId: widget.eventType == 'goal' ? _assistId : null,
      assistName: widget.eventType == 'goal' ? _assistName : null,
      goalType: widget.eventType == 'goal' ? _goalType : null,
      cardType: widget.eventType == 'card' ? _cardType : null,
      cardReason: widget.eventType == 'card' ? _cardReason : null,
      playerOutId: widget.eventType == 'substitution' ? _outId : null,
      playerOutName: widget.eventType == 'substitution' ? _outName : null,
      playerInId: widget.eventType == 'substitution' ? _inId : null,
      playerInName: widget.eventType == 'substitution' ? _inName : null,
      substitutionReason: widget.eventType == 'substitution' ? _subReason : null,
      timestamp: DateTime.now().toIso8601String(),
      recordedBy: uid,
    );

    int? newA;
    int? newB;
    if (widget.eventType == 'goal') {
      newA = (match.teamA?.score ?? 0) + (scoringA ? 1 : 0);
      newB = (match.teamB?.score ?? 0) + (scoringA ? 0 : 1);
    }

    try {
      await ref.read(matchServiceProvider).recordLiveEvent(
            matchId: match.id,
            event: event,
            teamAScore: newA,
            teamBScore: newB,
          );
      navigator.pop();
    } catch (e) {
      setState(() => _saving = false);
      messenger.showSnackBar(
        SnackBar(
          content: Text('$e'),
          backgroundColor: AppColors.destructive,
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final isGoal = widget.eventType == 'goal';
    final isCard = widget.eventType == 'card';
    final isSub = widget.eventType == 'substitution';

    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: Container(
        decoration: const BoxDecoration(
          color: AppColors.popover,
          borderRadius: AppRadii.surfaceTop,
        ),
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
        child: SafeArea(
          top: false,
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Center(
                  child: Container(
                    width: 44,
                    height: 4,
                    margin: const EdgeInsets.only(bottom: 18),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.25),
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),

                Row(
                  children: [
                    Text(_title,
                        style: AppTypography.headline(size: 20, weight: FontWeight.w900)),
                    const Spacer(),
                    _MinuteStepper(
                      minute: _minute,
                      onChanged: (m) => setState(() => _minute = m),
                    ),
                  ],
                ),
                const SizedBox(height: 18),

                _TeamToggle(
                  match: widget.match,
                  teamA: _teamA,
                  onChanged: (v) => setState(() {
                    _teamA = v;
                    _playerId = _playerName = null;
                    _assistId = _assistName = null;
                    _outId = _outName = _inId = _inName = null;
                  }),
                ),
                const SizedBox(height: 18),

                if (isSub) ...[
                  _PlayerPicker(
                    label: 'Sale',
                    players: _roster,
                    selectedId: _outId,
                    onPick: (p) => setState(() {
                      _outId = p?.uid;
                      _outName = p?.displayName;
                    }),
                  ),
                  const SizedBox(height: 12),
                  _PlayerPicker(
                    label: 'Entra',
                    players: _roster.where((p) => p.uid != _outId).toList(),
                    selectedId: _inId,
                    onPick: (p) => setState(() {
                      _inId = p?.uid;
                      _inName = p?.displayName;
                    }),
                  ),
                  const SizedBox(height: 16),
                  _OptionRow(
                    label: 'Motivo',
                    options: _subReasons,
                    value: _subReason,
                    onChanged: (v) => setState(() => _subReason = v),
                  ),
                ] else ...[
                  _PlayerPicker(
                    label: isCard ? 'Amonestado' : 'Jugador',
                    players: _roster,
                    selectedId: _playerId,
                    onPick: (p) => setState(() {
                      _playerId = p?.uid;
                      _playerName = p?.displayName;
                      if (_assistId == _playerId) {
                        _assistId = null;
                        _assistName = null;
                      }
                    }),
                  ),
                ],

                if (isGoal) ...[
                  const SizedBox(height: 12),
                  _PlayerPicker(
                    label: 'Asistencia (opcional)',
                    players: _roster.where((p) => p.uid != _playerId).toList(),
                    selectedId: _assistId,
                    allowClear: true,
                    onPick: (p) => setState(() {
                      _assistId = p?.uid;
                      _assistName = p?.displayName;
                    }),
                  ),
                  const SizedBox(height: 16),
                  _OptionRow(
                    label: 'Cómo fue',
                    options: _goalTypes,
                    value: _goalType,
                    onChanged: (v) => setState(() => _goalType = v),
                  ),
                ],

                if (isCard) ...[
                  const SizedBox(height: 16),
                  _CardColorPicker(
                    value: _cardType,
                    onChanged: (v) => setState(() => _cardType = v),
                  ),
                  const SizedBox(height: 16),
                  _OptionRow(
                    label: 'Motivo',
                    options: _cardReasons,
                    value: _cardReason,
                    onChanged: (v) => setState(() => _cardReason = v),
                  ),
                ],

                const SizedBox(height: 24),
                FilledButton(
                  onPressed: _canSave ? _save : null,
                  style: FilledButton.styleFrom(
                    backgroundColor: AppColors.voltNeon,
                    foregroundColor: AppColors.background,
                    disabledBackgroundColor: Colors.white.withValues(alpha: 0.08),
                    padding: const EdgeInsets.symmetric(vertical: 15),
                    shape: const RoundedRectangleBorder(borderRadius: AppRadii.cardAll),
                  ),
                  child: _saving
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: AppColors.background),
                        )
                      : Text('Guardar',
                          style: AppTypography.headline(
                              size: 14,
                              weight: FontWeight.w800,
                              color: _canSave ? AppColors.background : AppColors.textMuted)),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _MinuteStepper extends StatelessWidget {
  final int minute;
  final ValueChanged<int> onChanged;

  const _MinuteStepper({required this.minute, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        borderRadius: AppRadii.chipAll,
        border: Border.all(color: Colors.white.withValues(alpha: 0.15)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _step(Icons.remove_rounded, () => onChanged(minute > 0 ? minute - 1 : 0)),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 4),
            child: Text("$minute'",
                style: AppTypography.code(size: 14, weight: FontWeight.w800)),
          ),
          _step(Icons.add_rounded, () => onChanged(minute + 1)),
        ],
      ),
    );
  }

  Widget _step(IconData icon, VoidCallback onTap) => InkWell(
        onTap: onTap,
        borderRadius: AppRadii.chipAll,
        child: Padding(
          padding: const EdgeInsets.all(7),
          child: Icon(icon, size: 16, color: AppColors.textSecondary),
        ),
      );
}

class _TeamToggle extends StatelessWidget {
  final MatchModel match;
  final bool teamA;
  final ValueChanged<bool> onChanged;

  const _TeamToggle({required this.match, required this.teamA, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: _side(match.teamA?.name ?? 'Equipo A', teamA, () => onChanged(true)),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: _side(match.teamB?.name ?? 'Equipo B', !teamA, () => onChanged(false)),
        ),
      ],
    );
  }

  Widget _side(String name, bool selected, VoidCallback onTap) => InkWell(
        onTap: onTap,
        borderRadius: AppRadii.cardAll,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 10),
          decoration: BoxDecoration(
            color: selected ? AppColors.voltNeon.withValues(alpha: 0.12) : Colors.transparent,
            borderRadius: AppRadii.cardAll,
            border: Border.all(
              color: selected ? AppColors.voltNeon : Colors.white.withValues(alpha: 0.12),
            ),
          ),
          child: Text(
            name,
            textAlign: TextAlign.center,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: AppTypography.headline(
              size: 13,
              weight: FontWeight.w800,
              color: selected ? AppColors.voltNeon : AppColors.textSecondary,
            ),
          ),
        ),
      );
}

class _PlayerPicker extends StatelessWidget {
  final String label;
  final List<MatchPlayerEntry> players;
  final String? selectedId;
  final bool allowClear;
  final ValueChanged<MatchPlayerEntry?> onPick;

  const _PlayerPicker({
    required this.label,
    required this.players,
    required this.selectedId,
    required this.onPick,
    this.allowClear = false,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label.toUpperCase(),
            style: AppTypography.headline(
                size: 10, weight: FontWeight.w800,
                color: AppColors.textMuted, letterSpacing: 1)),
        const SizedBox(height: 8),
        if (players.isEmpty)
          Text('No hay jugadores cargados en este equipo.',
              style: AppTypography.body(size: 12, color: AppColors.textMuted))
        else
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              if (allowClear)
                _chip('Ninguna', selectedId == null, () => onPick(null)),
              for (final p in players)
                _chip(p.displayName, p.uid == selectedId, () => onPick(p)),
            ],
          ),
      ],
    );
  }

  Widget _chip(String text, bool selected, VoidCallback onTap) => InkWell(
        onTap: onTap,
        borderRadius: AppRadii.chipAll,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          decoration: BoxDecoration(
            color: selected ? AppColors.voltNeon.withValues(alpha: 0.14) : Colors.transparent,
            borderRadius: AppRadii.chipAll,
            border: Border.all(
              color: selected ? AppColors.voltNeon : Colors.white.withValues(alpha: 0.12),
            ),
          ),
          child: Text(
            text,
            style: AppTypography.body(
              size: 12,
              weight: selected ? FontWeight.w700 : FontWeight.w400,
              color: selected ? AppColors.voltNeon : AppColors.textSecondary,
            ),
          ),
        ),
      );
}

class _OptionRow extends StatelessWidget {
  final String label;
  final Map<String, String> options;
  final String value;
  final ValueChanged<String> onChanged;

  const _OptionRow({
    required this.label,
    required this.options,
    required this.value,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label.toUpperCase(),
            style: AppTypography.headline(
                size: 10, weight: FontWeight.w800,
                color: AppColors.textMuted, letterSpacing: 1)),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final entry in options.entries)
              InkWell(
                onTap: () => onChanged(entry.key),
                borderRadius: AppRadii.chipAll,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    color: entry.key == value
                        ? AppColors.voltNeon.withValues(alpha: 0.14)
                        : Colors.transparent,
                    borderRadius: AppRadii.chipAll,
                    border: Border.all(
                      color: entry.key == value
                          ? AppColors.voltNeon
                          : Colors.white.withValues(alpha: 0.12),
                    ),
                  ),
                  child: Text(
                    entry.value,
                    style: AppTypography.body(
                      size: 12,
                      color: entry.key == value ? AppColors.voltNeon : AppColors.textSecondary,
                    ),
                  ),
                ),
              ),
          ],
        ),
      ],
    );
  }
}

class _CardColorPicker extends StatelessWidget {
  final String value;
  final ValueChanged<String> onChanged;

  const _CardColorPicker({required this.value, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(child: _card('yellow', 'Amarilla', AppColors.warning)),
        const SizedBox(width: 10),
        Expanded(child: _card('red', 'Roja', AppColors.destructive)),
      ],
    );
  }

  Widget _card(String key, String label, Color color) {
    final selected = value == key;
    return InkWell(
      onTap: () => onChanged(key),
      borderRadius: AppRadii.cardAll,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: BoxDecoration(
          color: selected ? color.withValues(alpha: 0.14) : Colors.transparent,
          borderRadius: AppRadii.cardAll,
          border: Border.all(color: selected ? color : Colors.white.withValues(alpha: 0.12)),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 12,
              height: 16,
              decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(2)),
            ),
            const SizedBox(width: 8),
            Text(label,
                style: AppTypography.headline(
                    size: 13,
                    weight: FontWeight.w800,
                    color: selected ? color : AppColors.textSecondary)),
          ],
        ),
      ),
    );
  }
}
