import 'dart:io';
import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/material.dart';

import '../../core/theme/app_radii.dart';
import '../../core/theme/app_typography.dart';
import '../../core/theme/patea_colors.dart';

/// Lado del recorte exportado. El escudo se muestra a lo sumo a ~110 px, así
/// que 512 deja margen de sobra y mantiene el PNG liviano (ver también el
/// tope de 512 px que aplica `GroupService.uploadTeamCrest`).
const int kCrestCropOutputSize = 512;

/// Hoja inferior para encuadrar la imagen del escudo ANTES de subirla: se
/// arrastra, se hace zoom y se confirma. Devuelve un PNG cuadrado con el canal
/// alfa intacto, o `null` si se cancela.
///
/// Antes se subía la imagen tal cual y sólo había un interruptor de "recorte
/// circular" que no se podía previsualizar: un logo descentrado quedaba
/// descentrado en la ficha del equipo.
Future<File?> showCrestCropSheet(
  BuildContext context,
  File source, {
  bool circular = false,
}) {
  return showModalBottomSheet<File>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (_) => CrestCropSheet(source: source, circular: circular),
  );
}

class CrestCropSheet extends StatefulWidget {
  final File source;

  /// Dibuja la guía circular. NO recorta el PNG exportado: el recorte circular
  /// es una preferencia del equipo que se aplica al mostrarlo.
  final bool circular;

  const CrestCropSheet({
    super.key,
    required this.source,
    this.circular = false,
  });

  @override
  State<CrestCropSheet> createState() => _CrestCropSheetState();
}

class _CrestCropSheetState extends State<CrestCropSheet> {
  static const double _frame = 280;
  static const double _minZoom = 1;
  static const double _maxZoom = 4;

  ui.Image? _image;
  Object? _loadError;
  bool _exporting = false;

  double _zoom = 1;
  Offset _offset = Offset.zero; // desplazamiento del centro de la imagen

