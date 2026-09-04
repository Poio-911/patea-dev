import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:video_player/video_player.dart';

import '../../../core/models/match_model.dart';
import '../../../core/services/auth_service.dart';
import '../../../core/services/match_clips_service.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_typography.dart';

/// Los clips del partido, en fila y por minuto.
///
/// Aparece siempre que haya algo que mostrar o alguien que pueda subir. No
/// es una galería: son cuatro o cinco momentos del partido, y se recorren de
/// costado sin sacar al usuario de la pantalla.
class MatchClipsView extends ConsumerWidget {
  final MatchModel match;

  /// Sólo los que juegan (y el organizador) pueden subir — así lo pide la
  /// regla de Firestore.
  final bool canUpload;

  const MatchClipsView({super.key, required this.match, required this.canUpload});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final clips = ref.watch(matchClipsProvider(match.id)).value ?? const <MatchClip>[];
    if (clips.isEmpty && !canUpload) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Expanded(
              child: Text('CLIPS',
                  style: AppTypography.headline(
                      size: 11,
                      weight: FontWeight.w800,
                      color: AppColors.textMuted,
                      letterSpacing: 1.2)),
            ),
            if (canUpload)
              TextButton.icon(
                onPressed: () => ClipCaptureSheet.show(context, match),
                icon: const Icon(Icons.videocam_outlined, size: 16),
                label: Text('Subir',
                    style: AppTypography.headline(
                        size: 12, weight: FontWeight.w700, color: AppColors.voltNeon)),
                style: TextButton.styleFrom(
                  foregroundColor: AppColors.voltNeon,
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  minimumSize: Size.zero,
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
              ),
          ],
        ),
        const SizedBox(height: 10),
        if (clips.isEmpty)
          Text(
            'Cuando pase algo que valga la pena, grabá veinte segundos y quedan acá.',
            style: AppTypography.body(size: 12, color: AppColors.textMuted),
          )
        else
          SizedBox(
            height: 96,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: clips.length,
              separatorBuilder: (_, __) => const SizedBox(width: 10),
              itemBuilder: (context, i) => _ClipChip(
                clip: clips[i],
                onTap: () => ClipPlayerSheet.show(context, match.id, clips[i]),
              ),
            ),
          ),
      ],
    );
  }
}

class _ClipChip extends StatelessWidget {
  final MatchClip clip;
  final VoidCallback onTap;

  const _ClipChip({required this.clip, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: AppRadii.cardAll,
      child: Container(
        width: 132,
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          borderRadius: AppRadii.cardAll,
          border: Border.all(color: Colors.white.withValues(alpha: 0.14)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.play_circle_fill_rounded, size: 22, color: AppColors.voltNeon),
                const SizedBox(width: 8),
                Text("${clip.minute}'",
                    style: AppTypography.code(
                        size: 13, weight: FontWeight.w800, color: AppColors.textPrimary)),
              ],
            ),
            const Spacer(),
            Text(clip.label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AppTypography.headline(size: 13, weight: FontWeight.w700)),
            const SizedBox(height: 2),
            Text(clip.uploaderName.isEmpty ? 'Clip' : 'por ${clip.uploaderName}',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AppTypography.body(size: 10, color: AppColors.textMuted)),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------- subir --

/// Grabar o elegir un video y colgarlo de un minuto.
class ClipCaptureSheet extends ConsumerStatefulWidget {
  final MatchModel match;

  const ClipCaptureSheet({super.key, required this.match});

  static Future<void> show(BuildContext context, MatchModel match) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.background,
      shape: const RoundedRectangleBorder(borderRadius: AppRadii.surfaceTop),
      builder: (_) => ClipCaptureSheet(match: match),
    );
  }

  @override
  ConsumerState<ClipCaptureSheet> createState() => _ClipCaptureSheetState();
}

