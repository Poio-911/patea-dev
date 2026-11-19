import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:just_audio/just_audio.dart';
import 'package:path_provider/path_provider.dart';

import '../../../core/services/evaluation_service.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/theme/patea_colors.dart';
import '../../../core/widgets/patea_button_progress.dart';

String formatAudioDuration(int seconds) {
  final safe = seconds < 0 ? 0 : seconds;
  final mins = safe ~/ 60;
  final secs = safe % 60;
  return '$mins:${secs.toString().padLeft(2, '0')}';
}

/// Reproductor compacto inline para notas de voz de evaluaciones.
///
/// - Si recibe [localFilePath], reproduce el archivo local recién grabado.
/// - Si recibe [evaluationId], descarga los bytes a demanda vía la Cloud
///   Function `getEvaluationAudio` (sólo habilitada tras revelar identidad o
///   para el autor) y cachea el archivo temporal en memoria del widget.
class EvaluationAudioPlayer extends ConsumerStatefulWidget {
  final String? localFilePath;
  final String? evaluationId;
  final int? durationSec;
  final Widget? trailing;

  const EvaluationAudioPlayer({
    super.key,
    this.localFilePath,
    this.evaluationId,
    this.durationSec,
    this.trailing,
  }) : assert(localFilePath != null || evaluationId != null);

  @override
  ConsumerState<EvaluationAudioPlayer> createState() =>
      _EvaluationAudioPlayerState();
}

class _EvaluationAudioPlayerState extends ConsumerState<EvaluationAudioPlayer> {
  AudioPlayer? _player;
  StreamSubscription<PlayerState>? _stateSub;
  StreamSubscription<Duration>? _posSub;
  StreamSubscription<Duration?>? _durSub;

  String? _resolvedPath;
  bool _loading = false;
  bool _playing = false;
  Duration _position = Duration.zero;
  Duration _duration = Duration.zero;
  String? _error;

  @override
  void initState() {
    super.initState();
    _resolvedPath = widget.localFilePath;
    if (widget.durationSec != null && widget.durationSec! > 0) {
      _duration = Duration(seconds: widget.durationSec!);
    }
  }

  @override
  void didUpdateWidget(covariant EvaluationAudioPlayer oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.localFilePath != widget.localFilePath ||
        oldWidget.evaluationId != widget.evaluationId) {
      _resetPlayer();
      _resolvedPath = widget.localFilePath;
      _duration = widget.durationSec != null && widget.durationSec! > 0
          ? Duration(seconds: widget.durationSec!)
          : Duration.zero;
    }
  }

  void _resetPlayer() {
    _stateSub?.cancel();
    _posSub?.cancel();
    _durSub?.cancel();
    _player?.dispose();
    _player = null;
    _playing = false;
    _position = Duration.zero;
    _error = null;
  }

  @override
  void dispose() {
    _resetPlayer();
    super.dispose();
  }

  Future<void> _togglePlay() async {
    if (_loading) return;
    setState(() => _error = null);

    try {
      if (_player != null && _playing) {
        await _player!.pause();
        return;
      }

      if (_player == null) {
        setState(() => _loading = true);
        var path = _resolvedPath;
        if (path == null && widget.evaluationId != null) {
          final data = await ref
              .read(evaluationServiceProvider)
              .loadEvaluationAudio(widget.evaluationId!);
          final dir = await getTemporaryDirectory();
          final file = File(
            '${dir.path}${Platform.pathSeparator}patea_eval_${widget.evaluationId}.m4a',
          );
          await file.writeAsBytes(data.bytes, flush: true);
          path = file.path;
          _resolvedPath = path;
          if (data.durationSec != null && data.durationSec! > 0 && mounted) {
            _duration = Duration(seconds: data.durationSec!);
          }
        }
        if (path == null) {
          throw Exception('No hay archivo de audio disponible.');
        }

        final player = AudioPlayer();
        _player = player;
        final loadedDuration = await player.setFilePath(path);
        if (loadedDuration != null && mounted) {
          _duration = loadedDuration;
        }
        _durSub = player.durationStream.listen((d) {
          if (d != null && mounted) setState(() => _duration = d);
        });
        _posSub = player.positionStream.listen((pos) {
          if (mounted) setState(() => _position = pos);
        });
        _stateSub = player.playerStateStream.listen((st) {
          if (!mounted) return;
          if (st.processingState == ProcessingState.completed) {
            player.seek(Duration.zero);
            player.pause();
            setState(() {
              _playing = false;
              _position = Duration.zero;
            });
          } else {
            setState(() => _playing = st.playing);
          }
        });
        if (mounted) setState(() => _loading = false);
      }

      if (_duration > Duration.zero && _position >= _duration) {
        await _player!.seek(Duration.zero);
      }
      await _player!.play();
    } catch (_) {
      if (mounted) {
        setState(() {
          _loading = false;
          _playing = false;
          _error = 'No pudimos reproducir la nota de voz.';
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final totalMs = _duration.inMilliseconds;
    final progress = totalMs > 0
        ? (_position.inMilliseconds / totalMs).clamp(0.0, 1.0)
        : 0.0;
    final shownSec = _playing || _position > Duration.zero
        ? _position.inSeconds
        : (_duration.inSeconds > 0
            ? _duration.inSeconds
            : (widget.durationSec ?? 0));

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
          decoration: BoxDecoration(
            color: c.cardSurface.withValues(alpha: c.isDarkSurface ? 0.6 : 0.8),
            borderRadius: AppRadii.cardAll,
            border: Border.all(color: c.overlayLine),
          ),
          child: Row(
            children: [
              SizedBox(
                width: 38,
                height: 38,
                child: FilledButton(
                  onPressed: _loading ? null : _togglePlay,
                  style: FilledButton.styleFrom(
                    padding: EdgeInsets.zero,
                    shape: const CircleBorder(),
                    backgroundColor: c.primary,
                    foregroundColor: c.onPrimary,
                  ),
                  child: _loading
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: PateaButtonProgress(),
                        )
                      : Icon(
                          _playing
                              ? Icons.pause_rounded
                              : Icons.play_arrow_rounded,
                          size: 22,
                        ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    ClipRRect(
                      borderRadius: AppRadii.pillAll,
                      child: LinearProgressIndicator(
                        value: progress,
                        minHeight: 4,
                        backgroundColor: c.overlayLine,
                        color: c.primary,
                      ),
                    ),
                    const SizedBox(height: 5),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          'Nota de voz',
                          style: AppTypography.body(
                            size: 11.5,
                            weight: FontWeight.w600,
                            color: c.textSecondary,
                          ),
                        ),
                        Text(
                          formatAudioDuration(shownSec),
                          style: AppTypography.code(
                            size: 11.5,
                            weight: FontWeight.w700,
                            color: c.textPrimary,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              if (widget.trailing != null) ...[
                const SizedBox(width: 6),
                widget.trailing!,
              ],
            ],
          ),
        ),
        if (_error != null) ...[
          const SizedBox(height: 6),
          Text(
            _error!,
            style: AppTypography.body(size: 12, color: c.destructive),
          ),
        ],
      ],
    );
  }
}
