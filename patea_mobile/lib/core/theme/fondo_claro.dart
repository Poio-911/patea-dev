/// Las tres variantes candidatas del fondo del tema claro, para poder
/// compararlas en el teléfono en vez de elegir a ciegas.
///
/// **Esto es andamio.** Cuando esté elegida la variante, sobra: se deja una
/// sola en `PateaBackground` y este archivo se borra junto con el selector de
/// `/dev/gallery`. Si seguís leyendo esto y ya hay una decisión tomada, la
/// decisión no se terminó de aplicar.
///
/// **Por qué existía el problema.** El degradado que había mezclaba una parada
/// translúcida (el tinte al 5 %) con una opaca (el blanco del fondo). Toda la
/// rampa entre las dos arrastra alfa intermedia, así que a mitad de camino
/// había medio azul opaco: medido sobre el golden, **49 %** de azul arriba a
/// la izquierda y 38 % de ámbar abajo a la derecha, cuando lo escrito decía
/// 5 %. La web tiene la misma estructura de paradas pero estira el degradado a
/// 400 % de la pantalla y lo desliza, así que nunca muestra más que una tajada
/// fina de esa rampa.
///
/// La regla que sale de ahí, y que vale para las tres variantes: **un
/// degradado no mezcla paradas translúcidas con opacas**. O todas las paradas
/// son opacas (pre-mezcladas contra el fondo), o el degradado se apoya sobre
/// una base opaca y se desvanece hacia *el mismo color con alfa 0* — nunca
/// hacia `Colors.transparent`, que es negro invisible y ensucia el medio.
///
/// Ver `docs/technical/AUDITORIA_DE_ESTILOS_Y_MODO_CLARO.md`.
library;

import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'patea_colors.dart';

enum FondoClaro {
  /// El de siempre, con las paradas pre-mezcladas para que el 5 % sea 5 %.
  degradado,

  /// Dos o tres manchas radiales suaves, con la disposición sorteada una vez
  /// por sesión.
  mancha,

  /// La misma foto de cancha del tema `game`, en gris y bajo un velo blanco:
  /// deja textura, no color.
  foto;

  String get etiqueta => switch (this) {
        FondoClaro.degradado => 'Degradado',
        FondoClaro.mancha => 'Mancha',
        FondoClaro.foto => 'Foto',
      };
}

const _clave = 'fondoClaro';

/// Se persiste para que la comparación sobreviva a cerrar la app: si no, cada
/// vuelta al emulador vuelve a la variante por defecto y no se puede comparar
/// nada.
final fondoClaroProvider =
    NotifierProvider<FondoClaroController, FondoClaro>(FondoClaroController.new);

class FondoClaroController extends Notifier<FondoClaro> {
  @override
  FondoClaro build() {
    _cargar();
    return FondoClaro.degradado;
  }

  Future<void> _cargar() async {
    final prefs = await SharedPreferences.getInstance();
    final guardado = prefs.getString(_clave);
    final v = FondoClaro.values.where((f) => f.name == guardado).firstOrNull;
    if (v != null && v != state) state = v;
  }

  Future<void> elegir(FondoClaro v) async {
    if (v == state) return;
    state = v;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_clave, v.name);
  }
}

/// Cuál de las disposiciones de manchas toca en esta sesión.
///
/// Se sortea una sola vez, igual que la foto de cancha del tema `game`
/// (`backgroundIndexProvider`): da variedad entre arranques sin animar nada.
/// Una animación de pantalla completa corriendo siempre, en todas las
/// pantallas, es batería que en la web no se paga.
final disposicionManchaProvider =
    Provider<int>((ref) => Random().nextInt(_disposiciones.length));

/// Cuatro disposiciones elegidas a mano, no coordenadas al azar: sorteando
/// libremente salían manchas pisándose en el medio, justo detrás del texto.
///
/// Cada una es (alineación, radio, tinte, alfa). El tinte se resuelve contra
/// el esquema en tiempo de dibujo.
const List<List<_Mancha>> _disposiciones = [
  [
    _Mancha(Alignment(-0.9, -0.85), 1.05, _Tinte.primary, 0.07),
    _Mancha(Alignment(0.95, 0.9), 0.95, _Tinte.accent, 0.06),
  ],
  [
    _Mancha(Alignment(-0.75, -1.0), 0.9, _Tinte.primary, 0.075),
    _Mancha(Alignment(1.0, 0.55), 0.85, _Tinte.accent, 0.055),
    _Mancha(Alignment(-1.0, 0.95), 0.7, _Tinte.primary, 0.035),
  ],
  [
    _Mancha(Alignment(0.85, -0.95), 1.0, _Tinte.primary, 0.065),
    _Mancha(Alignment(-0.9, 0.85), 0.9, _Tinte.accent, 0.06),
  ],
  [
    _Mancha(Alignment(-1.0, -0.7), 0.8, _Tinte.accent, 0.05),
    _Mancha(Alignment(0.9, -0.9), 0.85, _Tinte.primary, 0.07),
    _Mancha(Alignment(0.2, 1.0), 1.0, _Tinte.primary, 0.04),
  ],
];

