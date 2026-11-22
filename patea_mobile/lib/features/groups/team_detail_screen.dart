import 'team_rivals_screen.dart';
import '../../core/utils/dates.dart';
import '../../core/widgets/patea_button_progress.dart';
import '../../core/widgets/patea_card.dart';
import '../../core/theme/app_radii.dart';
import '../../core/widgets/patea_snack.dart';
import '../../core/widgets/patea_states.dart';
import '../../core/widgets/patea_avatar.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/models/group_permissions.dart';
import '../../core/models/match_model.dart';

import '../../core/theme/patea_colors.dart';
import 'widgets/manage_roster_sheet.dart';
import '../../core/theme/app_typography.dart';
import '../../core/services/firestore_service.dart';
import '../../core/services/group_service.dart';
import '../../core/services/team_challenge_service.dart';
import '../../core/models/group_model.dart';
import '../../core/models/player_model.dart';
import '../../core/widgets/jersey_painter.dart';
import '../../core/widgets/patea_background.dart';
import 'create_team_screen.dart';

/// Detalle de equipo: plantel separado en titulares y suplentes, trofeos,
/// próximos partidos y las acciones que tu rol habilita.
///
/// Los botones se muestran con el mismo criterio que usa el servidor en
/// `getTeamPermissionOrThrow`: el creador del equipo siempre puede, y si no,
/// manda el rol en el grupo. Es sólo para no ofrecer algo que va a fallar —
/// quien decide es la Cloud Function.
///
/// No portado (a propósito): el límite de "máximo 3 equipos por jugador" y el
/// análisis táctico (`TeamTacticalAnalysis`) de la web.
class TeamDetailScreen extends ConsumerStatefulWidget {
  final String teamId;

  const TeamDetailScreen({super.key, required this.teamId});

  @override
  ConsumerState<TeamDetailScreen> createState() => _TeamDetailScreenState();
}

class _TeamDetailScreenState extends ConsumerState<TeamDetailScreen> {
  bool _isDeleting = false;

