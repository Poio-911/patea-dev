import 'package:flutter/widgets.dart';

/// Cuánto hay que dejar libre abajo para que lo último no quede tapado.
///
/// El shell monta el menú con `extendBody: true`: el cuerpo llega hasta el
/// borde de la pantalla y el menú se dibuja **encima**, translúcido. Eso es a
/// propósito —el fondo de cancha se ve pasar por debajo—, pero significa que
/// cualquier lista tiene que reservar ese espacio a mano.
///
/// Flutter ya deja el número en `MediaQuery.padding.bottom` del cuerpo: es el
/// alto del menú (60) más el área segura del gesto. Lo que faltaba era
/// sumarlo: con un `EdgeInsets.all(16)` la última tarjeta queda debajo del
/// menú, que es justo lo que pasaba en Partidos, Explorar y Evaluaciones.
///
/// Uso:
/// ```dart
/// padding: EdgeInsets.fromLTRB(16, 12, 16, bottomInset(context)),
/// ```
double bottomInset(BuildContext context, {double extra = 16}) =>
    MediaQuery.paddingOf(context).bottom + extra;
