import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/services/profile_service.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';

/// Ajuste del encuadre de la foto de perfil.
///
/// La web usa `ImageCropperDialog`: un recuadro con manijas que se arrastran
/// con el mouse. Acá se hace con los gestos del teléfono — se mueve la foto con
/// el dedo y se hace zoom pellizcando, y el recorte se ve directamente dentro
/// del círculo donde después va a quedar.
///
/// Guarda lo mismo que la web: `cropPosition` (x,y en porcentaje 0-100) y
/// `cropZoom` (1 a 4).
class CropPhotoScreen extends ConsumerStatefulWidget {
  final String photoUrl;
  final double initialX;
  final double initialY;
  final double initialZoom;

  const CropPhotoScreen({
    super.key,
    required this.photoUrl,
    this.initialX = 50,
    this.initialY = 50,
    this.initialZoom = 1,
  });

  @override
  ConsumerState<CropPhotoScreen> createState() => _CropPhotoScreenState();
}

class _CropPhotoScreenState extends ConsumerState<CropPhotoScreen> {
  static const _minZoom = 1.0;
  static const _maxZoom = 4.0;
  static const _circle = 260.0;

  late double _x = widget.initialX;
  late double _y = widget.initialY;
  late double _zoom = widget.initialZoom;

  double _zoomAtGestureStart = 1;
  bool _saving = false;
  String? _error;

  void _onScaleStart(ScaleStartDetails _) {
    _zoomAtGestureStart = _zoom;
  }

  void _onScaleUpdate(ScaleUpdateDetails details) {
    setState(() {
      if (details.scale != 1.0) {
        _zoom = (_zoomAtGestureStart * details.scale).clamp(_minZoom, _maxZoom);
      }
      // El desplazamiento del dedo se traduce a porcentaje sobre el diámetro
      // del círculo. Se divide por el zoom para que, cuando está ampliada, el
      // dedo mueva la imagen lo mismo en pantalla y no de golpe.
      if (details.focalPointDelta != Offset.zero) {
        _x = (_x - (details.focalPointDelta.dx / _circle) * 100 / _zoom).clamp(0.0, 100.0);
        _y = (_y - (details.focalPointDelta.dy / _circle) * 100 / _zoom).clamp(0.0, 100.0);
      }
    });
  }

  Future<void> _save() async {
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await ref.read(profileServiceProvider).updateCrop(x: _x, y: _y, zoom: _zoom);
      await HapticFeedback.mediumImpact();
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      if (mounted) {
        setState(() {
          _saving = false;
          _error = e.toString().replaceFirst('Exception: ', '');
        });
      }
    }
  }

  void _reset() {
    HapticFeedback.selectionClick();
    setState(() {
      _x = 50;
      _y = 50;
      _zoom = 1;
    });
  }

  @override
  Widget build(BuildContext context) {
    final isDefault = _x == 50 && _y == 50 && _zoom == 1;

    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        title: Text('AJUSTAR FOTO',
            style: AppTypography.headline(size: 16, weight: FontWeight.w700)),
        actions: [
          if (!isDefault)
            TextButton(
              onPressed: _saving ? null : _reset,
              child: Text('Centrar',
                  style: AppTypography.body(size: 13, color: AppColors.textSecondary)),
            ),
        ],
      ),
      body: Column(
        children: [
          const SizedBox(height: 8),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 28),
            child: Text(
              'Arrastrá para mover y pellizcá para acercar. Así se va a ver en tu carta.',
              textAlign: TextAlign.center,
              style: AppTypography.body(size: 13, color: AppColors.textMuted, height: 1.45),
            ),
          ),
          const Spacer(),

          // El círculo ES el marco real de la carta, no una aproximación.
          GestureDetector(
            onScaleStart: _onScaleStart,
            onScaleUpdate: _onScaleUpdate,
            child: Container(
              width: _circle,
              height: _circle,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(color: AppColors.voltNeon, width: 3),
                boxShadow: [
                  BoxShadow(
                    color: AppColors.voltNeon.withValues(alpha: 0.25),
                    blurRadius: 22,
                  ),
                ],
              ),
              child: ClipOval(
                child: Transform.scale(
                  scale: _zoom,
                  alignment: Alignment((_x / 50) - 1, (_y / 50) - 1),
                  child: CachedNetworkImage(
                    imageUrl: widget.photoUrl,
                    fit: BoxFit.cover,
                    memCacheWidth: 780,
                    placeholder: (_, _) => Container(
                      color: const Color(0xFF1E2636),
                      child: const Center(
                        child: CircularProgressIndicator(color: AppColors.voltNeon),
                      ),
                    ),
                    errorWidget: (_, _, _) => Container(
                      color: const Color(0xFF1E2636),
                      child: Icon(Icons.broken_image_outlined,
                          color: AppColors.textMuted, size: 40),
                    ),
                  ),
                ),
              ),
            ),
          ),

          const SizedBox(height: 28),

          // El slider es la alternativa para quien no maneja el pellizco.
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 32),
            child: Row(
              children: [
                Icon(Icons.zoom_out, size: 18, color: AppColors.textMuted),
                Expanded(
                  child: Slider(
                    value: _zoom,
                    min: _minZoom,
                    max: _maxZoom,
                    activeColor: AppColors.voltNeon,
                    inactiveColor: Colors.white.withValues(alpha: 0.15),
                    onChanged: _saving ? null : (v) => setState(() => _zoom = v),
                  ),
                ),
                Icon(Icons.zoom_in, size: 18, color: AppColors.textMuted),
              ],
            ),
          ),
          Text(
            '${_zoom.toStringAsFixed(1)}×',
            style: AppTypography.code(size: 11, color: AppColors.textMuted),
          ),

          const Spacer(),

          if (_error != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 0, 24, 12),
              child: Text(
                _error!,
                textAlign: TextAlign.center,
                style: AppTypography.body(size: 12, color: AppColors.destructive),
              ),
            ),

          Padding(
            padding: const EdgeInsets.fromLTRB(24, 0, 24, 28),
            child: SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: _saving ? null : _save,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.voltNeon,
                  foregroundColor: Colors.black,
                  padding: const EdgeInsets.symmetric(vertical: 15),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                icon: _saving
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.black),
                      )
                    : const Icon(Icons.check, size: 18),
                label: Text(
                  _saving ? 'Guardando…' : 'Usar este encuadre',
                  style: AppTypography.headline(
                      size: 14, weight: FontWeight.w700, color: Colors.black),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