  Future<void> _handleDelete(GroupTeamModel team) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(
          '¿Eliminar "${team.name}"?',
          style: AppTypography.headline(size: 20),
        ),
        content: Text(
          'Esta acción es permanente.',
          style: AppTypography.body(color: context.c.textSecondary, size: 13),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancelar'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            style: ElevatedButton.styleFrom(
              backgroundColor: context.c.destructive,
            ),
            child: const Text('Eliminar'),
          ),
        ],
      ),
    );
    if (confirm != true) return;

    setState(() => _isDeleting = true);
    try {
      await ref.read(groupServiceProvider).deleteTeam(team.id);
      if (mounted) Navigator.pop(context);
    } catch (e) {
      if (mounted) {
        PateaSnack.error(context, '$e');
        setState(() => _isDeleting = false);
      }
    }
  }

  Future<void> _showEditDialog(GroupTeamModel team) async {
    await Navigator.of(context, rootNavigator: true).push<bool>(
      MaterialPageRoute(
        builder: (_) => PateaBackground(
          child: CreateTeamScreen(groupId: team.groupId, initialTeam: team),
        ),
      ),
    );
  }

  Future<void> _showEditMembersSheet(
    GroupTeamModel team,
    List<PlayerModel> groupPlayers,
  ) async {
    final members = await showModalBottomSheet<List<Map<String, dynamic>>>(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (_) => ManageRosterSheet(
        teamName: team.name,
        groupPlayers: groupPlayers,
        current: team.members,
      ),
    );
    if (members == null || !mounted) return;

    try {
      await ref
          .read(groupServiceProvider)
          .updateTeamMembers(teamId: team.id, members: members);
      if (mounted) {
        PateaSnack.info(context, 'Plantel actualizado');
      }
    } catch (e) {
      if (mounted) {
        PateaSnack.error(context, '$e');
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final teamAsync = ref.watch(singleTeamStreamProvider(widget.teamId));
    // Antes leia FirebaseAuth.instance directo. Es el mismo uid, pero por el
    // provider la pantalla se puede montar sin Firebase y se reconstruye sola
    // al cambiar de sesion.
    final uid = ref.watch(currentUidProvider);

    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        title: Text(
          'Equipo',
          style: AppTypography.headline(size: 20, weight: FontWeight.w700),
        ),
      ),
      body: teamAsync.when(
        loading: () => const PateaLoading(),
        error: (e, _) => PateaError(
          error: e,
          message: 'No se pudo cargar el equipo.',
          onRetry: () =>
              ref.invalidate(singleTeamStreamProvider(widget.teamId)),
        ),
        data: (team) {
          if (team == null) {
            return Center(
              child: Text(
                'Equipo no encontrado.',
                style: AppTypography.body(color: context.c.textSecondary),
              ),
            );
          }

          final groupPlayers =
              ref.watch(playersStreamProvider(team.groupId)).value ??
              const <PlayerModel>[];
          final playersById = {for (final p in groupPlayers) p.id: p};

          // El mismo criterio del servidor: el creador siempre puede, y si no,
          // manda el rol en el grupo. Ver `getTeamPermissionOrThrow`.
          final role = ref.watch(myGroupRoleProvider(team.groupId)).value;
          final isCreator = uid != null && uid == team.createdBy;
          final canEdit =
              isCreator || hasPermission(role, GroupPermission.teamsEdit);
          final canDelete =
              isCreator || hasPermission(role, GroupPermission.teamsDelete);

          int byNumber(TeamMemberEntry a, TeamMemberEntry b) {
            if (a.number != b.number) {
              if (a.number == 0) return 1;
              if (b.number == 0) return -1;
              return a.number.compareTo(b.number);
            }
            final an = playersById[a.playerId]?.name ?? '';
            final bn = playersById[b.playerId]?.name ?? '';
            return an.compareTo(bn);
          }

          final starters =
              team.members.where((m) => m.status == 'titular').toList()
                ..sort(byNumber);
          final subs = team.members.where((m) => m.status != 'titular').toList()
            ..sort(byNumber);

          final trophies =
              ref.watch(teamTrophiesProvider(team.id)).value ?? const [];

          String? creatorName;
          if (team.createdBy.isNotEmpty) {
            final matchingPlayer = groupPlayers.where(
              (p) => p.id == team.createdBy || p.ownerUid == team.createdBy,
            );
            if (matchingPlayer.isNotEmpty) {
              creatorName = matchingPlayer.first.name;
            } else {
              creatorName = ref
                  .watch(userDisplayNameProvider(team.createdBy))
                  .value;
            }
          }

          final matches =
              ref.watch(matchesStreamProvider(team.groupId)).value ?? const [];
          // La web cruza por nombre de equipo, no por id: los partidos guardan
          // `teams[].name`, no una referencia al equipo del grupo.
          final agenda =
              matches.where((m) {
                if (m.status != 'upcoming' && m.status != 'active') {
                  return false;
                }
                return m.teamA?.name == team.name || m.teamB?.name == team.name;
              }).toList()..sort((a, b) {
                if (a.status != b.status) return a.status == 'active' ? -1 : 1;
                return a.date.compareTo(b.date);
              });

          return ListView(
            padding: const EdgeInsets.fromLTRB(14, 4, 14, 28),
            children: [
              _TeamBanner(
                team: team,
                trophies: trophies,
                creatorName: creatorName,
                actions: canEdit || canDelete
                    ? PopupMenuButton<String>(
                        tooltip: 'Opciones del equipo',
                        enabled: !_isDeleting,
                        icon: _isDeleting
                            ? const SizedBox.square(
                                dimension: 18,
                                child: PateaButtonProgress(),
                              )
                            : const Icon(Icons.more_horiz_rounded),
                        onSelected: (action) {
                          if (action == 'edit') {
                            _showEditDialog(team);
                          } else {
                            _handleDelete(team);
                          }
                        },
                        itemBuilder: (context) => [
                          if (canEdit)
                            const PopupMenuItem(
                              value: 'edit',
                              child: Text('Editar equipo'),
                            ),
                          if (canDelete)
                            PopupMenuItem(
                              value: 'delete',
                              child: Text(
                                'Eliminar equipo',
                                style: TextStyle(color: context.c.destructive),
                              ),
                            ),
                        ],
                      )
                    : null,
              ),
              const SizedBox(height: 16),
              if (agenda.isNotEmpty) ...[
                _SectionLabel(text: 'Agenda', count: agenda.length),
                const SizedBox(height: 8),
                ...agenda
                    .take(4)
                    .map(
                      (m) => _AgendaRow(
                        match: m,
                        teamName: team.name,
                        onTap: () => context.push('/matches/${m.id}'),
                      ),
                    ),
                const SizedBox(height: 18),
              ],

              Text(
                'Plantel',
                style: AppTypography.headline(
                  size: 22,
                  weight: FontWeight.w800,
                ),
              ),
              if (canEdit)
                Align(
                  alignment: AlignmentDirectional.centerStart,
                  child: TextButton.icon(
                    onPressed: () => _showEditMembersSheet(team, groupPlayers),
                    icon: const Icon(Icons.groups_outlined, size: 19),
                    label: const Text('Gestionar plantel'),
                  ),
                ),
              const SizedBox(height: 8),
              _SectionLabel(text: 'Titulares', count: starters.length),
              const SizedBox(height: 8),
              if (starters.isEmpty)
                PateaEmpty(
                  icon: Icons.groups_outlined,
                  title: canEdit
                      ? 'Todavía no armaste el once'
                      : 'El once no está armado todavía',
                  hint: canEdit
                      ? 'Usá Gestionar plantel para sumar titulares.'
                      : null,
                  compact: true,
                )
              else
                ...starters.map(
                  (m) =>
                      _RosterTile(member: m, player: playersById[m.playerId]),
                ),

              const SizedBox(height: 18),
              _SectionLabel(text: 'Suplentes', count: subs.length),
              const SizedBox(height: 8),
              if (subs.isEmpty)
                const PateaEmpty(
                  icon: Icons.chair_alt_outlined,
                  title: 'Sin suplentes',
                  compact: true,
                )
              else
                ...subs.map(
                  (m) =>
                      _RosterTile(member: m, player: playersById[m.playerId]),
                ),
              if (canEdit && team.members.isNotEmpty) ...[
                const SizedBox(height: 22),
                _RivalsCard(team: team),
              ],
              if (canEdit || role != null) ...[
                const SizedBox(height: 16),
                TeamRivalsPanel(team: team, limit: 3, preview: true),
              ],
            ],
          );
        },
      ),
    );
  }
}

