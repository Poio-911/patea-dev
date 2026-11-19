import 'package:flutter/material.dart';

import 'app_radii.dart';
import 'patea_colors.dart';

/// Relleno + borde de un mosaico elegible (diseño de camiseta, silueta de
/// escudo, plantilla, etc.).
///
/// El elegido NO se tiñe con `primary`: el tinte translúcido se leía oliva
/// sucio en el tema oscuro y celeste lavado en el claro, y además compite con
/// los colores de lo que se está previsualizando adentro. Se marca con la
/// superficie neutra del tema y un borde sólido de 2 px. El borde es SIEMPRE
/// de 2 px (transparente cuando no está elegido) para que elegir no cambie el
/// tamaño útil del contenido.
BoxDecoration pateaSelectableDecoration(BuildContext context, bool selected) {
  final c = context.c;
  return BoxDecoration(
    color: selected ? c.cardSurface : Colors.transparent,
    borderRadius: AppRadii.cardAll,
    border: Border.all(
      color: selected ? c.primary : Colors.transparent,
      width: 2,
    ),
  );
}
