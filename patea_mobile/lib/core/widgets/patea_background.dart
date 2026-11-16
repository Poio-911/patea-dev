import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../theme/fondo_claro.dart';
import '../theme/patea_colors.dart';

/// Índice conservado para el fondo fotográfico opcional del tema claro.
final backgroundIndexProvider = Provider<int>((ref) => Random().nextInt(9) + 1);

/// Lienzo de la aplicación. La fotografía queda en piezas protagonistas;
/// los campos y las listas descansan sobre una superficie estable.
class PateaBackground extends ConsumerWidget {
  final Widget child;
  final int? backgroundIndex;

  const PateaBackground({super.key, required this.child, this.backgroundIndex});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.c;
    if (!c.isDarkSurface) {
      // Se conserva la preferencia explícita de fondo del tema claro.
      final index = (backgroundIndex ?? ref.watch<int>(backgroundIndexProvider))
          .clamp(1, 9);
      return Stack(
        children: [
          Positioned.fill(child: FondoClaroWidget(indiceFoto: index)),
          child,
        ],
      );
    }
    return Stack(
      children: [
        Positioned.fill(
          child: DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  Color.alphaBlend(
                    c.primary.withValues(alpha: 0.025),
                    c.background,
                  ),
                  c.background,
                  Color.alphaBlend(
                    c.accent.withValues(alpha: 0.015),
                    c.background,
                  ),
                ],
                stops: const [0, 0.55, 1],
              ),
            ),
          ),
        ),
        Positioned.fill(
          child: IgnorePointer(
            child: RepaintBoundary(
              child: CustomPaint(
                painter: _PitchLines(c.textSecondary.withValues(alpha: 0.045)),
              ),
            ),
          ),
        ),
        child,
      ],
    );
  }
}

class _PitchLines extends CustomPainter {
  final Color color;
  const _PitchLines(this.color);

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1;
    final width = size.width * 0.86;
    final height = width * 1.4;
    canvas.save();
    canvas.clipRect(Offset.zero & size);
    canvas.translate(size.width * 0.64, size.height * 0.76);
    canvas.rotate(-0.22);
    final field = Rect.fromCenter(
      center: Offset.zero,
      width: width,
      height: height,
    );
    canvas.drawRect(field, paint);
    canvas.drawLine(Offset(field.left, 0), Offset(field.right, 0), paint);
    canvas.drawCircle(Offset.zero, width * 0.16, paint);
    for (final bottom in [false, true]) {
      canvas.drawRect(
        Rect.fromLTWH(
          -width * 0.29,
          bottom ? field.bottom - height * 0.16 : field.top,
          width * 0.58,
          height * 0.16,
        ),
        paint,
      );
    }
    canvas.restore();
  }

  @override
  bool shouldRepaint(covariant _PitchLines oldDelegate) =>
      oldDelegate.color != color;
}