/// Cabecera del equipo: la camiseta manda el color de todo el bloque.
class _TeamBanner extends StatelessWidget {
  final GroupTeamModel team;
  final List<TeamTrophy> trophies;
  final String? creatorName;
  final Widget? actions;
  const _TeamBanner({
    required this.team,
    required this.trophies,
    this.creatorName,
    this.actions,
  });
  @override
  Widget build(BuildContext context) {
    final colors = context.c;
    final accent = parseJerseyHexColor(team.jersey.primaryColor);
    return PateaCard(
      borderColor: colors.border,
      padding: const EdgeInsets.all(12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          DecoratedBox(
            decoration: BoxDecoration(
              color: Color.alphaBlend(
                accent.withValues(alpha: 0.16),
                colors.cardSurface,
              ),
              borderRadius: AppRadii.chipAll,
            ),
            child: Padding(
              padding: const EdgeInsets.all(8),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  JerseyWidget(
                    jersey: team.jersey,
                    teamName: team.name,
                    size: 60,
                  ),
                  if (team.jersey.hasCrest)
                    TeamCrestWidget(
                      jersey: team.jersey,
                      teamName: team.name,
                      size: 24,
                    ),
                ],
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  team.name,
                  style: AppTypography.headline(
                    size: 22,
                    weight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  '${team.members.length} ${team.members.length == 1 ? 'jugador' : 'jugadores'}',
                  style: AppTypography.body(
                    size: 14,
                    color: context.c.textSecondary,
                  ),
                ),
                if (creatorName != null && creatorName!.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      Icon(
                        Icons.person_outline_rounded,
                        size: 14,
                        color: context.c.textSecondary,
                      ),
                      const SizedBox(width: 4),
                      Expanded(
                        child: Text(
                          'Creado por $creatorName',
                          style: AppTypography.body(
                            size: 12.5,
                            color: context.c.textSecondary,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                ],
                for (final trophy in trophies)
                  Padding(
                    padding: const EdgeInsets.only(top: 10),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Icon(
                          trophy.isCup
                              ? Icons.emoji_events_outlined
                              : Icons.workspace_premium_outlined,
                          size: 18,
                          color: context.c.goldText,
                        ),
                        const SizedBox(width: 6),
                        Expanded(
                          child: Text(
                            trophy.name.isEmpty
                                ? (trophy.isCup ? 'Copa' : 'Liga')
                                : trophy.name,
                            style: AppTypography.body(
                              size: 13,
                              weight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          ),
          ?actions,
        ],
      ),
    );
  }
}

/// Rivales: buscar un equipo de otro grupo para desafiar, y decidir si este
/// equipo recibe desafíos de otros. Sólo lo ve quien puede editar el equipo.
class _RivalsCard extends ConsumerStatefulWidget {
  final GroupTeamModel team;
  const _RivalsCard({required this.team});

  @override
  ConsumerState<_RivalsCard> createState() => _RivalsCardState();
}

class _RivalsCardState extends ConsumerState<_RivalsCard> {
  bool _saving = false;

  Future<void> _setReceives(bool receives) async {
    if (_saving) return;
    setState(() => _saving = true);
    try {
      await ref
          .read(teamChallengeServiceProvider)
          .setTeamChallengeOptOut(teamId: widget.team.id, optOut: !receives);
      // El equipo viene de un stream de Firestore: la pantalla se actualiza sola.
    } catch (e) {
      if (mounted) {
        PateaSnack.error(
          context,
          challengeErrorMessage(e, fallback: 'No se pudo guardar el cambio.'),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final receives = !widget.team.challengeOptOut;
    return PateaCard(
      padding: const EdgeInsets.fromLTRB(14, 12, 6, 6),
      borderColor: c.overlayLine,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Rivales',
            style: AppTypography.headline(size: 15, weight: FontWeight.w800),
          ),
          const SizedBox(height: 4),
          Text(
            'Buscá un equipo de otro grupo y mandale un desafío.',
            style: AppTypography.body(size: 12, color: c.textSecondary),
          ),
          const SizedBox(height: 10),
          Padding(
            padding: const EdgeInsets.only(right: 8),
            child: Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () => context.push(
                      '/matches/create?type=intergroup_friendly&teamId=${widget.team.id}',
                    ),
                    icon: const Icon(Icons.search, size: 18),
                    label: const Text('Desafiar rival'),
                  ),
                ),
                const SizedBox(width: 8),
                IconButton(
                  tooltip: 'Desafíos recibidos',
                  icon: const Icon(Icons.inbox_outlined),
                  onPressed: () => context.push('/challenges'),
                ),
              ],
            ),
          ),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: Text(
              'Recibir desafíos',
              style: AppTypography.body(
                size: 14,
                weight: FontWeight.w600,
                color: c.textPrimary,
              ),
            ),
            subtitle: Text(
              receives
                  ? 'Otros equipos pueden encontrarlo y desafiarlo.'
                  : 'Oculto en el buscador: nadie puede desafiarlo.',
              style: AppTypography.body(size: 12, color: c.textSecondary),
            ),
            value: receives,
            onChanged: _saving ? null : _setReceives,
          ),
        ],
      ),
    );
  }
}

class _SectionLabel extends StatelessWidget {
  final String text;
  final int count;

