import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/models/group_permissions.dart';
import '../../core/models/match_model.dart';

import '../../core/theme/app_colors.dart';
import 'widgets/manage_roster_sheet.dart';
import '../../core/theme/app_typography.dart';
import '../../core/services/firestore_service.dart';
import '../../core/services/group_service.dart';
import '../../core/models/group_model.dart';
import '../../core/models/player_model.dart';
import '../../core/widgets/jersey_painter.dart';
import 'jersey_designer.dart';

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
        backgroundColor: AppColors.card,
        title: Text('¿Eliminar "${team.name}"?', style: AppTypography.headline(size: 16)),
        content: Text('Esta acción es permanente.', style: AppTypography.body(size: 13)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancelar')),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.destructive),
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
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e'), backgroundColor: AppColors.destructive));
        setState(() => _isDeleting = false);
      }
    }
  }

  Future<void> _showEditDialog(GroupTeamModel team) async {
    final controller = TextEditingController(text: team.name);
    JerseyModel jersey = team.jersey;
    bool submitting = false;

    await showModalBottomSheet<void>(
      context: context,
      backgroundColor: AppColors.card,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (context) => StatefulBuilder(
        builder: (context, setSheetState) => Padding(
          padding: EdgeInsets.only(
            left: 20, right: 20, top: 20,
            bottom: 20 + MediaQuery.of(context).viewInsets.bottom,
          ),
          child: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text('Editar Equipo', style: AppTypography.headline(size: 16)),
                const SizedBox(height: 16),
                TextField(controller: controller, decoration: const InputDecoration(labelText: 'Nombre del Equipo')),
                const SizedBox(height: 20),
                JerseyDesigner(value: jersey, onChanged: (j) => setSheetState(() => jersey = j)),
                const SizedBox(height: 20),
                ElevatedButton(
                  onPressed: submitting
                      ? null
                      : () async {
                          if (controller.text.trim().length < 2) return;
                          setSheetState(() => submitting = true);
                          try {
                            await ref.read(groupServiceProvider).updateTeam(
                                  teamId: team.id,
                                  name: controller.text.trim(),
                                  jersey: {'type': jersey.pattern, 'primaryColor': jersey.primaryColor, 'secondaryColor': jersey.secondaryColor},
                                );
                            if (context.mounted) Navigator.pop(context);
                          } catch (e) {
                            setSheetState(() => submitting = false);
                            if (context.mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e'), backgroundColor: AppColors.destructive));
                            }
                          }
                        },
                  style: ElevatedButton.styleFrom(backgroundColor: AppColors.voltNeon, foregroundColor: Colors.black),
                  child: submitting
                      ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.black))
                      : const Text('Guardar'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _showEditMembersSheet(GroupTeamModel team, List<PlayerModel> groupPlayers) async {
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
      await ref.read(groupServiceProvider).updateTeamMembers(
            teamId: team.id,
            members: members,
          );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Text('Plantel actualizado'),
            backgroundColor: AppColors.cardSurface,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('$e'), backgroundColor: AppColors.destructive),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final teamAsync = ref.watch(singleTeamStreamProvider(widget.teamId));
    final uid = FirebaseAuth.instance.currentUser?.uid;

    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        title: Text('EQUIPO',
            style: AppTypography.headline(size: 18, weight: FontWeight.w800)),
      ),
      body: teamAsync.when(
        loading: () => const Center(
            child: CircularProgressIndicator(color: AppColors.voltNeon)),
        error: (e, _) => Center(
          child: Text('No se pudo cargar el equipo.',
              style: AppTypography.body(color: AppColors.textMuted)),
        ),
        data: (team) {
          if (team == null) {
            return Center(
              child: Text('Equipo no encontrado.',
                  style: AppTypography.body(color: AppColors.textMuted)),
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
          }).toList()
            ..sort((a, b) => a.date.compareTo(b.date));

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
                _SectionLabel(text: 'PRÓXIMOS PARTIDOS', count: agenda.length),
                const SizedBox(height: 8),
                ...agenda.take(4).map(
                      (m) => _AgendaRow(
                        match: m,
                        teamName: team.name,
                        onTap: () => context.push('/matches/${m.id}'),
                      ),
                    ),
                const SizedBox(height: 18),
              ],

              _SectionLabel(text: 'TITULARES', count: starters.length),
              const SizedBox(height: 8),
              if (starters.isEmpty)
                _EmptyLine(
                  text: canEdit
                      ? 'Todavía no armaste el once. Tocá Plantel.'
                      : 'El once no está armado todavía.',
                )
              else
                ...starters.map((m) => _RosterTile(
                      member: m,
                      player: playersById[m.playerId],
                      starter: true,
                    )),

              const SizedBox(height: 18),
              _SectionLabel(text: 'SUPLENTES', count: subs.length),
              const SizedBox(height: 8),
              if (subs.isEmpty)
                const _EmptyLine(text: 'Sin suplentes.')
              else
                ...subs.map((m) => _RosterTile(
                      member: m,
                      player: playersById[m.playerId],
                      starter: false,
                    )),
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
    final accent = _parseColor(team.jersey.primaryColor);

    return Container(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 14),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            accent.withValues(alpha: 0.28),
            const Color(0xFF121822),
          ],
        ),
      ),
      child: Row(
        children: [
          JerseyWidget(jersey: team.jersey, size: 76),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  team.name.toUpperCase(),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: AppTypography.headline(
                      size: 23, weight: FontWeight.w900, letterSpacing: -0.4),
                ),
                const SizedBox(height: 3),
                Text(
                  '${team.members.length} ${team.members.length == 1 ? 'jugador' : 'jugadores'}',
                  style:
                      AppTypography.body(size: 12, color: AppColors.textMuted),
                ),
                if (trophies.isNotEmpty) ...[
                  const SizedBox(height: 9),
                  Wrap(
                    spacing: 6,
                    runSpacing: 6,
                    children: trophies
                        .map((t) => Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 8, vertical: 4),
                              decoration: BoxDecoration(
                                color: const Color(0xFFFFC64A)
                                    .withValues(alpha: 0.14),
                                borderRadius: BorderRadius.circular(20),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(
                                    t.isCup
                                        ? Icons.emoji_events_rounded
                                        : Icons.workspace_premium_rounded,
                                    size: 12,
                                    color: const Color(0xFFFFC64A),
                                  ),
                                  const SizedBox(width: 4),
                                  Text(
                                    t.name.isEmpty
                                        ? (t.isCup ? 'Copa' : 'Liga')
                                        : t.name,
                                    style: AppTypography.code(
                                        size: 9,
                                        weight: FontWeight.w700,
                                        color: const Color(0xFFFFC64A)),
                                  ),
                                ],
                              ),
                            ))
                        .toList(),
                  ),
                ],
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
    final fg = danger
        ? AppColors.destructive
        : primary
            ? Colors.black
            : AppColors.textPrimary;
    final bg = danger
        ? AppColors.destructive.withValues(alpha: 0.12)
        : primary
            ? AppColors.voltNeon
            : Colors.white.withValues(alpha: 0.07);

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(11),
      child: Container(
        height: 44,
        padding: EdgeInsets.symmetric(horizontal: label == null ? 14 : 12),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(11),
        ),
        child: busy
            ? SizedBox(
                width: 15,
                height: 15,
                child: CircularProgressIndicator(strokeWidth: 2, color: fg),
              )
            : Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(icon, size: 17, color: fg),
                  if (label != null) ...[
                    const SizedBox(width: 7),
                    Text(label!,
                        style: AppTypography.headline(
                            size: 13, weight: FontWeight.w700, color: fg)),
                  ],
                ],
              ),
      ),
    );
  }
}