class _ClipCaptureSheetState extends ConsumerState<ClipCaptureSheet> {
  File? _file;
  late int _minute;
  String? _playerId;
  String? _playerName;
  double _progress = 0;
  bool _uploading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    // Arranca en el minuto en el que va el partido: casi siempre es el que
    // corresponde, porque uno sube el clip justo después de que pasó.
    _minute = widget.match.currentMinute ?? 0;
  }

  List<MatchPlayerEntry> get _roster {
    final all = <String, MatchPlayerEntry>{};
    for (final p in widget.match.players) {
      all[p.uid] = p;
    }
    for (final t in [widget.match.teamA, widget.match.teamB]) {
      for (final p in t?.players ?? const <MatchPlayerEntry>[]) {
        all[p.uid] = p;
      }
    }
    return all.values.toList()..sort((a, b) => a.displayName.compareTo(b.displayName));
  }

  Future<void> _pick(ImageSource source) async {
    try {
      final picked = await ImagePicker().pickVideo(
        source: source,
        // Veinte segundos es un gol con su festejo. Más que eso ya es
        // transmitir, que es otra cosa.
        maxDuration: const Duration(seconds: 30),
      );
      if (picked == null) return;
      setState(() {
        _file = File(picked.path);
        _error = null;
      });
    } catch (e) {
      setState(() => _error = '$e');
    }
  }

  Future<void> _upload() async {
    final file = _file;
    if (file == null) return;

    setState(() {
      _uploading = true;
      _progress = 0;
      _error = null;
    });

    try {
      final me = ref.read(authServiceProvider).currentUser;
      await ref.read(matchClipsServiceProvider).upload(
            matchId: widget.match.id,
            file: file,
            minute: _minute,
            uploaderName: me?.displayName?.split(' ').first ?? 'Alguien',
            playerId: _playerId,
            playerName: _playerName,
            onProgress: (p) {
              if (mounted) setState(() => _progress = p);
            },
          );
      if (!mounted) return;
      Navigator.pop(context);
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Clip subido.')));
    } catch (e) {
      if (mounted) {
        setState(() {
          _uploading = false;
          _error = '$e';
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 20,
        bottom: MediaQuery.viewInsetsOf(context).bottom + 20,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('SUBIR UN CLIP',
              style: AppTypography.headline(
                  size: 12,
                  weight: FontWeight.w800,
                  color: AppColors.textMuted,
                  letterSpacing: 1.2)),
          const SizedBox(height: 14),

          if (_file == null) ...[
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () => _pick(ImageSource.camera),
                    icon: const Icon(Icons.videocam_rounded, size: 18),
                    label: const Text('Grabar'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () => _pick(ImageSource.gallery),
                    icon: const Icon(Icons.photo_library_outlined, size: 18),
                    label: const Text('Elegir'),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Text('Hasta 30 segundos.',
                style: AppTypography.body(size: 11, color: AppColors.textMuted)),
          ] else ...[
            Row(
              children: [
                const Icon(Icons.movie_outlined, size: 20, color: AppColors.voltNeon),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(_file!.path.split(Platform.pathSeparator).last,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppTypography.body(size: 12, color: AppColors.textSecondary)),
                ),
                if (!_uploading)
                  TextButton(
                    onPressed: () => setState(() => _file = null),
                    style: TextButton.styleFrom(
                      foregroundColor: AppColors.textMuted,
                      padding: EdgeInsets.zero,
                      minimumSize: Size.zero,
                      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    ),
                    child: const Text('Cambiar'),
                  ),
              ],
            ),
            const SizedBox(height: 18),
            _MinuteRow(
              minute: _minute,
              enabled: !_uploading,
              onChanged: (m) => setState(() => _minute = m),
            ),
            const SizedBox(height: 18),
            Text('DE QUIÉN ES (OPCIONAL)',
                style: AppTypography.headline(
                    size: 10,
                    weight: FontWeight.w800,
                    color: AppColors.textMuted,
                    letterSpacing: 1)),
            const SizedBox(height: 8),
            SizedBox(
              height: 34,
              child: ListView(
                scrollDirection: Axis.horizontal,
                children: [
                  for (final p in _roster)
                    Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: _PlayerChip(
                        name: p.displayName.split(' ').first,
                        selected: _playerId == p.uid,
                        onTap: _uploading
                            ? null
                            : () => setState(() {
                                  if (_playerId == p.uid) {
                                    _playerId = null;
                                    _playerName = null;
                                  } else {
                                    _playerId = p.uid;
                                    _playerName = p.displayName;
                                  }
                                }),
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 20),
            if (_uploading) ...[
              ClipRRect(
                borderRadius: BorderRadius.circular(999),
                child: LinearProgressIndicator(
                  value: _progress == 0 ? null : _progress,
                  minHeight: 6,
                  backgroundColor: Colors.white.withValues(alpha: 0.1),
                  valueColor: const AlwaysStoppedAnimation(AppColors.voltNeon),
                ),
              ),
              const SizedBox(height: 8),
              Text('Subiendo… ${(_progress * 100).round()}%',
                  textAlign: TextAlign.center,
                  style: AppTypography.body(size: 11, color: AppColors.textMuted)),
            ] else
              FilledButton(
                onPressed: _upload,
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.voltNeon,
                  foregroundColor: AppColors.background,
                  padding: const EdgeInsets.symmetric(vertical: 15),
                  shape: const RoundedRectangleBorder(borderRadius: AppRadii.cardAll),
                ),
                child: Text('Subir clip',
                    style: AppTypography.headline(
                        size: 14, weight: FontWeight.w800, color: AppColors.background)),
              ),
          ],

          if (_error != null) ...[
            const SizedBox(height: 12),
            Text(_error!, style: AppTypography.body(size: 11, color: AppColors.destructive)),
          ],
        ],
      ),
    );
  }
}

class _MinuteRow extends StatelessWidget {
  final int minute;
  final bool enabled;
  final ValueChanged<int> onChanged;

  const _MinuteRow({required this.minute, required this.enabled, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Text('MINUTO',
            style: AppTypography.headline(
                size: 10, weight: FontWeight.w800, color: AppColors.textMuted, letterSpacing: 1)),
        const Spacer(),
        IconButton(
          onPressed: enabled && minute > 0 ? () => onChanged(minute - 1) : null,
          icon: const Icon(Icons.remove_circle_outline, size: 22),
          color: AppColors.textSecondary,
        ),
        SizedBox(
          width: 44,
          child: Text("$minute'",
              textAlign: TextAlign.center,
              style: AppTypography.code(size: 17, weight: FontWeight.w800)),
        ),
        IconButton(
          onPressed: enabled && minute < 130 ? () => onChanged(minute + 1) : null,
          icon: const Icon(Icons.add_circle_outline, size: 22),
          color: AppColors.textSecondary,
        ),
      ],
    );
  }
}

class _PlayerChip extends StatelessWidget {
  final String name;
  final bool selected;
  final VoidCallback? onTap;

  const _PlayerChip({required this.name, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: AppRadii.chipAll,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
        decoration: BoxDecoration(
          color: selected ? AppColors.voltNeon : Colors.transparent,
          borderRadius: AppRadii.chipAll,
          border: Border.all(
            color: selected ? AppColors.voltNeon : Colors.white.withValues(alpha: 0.18),
          ),
        ),
        child: Text(name,
            style: AppTypography.headline(
                size: 12,
                weight: FontWeight.w700,
                color: selected ? AppColors.background : AppColors.textSecondary)),
      ),
    );
  }
}

