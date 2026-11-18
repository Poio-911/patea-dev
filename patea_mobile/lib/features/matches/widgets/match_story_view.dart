import '../../../core/widgets/patea_button_progress.dart';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import '../../../core/widgets/patea_card.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/models/match_model.dart';
import '../../../core/services/match_result_service.dart';
import '../../../core/services/match_service.dart';
import '../../../core/theme/patea_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/widgets/patea_avatar.dart';

/// Lo que queda del partido cuando terminó, con forma de revista.
///
/// Port de `IntegratedMatchStory` (src/components/match-details/). La web no
/// resuelve esto como una tarjeta más: le da tipografía serif, textura de
/// papel, un separador ornamental, capitular en el cuerpo y las voces del
/// vestuario como recortes. Es el único contenido de la app que se lee como
/// texto largo y no como interfaz, y por eso se ve distinto a propósito.
///
/// El dato importante: los testimonios que alimentan todo esto ya se venían
/// guardando. El formulario de evaluación del móvil pide `personalChronicle` y
/// `mvpVote` desde siempre, y hasta ahora nada los leía.
enum MatchStoryPart { all, figure, planilla, chronicle }

class MatchStoryView extends ConsumerStatefulWidget {
  final MatchModel match;
  final MatchStoryPart part;

  const MatchStoryView({
    super.key,
    required this.match,
    this.part = MatchStoryPart.all,
  });

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
      await ref
          .read(matchServiceProvider)
          .generateMatchChronicle(widget.match.id);
      // No hace falta guardar nada: la función escribe la crónica en el
      // partido y el stream la trae.
    } catch (e) {
      if (mounted) setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _generating = false);
    }
  }

  /// Un jugador del partido, buscándolo por id.
  MatchPlayerEntry? _playerOf(String id) {
    for (final p in widget.match.players) {
      if (p.uid == id) return p;
    }
    for (final t in [widget.match.teamA, widget.match.teamB]) {
      for (final p in t?.players ?? const <MatchPlayerEntry>[]) {
        if (p.uid == id) return p;
      }
    }
    return null;
  }

  String _nameOf(String id) => _playerOf(id)?.displayName ?? 'Jugador';

  /// El jugador cuyo nombre escribió la IA. Viene como texto libre, así que se
  /// busca por coincidencia parcial igual que en la web.
  MatchPlayerEntry? _playerByName(String name) {
    final needle = name.toLowerCase().trim();
    if (needle.isEmpty) return null;
    for (final p in widget.match.players) {
      final n = p.displayName.toLowerCase();
      if (n == needle || n.contains(needle) || needle.contains(n)) return p;
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final match = widget.match;
    final stats =
        ref.watch(matchResultStatsProvider(match.id)).value ??
        MatchResultStats.empty;
    final chronicle = match.chronicle;

    // El MVP guardado en el partido manda; si el partido es viejo y no lo
    // tiene, se recalcula con los votos.
    final mvpId = match.bestPlayerId ?? stats.mvpId;
    final mvp = mvpId == null ? null : _playerOf(mvpId);

    final showFigure =
        widget.part == MatchStoryPart.all ||
        widget.part == MatchStoryPart.figure;
    final showPlanilla =
        widget.part == MatchStoryPart.all ||
        widget.part == MatchStoryPart.planilla;
    final showChronicle =
        widget.part == MatchStoryPart.all ||
        widget.part == MatchStoryPart.chronicle;
    final content = Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (showChronicle && chronicle != null)
          _Masthead(headline: chronicle.headline, match: match)
        else if (showChronicle)
          _CoverPending(
            generating: _generating,
            error: _error,
            onTap: _generate,
          ),

        if (showFigure && mvp != null)
          _MvpMedallion(
            player: mvp,
            votes: stats.mvpVotes,
            goals: stats.scorers
                .where((p) => p.playerId == mvpId)
                .fold<int>(0, (sum, p) => sum + p.goals),
            assists: stats.assisters
                .where((p) => p.playerId == mvpId)
                .fold<int>(0, (sum, p) => sum + p.assists),
          ),

        if (showChronicle && chronicle != null) _Story(text: chronicle.story),

        if (showPlanilla &&
            (stats.scorers.isNotEmpty || stats.assisters.isNotEmpty))
          _Boxscore(
            scorers: stats.scorers,
            assisters: stats.assisters,
            nameOf: _nameOf,
            playerOf: _playerOf,
          ),

        if (showChronicle &&
            chronicle != null &&
            chronicle.playerVoices.isNotEmpty)
          _Voices(voices: chronicle.playerVoices, playerByName: _playerByName),
      ],
    );
    return widget.part == MatchStoryPart.all ||
            widget.part == MatchStoryPart.chronicle
        ? _Paper(child: content)
        : content;
  }
}

