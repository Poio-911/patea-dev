import 'dart:ui' as ui;
import 'package:flutter/material.dart';

import '../theme/patea_colors.dart';

enum PateaBackgroundScene {
  players('assets/brand/patea_background_players.webp'),
  matches('assets/brand/patea_background_matches.webp');

  final String asset;
  const PateaBackgroundScene(this.asset);
}

/// Lienzo compartido. Jugadores y Partidos tienen una fotografía de sección
/// fija bajo el contenido, con velo adaptado al tema. Otras rutas conservan
/// su fondo neutro y sus líneas de cancha.
class PateaBackground extends StatelessWidget {
  final Widget child;
  final PateaBackgroundScene? scene;

  const PateaBackground({super.key, required this.child, this.scene});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final dark = c.isDarkSurface;
    if (scene != null) {
      Widget photo = Image.asset(
        scene!.asset,
        fit: BoxFit.cover,
        alignment: Alignment.centerRight,
        cacheWidth:
            (MediaQuery.sizeOf(context).width *
                    MediaQuery.devicePixelRatioOf(context))
                .round()
                .clamp(480, 1024),
        excludeFromSemantics: true,
        errorBuilder: (_, error, stack) => const SizedBox.shrink(),
      );
      if (dark) {
        // 85 % desaturation, soft focus and charcoal veil: atmosphere,
        // rather than the untreated photograph competing with the cards.
        photo = ImageFiltered(
          imageFilter: ui.ImageFilter.blur(sigmaX: 2.8, sigmaY: 2.8),
          child: ColorFiltered(
            colorFilter: const ColorFilter.matrix([
              .33071,
              .60792,
              .06137,
              0,
              0,
              .18071,
              .75792,
              .06137,
              0,
              0,
              .18071,
              .60792,
              .21137,
              0,
              0,
              0,
              0,
              0,
              1,
              0,
            ]),
            child: photo,
          ),
        );
      }
      return Stack(
        children: [
          Positioned.fill(child: ColoredBox(color: c.background)),
          Positioned.fill(
            child: IgnorePointer(
              child: Opacity(opacity: dark ? 0.40 : 0.34, child: photo),
            ),
          ),
          Positioned.fill(
            child: IgnorePointer(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      c.background.withValues(alpha: dark ? .35 : .20),
                      c.background.withValues(alpha: dark ? .20 : .08),
                      c.background.withValues(alpha: dark ? .45 : .18),
                    ],
                    stops: const [0, .45, 1],
                  ),
                ),
              ),
            ),
          ),
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
                    c.primary.withValues(alpha: dark ? 0.025 : 0.05),
                    c.background,
                  ),
                  c.background,
                  c.background,
                  Color.alphaBlend(
                    c.accent.withValues(alpha: dark ? 0.015 : 0.05),
                    c.background,
                  ),
                ],
                stops: const [0, 0.22, 0.72, 1],
              ),
            ),
          ),
        ),
        Positioned.fill(
          child: IgnorePointer(
            child: RepaintBoundary(
              child: CustomPaint(
                painter: _PitchLines(
                  c.textSecondary.withValues(alpha: dark ? 0.045 : 0.035),
                ),
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
