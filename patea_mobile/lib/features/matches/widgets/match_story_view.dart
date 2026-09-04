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

/// La hoja de la revista: fondo propio y textura de puntos.
///
/// La textura es lo que la separa de una tarjeta cualquiera. En la web es un
/// SVG repetido al 3-5% de opacidad; acá se pinta con un CustomPainter, que
/// sale más barato que un asset.
class _Paper extends StatelessWidget {
  final Widget child;

  const _Paper({required this.child});

  @override
  Widget build(BuildContext context) {
    return Container(
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: const Color(0xFF10141C).withValues(alpha: 0.92),
        borderRadius: AppRadii.surfaceAll,
        border: Border.all(color: AppColors.border.withValues(alpha: 0.30)),
      ),
      child: Stack(
        children: [
          Positioned.fill(
            child: IgnorePointer(
              child: CustomPaint(painter: _NewsprintPainter()),
            ),
          ),
          child,
        ],
      ),
    );
  }
}

class _NewsprintPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..color = Colors.white.withValues(alpha: 0.035);
    const step = 9.0;
    for (double y = 3; y < size.height; y += step) {
      for (double x = 3; x < size.width; x += step) {
        canvas.drawCircle(Offset(x, y), 0.9, paint);
      }
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

/// Cabecera: volanta, titular entre comillas, filete ornamental y marcador.
class _Masthead extends StatelessWidget {
  final String headline;
  final MatchModel match;

  const _Masthead({required this.headline, required this.match});

  @override
  Widget build(BuildContext context) {
    final hasScore = match.hasFinalScore && match.teamA != null && match.teamB != null;

    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 26, 20, 18),
      child: Column(
        children: [
          Text(
            'LA CRÓNICA',
            style: AppTypography.code(
                size: 9, weight: FontWeight.w700, color: AppColors.textMuted)
                .copyWith(letterSpacing: 3),
          ),
          const SizedBox(height: 14),
          Text(
            '«$headline»',
            textAlign: TextAlign.center,
            style: AppTypography.editorial(
              size: 26,
              weight: FontWeight.w700,
              height: 1.2,
            ),
          ),
          const SizedBox(height: 18),
          const _Ornament(),
          if (hasScore) ...[
            const SizedBox(height: 20),
            Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Expanded(
                  child: Text(
                    match.teamA!.name.toUpperCase(),
                    textAlign: TextAlign.right,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: AppTypography.editorial(
                        size: 12,
                        weight: FontWeight.w700,
                        color: AppColors.textSecondary)
                        .copyWith(letterSpacing: 1.4),
                  ),
                ),
                // Marcador en negativo: el único bloque claro de la pantalla.
                // Es el remate de la cabecera y tiene que ganarle al titular.
                Container(
                  margin: const EdgeInsets.symmetric(horizontal: 14),
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 7),
                  decoration: BoxDecoration(
                    color: AppColors.textPrimary,
                    borderRadius: AppRadii.cardAll,
                  ),
                  child: Text(
                    '${match.teamA!.score} - ${match.teamB!.score}',
                    style: AppTypography.editorial(
                        size: 28,
                        weight: FontWeight.w700,
                        color: const Color(0xFF10141C)),
                  ),
                ),
                Expanded(
                  child: Text(
                    match.teamB!.name.toUpperCase(),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: AppTypography.editorial(
                        size: 12,
                        weight: FontWeight.w700,
                        color: AppColors.textSecondary)
                        .copyWith(letterSpacing: 1.4),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

/// Filete: raya, rombo, raya. El separador de la web.
class _Ornament extends StatelessWidget {
  const _Ornament();

  @override
  Widget build(BuildContext context) {
    final color = AppColors.textMuted.withValues(alpha: 0.55);
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Container(width: 46, height: 1, color: color),
        Container(
          width: 6,
          height: 6,
          margin: const EdgeInsets.symmetric(horizontal: 10),
          transform: Matrix4.rotationZ(math.pi / 4),
          transformAlignment: Alignment.center,
          color: color,
        ),
        Container(width: 46, height: 1, color: color),
      ],
    );
  }
}

/// La figura, como medalla colgada del borde entre la cabecera y el cuerpo.
///
/// En la web es una píldora suspendida con margen negativo: pisa las dos
/// secciones y por eso se lee como un sello y no como una fila más.
class _MvpMedallion extends StatelessWidget {
  final MatchPlayerEntry player;
  final int votes;

  const _MvpMedallion({required this.player, required this.votes});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Flexible(
            child: Container(
              padding: const EdgeInsets.fromLTRB(5, 5, 16, 5),
              decoration: BoxDecoration(
                color: AppColors.card,
                borderRadius: BorderRadius.circular(999),
                border: Border.all(color: AppColors.goldBorder.withValues(alpha: 0.55)),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 38,
                    height: 38,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      border: Border.all(color: AppColors.goldBorder, width: 2),
                    ),
                    child: ClipOval(child: _Avatar(player: player)),
                  ),
                  const SizedBox(width: 10),
                  Flexible(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.emoji_events_rounded,
                                size: 11, color: AppColors.goldBorder),
                            const SizedBox(width: 4),
                            Text(
                              'FIGURA DEL PARTIDO',
                              style: AppTypography.code(
                                  size: 8,
                                  weight: FontWeight.w700,
                                  color: AppColors.goldBorder)
                                  .copyWith(letterSpacing: 1.4),
                            ),
                          ],
                        ),
                        const SizedBox(height: 2),
                        Text(
                          player.displayName,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: AppTypography.editorial(
                              size: 14, weight: FontWeight.w700),
                        ),
                        if (votes > 0)
                          Text(
                            votes == 1 ? '1 voto' : '$votes votos',
                            style: AppTypography.body(
                                size: 10, color: AppColors.textMuted),
                          ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// El cuerpo del relato, con capitular.
///
/// Flutter no sabe hacer que el texto rodee una letra flotada, así que la
/// capitular va como versal alta: ocupa su propia línea de altura y el resto
/// del párrafo arranca al lado. Es un recurso editorial real, no un parche.
class _Story extends StatelessWidget {
  final String text;

  const _Story({required this.text});

  @override
  Widget build(BuildContext context) {
    final clean = text.trimLeft();
    final initial = clean.isEmpty ? '' : clean.substring(0, 1);
    final rest = clean.isEmpty ? '' : clean.substring(1);

    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 18, 20, 24),
      child: Text.rich(
        TextSpan(
          children: [
            WidgetSpan(
              alignment: PlaceholderAlignment.baseline,
              baseline: TextBaseline.alphabetic,
              child: Padding(
                padding: const EdgeInsets.only(right: 6),
                child: Text(
                  initial,
                  style: AppTypography.editorial(
                      size: 44, weight: FontWeight.w700, height: 0.82),
                ),
              ),
            ),
            TextSpan(text: rest),
          ],
        ),
        style: AppTypography.editorial(
          size: 15,
          color: AppColors.textPrimary.withValues(alpha: 0.88),
          height: 1.72,
        ),
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
      padding: const EdgeInsets.fromLTRB(24, 28, 24, 26),
      child: Column(
        children: [
          Container(
            width: 54,
            height: 54,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: AppColors.voltNeon.withValues(alpha: 0.12),
              border: Border.all(color: AppColors.voltNeon.withValues(alpha: 0.3)),
            ),
            child: Icon(Icons.auto_stories_rounded,
                size: 24, color: AppColors.voltNeon),
          ),
          const SizedBox(height: 16),
          Text(
            'La historia del partido',
            textAlign: TextAlign.center,
            style: AppTypography.editorial(size: 21, weight: FontWeight.w700),
          ),
          const SizedBox(height: 10),
          const _Ornament(),
          const SizedBox(height: 14),
          Text(
            'Un cronista escribe la historia con los goles, las etiquetas de '
            'rendimiento y lo que contó cada uno.',
            textAlign: TextAlign.center,
            style: AppTypography.body(
                size: 12.5, color: AppColors.textSecondary, height: 1.5),
          ),
          const SizedBox(height: 18),
            FilledButton.icon(
              onPressed: generating ? null : onTap,
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.voltNeon,
                foregroundColor: AppColors.background,
                padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 13),
                shape: const RoundedRectangleBorder(borderRadius: AppRadii.cardAll),
              ),
              icon: generating
                  ? const SizedBox(
                      width: 15,
                      height: 15,
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: AppColors.background))
                  : const Icon(Icons.auto_stories_rounded, size: 17),
              label: Text(
                generating ? 'Escribiendo…' : 'Publicar la crónica',
                style: AppTypography.editorial(
                    size: 14, weight: FontWeight.w700, color: AppColors.background),
              ),
            ),
          if (error != null) ...[
            const SizedBox(height: 12),
            Text(error!,
                textAlign: TextAlign.center,
                style: AppTypography.body(size: 11, color: AppColors.destructive)),
          ],
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