/// Tarjeta contenedora de la crónica con estética dark moderna.
class _Paper extends StatelessWidget {
  final Widget child;

  const _Paper({required this.child});

  @override
  Widget build(BuildContext context) {
    return PateaCard(
      color: context.c.card,
      radius: AppRadii.cardAll,
      borderColor: context.c.border.withValues(alpha: 0.35),
      clipBehavior: Clip.antiAlias,
      child: child,
    );
  }
}

/// Cabecera moderna de la crónica: badge oficial, titular y marcador si disponible.
class _Masthead extends StatelessWidget {
  final String headline;
  final MatchModel match;

  const _Masthead({required this.headline, required this.match});

  @override
  Widget build(BuildContext context) {
    final hasScore =
        match.hasFinalScore && match.teamA != null && match.teamB != null;

    return Padding(
      padding: const EdgeInsets.fromLTRB(18, 18, 18, 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              PateaCard(
                color: context.c.primary.withValues(alpha: 0.15),
                radius: AppRadii.chipAll,
                padding: const EdgeInsets.all(6),
                child: Icon(
                  Icons.auto_stories_rounded,
                  size: 15,
                  color: context.c.primary,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Crónica del partido',
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: AppTypography.code(
                    size: 12,
                    weight: FontWeight.w800,
                    color: context.c.primary,
                  ).copyWith(letterSpacing: 1.4),
                ),
              ),
              if (hasScore) ...[
                const SizedBox(width: 8),
                PateaCard(
                  color: context.c.cardSurface,
                  radius: AppRadii.chipAll,
                  borderColor: context.c.border.withValues(alpha: 0.4),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 3.5,
                  ),
                  child: Text(
                    '${match.teamA!.score} - ${match.teamB!.score}',
                    style: AppTypography.sportNumber(
                      size: 18,
                      color: context.c.textPrimary,
                    ),
                  ),
                ),
              ],
            ],
          ),
          const SizedBox(height: 12),
          Text(
            '«$headline»',
            style: AppTypography.headline(size: 18, weight: FontWeight.w800),
          ),
          const SizedBox(height: 12),
          Container(height: 1, color: context.c.border.withValues(alpha: 0.25)),
        ],
      ),
    );
  }
}

/// La figura del partido en tarjeta dorada moderna.
class _MvpMedallion extends StatelessWidget {
  final MatchPlayerEntry player;
  final int votes;
  final int goals;
  final int assists;

