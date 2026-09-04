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
/// (badges, píldoras, cuadraditos de ícono). Si algo necesita un cuarto nivel,
/// casi siempre el problema es que hay una caja de más.
class AppRadii {
  static const double surface = 24;
  static const double card = 12;
  static const double chip = 8;

  static const BorderRadius surfaceAll = BorderRadius.all(Radius.circular(surface));
  static const BorderRadius cardAll = BorderRadius.all(Radius.circular(card));
  static const BorderRadius chipAll = BorderRadius.all(Radius.circular(chip));

  /// Para hojas que suben desde abajo: sólo las esquinas de arriba.
  static const BorderRadius surfaceTop =
      BorderRadius.vertical(top: Radius.circular(surface));
}
