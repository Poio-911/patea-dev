import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/models/match_model.dart';
import '../../../core/services/match_result_service.dart';
import '../../../core/services/match_service.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/widgets/player_avatar_fallback.dart';

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
    final stats = ref.watch(matchResultStatsProvider(match.id)).value ?? MatchResultStats.empty;
    final chronicle = match.chronicle;

    // El MVP guardado en el partido manda; si el partido es viejo y no lo
    // tiene, se recalcula con los votos.
    final mvpId = match.bestPlayerId ?? stats.mvpId;
    final mvp = mvpId == null ? null : _playerOf(mvpId);

    return _Paper(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (chronicle != null)
            _Masthead(
              headline: chronicle.headline,
              match: match,
            )
          else
            _CoverPending(
              generating: _generating,
              error: _error,
              onTap: _generate,
            ),

          if (mvp != null) _MvpMedallion(player: mvp, votes: stats.mvpVotes),

          if (chronicle != null) _Story(text: chronicle.story),

          if (stats.scorers.isNotEmpty || stats.assisters.isNotEmpty)
            _Boxscore(
              scorers: stats.scorers,
              assisters: stats.assisters,
              nameOf: _nameOf,
              playerOf: _playerOf,
            ),

          if (chronicle != null && chronicle.playerVoices.isNotEmpty)
            _Voices(
              voices: chronicle.playerVoices,
              playerByName: _playerByName,
            ),
        ],
      ),
    );
  }
}

/// Tarjeta contenedora de la crónica con estética dark moderna.
class _Paper extends StatelessWidget {
  final Widget child;

  const _Paper({required this.child});

  @override
  Widget build(BuildContext context) {
    return Container(
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: AppColors.card.withValues(alpha: 0.55),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border.withValues(alpha: 0.35)),
      ),
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
    final hasScore = match.hasFinalScore && match.teamA != null && match.teamB != null;

    return Padding(
      padding: const EdgeInsets.fromLTRB(18, 18, 18, 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: AppColors.voltNeon.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(Icons.auto_stories_rounded, size: 15, color: AppColors.voltNeon),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'CRÓNICA DEL PARTIDO',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTypography.code(
                    size: 9.5,
                    weight: FontWeight.w800,
                    color: AppColors.voltNeon,
                  ).copyWith(letterSpacing: 1.4),
                ),
              ),
              if (hasScore) ...[
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3.5),
                  decoration: BoxDecoration(
                    color: AppColors.cardSurface,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: AppColors.border.withValues(alpha: 0.4)),
                  ),
                  child: Text(
                    '${match.teamA!.score} - ${match.teamB!.score}',
                    style: AppTypography.jersey(size: 15, color: AppColors.textPrimary),
                  ),
                ),
              ],
            ],
          ),
          const SizedBox(height: 12),
          Text(
            '«$headline»',
            style: AppTypography.headline(
              size: 18,
              weight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 12),
          Container(height: 1, color: AppColors.border.withValues(alpha: 0.25)),
        ],
      ),
    );
  }
}
/// La figura del partido en tarjeta dorada moderna.
class _MvpMedallion extends StatelessWidget {
  final MatchPlayerEntry player;
  final int votes;