  const _MvpMedallion({
    required this.player,
    required this.votes,
    this.goals = 0,
    this.assists = 0,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: PateaCard(
        color: context.c.cardSurface,
        radius: AppRadii.cardAll,
        borderColor: context.c.goldBorder.withValues(alpha: 0.5),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        child: Row(
          children: [
            PateaAvatar(
              photoUrl: player.photoURL,
              seed: player.uid,
              size: 40,
              borderColor: context.c.goldBorder,
              borderWidth: 2,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Wrap(
                    spacing: 5,
                    runSpacing: 4,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      Icon(
                        Icons.emoji_events_rounded,
                        size: 13,
                        color: context.c.goldText,
                      ),
                      const SizedBox(width: 5),
                      Text(
                        'Figura del partido',
                        style: AppTypography.body(
                          size: 12,
                          weight: FontWeight.w600,
                          color: context.c.goldText,
                        ),
                      ),
                      if (votes > 0) ...[
                        Text(
                          '$votes voto${votes > 1 ? "s" : ""}',
                          style: AppTypography.body(
                            size: 12,
                            color: context.c.textSecondary,
                          ),
                        ),
                      ],
                    ],
                  ),
                  const SizedBox(height: 3),
                  Text(
                    player.displayName,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppTypography.headline(
                      size: 15,
                      weight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 5),
                  Text(
                    '$goals goles · $assists asistencias',
                    style: AppTypography.body(
                      size: 12,
                      color: context.c.textSecondary,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// El cuerpo del relato, con capitular y colapso inteligente.
///
/// Flutter no sabe hacer que el texto rodee una letra flotada, así que la
/// capitular va como versal alta: ocupa su propia línea de altura y el resto
/// del párrafo arranca al lado. Es un recurso editorial real, no un parche.
class _Story extends StatefulWidget {
  final String text;

  const _Story({required this.text});

  @override
  State<_Story> createState() => _StoryState();
}

class _StoryState extends State<_Story> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final clean = widget.text.trimLeft();
    final isLong = clean.length > 320;

    final textWidget = Text(
      clean,
      style: AppTypography.body(
        size: 13.5,
        height: 1.6,
        color: context.c.textPrimary.withValues(alpha: 0.9),
      ),
    );

    if (!isLong) {
      return Padding(
        padding: const EdgeInsets.fromLTRB(18, 14, 18, 18),
        child: textWidget,
      );
    }

    return Padding(
      padding: const EdgeInsets.fromLTRB(18, 14, 18, 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          AnimatedCrossFade(
            duration: Duration(
              milliseconds: MediaQuery.disableAnimationsOf(context) ? 0 : 180,
            ),
            crossFadeState: _expanded
                ? CrossFadeState.showSecond
                : CrossFadeState.showFirst,
            firstChild: Text(
              clean,
              maxLines: 4,
              overflow: TextOverflow.ellipsis,
              style: AppTypography.body(
                size: 14,
                height: 1.6,
                color: context.c.textPrimary,
              ),
            ),
            secondChild: textWidget,
          ),
          const SizedBox(height: 6),
          Center(
            child: TextButton.icon(
              onPressed: () => setState(() => _expanded = !_expanded),
              icon: Icon(
                _expanded
                    ? Icons.expand_less_rounded
                    : Icons.expand_more_rounded,
                size: 18,
                color: context.c.primary,
              ),
              label: Text(
                _expanded ? 'Mostrar menos' : 'Leer crónica completa',
                style: AppTypography.action(size: 14, color: context.c.primary),
              ),
              style: TextButton.styleFrom(
                foregroundColor: context.c.primary,
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 6,
                ),
                minimumSize: Size.zero,
                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// La planilla: quién marcó y quién asistió.
///
/// Fondo propio y filas con numeración: es una tabla, no prosa, y tiene que
/// leerse distinto del relato que tiene arriba.
class _Boxscore extends StatelessWidget {
  final List<MatchPlayerTally> scorers;
  final List<MatchPlayerTally> assisters;
  final String Function(String) nameOf;
  final MatchPlayerEntry? Function(String) playerOf;

  const _Boxscore({
    required this.scorers,
    required this.assisters,
    required this.nameOf,
    required this.playerOf,
  });

  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, constraints) {
      final twoColumns =
          constraints.maxWidth >= 320 &&
          MediaQuery.textScalerOf(context).scale(14) <= 20;
      Widget list(List<MatchPlayerTally> values, bool goals) => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            goals ? 'Goles' : 'Asistencias',
            style: AppTypography.body(size: 13, color: context.c.textSecondary),
          ),
          const SizedBox(height: 12),
          for (final value in values)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      nameOf(value.playerId),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: AppTypography.body(
                        size: 13,
                        weight: FontWeight.w500,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    '${goals ? value.goals : value.assists}',
                    style: AppTypography.sportNumber(
                      size: 18,
                      color: context.c.primary,
                    ),
                  ),
                ],
              ),
            ),
        ],
      );
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'La planilla',
              style: AppTypography.headline(size: 17, weight: FontWeight.w600),
            ),
            const SizedBox(height: 16),
            if (twoColumns && scorers.isNotEmpty && assisters.isNotEmpty)
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(child: list(scorers, true)),
                  const SizedBox(width: 24),
                  Expanded(child: list(assisters, false)),
                ],
              )
            else ...[
              if (scorers.isNotEmpty) list(scorers, true),
              if (scorers.isNotEmpty && assisters.isNotEmpty)
                const SizedBox(height: 16),
              if (assisters.isNotEmpty) list(assisters, false),
            ],
          ],
        ),
      );
    },
  );
}

/// Voces del vestuario: recortes que se pasan de costado.
///
/// En la web es un carrusel de tarjetas con una comilla gigante de fondo. Acá
/// va como lista horizontal, que es el gesto equivalente en un teléfono.
class _Voices extends StatelessWidget {
  final List<({String playerName, String quote})> voices;
  final MatchPlayerEntry? Function(String) playerByName;

