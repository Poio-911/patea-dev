/// Una superficie apoyada sobre otra. La caja de siempre, en un solo lugar.
///
/// Había **226 `BoxDecoration` escritas a mano y cero widgets `Card`**, y 168
/// de ellas eran exactamente la misma forma: un color, un radio y a veces un
/// borde. La Fase 1 les unificó el radio y la Fase 4 el color, así que ya no
/// divergen — lo que faltaba es que "cómo se ve una tarjeta en Pateá" viva en
/// un archivo y no en 168.
///
/// No reemplaza a `Card` de Material por capricho: `Card` trae elevación,
/// margen y `surfaceTint` propios, y acá la superficie es plana y el borde es
/// lo que separa. Por eso el `cardTheme` del `ThemeData` se borró en la Fase 0:
/// no lo usaba nadie.
///
/// Ver `docs/technical/AUDITORIA_DE_ESTILOS_Y_MODO_CLARO.md`.
library;

import 'package:flutter/material.dart';

import '../theme/app_radii.dart';
import 'package:patea_mobile/core/theme/patea_colors.dart';

class PateaCard extends StatelessWidget {
  final Widget? child;

  /// El relleno de la superficie. Sin default: una tarjeta de contenido y una
  /// fila de lista no llevan el mismo aire, y elegir uno haría que la mitad
  /// de las llamadas lo pisen.
  final EdgeInsetsGeometry? padding;
  final EdgeInsetsGeometry? margin;

  /// Null = `context.c.card`, que es lo que una tarjeta es.
  final Color? color;

  /// Null = sin borde. La mayoría de las tarjetas de la app llevan uno tenue.
  final Color? borderColor;
  final double borderWidth;

  /// Null = [AppRadii.cardAll].
  final BorderRadius? radius;

  final double? width;
  final double? height;
  final AlignmentGeometry? alignment;
  final Clip clipBehavior;

  const PateaCard({
    super.key,
    this.child,
    this.padding,
    this.margin,
    this.color,
    this.borderColor,
    this.borderWidth = 1,
    this.radius,
    this.width,
    this.height,
    this.alignment,
    this.clipBehavior = Clip.none,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: width,
      height: height,
      padding: padding,
      margin: margin,
      alignment: alignment,
      clipBehavior: clipBehavior,
      decoration: BoxDecoration(
        color: color ?? context.c.card,
        borderRadius: radius ?? AppRadii.cardAll,
        border: borderColor == null
            ? null
            : Border.all(color: borderColor!, width: borderWidth),
      ),
      child: child,
    );
  }
}
