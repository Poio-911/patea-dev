import 'package:flutter/material.dart';
import '../theme/app_colors.dart';
import '../theme/app_typography.dart';

class PlayerPositionBadge extends StatelessWidget {
  final String position;
  final bool showFullName;
  final double fontSize;

  const PlayerPositionBadge({
    super.key,
    required this.position,
    this.showFullName = false,
    this.fontSize = 12,
  });

  String get _fullName {
    switch (position.toUpperCase()) {
      case 'DEL':
        return 'Delantero';
      case 'MED':
        return 'Medio';
      case 'DEF':
        return 'Defensa';
      case 'POR':
        return 'Portero';
      default:
        return position;
    }
  }

  @override
  Widget build(BuildContext context) {
    final color = AppColors.getPositionColor(position);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.18),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: color.withValues(alpha: 0.8), width: 1),
      ),
      child: Text(
        showFullName ? _fullName.toUpperCase() : position.toUpperCase(),
        style: AppTypography.headline(
          size: fontSize,
          weight: FontWeight.w700,
          color: color,
        ),
      ),
    );
  }
}