  const _MvpMedallion({required this.player, required this.votes});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(18, 0, 18, 14),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: AppColors.cardSurface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.goldBorder.withValues(alpha: 0.5)),
        ),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(color: AppColors.goldBorder, width: 2),
              ),
              child: ClipOval(child: _Avatar(player: player)),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Row(
                    children: [
                      Icon(Icons.emoji_events_rounded, size: 13, color: AppColors.goldBorder),
                      const SizedBox(width: 5),
                      Text(
                        'FIGURA DEL PARTIDO',
                        style: AppTypography.code(size: 9, weight: FontWeight.w800, color: AppColors.goldBorder)
                            .copyWith(letterSpacing: 1.3),
                      ),
                      if (votes > 0) ...[
                        const Spacer(),
                        Text(
                          '$votes voto${votes > 1 ? "s" : ""}',
                          style: AppTypography.code(size: 9, color: AppColors.textMuted),
                        ),
                      ],
                    ],
                  ),
                  const SizedBox(height: 3),
                  Text(
                    player.displayName.toUpperCase(),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppTypography.condensed(size: 15, weight: FontWeight.w700),
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
        color: AppColors.textPrimary.withValues(alpha: 0.9),
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
            duration: const Duration(milliseconds: 250),
            crossFadeState: _expanded
                ? CrossFadeState.showSecond
                : CrossFadeState.showFirst,
            firstChild: Stack(
              children: [
                ConstrainedBox(
                  constraints: const BoxConstraints(maxHeight: 160),
                  child: ClipRect(child: textWidget),
                ),
                Positioned(
                  left: 0,
                  right: 0,
                  bottom: 0,
                  height: 65,
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [
                          AppColors.card.withValues(alpha: 0.0),
                          AppColors.card.withValues(alpha: 0.95),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ),
            secondChild: textWidget,
          ),
          const SizedBox(height: 6),
          Center(
            child: TextButton.icon(
              onPressed: () => setState(() => _expanded = !_expanded),
              icon: Icon(
                _expanded ? Icons.expand_less_rounded : Icons.expand_more_rounded,
                size: 18,
                color: AppColors.voltNeon,
              ),
              label: Text(
                _expanded ? 'MOSTRAR MENOS' : 'LEER CRÓNICA COMPLETA',
                style: AppTypography.code(
                  size: 10,
                  weight: FontWeight.w800,
                  color: AppColors.voltNeon,
                ).copyWith(letterSpacing: 1.4),
              ),
              style: TextButton.styleFrom(
                foregroundColor: AppColors.voltNeon,
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
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
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 18),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.28),
        border: Border(
          top: BorderSide(color: AppColors.border.withValues(alpha: 0.30)),
          bottom: BorderSide(color: AppColors.border.withValues(alpha: 0.30)),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'LA PLANILLA',
            style: AppTypography.code(
                size: 9, weight: FontWeight.w700, color: AppColors.textMuted)
                .copyWith(letterSpacing: 3),
          ),
          // Dos listas separadas y no una sola: quien marcó y asistió aparece
          // en las dos, y sin el encabezado se lee como una fila repetida.
          if (scorers.isNotEmpty) ...[
            const SizedBox(height: 12),
            _TallyHeader(
                icon: Icons.sports_soccer_rounded,
                text: 'GOLES',
                color: AppColors.voltNeon),
            const SizedBox(height: 8),
            for (final t in scorers)
              _TallyLine(
                icon: Icons.sports_soccer_rounded,
                player: playerOf(t.playerId),
                name: nameOf(t.playerId),
                count: t.goals,
                color: AppColors.voltNeon,
              ),
          ],
          if (assisters.isNotEmpty) ...[
            const SizedBox(height: 6),
            _TallyHeader(
                icon: Icons.compare_arrows_rounded,
                text: 'ASISTENCIAS',
                color: AppColors.info),
            const SizedBox(height: 8),
            for (final t in assisters)
              _TallyLine(
                icon: Icons.compare_arrows_rounded,
                player: playerOf(t.playerId),
                name: nameOf(t.playerId),
                count: t.assists,
                color: AppColors.info,
              ),
          ],
        ],
      ),
    );
  }
}

class _TallyHeader extends StatelessWidget {
  final IconData icon;
  final String text;
  final Color color;

  const _TallyHeader({required this.icon, required this.text, required this.color});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 12, color: color),
        const SizedBox(width: 6),
        Text(text,
            style: AppTypography.condensed(
                size: 12, weight: FontWeight.w700, color: color, letterSpacing: 1.4)),
      ],
    );
  }
}

class _TallyLine extends StatelessWidget {
  final IconData icon;
  final MatchPlayerEntry? player;
  final String name;
  final int count;
  final Color color;