  const _Voices({required this.voices, required this.playerByName});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(0, 18, 0, 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Row(
              children: [
                Icon(
                  Icons.format_quote_rounded,
                  size: 14,
                  color: context.c.textSecondary,
                ),
                const SizedBox(width: 6),
                Text(
                  'Voces del vestuario',
                  style: AppTypography.code(
                    size: 12,
                    weight: FontWeight.w600,
                    color: context.c.textSecondary,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          SizedBox(
            height: 172,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 20),
              itemCount: voices.length,
              separatorBuilder: (_, index) => const SizedBox(width: 12),
              itemBuilder: (context, index) {
                final v = voices[index];
                return _VoiceCard(
                  quote: v.quote,
                  name: v.playerName,
                  player: playerByName(v.playerName),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _VoiceCard extends StatelessWidget {
  final String quote;
  final String name;
  final MatchPlayerEntry? player;

  const _VoiceCard({
    required this.quote,
    required this.name,
    required this.player,
  });

  @override
  Widget build(BuildContext context) {
    return PateaCard(
      color: context.c.card,
      radius: AppRadii.cardAll,
      borderColor: context.c.border.withValues(alpha: 0.35),
      width: 250,
      clipBehavior: Clip.antiAlias,
      padding: const EdgeInsets.all(16),
      child: Stack(
        children: [
          // La comilla gigante de fondo, girada, como en la web.
          Positioned(
            top: -26,
            right: -14,
            child: Transform.rotate(
              angle: math.pi,
              child: Icon(
                Icons.format_quote_rounded,
                size: 86,
                color: context.c.overlaySubtle,
              ),
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(
                  '“$quote”',
                  maxLines: 5,
                  overflow: TextOverflow.ellipsis,
                  style: AppTypography.editorial(
                    size: 13,
                    italic: true,
                    height: 1.5,
                    color: context.c.textPrimary.withValues(alpha: 0.9),
                  ),
                ),
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  PateaAvatar(
                    photoUrl: player?.photoURL,
                    seed: player?.uid ?? name,
                    size: 28,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          name,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: AppTypography.editorial(
                            size: 12,
                            weight: FontWeight.w700,
                          ),
                        ),
                        if (player != null)
                          Text(
                            player!.position.toUpperCase(),
                            style: AppTypography.code(
                              size: 12,
                              weight: FontWeight.w700,
                              color: context.c.positionColor(player!.position),
                            ),
                          ),
                      ],
                    ),
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// Todavía no hay relato, pero ya se puede pedir.
///
/// No existe el caso "esperá a que todos evalúen": la pantalla de detalle no
/// monta la revista hasta que el partido está evaluado, así que si esto se ve,
/// el botón sirve.
class _CoverPending extends StatelessWidget {
  final bool generating;
  final String? error;
  final VoidCallback onTap;

  const _CoverPending({
    required this.generating,
    required this.error,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(18),
      child: Column(
        children: [
          Row(
            children: [
              PateaCard(
                color: context.c.primary.withValues(alpha: 0.12),
                radius: AppRadii.cardAll,
                padding: const EdgeInsets.all(8),
                child: Icon(
                  Icons.auto_stories_rounded,
                  size: 20,
                  color: context.c.primary,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Crónica del Partido',
                      style: AppTypography.headline(
                        size: 15,
                        weight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      'Relato oficial con IA a partir de goles, asistencias y votos.',
                      style: AppTypography.body(
                        size: 12,
                        color: context.c.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          if (error != null) ...[
            const SizedBox(height: 12),
            Text(
              error!,
              textAlign: TextAlign.center,
              style: AppTypography.body(size: 12, color: context.c.destructive),
            ),
          ],
          const SizedBox(height: 14),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: generating ? null : onTap,
              style: ElevatedButton.styleFrom(
                backgroundColor: context.c.primary,
                foregroundColor: context.c.onPrimary,
                padding: const EdgeInsets.symmetric(vertical: 12),
                shape: RoundedRectangleBorder(borderRadius: AppRadii.cardAll),
              ),
              icon: generating
                  ? SizedBox(
                      width: 15,
                      height: 15,
                      child: const PateaButtonProgress(),
                    )
                  : Icon(Icons.auto_awesome, size: 16),
              label: Text(
                generating ? 'Escribiendo relato…' : 'Generar crónica con IA',
                style: AppTypography.action(size: 15),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
