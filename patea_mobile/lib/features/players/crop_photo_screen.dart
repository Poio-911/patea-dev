import 'dart:math' as math;

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/services/profile_service.dart';
import '../../core/theme/app_radii.dart';
import '../../core/theme/app_typography.dart';
import '../../core/theme/patea_colors.dart';
import '../../core/widgets/patea_button_progress.dart';

/// Ajuste del encuadre de la foto de perfil con proporción de retrato de ficha.
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
  static const _frameWidth = 240.0;
  static const _frameHeight = 300.0;

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
      if (details.focalPointDelta != Offset.zero) {
        _x = (_x - (details.focalPointDelta.dx / _frameWidth) * 100 / _zoom)
            .clamp(0.0, 100.0);
        _y = (_y - (details.focalPointDelta.dy / _frameHeight) * 100 / _zoom)
            .clamp(0.0, 100.0);
      }
    });
  }

  Future<void> _save() async {
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await ref
          .read(profileServiceProvider)
          .updateCrop(x: _x, y: _y, zoom: _zoom);
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
    final c = context.c;
    final isDefault = _x == 50 && _y == 50 && _zoom == 1;

    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        title: Text(
          'Ajustar encuadre',
          style: AppTypography.headline(size: 17, weight: FontWeight.w700),
        ),
        actions: [
          if (!isDefault)
            TextButton(
              onPressed: _saving ? null : _reset,
              child: Text(
                'Centrar',
                style: AppTypography.action(size: 13, color: c.textSecondary),
              ),
            ),
        ],
      ),
      body: LayoutBuilder(
        builder: (context, constraints) {
          final frameW = math.min(_frameWidth, constraints.maxWidth - 48);
          final frameH = frameW * (_frameHeight / _frameWidth);

          return SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(24, 8, 24, 28),
            child: ConstrainedBox(
              constraints: BoxConstraints(
                minHeight: math.max(0, constraints.maxHeight - 36),
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Arrastrá para mover y pellizcá para acercar. Así se va a ver en tu ficha y en tu perfil.',
                    textAlign: TextAlign.center,
                    style: AppTypography.body(
                      size: 13,
                      color: c.textSecondary,
                      height: 1.4,
                    ),
                  ),
                  const SizedBox(height: 20),
                  GestureDetector(
                    onScaleStart: _onScaleStart,
                    onScaleUpdate: _onScaleUpdate,
                    child: Container(
                      width: frameW,
                      height: frameH,
                      decoration: BoxDecoration(
                        color: c.cardSurface,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: c.primary, width: 2),
                      ),
                      clipBehavior: Clip.antiAlias,
                      child: Stack(
                        fit: StackFit.expand,
                        children: [
                          Transform.scale(
                            scale: _zoom,
                            alignment: Alignment((_x / 50) - 1, (_y / 50) - 1),
                            child: CachedNetworkImage(
                              imageUrl: widget.photoUrl,
                              fit: BoxFit.cover,
                              alignment: Alignment.topCenter,
                              memCacheWidth: 780,
                              placeholder: (_, _) => ColoredBox(
                                color: c.cardSurface,
                                child: Center(
                                  child: CircularProgressIndicator(
                                    color: c.primary,
                                  ),
                                ),
                              ),
                              errorWidget: (_, _, _) => ColoredBox(
                                color: c.cardSurface,
                                child: Icon(
                                  Icons.broken_image_outlined,
                                  color: c.textSecondary,
                                  size: 40,
                                ),
                              ),
                            ),
                          ),
                          Positioned(
                            left: 0,
                            right: 0,
                            bottom: 0,
                            height: 64,
                            child: IgnorePointer(
                              child: DecoratedBox(
                                decoration: BoxDecoration(
                                  gradient: LinearGradient(
                                    begin: Alignment.topCenter,
                                    end: Alignment.bottomCenter,
                                    colors: [
                                      c.card.withValues(alpha: 0),
                                      c.card.withValues(alpha: 0.85),
                                    ],
                                  ),
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 20),
                  Column(
                    children: [
                      Row(
                        children: [
                          Icon(
                            Icons.zoom_out,
                            size: 18,
                            color: c.textSecondary,
                          ),
                          Expanded(
                            child: Slider(
                              value: _zoom,
                              min: _minZoom,
                              max: _maxZoom,
                              activeColor: c.primary,
                              inactiveColor: c.overlayLine,
                              onChanged: _saving
                                  ? null
                                  : (v) => setState(() => _zoom = v),
                            ),
                          ),
                          Icon(Icons.zoom_in, size: 18, color: c.textSecondary),
                        ],
                      ),
                      Text(
                        '${_zoom.toStringAsFixed(1)}×',
                        style: AppTypography.body(
                          size: 12,
                          color: c.textSecondary,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 20),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      if (_error != null)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: Text(
                            _error!,
                            textAlign: TextAlign.center,
                            style: AppTypography.body(
                              size: 12,
                              color: c.destructive,
                            ),
                          ),
                        ),
                      FilledButton.icon(
                        onPressed: _saving ? null : _save,
                        style: FilledButton.styleFrom(
                          padding: const EdgeInsets.symmetric(vertical: 15),
                          shape: RoundedRectangleBorder(
                            borderRadius: AppRadii.cardAll,
                          ),
                        ),
                        icon: _saving
                            ? const SizedBox(
                                width: 16,
                                height: 16,
                                child: PateaButtonProgress(),
                              )
                            : const Icon(Icons.check, size: 18),
                        label: Text(
                          _saving ? 'Guardando…' : 'Usar este encuadre',
                          style: AppTypography.action(
                            size: 15,
                            color: c.onPrimary,
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}