class _SectionLabel extends StatelessWidget {
  final String text;
  final int count;

  const _SectionLabel({required this.text, required this.count});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(width: 3, height: 13, color: AppColors.voltNeon),
        const SizedBox(width: 8),
        Text(text,
            style: AppTypography.code(
                size: 10,
                weight: FontWeight.w800,
                color: AppColors.textSecondary)),
        const SizedBox(width: 7),
        Text('$count',
            style: AppTypography.code(size: 10, color: AppColors.textMuted)),
      ],
    );
  }
}

class _EmptyLine extends StatelessWidget {
  final String text;

  const _EmptyLine({required this.text});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 2),
      child: Text(text,
          style: AppTypography.body(size: 12, color: AppColors.textMuted)),
    );
  }
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
    final photo = p?.photoUrl;

    return Opacity(
      opacity: starter ? 1 : 0.72,
      child: InkWell(
        onTap: p == null ? null : () => context.push('/players/${p.id}'),
        borderRadius: BorderRadius.circular(11),
        child: Container(
          margin: const EdgeInsets.only(bottom: 5),
          padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 9),
          decoration: BoxDecoration(
            color: const Color(0xFF121822),
            borderRadius: BorderRadius.circular(11),
            border: starter
                ? const Border(
                    left: BorderSide(color: AppColors.voltNeon, width: 2.5))
                : null,
          ),
          child: Row(
            children: [
              SizedBox(
                width: 26,
                child: Text(
                  member.number == 0 ? '—' : '${member.number}',
                  textAlign: TextAlign.center,
                  style: AppTypography.sportNumber(
                    size: 17,
                    color: member.number == 0
                        ? AppColors.textMuted
                        : AppColors.textPrimary,
                  ),
                ),
              ),
              const SizedBox(width: 10),
              CircleAvatar(
                radius: 16,
                backgroundColor: const Color(0xFF1B2432),
                backgroundImage: photo != null && photo.isNotEmpty
                    ? NetworkImage(photo)
                    : null,
                child: photo == null || photo.isEmpty
                    ? Text(
                        (p?.name.isNotEmpty ?? false)
                            ? p!.name[0].toUpperCase()
                            : '?',
                        style: AppTypography.headline(size: 13),
                      )
                    : null,
              ),
              const SizedBox(width: 11),
              Expanded(
                child: Text(
                  p?.name ?? 'Jugador sin datos',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTypography.body(size: 13, weight: FontWeight.w600),
                ),
              ),
              if (p != null) ...[
                Text(p.position,
                    style: AppTypography.code(
                        size: 9, color: AppColors.textMuted)),
                const SizedBox(width: 9),
                Text('${p.ovr}', style: AppTypography.sportNumber(size: 16)),
              ],
            ],
          ),
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
    final rival =
        match.teamA?.name == teamName ? match.teamB?.name : match.teamA?.name;
    final live = match.status == 'active';

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(11),
      child: Container(
        margin: const EdgeInsets.only(bottom: 5),
        padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 10),
        decoration: BoxDecoration(
          color: const Color(0xFF121822),
          borderRadius: BorderRadius.circular(11),
        ),
        child: Row(
          children: [
            if (live) ...[
              Container(
                width: 7,
                height: 7,
                decoration: const BoxDecoration(
                    color: AppColors.destructive, shape: BoxShape.circle),
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
                    style:
                        AppTypography.body(size: 13, weight: FontWeight.w700),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    live
                        ? 'EN JUEGO'
                        : match.time == null
                            ? match.date
                            : '${match.date} · ${match.time}',
                    style: AppTypography.code(
                      size: 9,
                      color: live ? AppColors.destructive : AppColors.textMuted,
                    ),
                  ),
                ],
              ),
            ),
            const Icon(Icons.chevron_right_rounded,
                size: 18, color: AppColors.textMuted),
          ],
        ),
      ),
    );
  }
}

Color _parseColor(String hex) {
  final clean = hex.replaceAll('#', '').trim();
  if (clean.length != 6) return AppColors.voltNeon;
  final value = int.tryParse(clean, radix: 16);
  return value == null ? AppColors.voltNeon : Color(0xFF000000 | value);
}
