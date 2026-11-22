
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:share_plus/share_plus.dart';

import '../../core/models/player_model.dart';
import '../../core/services/auth_service.dart';
import '../../core/services/firestore_service.dart';
import '../../core/theme/app_insets.dart';
import '../../core/theme/app_radii.dart';
import '../../core/theme/app_typography.dart';
import '../../core/theme/patea_colors.dart';
import '../../core/widgets/ovr_accent.dart';
import '../../core/utils/photo_url.dart';
import '../../core/utils/player_attribute_highlight.dart';
import '../../core/widgets/cropped_photo.dart';
import '../../core/widgets/ovr_progression_chart.dart';
import '../../core/widgets/patea_card.dart';
import '../../core/widgets/patea_states.dart';
import '../../core/widgets/patea_tabs.dart';
import '../../core/widgets/player_avatar_fallback.dart';
import 'widgets/player_match_debrief.dart';
import 'widgets/player_teams_list.dart';
import 'create_player_dialog.dart';
import 'manual_player_recovery.dart';
import '../../core/services/player_service.dart';
import '../../core/widgets/patea_snack.dart';

/// Vista unificada de `/players/:id` y `/profile`.
///
/// Adopta la estética de la nueva ficha de plantel (`PlayerCardWidget`) en
/// portada edge-to-edge: retrato con degradado de cinco paradas, línea en
/// `ratingAccent` con punto final, `OVR` inclinado, nombre y seis atributos
/// limpios, seguidos por la banda de carrera y `PateaTabs`.
class PlayerDetailScreen extends ConsumerStatefulWidget {
  final String playerId;

  /// Cuando es true corresponde a `/profile`.
  final bool asOwnProfile;

  const PlayerDetailScreen({
    super.key,
    required this.playerId,
    this.asOwnProfile = false,
  });

  @override
  ConsumerState<PlayerDetailScreen> createState() => _PlayerDetailScreenState();
}

class _PlayerDetailScreenState extends ConsumerState<PlayerDetailScreen> {
  int _activeTab = 0;