// ------------------------------------------------------------- reproducir --

/// Reproduce un clip a pantalla casi completa.
class ClipPlayerSheet extends ConsumerStatefulWidget {
  final String matchId;
  final MatchClip clip;

  const ClipPlayerSheet({super.key, required this.matchId, required this.clip});

  static Future<void> show(BuildContext context, String matchId, MatchClip clip) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.black,
      shape: const RoundedRectangleBorder(borderRadius: AppRadii.surfaceTop),
      builder: (_) => ClipPlayerSheet(matchId: matchId, clip: clip),
    );
  }

  @override
  ConsumerState<ClipPlayerSheet> createState() => _ClipPlayerSheetState();
}

class _ClipPlayerSheetState extends ConsumerState<ClipPlayerSheet> {
  VideoPlayerController? _controller;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final controller = VideoPlayerController.networkUrl(Uri.parse(widget.clip.url));
    try {
      await controller.initialize();
      if (!mounted) {
        await controller.dispose();
        return;
      }
      // Un clip de veinte segundos se mira más de una vez: en loop y
      // arrancando solo, sin pedir permiso.
      await controller.setLooping(true);
      await controller.play();
      setState(() => _controller = controller);
    } catch (e) {
      await controller.dispose();
      if (mounted) setState(() => _error = '$e');
    }
  }

  @override
  void dispose() {
    _controller?.dispose();
    super.dispose();
  }

  Future<void> _delete() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: AppColors.card,
        title: Text('¿Borrar el clip?',
            style: AppTypography.headline(size: 16, weight: FontWeight.w800)),
        content: Text('No se puede deshacer.',
            style: AppTypography.body(size: 13, color: AppColors.textSecondary)),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context, false), child: const Text('Cancelar')),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            style: TextButton.styleFrom(foregroundColor: AppColors.destructive),
            child: const Text('Borrar'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    try {
      await ref.read(matchClipsServiceProvider).delete(widget.matchId, widget.clip);
      if (mounted) Navigator.pop(context);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('$e'),
          backgroundColor: AppColors.destructive,
        ));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final uid = ref.watch(authServiceProvider).currentUser?.uid;
    final isMine = uid != null && uid == widget.clip.uploadedBy;
    final controller = _controller;

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Text("${widget.clip.minute}'  ${widget.clip.label}",
                    style: AppTypography.headline(size: 16, weight: FontWeight.w800)),
                const Spacer(),
                if (isMine)
                  IconButton(
                    onPressed: _delete,
                    icon: const Icon(Icons.delete_outline, size: 20),
                    color: AppColors.textMuted,
                  ),
              ],
            ),
            const SizedBox(height: 12),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 40),
                child: Text('No se pudo reproducir el clip.\n$_error',
                    textAlign: TextAlign.center,
                    style: AppTypography.body(size: 12, color: AppColors.textMuted)),
              )
            else if (controller == null)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 60),
                child: Center(child: CircularProgressIndicator(color: AppColors.voltNeon)),
              )
            else
              GestureDetector(
                onTap: () => setState(() {
                  controller.value.isPlaying ? controller.pause() : controller.play();
                }),
                child: ClipRRect(
                  borderRadius: AppRadii.cardAll,
                  child: AspectRatio(
                    aspectRatio: controller.value.aspectRatio,
                    child: Stack(
                      alignment: Alignment.center,
                      children: [
                        VideoPlayer(controller),
                        if (!controller.value.isPlaying)
                          const Icon(Icons.play_arrow_rounded, size: 64, color: Colors.white70),
                      ],
                    ),
                  ),
                ),
              ),
            if (widget.clip.uploaderName.isNotEmpty) ...[
              const SizedBox(height: 12),
              Text('Grabado por ${widget.clip.uploaderName}',
                  textAlign: TextAlign.center,
                  style: AppTypography.body(size: 11, color: AppColors.textMuted)),
            ],
          ],
        ),
      ),
    );
  }
}
