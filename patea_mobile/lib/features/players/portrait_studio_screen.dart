import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../core/models/player_model.dart';
import '../../core/services/profile_service.dart';
import '../../core/theme/patea_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/widgets/player_card_widget.dart';

class PortraitStudioScreen extends ConsumerStatefulWidget {
  final PlayerModel player;
  final File? initialPhoto;
  const PortraitStudioScreen({
    super.key,
    required this.player,
    this.initialPhoto,
  });
  @override
  ConsumerState<PortraitStudioScreen> createState() => _PortraitStudioState();
}

class _PortraitStudioState extends ConsumerState<PortraitStudioScreen> {
  static const _colors = {
    '#173D78': 'Azul',
    '#D64A41': 'Rojo',
    '#297A55': 'Verde',
    '#D9A536': 'Dorado',
    '#6C4AA0': 'Violeta',
    '#202630': 'Negro',
    '#F5F4EF': 'Blanco',
  };
  File? _source;
  String? _uploadedSource;
  PortraitDraft? _draft;
  String _primary = '#173D78', _secondary = '#F5F4EF', _pattern = 'plain';
  bool _busy = false, _card = false, _original = false;
  String? _error;
  int? _credits;
  String? get _reference =>
      widget.player.aiSourcePhotoUrl ?? widget.player.photoUrl;

  @override
  void initState() {
    super.initState();
    _source = widget.initialPhoto;
    _credits = widget.player.cardGenerationCredits;
  }

  Future<void> _pick(ImageSource source) async {
    try {
      final photo = await ImagePicker().pickImage(
        source: source,
        maxWidth: 1080,
        maxHeight: 1080,
        imageQuality: 88,
      );
      if (photo == null || !mounted) return;
      setState(() {
        _source = File(photo.path);
        _uploadedSource = null;
        _draft = null;
        _original = false;
        _error = null;
      });
    } catch (_) {
      if (mounted)
        setState(() => _error = 'No se pudo abrir la cámara o la galería.');
    }
  }

  Future<void> _generate() async {
    if (_busy || (_credits != null && _credits! <= 0)) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final service = ref.read(profileServiceProvider);
      if (_source != null && _uploadedSource == null)
        _uploadedSource = await service.uploadProfilePhoto(_source!);
      final draft = await service.previewAiPhoto(
        sourcePhotoUrl: _uploadedSource,
        primaryColor: _primary,
        secondaryColor: _secondary,
        pattern: _pattern,
      );
      if (!mounted) return;
      await HapticFeedback.mediumImpact();
      if (!mounted) return;
      setState(() {
        _draft = draft;
        _credits = draft.creditsRemaining;
        _original = false;
      });
    } catch (e) {
      if (mounted)
        setState(() => _error = e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _apply({bool original = false}) async {
    if (_busy) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final service = ref.read(profileServiceProvider);
      if (!original && _draft != null) {
        await service.applyAiPhoto(_draft!.id);
      } else {
        final url = _source != null
            ? (_uploadedSource ?? await service.uploadProfilePhoto(_source!))
            : _reference;
        if (url == null) throw Exception('Primero elegí una foto.');
        await service.updateProfile(photoUrl: url);
        await service.updateCrop(x: 50, y: 50, zoom: 1);
      }
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted)
        setState(() {
          _busy = false;
          _error = e.toString().replaceFirst('Exception: ', '');
        });
    }
  }

