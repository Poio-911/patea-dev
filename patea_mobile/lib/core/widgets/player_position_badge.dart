import 'package:flutter/material.dart';
import '../../core/widgets/patea_card.dart';
import '../../core/theme/app_radii.dart';
import '../theme/patea_colors.dart';
import '../theme/app_typography.dart';

/// El puesto de un jugador.
///
/// Existía y se usaba en **dos** pantallas. En las demás el puesto era texto
/// suelto en tres tamaños distintos — y en dos de esos lugares ni siquiera
/// llevaba el color de la posición, que es lo único que el puesto aporta de un
/// vistazo.
///
/// [dense] no es otro diseño: es el mismo, sin caja, para cuando el puesto va
/// pegado al nombre en una fila angosta y una píldora pesaría demasiado.
class PlayerPositionBadge extends StatelessWidget {
  final String position;
  final bool showFullName;
  final double fontSize;

  /// Sin caja ni borde: sólo la sigla en el color del puesto.
  final bool dense;

  const PlayerPositionBadge({
    super.key,
    required this.position,
    this.showFullName = false,
    this.fontSize = 12,
    this.dense = false,
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
    final color = context.c.positionColor(position);
    final texto = showFullName
        ? _fullName.toUpperCase()
        : position.toUpperCase();

    if (dense) {
      return Text(
        texto,
        style: AppTypography.code(
          size: fontSize,
          weight: FontWeight.w700,
          color: color,
        ),
      );
    }

    return PateaCard(
             color: color.withValues(alpha: 0.18),
             radius: AppRadii.chipAll,
             borderColor: color.withValues(alpha: 0.8),
             borderWidth: 1,
             padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
             child: Text(
        texto,
        style: AppTypography.headline(
          size: fontSize,
          weight: FontWeight.w700,
          color: color,
        ),
      ),
           );
  }
}
