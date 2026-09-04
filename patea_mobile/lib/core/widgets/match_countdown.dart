import 'dart:async';

import 'package:flutter/material.dart';

import '../theme/app_colors.dart';
import '../theme/app_typography.dart';

/// Cuenta regresiva al próximo partido, corriendo de verdad.
///
/// Es la razón por la que alguien abre la app un jueves a la tarde: saber
/// cuánto falta. Antes había que leer la fecha y hacer la cuenta mental.
///
/// Se apaga sola cuando llega a cero y muestra "¡Es ahora!".
class MatchCountdown extends StatefulWidget {
  final DateTime kickoff;
  final double? size;
  final Color? color;
  final bool isItalic;

  const MatchCountdown({
    super.key,
    required this.kickoff,
    this.size,
    this.color,
    this.isItalic = false,
  });

  @override
  State<MatchCountdown> createState() => _MatchCountdownState();
}

class _MatchCountdownState extends State<MatchCountdown> {
  Timer? _timer;
  late Duration _left;

  @override
  void initState() {
    super.initState();
    _tick();
    // Un tick por segundo sólo si falta menos de un día: más allá de eso los
    // segundos no le importan a nadie y es despertar la pantalla al pedo.
    _timer = Timer.periodic(
      _left.inHours < 24 ? const Duration(seconds: 1) : const Duration(minutes: 1),
      (_) => _tick(),
    );
  }

  void _tick() {
    final left = widget.kickoff.difference(DateTime.now());
    if (mounted) {
      setState(() => _left = left.isNegative ? Duration.zero : left);
    } else {
      _left = left.isNegative ? Duration.zero : left;
    }
    if (_left == Duration.zero) _timer?.cancel();
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_left == Duration.zero) {
      return Text(
        '¡ES AHORA!',
        style: AppTypography.headline(
          size: 15,
          weight: FontWeight.w900,
          color: AppColors.voltNeon,
        ),
      );
    }

    final days = _left.inDays;
    final hours = _left.inHours % 24;
    final minutes = _left.inMinutes % 60;
    final seconds = _left.inSeconds % 60;

    return Row(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        if (days > 0) ...[
          _Unit(value: days, label: 'D', size: widget.size, color: widget.color, isItalic: widget.isItalic),
          _Sep(size: widget.size, color: widget.color),
        ],
        _Unit(value: hours, label: 'H', size: widget.size, color: widget.color, isItalic: widget.isItalic),
        _Sep(size: widget.size, color: widget.color),
        _Unit(value: minutes, label: 'M', size: widget.size, color: widget.color, isItalic: widget.isItalic),
        // Los segundos sólo cuando ya falta poco: en tres días son ruido.
        if (days == 0) ...[
          _Sep(size: widget.size, color: widget.color),
          _Unit(value: seconds, label: 'S', dim: true, size: widget.size, color: widget.color, isItalic: widget.isItalic),
        ],
      ],
    );
  }
}

class _Unit extends StatelessWidget {
  final int value;
  final String label;
  final bool dim;
  final double? size;
  final Color? color;
  final bool isItalic;

  const _Unit({
    required this.value,
    required this.label,
    this.dim = false,
    this.size,
    this.color,
    this.isItalic = false,
  });

  @override
  Widget build(BuildContext context) {
    final baseSize = size ?? 30;
    final displaySize = dim ? baseSize * 0.75 : baseSize;
    final displayColor = color ?? (dim ? AppColors.textSecondary : AppColors.textPrimary);

    return Row(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        Text(
          value.toString().padLeft(2, '0'),
          style: AppTypography.sportNumber(
            size: displaySize,
            color: displayColor,
          ).copyWith(
            fontStyle: isItalic ? FontStyle.italic : FontStyle.normal,
          ),
        ),
        Padding(
          padding: const EdgeInsets.only(bottom: 4, left: 1),
          child: Text(
            label,
            style: AppTypography.code(size: (baseSize * 0.3).clamp(8.0, 12.0), color: AppColors.textMuted),
          ),
        ),
      ],
    );
  }
}

class _Sep extends StatelessWidget {
  final double? size;
  final Color? color;

  const _Sep({this.size, this.color});

  @override
  Widget build(BuildContext context) {
    final baseSize = size ?? 30;
    return Padding(
      padding: EdgeInsets.only(
        left: (baseSize * 0.18).clamp(4.0, 8.0),
        right: (baseSize * 0.18).clamp(4.0, 8.0),
        bottom: 5,
      ),
      child: Text(
        ':',
        style: AppTypography.sportNumber(
          size: baseSize * 0.65,
          color: color?.withValues(alpha: 0.6) ?? AppColors.textMuted,
        ),
      ),
    );
  }
}