  Future<void> _removeManual(PlayerModel player) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('¿Quitar del plantel?'),
        content: Text(
          '${player.name} dejará de aparecer en el plantel. Sus partidos y evaluaciones anteriores se conservan. Si tiene partidos pendientes, primero quitá su convocatoria.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancelar'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Quitar jugador'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    try {
      await ref.read(playerServiceProvider).deleteManualPlayer(player.id);
      if (!mounted) return;
      PateaSnack.ok(context, 'Jugador quitado del plantel');
      context.go('/players');
    } catch (e) {
      if (mounted) PateaSnack.error(context, 'No se pudo quitar: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    final playerAsync = ref.watch(singlePlayerStreamProvider(widget.playerId));
    final currentUid = ref.watch(authServiceProvider).currentUser?.uid;

    return Scaffold(
      backgroundColor: Colors.transparent,
      body: playerAsync.when(
        loading: () => const PateaLoading(),
        error: (err, _) => PateaError(
          error: err,
          message: 'No pudimos cargar el perfil del jugador.',
          onRetry: () =>
              ref.invalidate(singlePlayerStreamProvider(widget.playerId)),
        ),
        data: (player) {
          if (player == null)
            return _NotFound(asOwnProfile: widget.asOwnProfile);

          final isOwnProfile = currentUid == player.id;
          final hasOwnAccount = player.hasAccount;
          final showProgression =
              hasOwnAccount || player.stats.matchesPlayed > 0;
          final tabs = [
            const PateaTab('Partidos'),
            if (showProgression) const PateaTab('Progresión'),
            const PateaTab('Bio y Equipos'),
          ];
          final safeTab = _activeTab.clamp(0, tabs.length - 1);

          return ListView(
            padding: EdgeInsets.only(bottom: bottomInset(context)),
            children: [
              _HeroCardHeader(
                player: player,
                isOwnProfile: isOwnProfile && hasOwnAccount,
                asOwnProfile: widget.asOwnProfile,
              ),
              if (player.isManual &&
                  !player.archived &&
                  player.ownerUid == currentUid)
                Padding(
                  padding: const EdgeInsets.fromLTRB(18, 0, 18, 18),
                  child: Row(
                    children: [
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: () => showDialog<bool>(
                            context: context,
                            builder: (_) => CreatePlayerDialog(player: player),
                          ),
                          icon: const Icon(Icons.edit_outlined, size: 18),
                          label: const Text('Editar jugador'),
                        ),
                      ),
                      const SizedBox(width: 8),
                      IconButton(
                        tooltip: 'Quitar del plantel',
                        onPressed: () => _removeManual(player),
                        icon: const Icon(Icons.person_remove_outlined),
                      ),
                    ],
                  ),
                ),
              if (isOwnProfile &&
                  ref.watch(hasManualPlayerClaimProvider).asData?.value == true)
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 18),
                  child: TextButton.icon(
                    onPressed: () => showManualPlayerRecovery(context),
                    icon: const Icon(Icons.manage_history, size: 18),
                    label: const Text('Vincular historial anterior'),
                  ),
                ),
              Padding(
                padding: const EdgeInsets.fromLTRB(18, 6, 18, 0),
                child: _CareerStatsBand(player: player),
              ),
              const SizedBox(height: 16),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 18),
                child: PateaTabs(
                  tabs: tabs,
                  active: safeTab,
                  onChanged: (i) => setState(() => _activeTab = i),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(18, 16, 18, 0),
                child: _buildTabContent(
                  context,
                  player: player,
                  tabIndex: safeTab,
                  showProgression: showProgression,
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _buildTabContent(
    BuildContext context, {
    required PlayerModel player,
    required int tabIndex,
    required bool showProgression,
  }) {
    if (tabIndex == 0) {
      return PlayerMatchDebrief(playerId: widget.playerId);
    }
    if (showProgression && tabIndex == 1) {
      return _ProgressionTab(player: player);
    }
    return _BioAndTeamsTab(player: player);
  }
}

class _HeroCardHeader extends StatelessWidget {
  final PlayerModel player;
  final bool isOwnProfile;
  final bool asOwnProfile;

  const _HeroCardHeader({
    required this.player,
    required this.isOwnProfile,
    required this.asOwnProfile,
  });

  List<({String label, int value})> _attributesFor(PlayerModel p) {
    if (p.position.toUpperCase() == 'POR') {
      return [
        (label: 'EST', value: p.def),
        (label: 'REF', value: p.dri),
        (label: 'PAR', value: p.sho),
        (label: 'VEL', value: p.pac),
        (label: 'SAQ', value: p.pas),
        (label: 'POS', value: p.phy),
      ];
    }
    return [
      (label: 'RIT', value: p.pac),
      (label: 'TIR', value: p.sho),
      (label: 'PAS', value: p.pas),
      (label: 'REG', value: p.dri),
      (label: 'DEF', value: p.def),
      (label: 'FIS', value: p.phy),
    ];
  }

  String _metaLine(PlayerModel p) {
    final parts = <String>[];
    if (p.nationality != null && p.nationality!.trim().isNotEmpty) {
      parts.add(p.nationality!.trim());
    }
    if (p.birthYear != null) {
      final age = DateTime.now().year - p.birthYear!;
      if (age > 0 && age < 100) parts.add('$age años');
    }
    if (p.preferredFoot != null && p.preferredFoot!.trim().isNotEmpty) {
      parts.add('Pie ${p.preferredFoot!.trim()}');
    }
    return parts.join(' · ');
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final topInset = MediaQuery.paddingOf(context).top;
    final posColor = c.positionColor(player.position);
    final attrs = _attributesFor(player);
    final bestKey = playerAttributeHighlight(player);
    final attributeKeys = player.position.toUpperCase() == 'POR'
        ? const ['DEF', 'DRI', 'SHO', 'PAC', 'PAS', 'PHY']
        : const ['PAC', 'SHO', 'PAS', 'DRI', 'DEF', 'PHY'];
    final meta = _metaLine(player);

    return Stack(
      children: [
        // Retrato full-bleed con gradiente de 5 paradas hacia el fondo
        Positioned(
          top: 0,
          left: 0,
          right: 0,
          height: 360 + topInset,
          child: Stack(
            fit: StackFit.expand,
            children: [
              ColoredBox(color: c.cardSurface),
              _HeroPhoto(player: player),
              DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    stops: const [0, 0.22, 0.42, 0.70, 1],
                    colors: [
                      c.background.withValues(alpha: 0.25),
                      c.background.withValues(alpha: 0),
                      c.background.withValues(alpha: 0.28),
                      c.background.withValues(alpha: 0.88),
                      c.background,
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),

        // Contenido fluido (crece naturalmente con nombres largos o escala 1,3×)
        Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: EdgeInsets.fromLTRB(14, topInset + 8, 14, 0),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  _OverlayCircleButton(
                    icon: Icons.arrow_back,
                    tooltip: 'Volver',
                    onTap: () {
                      if (context.canPop()) {
                        context.pop();
                      } else {
                        context.go(asOwnProfile ? '/' : '/players');
                      }
                    },
                  ),
                  _OverlayCircleButton(
                    icon: Icons.share_outlined,
                    tooltip: 'Compartir perfil',
                    onTap: () => SharePlus.instance.share(
                      ShareParams(
                        text:
                            'Mirá el perfil de ${player.name} en Pateá — OVR ${player.ovr}',
                      ),
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 150),

            Padding(
              padding: const EdgeInsets.fromLTRB(18, 0, 18, 14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Padding(
                        padding: const EdgeInsets.only(bottom: 4),
                        child: Text.rich(
                          TextSpan(
                            text: player.position.toUpperCase(),
                            style: AppTypography.body(
                              size: 16,
                              height: 1.2,
                              weight: FontWeight.w700,
                              color: posColor,
                            ),
                            children: [
                              if (player.isManual)
                                TextSpan(
                                  text: ' · Sin cuenta',
                                  style: AppTypography.code(
                                    size: 12,
                                    color: c.textSecondary,
                                  ),
                                ),
                            ],
                          ),
                        ),
                      ),
                      Expanded(
                        child: Padding(
                          padding: const EdgeInsets.fromLTRB(10, 0, 10, 9),
                          child: SizedBox(
                            height: 1,
                            child: Stack(
                              clipBehavior: Clip.none,
                              children: [
                                Positioned.fill(
                                  child: ColoredBox(
                                    color: c.ratingAccent.withValues(
                                      alpha: 0.7,
                                    ),
                                  ),
                                ),
                                Positioned(
                                  right: -1,
                                  top: -1.5,
                                  child: Container(
                                    width: 4,
                                    height: 4,
                                    decoration: BoxDecoration(
                                      color: c.ratingAccent,
                                      shape: BoxShape.circle,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                      Column(
                        mainAxisSize: MainAxisSize.min,
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Text(
                            'OVR',
                            style: AppTypography.body(
                              size: 12,
                              height: 1.2,
                              color: c.textSecondary,
                            ),
                          ),
                          // Misma escala de color y categoría que la carta del jugador.
                          if (ovrCategory(player.ovr).isNotEmpty)
                            Text(
                              ovrCategory(player.ovr),
                              style: AppTypography.body(
                                size: 12,
                                height: 1.2,
                                weight: FontWeight.w700,
                                color: ovrAccentColor(c, player.ovr),
                              ),
                            ),
                          Transform(
                            transform: Matrix4.identity()
                              ..setEntry(0, 1, -0.12),
                            child: OvrPrismNumber(
                              ovr: player.ovr,
                              seed: player.id,
                              style:
                                  AppTypography.sportNumber(
                                    size: 52,
                                    color: ovrAccentColor(c, player.ovr),
                                  ).copyWith(
                                    height: 0.95,
                                    fontWeight: FontWeight.w700,
                                  ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(
                    player.name,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: AppTypography.headline(
                      size: 24,
                      weight: FontWeight.w600,
                      color: c.textPrimary,
                    ).copyWith(height: 1.15, letterSpacing: 0),
                  ),
                  if (meta.isNotEmpty) ...[
                    const SizedBox(height: 4),
                    Text(
                      meta,
                      style: AppTypography.body(
                        size: 12,
                        color: c.textSecondary,
                      ),
                    ),
                  ],
                  if (isOwnProfile) ...[
                    const SizedBox(height: 12),
                    Align(
                      alignment: Alignment.centerLeft,
                      child: OutlinedButton.icon(
                        onPressed: () => context.push('/profile/edit'),
                        style: OutlinedButton.styleFrom(
                          backgroundColor: c.cardSurface,
                          foregroundColor: c.textPrimary,
                          side: BorderSide(
                            color: c.primary.withValues(alpha: 0.45),
                          ),
                          shape: const RoundedRectangleBorder(
                            borderRadius: AppRadii.chipAll,
                          ),
                          padding: const EdgeInsets.symmetric(
                            horizontal: 14,
                            vertical: 10,
                          ),
                          minimumSize: const Size(0, 44),
                        ),
                        icon: Icon(
                          Icons.edit_outlined,
                          size: 16,
                          color: c.primary,
                        ),
                        label: Text(
                          'Editar perfil',
                          style: AppTypography.action(color: c.textPrimary),
                        ),
                      ),
                    ),
                  ],
                  const SizedBox(height: 12),
                  Divider(height: 1, thickness: 1, color: c.overlayLine),
                  const SizedBox(height: 12),
                  for (var r = 0; r < 3; r++) ...[
                    if (r > 0) const SizedBox(height: 6),
                    Row(
                      children: [
                        Expanded(
                          child: _AttributeLine(
                            label: attrs[r * 2].label,
                            value: attrs[r * 2].value,
                            isMax: attributeKeys[r * 2] == bestKey,
                          ),
                        ),
                        const SizedBox(width: 24),
                        Expanded(
                          child: _AttributeLine(
                            label: attrs[r * 2 + 1].label,
                            value: attrs[r * 2 + 1].value,
                            isMax: attributeKeys[r * 2 + 1] == bestKey,
                          ),
                        ),
                      ],
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _HeroPhoto extends StatelessWidget {
  final PlayerModel player;

  const _HeroPhoto({required this.player});

  @override
  Widget build(BuildContext context) {
    final fallback = PlayerAvatarFallback(
      seed: player.id.isEmpty ? player.name : player.id,
    );
    final url = nonEmptyPhotoUrl(player.photoUrl);
    if (url == null) return fallback;

    return LayoutBuilder(
      builder: (context, constraints) {
        final width =
            (constraints.maxWidth * MediaQuery.devicePixelRatioOf(context))
                .round()
                .clamp(240, 1200);
        return CroppedPhoto(
          cropX: player.cropX,
          cropY: player.cropY,
          cropZoom: player.cropZoom,
          child: CachedNetworkImage(
            imageUrl: url,
            fit: BoxFit.cover,
            alignment: Alignment.topCenter,
            memCacheWidth: width,
            maxWidthDiskCache: 800,
            placeholder: (_, _) => fallback,
            errorWidget: (_, _, _) => fallback,
          ),
        );
      },
    );
  }
}

class _OverlayCircleButton extends StatelessWidget {
  final IconData icon;
  final String tooltip;
  final VoidCallback onTap;

  const _OverlayCircleButton({
    required this.icon,
    required this.tooltip,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Semantics(
      button: true,
      label: tooltip,
      child: Material(
        color: c.isDarkSurface
            ? c.photoFallback.withValues(alpha: 0.72)
            : c.card.withValues(alpha: 0.90),
        shape: CircleBorder(side: BorderSide(color: c.overlayLine)),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: SizedBox(
            width: 44,
            height: 44,
            child: Icon(icon, size: 20, color: c.textPrimary),
          ),
        ),
      ),
    );
  }
}

class _AttributeLine extends StatelessWidget {
  final String label;
  final int value;
  final bool isMax;

  const _AttributeLine({
    required this.label,
    required this.value,
    required this.isMax,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Row(
      children: [
        Expanded(
          child: Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: AppTypography.body(
              size: 13,
              height: 1.2,
              weight: isMax ? FontWeight.w600 : FontWeight.w400,
              color: isMax ? c.ratingAccent : c.textSecondary,
            ),
          ),
        ),
        const SizedBox(width: 6),
        Text(
          '$value',
          style: AppTypography.body(
            size: 15,
            height: 1.2,
            weight: FontWeight.w600,
            color: isMax ? c.ratingAccent : c.textPrimary,
          ),
        ),
      ],
    );
  }
}

class _CareerStatsBand extends StatelessWidget {
  final PlayerModel player;

  const _CareerStatsBand({required this.player});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12),
      decoration: BoxDecoration(
        border: Border.symmetric(horizontal: BorderSide(color: c.border)),
      ),
      child: Row(
        children: [
          _StatColumn('PJ', '${player.stats.matchesPlayed}'),
          _BandDivider(color: c.border),
          _StatColumn('Goles', '${player.stats.goals}'),
          _BandDivider(color: c.border),
          _StatColumn('Asist.', '${player.stats.assists}'),
          _BandDivider(color: c.border),
          _StatColumn(
            'Rating',
            player.stats.averageRating.toStringAsFixed(1),
            accent: c.ratingAccent,
          ),
        ],
      ),
    );
  }
}

class _StatColumn extends StatelessWidget {
  final String label;
  final String value;
  final Color? accent;

  const _StatColumn(this.label, this.value, {this.accent});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Expanded(
      child: Column(
        children: [
          Text(
            value,
            style: AppTypography.sportNumber(
              size: 20,
              color: accent ?? c.textPrimary,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: AppTypography.code(
              size: 12,
              color: c.textSecondary,
              weight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

class _BandDivider extends StatelessWidget {
  final Color color;

  const _BandDivider({required this.color});

  @override
  Widget build(BuildContext context) =>
      Container(width: 1, height: 24, color: color);
}

class _ProgressionTab extends ConsumerWidget {
  final PlayerModel player;

  const _ProgressionTab({required this.player});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.c;
    final historyAsync = ref.watch(ovrHistoryStreamProvider(player.id));

    return PateaCard(
      color: c.card,
      radius: AppRadii.surfaceAll,
      borderColor: c.border,
      padding: const EdgeInsets.all(16),
      child: historyAsync.when(
        loading: () => const PateaLoading(height: 180),
        error: (err, _) => PateaError(
          error: err,
          message: 'No se pudo cargar la progresión.',
          compact: true,
        ),
        data: (history) =>
            OvrProgressionChart(player: player, history: history, height: 220),
      ),
    );
  }
}

class _BioAndTeamsTab extends StatelessWidget {
  final PlayerModel player;

  const _BioAndTeamsTab({required this.player});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final hasBio = player.bio != null && player.bio!.trim().isNotEmpty;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (hasBio ||
            player.nationality != null ||
            player.preferredFoot != null ||
            player.birthYear != null) ...[
          PateaCard(
            color: c.card,
            radius: AppRadii.cardAll,
            borderColor: c.border,
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Ficha personal',
                  style: AppTypography.headline(
                    size: 13,
                    weight: FontWeight.w700,
                  ),
                ),
                if (hasBio) ...[
                  const SizedBox(height: 8),
                  Text(
                    player.bio!.trim(),
                    style: AppTypography.body(size: 13, color: c.textPrimary),
                  ),
                ],
                const SizedBox(height: 10),
                Wrap(
                  spacing: 12,
                  runSpacing: 6,
                  children: [
                    if (player.nationality != null &&
                        player.nationality!.trim().isNotEmpty)
                      Text(
                        'Nacionalidad: ${player.nationality!.trim()}',
                        style: AppTypography.body(
                          size: 12,
                          color: c.textSecondary,
                        ),
                      ),
                    if (player.preferredFoot != null &&
                        player.preferredFoot!.trim().isNotEmpty)
                      Text(
                        'Pie hábil: ${player.preferredFoot!.trim()}',
                        style: AppTypography.body(
                          size: 12,
                          color: c.textSecondary,
                        ),
                      ),
                    if (player.birthYear != null)
                      Text(
                        'Nacimiento: ${player.birthYear}',
                        style: AppTypography.body(
                          size: 12,
                          color: c.textSecondary,
                        ),
                      ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
        ],
        PlayerTeamsList(playerId: player.id, groupId: player.groupId),
      ],
    );
  }
}

class _NotFound extends StatelessWidget {
  final bool asOwnProfile;

  const _NotFound({required this.asOwnProfile});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.person_off_outlined,
              size: 44,
              color: context.c.textSecondary.withValues(alpha: 0.4),
            ),
            const SizedBox(height: 14),
            Text(
              asOwnProfile
                  ? 'Todavía no tenés un perfil de jugador.'
                  : 'Jugador no encontrado.',
              textAlign: TextAlign.center,
              style: AppTypography.headline(size: 15, weight: FontWeight.w700),
            ),
            const SizedBox(height: 8),
            Text(
              asOwnProfile
                  ? 'Tu cuenta quedó incompleta. Cerrá sesión y volvé a entrar: '
                        'se repara sola.'
                  : 'Puede haber sido eliminado del plantel.',
              textAlign: TextAlign.center,
              style: AppTypography.body(
                size: 12,
                color: context.c.textSecondary,
              ),
            ),
            const SizedBox(height: 20),
            OutlinedButton.icon(
              onPressed: () => context.go(asOwnProfile ? '/' : '/players'),
              icon: const Icon(Icons.arrow_back, size: 16),
              label: Text(
                asOwnProfile ? 'Volver al Panel' : 'Volver al Plantel',
              ),
            ),
          ],
        ),
      ),
    );
  }
}