  const _SectionLabel({required this.text, required this.count});

  @override
  Widget build(BuildContext context) => Row(
    children: [
      Expanded(
        child: Text(
          text.isEmpty ? text : text[0] + text.substring(1).toLowerCase(),
          style: AppTypography.headline(size: 19, weight: FontWeight.w700),
        ),
      ),
      Text(
        '$count',
        style: AppTypography.body(size: 13, color: context.c.textSecondary),
      ),
    ],
  );
}

/// Una fila del plantel con el dorsal y el OVR en columnas fijas.
class _RosterTile extends StatelessWidget {
  final TeamMemberEntry member;
  final PlayerModel? player;

  const _RosterTile({required this.member, required this.player});

  @override
  Widget build(BuildContext context) {
    final p = player;
    return Column(
      children: [
        InkWell(
          onTap: p == null ? null : () => context.push('/players/${p.id}'),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
            child: Row(
              children: [
                SizedBox(
                  width: 34,
                  child: Text(
                    member.number == 0 ? '—' : '${member.number}',
                    textAlign: TextAlign.center,
                    style: AppTypography.sportNumber(
                      size: 21,
                      color: context.c.textSecondary,
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                PateaAvatar(
                  photoUrl: p?.photoUrl,
                  seed: p?.id ?? member.playerId,
                  size: 34,
                  cropX: p?.cropX ?? 50,
                  cropY: p?.cropY ?? 50,
                  cropZoom: p?.cropZoom ?? 1,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        p?.name ?? 'Jugador sin datos',
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: AppTypography.body(
                          size: 15,
                          weight: FontWeight.w600,
                        ),
                      ),
                      if (p != null)
                        Padding(
                          padding: const EdgeInsets.only(top: 4),
                          child: Text(
                            p.position.toUpperCase(),
                            style: AppTypography.body(
                              size: 12,
                              weight: FontWeight.w700,
                              color: context.c.positionColor(p.position),
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
                if (p != null) ...[
                  const SizedBox(width: 10),
                  Column(
                    children: [
                      Text(
                        '${p.ovr}',
                        style: AppTypography.sportNumber(
                          size: 24,
                          color: context.c.textPrimary,
                        ),
                      ),
                      Text(
                        'OVR',
                        style: AppTypography.body(
                          size: 12,
                          color: context.c.textSecondary,
                        ),
                      ),
                    ],
                  ),
                ],
              ],
            ),
          ),
        ),
        Divider(height: 1, color: context.c.overlayLine),
      ],
    );
  }
}

/// Un partido del equipo, con el rival resuelto desde el otro lado del cruce.
class _AgendaRow extends StatelessWidget {
  final MatchModel match;
  final String teamName;
  final VoidCallback onTap;

  const _AgendaRow({
    required this.match,
    required this.teamName,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final rival = match.teamA?.name == teamName
        ? match.teamB?.name
        : match.teamA?.name;
    final live = match.status == 'active';
    final time = match.time?.trim();
    final location = match.location?.trim();
    final details = [
      if (match.date.isNotEmpty) fmtDate(match.date),
      if (time != null && time.isNotEmpty) '$time hs',
      if (location != null && location.isNotEmpty) location,
    ].join(' · ');

    return InkWell(
      onTap: onTap,
      borderRadius: AppRadii.cardAll,
      child: PateaCard(
        color: context.c.card,
        borderColor: context.c.border,
        radius: AppRadii.cardAll,
        margin: const EdgeInsets.only(bottom: 5),
        padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 10),
        child: Row(
          children: [
            if (live) ...[
              Container(
                width: 7,
                height: 7,
                decoration: BoxDecoration(
                  color: context.c.destructive,
                  shape: BoxShape.circle,
                ),
              ),
              const SizedBox(width: 8),
            ],
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    rival == null || rival.isEmpty ? match.title : 'vs $rival',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppTypography.body(
                      color: context.c.textSecondary,
                      size: 13,
                      weight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 2),
                  if (live)
                    Text(
                      'En vivo',
                      style: AppTypography.body(
                        size: 12,
                        color: context.c.destructive,
                      ),
                    ),
                  if (details.isNotEmpty)
                    Text(
                      details,
                      style: AppTypography.body(
                        size: 12,
                        color: context.c.textSecondary,
                      ),
                    ),
                ],
              ),
            ),
            Icon(
              Icons.chevron_right_rounded,
              size: 18,
              color: context.c.textSecondary,
            ),
          ],
        ),
      ),
    );
  }
}
