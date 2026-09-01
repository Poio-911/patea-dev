import 'package:flutter/material.dart';
import '../models/group_model.dart';

class JerseyWidget extends StatelessWidget {
  final JerseyModel jersey;
  final double size;

  const JerseyWidget({
    super.key,
    required this.jersey,
    this.size = 48,
  });

  Color _parseColor(String hexStr) {
    try {
      final hex = hexStr.replaceAll('#', '');
      return Color(int.parse('FF$hex', radix: 16));
    } catch (_) {
      return Colors.blue;
    }
  }

  @override
  Widget build(BuildContext context) {
    return CustomPaint(
      size: Size(size, size * 1.1),
      painter: JerseyPainter(
        pattern: jersey.pattern,
        primaryColor: _parseColor(jersey.primaryColor),
        secondaryColor: _parseColor(jersey.secondaryColor),
      ),
    );
  }
}

class JerseyPainter extends CustomPainter {
  final String pattern;
  final Color primaryColor;
  final Color secondaryColor;

  JerseyPainter({
    required this.pattern,
    required this.primaryColor,
    required this.secondaryColor,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final basePaint = Paint()
      ..color = primaryColor
      ..style = PaintingStyle.fill;

    final secondaryPaint = Paint()
      ..color = secondaryColor
      ..style = PaintingStyle.fill;

    final path = Path();
    final w = size.width;
    final h = size.height;

    // Forma estilizada de camiseta de fútbol
    path.moveTo(w * 0.3, 0);
    path.lineTo(w * 0.7, 0);
    path.lineTo(w * 0.95, h * 0.28);
    path.lineTo(w * 0.82, h * 0.42);
    path.lineTo(w * 0.72, h * 0.32);
    path.lineTo(w * 0.72, h * 0.95);
    path.lineTo(w * 0.28, h * 0.95);
    path.lineTo(w * 0.28, h * 0.32);
    path.lineTo(w * 0.18, h * 0.42);
    path.lineTo(w * 0.05, h * 0.28);
    path.close();

    // Dibujar base
    canvas.drawPath(path, basePaint);

    // Aplicar patrón con clip dentro del contorno
    canvas.save();
    canvas.clipPath(path);

    switch (pattern) {
      case 'vertical':
        final stripeW = w * 0.14;
        canvas.drawRect(Rect.fromLTWH(w * 0.43, 0, stripeW, h), secondaryPaint);
        break;
      case 'band':
        canvas.drawRect(Rect.fromLTWH(0, h * 0.4, w, h * 0.2), secondaryPaint);
        break;
      case 'chevron':
        final chevronPath = Path()
          ..moveTo(0, h * 0.3)
          ..lineTo(w * 0.5, h * 0.5)
          ..lineTo(w, h * 0.3)
          ..lineTo(w, h * 0.45)
          ..lineTo(w * 0.5, h * 0.65)
          ..lineTo(0, h * 0.45)
          ..close();
        canvas.drawPath(chevronPath, secondaryPaint);
        break;
      case 'thirds':
        canvas.drawRect(Rect.fromLTWH(0, 0, w * 0.33, h), secondaryPaint);
        canvas.drawRect(Rect.fromLTWH(w * 0.66, 0, w * 0.33, h), secondaryPaint);
        break;
      case 'lines':
        final linePaint = Paint()
          ..color = secondaryColor
          ..strokeWidth = 2.0
          ..style = PaintingStyle.stroke;
        canvas.drawLine(Offset(w * 0.35, 0), Offset(w * 0.35, h), linePaint);
        canvas.drawLine(Offset(w * 0.65, 0), Offset(w * 0.65, h), linePaint);
        break;
      default:
        break;
    }

    canvas.restore();

    // Borde exterior
    final borderPaint = Paint()
      ..color = Colors.black26
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.0;
    canvas.drawPath(path, borderPaint);
  }

  @override
  bool shouldRepaint(covariant JerseyPainter oldDelegate) {
    return oldDelegate.pattern != pattern ||
        oldDelegate.primaryColor != primaryColor ||
        oldDelegate.secondaryColor != secondaryColor;
  }
}
