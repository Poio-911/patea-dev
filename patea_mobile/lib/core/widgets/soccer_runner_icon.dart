import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import '../theme/app_colors.dart';

/// Logo de Pateá.
///
/// Es el mismo SVG que usa la web (`src/components/icons/soccer-player-icon.tsx`),
/// copiado a `assets/icons/logo_patea.svg` sin tocarle un punto del trazo.
///
/// Antes acá había un `CustomPainter` que redibujaba la silueta a mano —
/// círculos y un `Path` reconstruido a ojo desde los comandos del SVG. Andaba,
/// pero era una aproximación: cualquier retoque del logo en la web había que
/// volver a traducirlo a Dart, y las curvas no daban exactamente iguales.
class SoccerRunnerIcon extends StatelessWidget {
  final double size;
  final Color color;

  const SoccerRunnerIcon({
    super.key,
    this.size = 24.0,
    this.color = AppColors.voltNeon,
  });

  @override
  Widget build(BuildContext context) {
    return SvgPicture.asset(
      'assets/icons/logo_patea.svg',
      width: size,
      height: size,
      colorFilter: ColorFilter.mode(color, BlendMode.srcIn),
    );
  }
}
