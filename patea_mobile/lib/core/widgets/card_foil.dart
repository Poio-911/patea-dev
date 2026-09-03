import 'dart:ui' as ui;

import 'package:flutter/material.dart';

/// Capa de material de la carta, dibujada con un fragment shader.
///
/// Es la diferencia real entre tiers: bronce mate, plata cepillada, oro pulido
/// y élite holográfico. Antes los cuatro eran el mismo fondo oscuro con un
/// borde de distinto alpha, y en el tema oscuro terminaban pareciéndose todos.
///
/// El reflejo depende de la inclinación del dedo cuadro a cuadro, así que no
/// se puede precalcular como imagen. En la web haría falta WebGL.
class CardFoil extends StatefulWidget {
  /// 'bronze' | 'silver' | 'gold' | 'elite'
  final String tier;

  /// Inclinación normalizada -1..1 en cada eje.
  final double tiltX;
  final double tiltY;

  /// Separa el patrón entre cartas para que no reflejen todas igual.
  final double seed;

  const CardFoil({
    super.key,
    required this.tier,
    required this.tiltX,
    required this.tiltY,
    this.seed = 0,
  });

  @override
  State<CardFoil> createState() => _CardFoilState();
}

class _CardFoilState extends State<CardFoil> {
  /// El programa se compila una sola vez para toda la app: cargarlo por carta
  /// haría trabajo de más en cada celda de la grilla.
  static ui.FragmentProgram? _program;
  static Future<ui.FragmentProgram>? _loading;

  ui.FragmentShader? _shader;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    if (_program != null) {
      setState(() => _shader = _program!.fragmentShader());
      return;
    }
    _loading ??= ui.FragmentProgram.fromAsset('shaders/card_foil.frag');
    try {
      final program = await _loading!;
      _program = program;
      if (mounted) setState(() => _shader = program.fragmentShader());
    } catch (_) {
      // Si el shader no compila o el dispositivo no lo soporta, la carta se
      // dibuja sin la capa de material en vez de romperse.
    }
  }

  @override
  void dispose() {
    _shader?.dispose();
    super.dispose();
  }

  static double _tierValue(String tier) => switch (tier) {
        'elite' => 3,
        'gold' => 2,
        'silver' => 1,
        _ => 0,
      };

  @override
  Widget build(BuildContext context) {
    final shader = _shader;
    if (shader == null) return const SizedBox.shrink();

    return CustomPaint(
      painter: _FoilPainter(
        shader: shader,
        tier: _tierValue(widget.tier),
        tiltX: widget.tiltX,
        tiltY: widget.tiltY,
        seed: widget.seed,
      ),
      size: Size.infinite,
    );
  }
}

class _FoilPainter extends CustomPainter {
  final ui.FragmentShader shader;
  final double tier;
  final double tiltX;
  final double tiltY;
  final double seed;

  _FoilPainter({
    required this.shader,
    required this.tier,
    required this.tiltX,
    required this.tiltY,
    required this.seed,
  });

  @override
  void paint(Canvas canvas, Size size) {
    if (size.isEmpty) return;
    shader
      ..setFloat(0, size.width)
      ..setFloat(1, size.height)
      ..setFloat(2, tiltX)
      ..setFloat(3, tiltY)
      ..setFloat(4, tier)
      ..setFloat(5, seed);

    canvas.drawRect(Offset.zero & size, Paint()..shader = shader);
  }

  @override
  bool shouldRepaint(_FoilPainter old) =>
      old.tiltX != tiltX || old.tiltY != tiltY || old.tier != tier || old.seed != seed;
}