  double _zoomAtStart = 1;
  Offset _offsetAtStart = Offset.zero;
  Offset _focalAtStart = Offset.zero;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _image?.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final bytes = await widget.source.readAsBytes();
      final codec = await ui.instantiateImageCodec(bytes);
      final frame = await codec.getNextFrame();
      codec.dispose();
      if (!mounted) {
        frame.image.dispose();
        return;
      }
      setState(() => _image = frame.image);
    } catch (e) {
      if (mounted) setState(() => _loadError = e);
    }
  }

  /// Escala que hace entrar TODA la imagen en el marco (zoom = 1). Un logo con
  /// fondo transparente se quiere ver entero antes de acercarlo.
  double get _baseScale {
    final img = _image!;
    return _frame / math.max(img.width, img.height);
  }

  Offset _clampOffset(Offset o) {
    final img = _image!;
    final scale = _baseScale * _zoom;
    // La imagen no puede salir del marco por completo: al menos su centro
    // queda dentro.
    final maxX = math.max(img.width * scale, _frame) / 2;
    final maxY = math.max(img.height * scale, _frame) / 2;
    return Offset(o.dx.clamp(-maxX, maxX), o.dy.clamp(-maxY, maxY));
  }

  void _setZoom(double value) {
    setState(() {
      _zoom = value.clamp(_minZoom, _maxZoom);
      _offset = _clampOffset(_offset);
    });
  }

  Future<void> _confirm() async {
    final img = _image;
    if (img == null || _exporting) return;
    setState(() => _exporting = true);
    try {
      const out = kCrestCropOutputSize;
      final k = out / _frame;
      final recorder = ui.PictureRecorder();
      final canvas = Canvas(recorder);
      canvas.translate(out / 2 + _offset.dx * k, out / 2 + _offset.dy * k);
      canvas.scale(_baseScale * _zoom * k);
      canvas.drawImage(
        img,
        Offset(-img.width / 2, -img.height / 2),
        Paint()..filterQuality = FilterQuality.high,
      );
      final picture = recorder.endRecording();
      final cropped = await picture.toImage(out, out);
      final data = await cropped.toByteData(format: ui.ImageByteFormat.png);
      cropped.dispose();
      picture.dispose();
      if (data == null) throw StateError('No se pudo generar el PNG.');

      final dir = Directory.systemTemp.createTempSync('patea_crest_crop_');
      final file = File('${dir.path}/crest.png')
        ..writeAsBytesSync(data.buffer.asUint8List());
      if (mounted) Navigator.pop(context, file);
    } catch (_) {
      if (mounted) {
        setState(() {
          _exporting = false;
          _loadError = 'No pudimos recortar la imagen.';
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return SafeArea(
      top: false,
      child: Container(
        decoration: BoxDecoration(
          color: c.popover,
          borderRadius: const BorderRadius.vertical(
            top: Radius.circular(AppRadii.surface),
          ),
        ),
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(
              child: Container(
                width: 48,
                height: 5,
                decoration: BoxDecoration(
                  color: c.textSecondary.withValues(alpha: 0.3),
                  borderRadius: AppRadii.hairAll,
                ),
              ),
            ),
            const SizedBox(height: 14),
            Text(
              'Encuadrá tu escudo',
              style: AppTypography.headline(
                size: 18,
                weight: FontWeight.w700,
                color: c.textPrimary,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              'Arrastrá y acercá con dos dedos. El fondo transparente se mantiene.',
              style: AppTypography.body(size: 12, color: c.textSecondary),
            ),
            const SizedBox(height: 14),
            Center(child: _buildFrame(context)),
            const SizedBox(height: 10),
            Row(
              children: [
                Icon(Icons.zoom_out, size: 20, color: c.textSecondary),
                Expanded(
                  child: Slider(
                    value: _zoom,
                    min: _minZoom,
                    max: _maxZoom,
                    onChanged: _image == null ? null : _setZoom,
                  ),
                ),
                Icon(Icons.zoom_in, size: 20, color: c.textSecondary),
              ],
            ),
            if (_loadError != null) ...[
              Text(
                'No pudimos leer esa imagen.',
                style: AppTypography.body(size: 12, color: c.destructive),
              ),
              const SizedBox(height: 6),
            ],
            const SizedBox(height: 4),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: _exporting ? null : () => Navigator.pop(context),
                    child: const Text('Cancelar'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: ElevatedButton(
                    onPressed: _image == null || _exporting ? null : _confirm,
                    child: Text(_exporting ? 'Procesando...' : 'Usar recorte'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFrame(BuildContext context) {
    final c = context.c;
    final image = _image;
    return Semantics(
      label: 'Marco de recorte del escudo',
      child: ClipRRect(
        borderRadius: AppRadii.cardAll,
        child: Container(
          width: _frame,
          height: _frame,
          decoration: BoxDecoration(
            border: Border.all(color: c.overlayLine),
            borderRadius: AppRadii.cardAll,
          ),
          child: image == null
              ? Center(
                  child: _loadError != null
                      ? Icon(Icons.broken_image_outlined, color: c.destructive)
                      : const SizedBox(
                          width: 22,
                          height: 22,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        ),
                )
              : GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onScaleStart: (d) {
                    _zoomAtStart = _zoom;
                    _offsetAtStart = _offset;
                    _focalAtStart = d.localFocalPoint;
                  },
                  onScaleUpdate: (d) {
                    setState(() {
                      _zoom = (_zoomAtStart * d.scale).clamp(
                        _minZoom,
                        _maxZoom,
                      );
                      _offset = _clampOffset(
                        _offsetAtStart + (d.localFocalPoint - _focalAtStart),
                      );
                    });
                  },
                  child: CustomPaint(
                    painter: _CropPainter(
                      image: image,
                      scale: _baseScale * _zoom,
                      offset: _offset,
                      circular: widget.circular,
                      light: c.textSecondary.withValues(alpha: 0.08),
                      dark: c.textSecondary.withValues(alpha: 0.18),
                      guide: c.primary,
                      shade: c.popover.withValues(alpha: 0.7),
                    ),
                  ),
                ),
        ),
      ),
    );
  }
}

class _CropPainter extends CustomPainter {
  final ui.Image image;
  final double scale;
  final Offset offset;
  final bool circular;
  final Color light;
  final Color dark;
  final Color guide;
  final Color shade;

  const _CropPainter({
    required this.image,
    required this.scale,
    required this.offset,
    required this.circular,
    required this.light,
    required this.dark,
    required this.guide,
    required this.shade,
  });

  @override
  void paint(Canvas canvas, Size size) {
    // Damero: deja ver que la transparencia se conserva.
    const cell = 12.0;
    final pLight = Paint()..color = light;
    final pDark = Paint()..color = dark;
    for (var r = 0; r < (size.height / cell).ceil(); r++) {
      for (var col = 0; col < (size.width / cell).ceil(); col++) {
        canvas.drawRect(
          Rect.fromLTWH(col * cell, r * cell, cell, cell),
          (r + col).isEven ? pLight : pDark,
        );
      }
    }

    canvas.save();
    canvas.clipRect(Offset.zero & size);
    canvas.translate(size.width / 2 + offset.dx, size.height / 2 + offset.dy);
    canvas.scale(scale);
    canvas.drawImage(
      image,
      Offset(-image.width / 2, -image.height / 2),
      Paint()..filterQuality = FilterQuality.high,
    );
    canvas.restore();

    if (circular) {
      // Oscurece lo que quedaría fuera del círculo y dibuja su borde.
      final hole = Path()..addOval(Offset.zero & size);
      final mask = Path.combine(
        PathOperation.difference,
        Path()..addRect(Offset.zero & size),
        hole,
      );
      canvas.drawPath(mask, Paint()..color = shade);
      canvas.drawOval(
        (Offset.zero & size).deflate(1),
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 2
          ..color = guide,
      );
    }
  }

  @override
  bool shouldRepaint(covariant _CropPainter old) =>
      old.image != image ||
      old.scale != scale ||
      old.offset != offset ||
      old.circular != circular ||
      old.light != light ||
      old.dark != dark ||
      old.guide != guide ||
      old.shade != shade;
}
