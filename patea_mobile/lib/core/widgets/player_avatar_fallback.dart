import 'package:flutter/material.dart';

import '../theme/patea_colors.dart';

/// Lo que se ve cuando el jugador todavía no subió foto.
///
/// Antes era un recuadro gris plano con la inicial. En la carta con foto en la
/// mitad superior eso deja medio card apagado — y en un grupo nuevo, donde casi
/// nadie subió foto, es la mayoría del plantel.
///
/// Son cuatro maniquíes renderizados sobre fondo transparente, así que el fondo
/// lo pone la app: se combinan **4 muñecos × 10 duotonos = 40 variantes**. Con
/// eso un plantel de veinte no repite, y como todo se elige del id del jugador,
/// el mismo jugador se ve siempre igual — la carta empieza a ser reconocible
/// antes de tener foto.
class PlayerAvatarFallback extends StatelessWidget {
  /// Con qué se elige muñeco y color. El id del jugador; el nombre si no hay.
  final String seed;

  const PlayerAvatarFallback({super.key, required this.seed});

  static const int _avatarCount = 4;

  /// Diez duotonos, el primero arriba y el segundo abajo.
  ///
  /// Están separados en tono a propósito y son más oscuros que el maniquí:
  /// las camisetas de los muñecos son saturadas y necesitan un fondo que las
  /// deje adelante en vez de competir.
  static const List<List<Color>> _palettes = [
    [Color(0xFF2F6E63), Color(0xFF0E2C27)], // verde cancha
    [Color(0xFF8C4A5A), Color(0xFF2E161D)], // vino
    [Color(0xFF3B5C93), Color(0xFF121C2E)], // azul noche
    [Color(0xFF8A6534), Color(0xFF2A1D0C)], // tierra
    [Color(0xFF5A4B85), Color(0xFF1C162C)], // violeta
    [Color(0xFF2D6C86), Color(0xFF0C222B)], // celeste profundo
    [Color(0xFF9C5A2E), Color(0xFF2F180A)], // naranja quemado
    [Color(0xFF44795A), Color(0xFF122619)], // verde musgo
    [Color(0xFF7A3F6B), Color(0xFF23111E)], // ciruela
    [Color(0xFF4C5A6B), Color(0xFF161A20)], // pizarra
  ];

  /// Hash propio y no `hashCode`: éste da el mismo número entre corridas, así
  /// que el avatar de alguien no cambia al reabrir la app.
  int get _hash {
    if (seed.isEmpty) return 0;
    var acc = 0;
    for (final unit in seed.codeUnits) {
      acc = (acc * 31 + unit) & 0x7fffffff;
    }
    return acc;
  }

  /// Los mismos diez tonos, subidos de luz para el tema claro.
  ///
  /// No son los oscuros aclarados con un `withValues`: eso da grises sucios.
  /// Es la misma familia de tonos con la luminosidad y la saturación de un
  /// fondo claro, así que el maniquí —que es de color saturado— sigue
  /// destacándose en vez de perderse.
  static const List<List<Color>> _palettesLight = [
    [Color(0xFFB9DCD4), Color(0xFF7FBCAF)], // verde cancha
    [Color(0xFFE8C3CC), Color(0xFFC98D9C)], // vino
    [Color(0xFFC2D2EC), Color(0xFF8FAAD3)], // azul noche
    [Color(0xFFE7D3B4), Color(0xFFC7A876)], // tierra
    [Color(0xFFD3CBE7), Color(0xFFA79ACC)], // violeta
    [Color(0xFFBBD8E4), Color(0xFF83B4C7)], // celeste profundo
    [Color(0xFFEFCDB4), Color(0xFFD9A276)], // naranja quemado
    [Color(0xFFBFDDC9), Color(0xFF88BE9C)], // verde musgo
    [Color(0xFFE2C6DA), Color(0xFFC195B4)], // ciruela
    [Color(0xFFCBD3DC), Color(0xFF9AA7B5)], // pizarra
  ];

  @override
  Widget build(BuildContext context) {
    final h = _hash;
    final paleta = context.c.isDarkSurface ? _palettes : _palettesLight;
    final palette = paleta[h % paleta.length];
    // El muñeco se elige con otra parte del hash: si se usara el mismo resto,
    // color y muñeco irían siempre de a pares y se verían sólo 10 variantes.
    final avatar = (h ~/ _palettes.length) % _avatarCount + 1;

    return DecoratedBox(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [palette[0], palette[1]],
        ),
      ),
      // `contain` y no `cover`, que es la razón de ser del PNG transparente:
      // con `cover` la figura llena el cuadro y se recorta —quedaban torsos
      // sin cabeza, o cabezas sin brazos—. Así entra entera, de la cabeza a
      // las manos cruzadas, y el degradado se ve alrededor.
      //
      // Apoyada abajo y al 92% de la altura: deja aire arriba, donde están el
      // puesto y el OVR, y el maniquí queda parado en el cuadro en vez de
      // flotando en el medio.
      child: Align(
        alignment: Alignment.bottomCenter,
        child: FractionallySizedBox(
          heightFactor: 0.92,
          child: Image.asset(
            'assets/avatars/player$avatar.png',
            fit: BoxFit.contain,
            alignment: Alignment.bottomCenter,
            errorBuilder: (context, error, stack) => const SizedBox(),
          ),
        ),
      ),
    );
  }
}
