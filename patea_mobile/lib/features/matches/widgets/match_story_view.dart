import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/models/match_model.dart';
import '../../../core/services/match_result_service.dart';
import '../../../core/services/match_service.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_typography.dart';

/// Lo que queda del partido cuando terminó.
///
/// Port de `IntegratedMatchStory` (src/components/match-details/): el
/// resultado con la figura, los goleadores y asistidores autoreportados, la
/// crónica escrita por la IA y las Voces del Vestuario.
///
/// El dato importante: los testimonios que alimentan todo esto ya se venían
/// guardando. El formulario de evaluación del móvil pide `personalChronicle` y
/// `mvpVote` desde siempre, y hasta ahora nada los leía — se escribían en
/// Firestore y ahí morían.
class MatchStoryView extends ConsumerStatefulWidget {
  final MatchModel match;

  const MatchStoryView({super.key, required this.match});

  @override
  ConsumerState<MatchStoryView> createState() => _MatchStoryViewState();
}

class _MatchStoryViewState extends ConsumerState<MatchStoryView> {
  bool _generating = false;
  String? _error;

  Future<void> _generate() async {
    setState(() {
      _generating = true;
      _error = null;
    });
    try {
      await ref.read(matchServiceProvider).generateMatchChronicle(widget.match.id);
      // No hace falta guardar nada: la función escribe la crónica en el
      // partido y el stream la trae.
    } catch (e) {
      if (mounted) setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _generating = false);
    }
  }

  /// Nombre de un jugador, buscándolo primero en el propio partido.
  String _nameOf(String id) {
    for (final p in widget.match.players) {
      if (p.uid == id) return p.displayName;
    }
    for (final t in [widget.match.teamA, widget.match.teamB]) {
      for (final p in t?.players ?? const <MatchPlayerEntry>[]) {
        if (p.uid == id) return p.displayName;
      }
    }
    return 'Jugador';
  }

  @override
  Widget build(BuildContext context) {
    final match = widget.match;
    final stats = ref.watch(matchResultStatsProvider(match.id)).value ?? MatchResultStats.empty;
    final chronicle = match.chronicle;

    // El MVP guardado en el partido manda; si el partido es viejo y no lo
    // tiene, se recalcula con los votos.
    final mvpId = match.bestPlayerId ?? stats.mvpId;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (mvpId != null) ...[
          _MvpBanner(name: _nameOf(mvpId), votes: stats.mvpVotes),
          const SizedBox(height: 18),
        ],

        if (stats.scorers.isNotEmpty || stats.assisters.isNotEmpty) ...[
          _SectionLabel('EN LA PLANILLA'),
          const SizedBox(height: 10),
          for (final t in stats.scorers)
            _TallyLine(
              icon: Icons.sports_soccer_rounded,
              name: _nameOf(t.playerId),
              count: t.goals,
              color: AppColors.voltNeon,
            ),
          for (final t in stats.assisters)
            _TallyLine(
              icon: Icons.compare_arrows_rounded,
              name: _nameOf(t.playerId),
              count: t.assists,
              color: AppColors.textSecondary,
            ),
          const SizedBox(height: 20),
        ],

        if (chronicle == null)
          _ChronicleCta(
            generating: _generating,
            error: _error,
            enabled: match.status == 'evaluated',
            onTap: _generate,
          )
        else
          _Chronicle(chronicle: chronicle),
      ],
    );
  }
}

class _SectionLabel extends StatelessWidget {
  final String text;
  const _SectionLabel(this.text);

  @override
  Widget build(BuildContext context) => Text(
        text,
        style: AppTypography.headline(
            size: 11, weight: FontWeight.w800,
            color: AppColors.textMuted, letterSpacing: 1.2),
      );
}

class _MvpBanner extends StatelessWidget {
  final String name;
  final int votes;

  const _MvpBanner({required this.name, required this.votes});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(Icons.emoji_events_rounded, size: 28, color: AppColors.goldBorder),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('FIGURA DEL PARTIDO',
                  style: AppTypography.headline(
                      size: 10, weight: FontWeight.w800,
                      color: AppColors.textMuted, letterSpacing: 1.2)),
              const SizedBox(height: 3),
              Text(name,
                  style: AppTypography.headline(size: 19, weight: FontWeight.w900)),
              if (votes > 0)
                Text(
                  votes == 1 ? 'con 1 voto' : 'con $votes votos',
                  style: AppTypography.body(size: 11, color: AppColors.textMuted),
                ),
            ],
          ),
        ),
      ],
    );
  }
}