  const _TallyLine({
    required this.icon,
    required this.player,
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
          SizedBox(
            width: 28,
            height: 28,
            child: ClipOval(child: _Avatar(player: player, seed: name)),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              name,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppTypography.condensed(size: 15, weight: FontWeight.w600),
            ),
          ),
          Icon(icon, size: 14, color: color),
          const SizedBox(width: 6),
          SizedBox(
            width: 18,
            child: Text(
              '$count',
              textAlign: TextAlign.right,
              style: AppTypography.code(
                  size: 13, weight: FontWeight.w800, color: color),
            ),
          ),
        ],
      ),
    );
  }
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
                Icon(Icons.format_quote_rounded, size: 14, color: AppColors.textMuted),
                const SizedBox(width: 6),
                Text(
                  'VOCES DEL VESTUARIO',
                  style: AppTypography.code(
                      size: 9, weight: FontWeight.w700, color: AppColors.textMuted)
                      .copyWith(letterSpacing: 3),
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

  const _VoiceCard({required this.quote, required this.name, required this.player});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 250,
      clipBehavior: Clip.antiAlias,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.card.withValues(alpha: 0.75),
        borderRadius: AppRadii.cardAll,
        border: Border.all(color: AppColors.border.withValues(alpha: 0.35)),
      ),
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
                color: Colors.white.withValues(alpha: 0.045),
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
                    color: AppColors.textPrimary.withValues(alpha: 0.9),
                  ),
                ),
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  SizedBox(
                    width: 28,
                    height: 28,
                    child: ClipOval(child: _Avatar(player: player, seed: name)),
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
                              size: 12, weight: FontWeight.w700),
                        ),
                        if (player != null)
                          Text(
                            player!.position.toUpperCase(),
                            style: AppTypography.code(
                                size: 8,
                                weight: FontWeight.w700,
                                color: AppColors.getPositionColor(player!.position))
                                .copyWith(letterSpacing: 1.2),
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
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: AppColors.voltNeon.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(Icons.auto_stories_rounded, size: 20, color: AppColors.voltNeon),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Crónica del Partido', style: AppTypography.headline(size: 15, weight: FontWeight.w800)),
                    const SizedBox(height: 3),
                    Text(
                      'Relato oficial con IA a partir de goles, asistencias y votos.',
                      style: AppTypography.body(size: 12, color: AppColors.textMuted),
                    ),
                  ],
                ),
              ),
            ],
          ),
          if (error != null) ...[
            const SizedBox(height: 12),
            Text(error!,
                textAlign: TextAlign.center,
                style: AppTypography.body(size: 11, color: AppColors.destructive)),
          ],
          const SizedBox(height: 14),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: generating ? null : onTap,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.voltNeon,
                foregroundColor: Colors.black,
                padding: const EdgeInsets.symmetric(vertical: 12),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
              icon: generating
                  ? const SizedBox(
                      width: 15,
                      height: 15,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.black),
                    )
                  : const Icon(Icons.auto_awesome, size: 16, color: Colors.black),
              label: Text(
                generating ? 'ESCRIBIENDO RELATO...' : 'GENERAR CRÓNICA CON IA',
                style: AppTypography.jersey(size: 14, color: Colors.black, letterSpacing: 1),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Foto del jugador, o el muñeco generado si no tiene.
class _Avatar extends StatelessWidget {
  final MatchPlayerEntry? player;
  final String? seed;

  const _Avatar({required this.player, this.seed});

  @override
  Widget build(BuildContext context) {
    final url = player?.photoURL;
    final fallbackSeed = player?.uid ?? seed ?? '?';
    if (url == null || url.isEmpty) {
      return PlayerAvatarFallback(seed: fallbackSeed);
    }
    return Image.network(
      url,
      fit: BoxFit.cover,
      errorBuilder: (_, error, stack) => PlayerAvatarFallback(seed: fallbackSeed),
    );
  }
}
