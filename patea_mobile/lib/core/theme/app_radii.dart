import 'package:flutter/material.dart';

/// Escala de esquinas redondeadas.
///
/// Tres valores, y alcanzan. El módulo del header llegó a tener nueve radios
/// distintos (28, 24, 18, 16, 12, 10, 6, 3, 2) porque cada componente eligió el
/// suyo; con tantos, el ojo deja de leerlos como una jerarquía y los lee como
/// desprolijidad.
///
/// Cómo elegir: [surface] es lo que se apoya sobre la pantalla (hojas,
/// diálogos), [card] es lo que se apoya sobre una superficie (tarjetas,
/// botones, filas tocables), [chip] es lo que se apoya sobre una tarjeta
/// (badges, píldoras, cuadraditos de ícono). Si algo necesita un nivel más,
/// casi siempre el problema es que hay una caja de más.
///
/// [hair] y [pill] no son escalones de esa jerarquía y por eso van aparte:
/// [hair] es el redondeo de una barrita o un indicador, donde la esquina casi
/// no se ve, y [pill] es "redondo del todo", que no depende del tamaño de la
/// caja sino de la intención.
///
/// La app tenía **207 radios literales repartidos en 18 valores** (de 1 a 28,
/// más 999). Con tantos el ojo deja de leerlos como jerarquía y los lee como
/// desprolijidad.
class AppRadii {
  static const double hair = 3;
  static const double chip = 8;
  static const double card = 12;
  static const double surface = 24;
  static const double pill = 999;

  static const BorderRadius surfaceAll = BorderRadius.all(Radius.circular(surface));
  static const BorderRadius cardAll = BorderRadius.all(Radius.circular(card));
  static const BorderRadius chipAll = BorderRadius.all(Radius.circular(chip));

  static const BorderRadius hairAll = BorderRadius.all(Radius.circular(hair));
  static const BorderRadius pillAll = BorderRadius.all(Radius.circular(pill));

  /// Para hojas que suben desde abajo: sólo las esquinas de arriba.
  static const BorderRadius surfaceTop =
      BorderRadius.vertical(top: Radius.circular(surface));
}