class _TallyLine extends StatelessWidget {
  final IconData icon;
  final String name;
  final int count;
  final Color color;

  const _TallyLine({
    required this.icon,
    required this.name,
    required this.count,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          Icon(icon, size: 16, color: color),
          const SizedBox(width: 10),
          Expanded(
            child: Text(name,
                style: AppTypography.headline(size: 13, weight: FontWeight.w700)),
          ),
          if (count > 1)
            Text('×$count',
                style: AppTypography.code(size: 12, weight: FontWeight.w800, color: color)),
        ],
      ),
    );
  }
}

class _ChronicleCta extends StatelessWidget {
  final bool generating;
  final bool enabled;
  final String? error;
  final VoidCallback onTap;

  const _ChronicleCta({
    required this.generating,
    required this.enabled,
    required this.error,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    if (!enabled) {
      return Text(
        'Cuando todos terminen de evaluar, se puede pedir el relato del partido.',
        style: AppTypography.body(size: 12, color: AppColors.textMuted),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text('EL RELATO',
            style: AppTypography.headline(
                size: 11, weight: FontWeight.w800,
                color: AppColors.textMuted, letterSpacing: 1.2)),
        const SizedBox(height: 8),
        Text(
          'Un cronista escribe la historia del partido con los goles, las '
          'etiquetas de rendimiento y lo que contó cada uno.',
          style: AppTypography.body(size: 12, color: AppColors.textSecondary),
        ),
        const SizedBox(height: 14),
        FilledButton.icon(
          onPressed: generating ? null : onTap,
          style: FilledButton.styleFrom(
            backgroundColor: AppColors.voltNeon,
            foregroundColor: AppColors.background,
            padding: const EdgeInsets.symmetric(vertical: 14),
            shape: const RoundedRectangleBorder(borderRadius: AppRadii.cardAll),
          ),
          icon: generating
              ? const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(
                      strokeWidth: 2, color: AppColors.background))
              : const Icon(Icons.auto_stories_rounded, size: 18),
          label: Text(generating ? 'Escribiendo…' : 'Escribir el relato',
              style: AppTypography.headline(
                  size: 14, weight: FontWeight.w800, color: AppColors.background)),
        ),
        if (error != null) ...[
          const SizedBox(height: 10),
          Text(error!,
              style: AppTypography.body(size: 11, color: AppColors.destructive)),
        ],
      ],
    );
  }
}

class _Chronicle extends StatelessWidget {
  final MatchChronicle chronicle;

  const _Chronicle({required this.chronicle});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('EL RELATO',
            style: AppTypography.headline(
                size: 11, weight: FontWeight.w800,
                color: AppColors.textMuted, letterSpacing: 1.2)),
        const SizedBox(height: 10),
        Text(
          chronicle.headline,
          style: AppTypography.headline(size: 22, weight: FontWeight.w900, letterSpacing: -0.5)
              .copyWith(height: 1.15),
        ),
        const SizedBox(height: 14),
        Text(
          chronicle.story,
          style: AppTypography.body(size: 14, color: AppColors.textPrimary, height: 1.65),
        ),
        if (chronicle.playerVoices.isNotEmpty) ...[
          const SizedBox(height: 26),
          Text('VOCES DEL VESTUARIO',
              style: AppTypography.headline(
                  size: 11, weight: FontWeight.w800,
                  color: AppColors.textMuted, letterSpacing: 1.2)),
          const SizedBox(height: 12),
          for (final v in chronicle.playerVoices) _Voice(name: v.playerName, quote: v.quote),
        ],
      ],
    );
  }
}

class _Voice extends StatelessWidget {
  final String name;
  final String quote;

  const _Voice({required this.name, required this.quote});

  @override
  Widget build(BuildContext context) {
    // Una cita es una cita: raya al costado y texto. Sin tarjeta, sin recuadro.
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 2,
            height: 40,
            margin: const EdgeInsets.only(top: 3, right: 12),
            color: AppColors.voltNeon.withValues(alpha: 0.5),
          ),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('«$quote»',
                    style: AppTypography.body(
                        size: 13, color: AppColors.textPrimary, height: 1.5)),
                const SizedBox(height: 4),
                Text(name.toUpperCase(),
                    style: AppTypography.headline(
                        size: 10, weight: FontWeight.w800,
                        color: AppColors.textMuted, letterSpacing: 1)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