  Widget _swatches(
    String title,
    String selected,
    ValueChanged<String> select,
  ) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(title, style: AppTypography.body(size: 14)),
      const SizedBox(height: 8),
      Wrap(
        spacing: 8,
        runSpacing: 8,
        children: [
          for (final entry in _colors.entries)
            Semantics(
              button: true,
              selected: selected == entry.key,
              label: '$title: ${entry.value}',
              child: Tooltip(
                message: entry.value,
                child: InkWell(
                  onTap: _busy
                      ? null
                      : () => setState(() {
                          select(entry.key);
                        }),
                  borderRadius: BorderRadius.circular(24),
                  child: Container(
                    width: 40,
                    height: 40,
                    padding: const EdgeInsets.all(4),
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: selected == entry.key
                            ? context.c.primary
                            : context.c.textSecondary.withValues(alpha: 0.25),
                        width: selected == entry.key ? 2 : 1,
                      ),
                    ),
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: Color(
                          int.parse('FF${entry.key.substring(1)}', radix: 16),
                        ),
                      ),
                      child: selected == entry.key
                          ? Icon(
                              Icons.check,
                              size: 18,
                              color:
                                  entry.key == '#F5F4EF' ||
                                      entry.key == '#D9A536'
                                  ? Colors.black
                                  : Colors.white,
                            )
                          : null,
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    ],
  );

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final showResult = _draft != null && !_original;
    final photoUrl = showResult ? _draft!.photoUrl : _reference;
    final local = showResult ? null : _source;
    final hasPhoto = local != null || photoUrl != null;
    final canGenerate =
        !_busy && hasPhoto && (_credits == null || _credits! > 0);
    final creditText = _credits == null
        ? 'Cada generación usa 1 crédito.'
        : _credits! <= 0
        ? 'Sin créditos disponibles este mes.'
        : 'Usa 1 crédito ($_credits disponibles).';
    return PopScope(
      canPop: !_busy,
      child: Scaffold(
        backgroundColor: c.background,
        appBar: AppBar(title: const Text('Tu retrato')),
        body: ListView(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 28),
          children: [
            Text(
              _draft == null
                  ? 'Tu foto, con presencia de jugador'
                  : 'Elegí cómo querés verte',
              style: AppTypography.headline(size: 23),
            ),
            const SizedBox(height: 8),
            Text(
              _draft == null
                  ? 'Elegí una foto y prepará tu camiseta. Conservamos tu foto actual hasta que confirmes.'
                  : 'Revisá el resultado y comparalo con la referencia antes de guardarlo.',
              style: AppTypography.body(size: 14, color: c.textSecondary),
            ),
            const SizedBox(height: 20),
            Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 300),
                child: AspectRatio(
                  aspectRatio: 2 / 3,
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(20),
                    child: AnimatedSwitcher(
                      duration: MediaQuery.disableAnimationsOf(context)
                          ? Duration.zero
                          : const Duration(milliseconds: 180),
                      child: _card
                          ? PlayerCardWidget(
                              key: ValueKey('card-$photoUrl-${local?.path}'),
                              player: widget.player.copyWith(
                                photoUrl: photoUrl,
                                cropX: 50,
                                cropY: 50,
                                cropZoom: 1,
                              ),
                              localPhoto: local,
                              photoStyle: CardPhotoStyle.halfTop,
                            )
                          : SizedBox.expand(
                              key: ValueKey(
                                'portrait-$photoUrl-${local?.path}',
                              ),
                              child: local != null
                                  ? Image.file(local, fit: BoxFit.cover)
                                  : photoUrl != null
                                  ? CachedNetworkImage(
                                      imageUrl: photoUrl,
                                      fit: BoxFit.cover,
                                      placeholder: (_, _) => Center(
                                        child: CircularProgressIndicator(
                                          color: c.primary,
                                        ),
                                      ),
                                      errorWidget: (_, _, _) => const Center(
                                        child: Icon(
                                          Icons.person_outline,
                                          size: 70,
                                        ),
                                      ),
                                    )
                                  : ColoredBox(
                                      color: c.cardSurface,
                                      child: Center(
                                        child: Icon(
                                          Icons.add_a_photo_outlined,
                                          size: 56,
                                          color: c.textSecondary,
                                        ),
                                      ),
                                    ),
                            ),
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: SegmentedButton<bool>(
                    segments: const [
                      ButtonSegment(value: false, label: Text('Retrato')),
                      ButtonSegment(value: true, label: Text('Ficha')),
                    ],
                    selected: {_card},
                    onSelectionChanged: (v) => setState(() => _card = v.first),
                  ),
                ),
                if (_draft != null) ...[
                  const SizedBox(width: 8),
                  IconButton(
                    tooltip: _original ? 'Ver resultado' : 'Ver original',
                    onPressed: () => setState(() => _original = !_original),
                    icon: Icon(
                      _original
                          ? Icons.auto_awesome_outlined
                          : Icons.compare_outlined,
                    ),
                  ),
                ],
              ],
            ),
            const SizedBox(height: 14),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: _busy ? null : () => _pick(ImageSource.camera),
                    icon: const Icon(Icons.photo_camera_outlined),
                    label: const Text('Cámara'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: _busy ? null : () => _pick(ImageSource.gallery),
                    icon: const Icon(Icons.photo_library_outlined),
                    label: const Text('Galería'),
                  ),
                ),
              ],
            ),
            if (_draft == null) ...[
              const SizedBox(height: 24),
              Text('Tu camiseta', style: AppTypography.headline(size: 20)),
              const SizedBox(height: 16),
              _swatches('Color principal', _primary, (v) => _primary = v),
              const SizedBox(height: 16),
              _swatches('Color secundario', _secondary, (v) => _secondary = v),
              const SizedBox(height: 18),
              DropdownButtonFormField<String>(
                initialValue: _pattern,
                decoration: const InputDecoration(labelText: 'Diseño'),
                items: const [
                  DropdownMenuItem(value: 'plain', child: Text('Lisa')),
                  DropdownMenuItem(
                    value: 'stripes',
                    child: Text('Rayas verticales'),
                  ),
                  DropdownMenuItem(
                    value: 'band',
                    child: Text('Banda horizontal'),
                  ),
                ],
                onChanged: _busy ? null : (v) => setState(() => _pattern = v!),
              ),
            ] else ...[
              const SizedBox(height: 14),
              TextButton.icon(
                onPressed: _busy
                    ? null
                    : () => setState(() {
                        _draft = null;
                        _original = false;
                      }),
                icon: const Icon(Icons.checkroom_outlined),
                label: const Text('Cambiar camiseta'),
              ),
            ],
            const SizedBox(height: 18),
            Text(
              creditText,
              style: AppTypography.body(size: 13, color: c.textSecondary),
            ),
            if (_draft != null)
              Text(
                'Aplicar esta foto no usa otro crédito.',
                style: AppTypography.body(size: 13, color: c.textSecondary),
              ),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.only(top: 12),
                child: Text(
                  _error!,
                  style: AppTypography.body(size: 14, color: c.destructive),
                ),
              ),
            if (_busy)
              const Padding(
                padding: EdgeInsets.only(top: 12),
                child: Text('Procesando… Tu foto actual se conserva.'),
              ),
            const SizedBox(height: 14),
            FilledButton.icon(
              onPressed: canGenerate ? _generate : null,
              icon: _busy
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.auto_awesome_outlined),
              label: Text(
                _draft == null ? 'Generar con IA' : 'Generar otra · 1 crédito',
              ),
            ),
            if (_draft != null)
              FilledButton(
                onPressed: _busy ? null : () => _apply(),
                child: const Text('Usar esta foto'),
              ),
            if (_draft == null && hasPhoto)
              OutlinedButton(
                onPressed: _busy ? null : () => _apply(original: true),
                child: const Text('Usar foto original'),
              ),
            if (!hasPhoto)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text(
                  'Elegí una foto de la cámara o galería para empezar.',
                  style: AppTypography.body(size: 13, color: c.textSecondary),
                ),
              ),
            TextButton(
              onPressed: _busy ? null : () => Navigator.pop(context, false),
              child: const Text('Conservar la actual'),
            ),
          ],
        ),
      ),
    );
  }
}