enum _Tinte { primary, accent }

class _Mancha {
  final Alignment centro;
  final double radio;
  final _Tinte tinte;
  final double alfa;

  const _Mancha(this.centro, this.radio, this.tinte, this.alfa);

  Color color(PateaColors c) =>
      tinte == _Tinte.primary ? c.primary : c.accent;
}

/// El fondo del tema claro, en la variante que esté elegida.
///
/// Devuelve sólo el fondo: quien lo usa lo pone abajo de todo en su `Stack`.
class FondoClaroWidget extends ConsumerWidget {
  /// Cuál de las nueve fotos toca en esta sesión. Lo decide quien monta el
  /// fondo, que ya lo tiene: así este archivo no depende de
  /// `patea_background.dart` y se puede borrar entero cuando sobre.
  final int indiceFoto;

  const FondoClaroWidget({super.key, required this.indiceFoto});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.c;
    switch (ref.watch(fondoClaroProvider)) {
      case FondoClaro.degradado:
        return _Degradado(c: c);
      case FondoClaro.mancha:
        return _Manchas(c: c, cual: ref.watch(disposicionManchaProvider));
      case FondoClaro.foto:
        return _Foto(c: c, indice: indiceFoto);
    }
  }
}

class _Degradado extends StatelessWidget {
  final PateaColors c;

  const _Degradado({required this.c});

  @override
  Widget build(BuildContext context) {
    // Las cuatro paradas opacas. `alphaBlend` hace acá, una vez, la mezcla que
    // antes quedaba a cargo del compositor a lo largo de toda la rampa.
    final azul = Color.alphaBlend(c.primary.withValues(alpha: 0.05), c.background);
    final ambar = Color.alphaBlend(c.accent.withValues(alpha: 0.05), c.background);

    return DecoratedBox(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          stops: const [0.0, 0.22, 0.72, 1.0],
          colors: [azul, c.background, c.background, ambar],
        ),
      ),
    );
  }
}

class _Manchas extends StatelessWidget {
  final PateaColors c;
  final int cual;

  const _Manchas({required this.c, required this.cual});

  @override
  Widget build(BuildContext context) {
    final manchas = _disposiciones[cual % _disposiciones.length];

    return Stack(
      fit: StackFit.expand,
      children: [
        // La base opaca va primero: sobre ella las manchas pueden ser
        // translúcidas sin que ningún píxel del fondo quede con alfa.
        ColoredBox(color: c.background),
        for (final m in manchas)
          DecoratedBox(
            decoration: BoxDecoration(
              gradient: RadialGradient(
                center: m.centro,
                radius: m.radio,
                colors: [
                  m.color(c).withValues(alpha: m.alfa),
                  // El mismo color con alfa 0, NO `Colors.transparent`: ese es
                  // negro invisible y en el medio del degradado ensucia de
                  // gris.
                  m.color(c).withValues(alpha: 0),
                ],
              ),
            ),
          ),
      ],
    );
  }
}

class _Foto extends StatelessWidget {
  final PateaColors c;
  final int indice;

  const _Foto({required this.c, required this.indice});

  /// Luma de Rec. 709 en las tres columnas: convierte a gris sin virar hacia
  /// el verde del césped, que es lo que pasa promediando los canales.
  static const ColorFilter _gris = ColorFilter.matrix(<double>[
    0.2126, 0.7152, 0.0722, 0, 0,
    0.2126, 0.7152, 0.0722, 0, 0,
    0.2126, 0.7152, 0.0722, 0, 0,
    0, 0, 0, 1, 0,
  ]);

  @override
  Widget build(BuildContext context) {
    return Stack(
      fit: StackFit.expand,
      children: [
        ColoredBox(color: c.background),
        Opacity(
          opacity: 0.07,
          child: ColorFiltered(
            colorFilter: _gris,
            child: Image.asset(
              'assets/backgrounds/fondo_$indice.jpg',
              fit: BoxFit.cover,
              errorBuilder: (_, _, _) => const SizedBox(),
            ),
          ),
        ),
        // Una viñeta clara: aclara el centro, donde vive el texto, y deja la
        // textura en los bordes.
        DecoratedBox(
          decoration: BoxDecoration(
            gradient: RadialGradient(
              center: Alignment.center,
              radius: 0.95,
              colors: [
                c.background,
                c.background.withValues(alpha: 0),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
