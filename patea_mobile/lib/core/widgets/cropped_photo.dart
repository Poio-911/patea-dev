import 'package:flutter/material.dart';

/// Applies saved `cropX` (0–100), `cropY` (0–100), and `cropZoom` (1–4)
/// inside a hard [ClipRect] so zoomed images never paint outside their frame.
class CroppedPhoto extends StatelessWidget {
  final double cropX;
  final double cropY;
  final double cropZoom;
  final Widget child;

  const CroppedPhoto({
    super.key,
    this.cropX = 50,
    this.cropY = 50,
    this.cropZoom = 1,
    required this.child,
  });

  @override
  Widget build(BuildContext context) {
    final zoom = cropZoom.isFinite ? cropZoom.clamp(1.0, 4.0) : 1.0;
    final x = cropX.isFinite ? cropX.clamp(0.0, 100.0) : 50.0;
    final y = cropY.isFinite ? cropY.clamp(0.0, 100.0) : 50.0;

    return ClipRect(
      child: Transform.scale(
        scale: zoom,
        alignment: Alignment((x / 50) - 1, (y / 50) - 1),
        child: child,
      ),
    );
  }
}
