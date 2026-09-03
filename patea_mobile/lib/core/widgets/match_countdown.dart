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

  const MatchCountdown({super.key, required this.kickoff});

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
          _Unit(value: days, label: 'D'),
          const _Sep(),
        ],
        _Unit(value: hours, label: 'H'),
        const _Sep(),
        _Unit(value: minutes, label: 'M'),
        // Los segundos sólo cuando ya falta poco: en tres días son ruido.
        if (days == 0) ...[
          const _Sep(),
          _Unit(value: seconds, label: 'S', dim: true),
        ],
      ],
    );
  }
}

class _Unit extends StatelessWidget {
  final int value;
  final String label;
  final bool dim;

  const _Unit({required this.value, required this.label, this.dim = false});

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        Text(
          value.toString().padLeft(2, '0'),
          style: AppTypography.sportNumber(
            size: dim ? 22 : 30,
            color: dim ? AppColors.textSecondary : AppColors.textPrimary,
          ),
        ),
        Padding(
          padding: const EdgeInsets.only(bottom: 4, left: 1),
          child: Text(
            label,
            style: AppTypography.code(size: 9, color: AppColors.textMuted),
          ),
        ),
      ],
    );
  }
}

class _Sep extends StatelessWidget {
  const _Sep();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(left: 7, right: 7, bottom: 5),
      child: Text(
        ':',
        style: AppTypography.sportNumber(size: 20, color: AppColors.textMuted),
      ),
    );
  }
}
