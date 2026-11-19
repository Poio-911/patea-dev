import '../../core/utils/dates.dart';
import '../../core/widgets/patea_button_progress.dart';
import '../../core/widgets/patea_card.dart';
import '../../core/widgets/player_position_badge.dart';
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

          final matches =
              ref.watch(matchesStreamProvider(team.groupId)).value ?? const [];
          // La web cruza por nombre de equipo, no por id: los partidos guardan
          // `teams[].name`, no una referencia al equipo del grupo.
          final agenda = matches.where((m) {
            if (m.status != 'upcoming' && m.status != 'active') return false;
            return m.teamA?.name == team.name || m.teamB?.name == team.name;
          }).toList()..sort((a, b) => a.date.compareTo(b.date));

          return ListView(
            padding: const EdgeInsets.fromLTRB(14, 4, 14, 28),
            children: [
              _TeamBanner(team: team, trophies: trophies),
              const SizedBox(height: 14),

              if (canEdit || canDelete) ...[
                _ActionBar(
                  canEdit: canEdit,
                  canDelete: canDelete,
                  isDeleting: _isDeleting,
                  onEdit: () => _showEditDialog(team),
                  onRoster: () => _showEditMembersSheet(team, groupPlayers),
                  onDelete: () => _handleDelete(team),
                ),
                const SizedBox(height: 18),
              ],

              if (agenda.isNotEmpty) ...[
                _SectionLabel(text: 'Próximos partidos', count: agenda.length),
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

              _SectionLabel(text: 'Titulares', count: starters.length),
              const SizedBox(height: 8),
              if (starters.isEmpty)
                PateaEmpty(
                  icon: Icons.groups_outlined,
                  title: canEdit
                      ? 'Todavía no armaste el once'
                      : 'El once no está armado todavía',
                  hint: canEdit ? 'Tocá Plantel para sumar titulares.' : null,
                  compact: true,
                )
              else
                ...starters.map(
                  (m) => _RosterTile(
                    member: m,
                    player: playersById[m.playerId],
                    starter: true,
                  ),
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
                  (m) => _RosterTile(
                    member: m,
                    player: playersById[m.playerId],
                    starter: false,
                  ),
                ),
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
  const _TeamBanner({required this.team, required this.trophies});
  @override
  Widget build(BuildContext context) {
    final accent = _parseColor(team.jersey.primaryColor, context.c.primary);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 18),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 86,
            child: JerseyWidget(
              jersey: team.jersey,
              teamName: team.name,
              size: 80,
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    if (team.jersey.hasCrest) ...[
                      TeamCrestWidget(
                        jersey: team.jersey,
                        teamName: team.name,
                        size: 28,
                      ),
                      const SizedBox(width: 8),
                    ],
                    Expanded(
                      child: Text(
                        team.name,
                        style: AppTypography.headline(
                          size: 25,
                          weight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Text(
                  '${team.members.length} ${team.members.length == 1 ? 'jugador' : 'jugadores'}',
                  style: AppTypography.body(
                    size: 14,
                    color: context.c.textSecondary,
                  ),
                ),
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
                const SizedBox(height: 12),
                Container(width: 32, height: 3, color: accent),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ActionBar extends StatelessWidget {
  final bool canEdit;
  final bool canDelete;
  final bool isDeleting;
  final VoidCallback onEdit;
  final VoidCallback onRoster;
  final VoidCallback onDelete;

  const _ActionBar({
    required this.canEdit,
    required this.canDelete,
    required this.isDeleting,
    required this.onEdit,
    required this.onRoster,
    required this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        if (canEdit) ...[
          Expanded(
            child: _ActionButton(
              icon: Icons.groups_rounded,
              label: 'Plantel',
              primary: true,
              onTap: onRoster,
            ),
          ),
          const SizedBox(width: 7),
          Expanded(
            child: _ActionButton(
              icon: Icons.edit_rounded,
              label: 'Editar',
              onTap: onEdit,
            ),
          ),
        ],
        if (canDelete) ...[
          if (canEdit) const SizedBox(width: 7),
          _ActionButton(
            icon: Icons.delete_outline_rounded,
            label: null,
            danger: true,
            busy: isDeleting,
            onTap: isDeleting ? null : onDelete,
          ),
        ],
      ],
    );
  }
}

class _ActionButton extends StatelessWidget {
  final IconData icon;
  final String? label;
  final bool primary;
  final bool danger;
  final bool busy;
  final VoidCallback? onTap;

  const _ActionButton({
    required this.icon,
    required this.label,
    this.primary = false,
    this.danger = false,
    this.busy = false,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final child = busy
        ? const SizedBox(width: 18, height: 18, child: PateaButtonProgress())
        : Icon(icon, size: 20);
    if (label == null) {
      return IconButton(
        tooltip: danger ? 'Eliminar equipo' : 'Opciones',
        onPressed: onTap,
        style: IconButton.styleFrom(
          minimumSize: const Size(48, 48),
          foregroundColor: danger
              ? context.c.destructive
              : context.c.textPrimary,
        ),
        icon: child,
      );
    }
    final content = Text(
      label!,
      style: AppTypography.body(
        size: 14,
        weight: FontWeight.w700,
        color: primary ? context.c.onPrimary : context.c.textPrimary,
      ),
    );
    if (primary) {
      return FilledButton.icon(
        onPressed: onTap,
        icon: child,
        label: content,
        style: FilledButton.styleFrom(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 14),
        ),
      );
    }
    return OutlinedButton.icon(
      onPressed: onTap,
      icon: child,
      label: content,
      style: OutlinedButton.styleFrom(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 14),
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

/// Una fila del plantel. Los suplentes se ven, pero más apagados.
class _RosterTile extends StatelessWidget {
  final TeamMemberEntry member;
  final PlayerModel? player;
  final bool starter;

  const _RosterTile({
    required this.member,
    required this.player,
    required this.starter,
  });

  @override
  Widget build(BuildContext context) {
    final p = player;
    return InkWell(
      onTap: p == null ? null : () => context.push('/players/${p.id}'),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 4),
        child: Row(
          children: [
            SizedBox(
              width: 30,
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
              size: 42,
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
                      child: PlayerPositionBadge(
                        position: p.position,
                        dense: true,
                        fontSize: 12,
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

    return InkWell(
      onTap: onTap,
      borderRadius: AppRadii.cardAll,
      child: PateaCard(
        color: context.c.background,
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
                  Text(
                    live
                        ? 'En vivo'
                        : match.time == null
                        ? fmtDate(match.date)
                        : '${fmtDate(match.date)} · ${match.time}',
                    style: AppTypography.body(
                      size: 12,
                      color: live
                          ? context.c.destructive
                          : context.c.textSecondary,
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

/// El color de una camiseta guardado como hex. [fallback] es lo que se usa
/// cuando el dato viene roto: lo pasa quien llama, porque depende del tema.
Color _parseColor(String hex, Color fallback) {
  final clean = hex.replaceAll('#', '').trim();
  if (clean.length != 6) return fallback;
  final value = int.tryParse(clean, radix: 16);
  return value == null ? fallback : Color(value).withAlpha(255);
}
