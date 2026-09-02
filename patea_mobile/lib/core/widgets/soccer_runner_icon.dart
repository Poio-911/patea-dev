import 'package:flutter/material.dart';

/// Ícono oficial de silueta de jugador pateando / corriendo de Pateá
class SoccerRunnerIcon extends StatelessWidget {
  final double size;
  final Color color;

  const SoccerRunnerIcon({
    super.key,
    this.size = 24.0,
    this.color = const Color(0xFFCCFF00),
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: CustomPaint(
        painter: _SoccerRunnerPainter(color: color),
      ),
    );
  }
}

class _SoccerRunnerPainter extends CustomPainter {
  final Color color;

  _SoccerRunnerPainter({required this.color});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.fill;

    // Escalamos el canvas desde el viewBox original de 15x15
    final scale = size.width / 15.0;
    canvas.scale(scale, scale);

    // Cabeza: M11,1.5C11,2.3284,10.3284,3,9.5,3S8,2.3284,8,1.5S8.6716,0,9.5,0S11,0.6716,11,1.5z
    canvas.drawCircle(const Offset(9.5, 1.5), 1.5, paint);

    // Pelota: M11,11c-0.5523,0-1,0.4477-1,1s0.4477,1,1,1s1-0.4477,1-1S11.5523,11,11,11z
    canvas.drawCircle(const Offset(11.0, 12.0), 1.0, paint);

    // Cuerpo del jugador:
    final bodyPath = Path();
    bodyPath.moveTo(12.84, 6.09);
    bodyPath.lineTo(10.93, 4.18);
    bodyPath.lineTo(10.56, 4.0);
    bodyPath.lineTo(3.5, 4.0);
    bodyPath.arcToPoint(const Offset(3.5, 5.0), radius: const Radius.circular(0.5));
    bodyPath.lineTo(6.2, 5.0);
    bodyPath.lineTo(3.0, 11.3);
    bodyPath.lineTo(4.0, 11.71);
    bodyPath.lineTo(5.0, 10.0);
    bodyPath.lineTo(7.0, 10.0);
    bodyPath.lineTo(5.07, 14.24);
    bodyPath.lineTo(6.0, 14.5);
    bodyPath.lineTo(10.7, 5.12);
    bodyPath.lineTo(12.14, 6.6);
    bodyPath.close();

    canvas.drawPath(bodyPath, paint);
  }

  @override
  bool shouldRepaint(covariant _SoccerRunnerPainter oldDelegate) {
    return oldDelegate.color != color;
  }
}
