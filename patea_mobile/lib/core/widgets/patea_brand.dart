import 'package:flutter/material.dart';

import '../theme/app_typography.dart';
import '../theme/patea_colors.dart';
import 'soccer_runner_icon.dart';

/// Una sola firma de marca para el acceso, la navegación y la bienvenida.
/// El símbolo conserva el trazo oficial; el nombre nunca se oculta en móvil.
class PateaBrand extends StatelessWidget {
  final double width;
  final double? height;
  final bool onPhoto;

  const PateaBrand({
    super.key,
    this.width = 140,
    this.height,
    this.onPhoto = false,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Semantics(
      label: 'Pateá',
      image: true,
      child: ExcludeSemantics(
        child: SizedBox(
          width: width,
          height: height ?? width / 3.1,
          child: FittedBox(
            alignment: Alignment.centerLeft,
            fit: BoxFit.contain,
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                SoccerRunnerIcon(size: 40, color: onPhoto ? c.brandVolt : c.primary),
                const SizedBox(width: 10),
                Text(
                  'Pateá',
                  textScaler: TextScaler.noScaling,
                  style: AppTypography.headline(
                    size: 38,
                    weight: FontWeight.w700,
                    color: onPhoto ? c.onPhoto : c.textPrimary,
                    letterSpacing: -1.5,
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
