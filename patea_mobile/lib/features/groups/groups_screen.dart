import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/services/auth_service.dart';
import '../../core/services/firestore_service.dart';
import '../../core/services/group_service.dart';
import '../../core/models/group_model.dart';
import '../../core/models/match_model.dart';
import '../../core/models/player_model.dart';
import '../../core/models/group_permissions.dart';
import '../../core/widgets/jersey_painter.dart';

const _spanishMonths = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
];

String _fmtDate(String raw) {
  final d = DateTime.tryParse(raw);
  if (d == null) return raw;
  final local = d.toLocal();
  return '${local.day.toString().padLeft(2, '0')} de ${_spanishMonths[local.month - 1]}';
}

/// Port de src/app/groups/page.tsx: selector de grupo activo, código de
/// invitación, y (a diferencia del "Mi Grupo" del dashboard, que solo lee)
/// gestión real de Equipos Guardados — crear/ver/editar/eliminar, ya que
/// esta es la Sección 5 (Grupos/Equipos) que esa pestaña daba por diferida.
///
/// Deliberadamente NO portado en esta pasada (ver plan): edición de
/// nombre/rol de miembros, `deleteGroupAction`, Amistosos Intergrupos,
/// crónica de partido con IA en "Últimos Partidos".
class GroupsScreen extends ConsumerWidget {
  const GroupsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final uid = ref.watch(authStateProvider).valueOrNull?.uid;

    return Scaffold(
      appBar: AppBar(
        title: Text('MIS GRUPOS', style: AppTypography.headline(size: 18, weight: FontWeight.w800)),
        actions: [
          IconButton(
            icon: const Icon(Icons.login, size: 20),
            tooltip: 'Unirse a Grupo',
            onPressed: () => _showJoinGroupDialog(context, ref),
          ),
          IconButton(
            icon: const Icon(Icons.add_circle_outline),
            tooltip: 'Crear Grupo',
            onPressed: () => _showCreateGroupDialog(context, ref),
          ),
        ],
      ),
      body: uid == null ? const SizedBox() : _GroupsBody(uid: uid),
    );
  }

  static Future<void> _showCreateGroupDialog(BuildContext context, WidgetRef ref) async {
    final controller = TextEditingController();
    bool submitting = false;
    await showDialog<void>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          backgroundColor: AppColors.card,
          title: Text('Crear Grupo', style: AppTypography.headline(size: 16)),
          content: TextField(
            controller: controller,
            decoration: const InputDecoration(hintText: 'Nombre del grupo (ej. Los Pibes FC)'),
          ),
          actions: [
            TextButton(onPressed: submitting ? null : () => Navigator.pop(context), child: const Text('Cancelar')),
            ElevatedButton(
              onPressed: submitting
                  ? null
                  : () async {
                      if (controller.text.trim().length < 3) return;
                      setDialogState(() => submitting = true);
                      try {
                        await ref.read(groupServiceProvider).createGroup(controller.text.trim());
                        if (context.mounted) Navigator.pop(context);
                      } catch (e) {
                        setDialogState(() => submitting = false);
                        if (context.mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e'), backgroundColor: AppColors.destructive));
                        }
                      }
                    },
              style: ElevatedButton.styleFrom(backgroundColor: AppColors.voltNeon, foregroundColor: Colors.black),
              child: submitting
                  ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.black))
                  : const Text('Crear'),
            ),
          ],
        ),
      ),
    );
  }

  static Future<void> _showJoinGroupDialog(BuildContext context, WidgetRef ref) async {
    final controller = TextEditingController();
    bool submitting = false;
    await showDialog<void>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          backgroundColor: AppColors.card,
          title: Text('Unirse a Grupo', style: AppTypography.headline(size: 16)),
          content: TextField(
            controller: controller,
            decoration: const InputDecoration(hintText: 'Código de invitación'),
          ),
          actions: [
            TextButton(onPressed: submitting ? null : () => Navigator.pop(context), child: const Text('Cancelar')),
            ElevatedButton(
              onPressed: submitting
                  ? null
                  : () async {
                      if (controller.text.trim().isEmpty) return;
                      setDialogState(() => submitting = true);
                      try {
                        await ref.read(groupServiceProvider).joinGroupByInviteCode(controller.text.trim());
                        if (context.mounted) Navigator.pop(context);
                      } catch (e) {
                        setDialogState(() => submitting = false);
                        if (context.mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e'), backgroundColor: AppColors.destructive));
                        }
                      }
                    },
              style: ElevatedButton.styleFrom(backgroundColor: AppColors.voltNeon, foregroundColor: Colors.black),
              child: submitting
                  ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.black))
                  : const Text('Unirme'),
            ),
          ],
        ),
      ),
    );
  }
}

class _GroupsBody extends ConsumerWidget {
  final String uid;

  const _GroupsBody({required this.uid});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final groupIdAsync = ref.watch(activeGroupIdStreamProvider(uid));

    return groupIdAsync.when(
      data: (groupId) {
        if (groupId == null) return _NoActiveGroupView(uid: uid);
        return _ActiveGroupView(groupId: groupId, uid: uid);
      },
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(child: Text('Error: $e')),
    );
  }
}

class _NoActiveGroupView extends ConsumerWidget {
  final String uid;

  const _NoActiveGroupView({required this.uid});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final groupsAsync = ref.watch(userGroupsStreamProvider(uid));

    return ListView(
      padding: const EdgeInsets.all(18),
      children: [
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(color: AppColors.voltNeon.withValues(alpha: 0.08), borderRadius: BorderRadius.circular(14), border: Border.all(color: AppColors.voltNeon.withValues(alpha: 0.3))),
          child: Row(
            children: [
              Icon(Icons.groups_2_outlined, color: AppColors.voltNeon),
              const SizedBox(width: 12),
              Expanded(
                child: Text('No tenés un grupo seleccionado. Elegí uno debajo, o creá/unite a uno.', style: AppTypography.body(size: 12)),
              ),
            ],
          ),
        ),
        const SizedBox(height: 18),
        groupsAsync.when(
          data: (groups) {
            if (groups.isEmpty) {
              return Container(
                padding: const EdgeInsets.all(28),
                decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(16)),
                child: Column(
                  children: [
                    Icon(Icons.groups_2_outlined, size: 40, color: AppColors.textMuted),
                    const SizedBox(height: 10),
                    Text('Todavía no formás parte de ningún grupo', style: AppTypography.body(size: 13, color: AppColors.textMuted), textAlign: TextAlign.center),
                  ],
                ),
              );
            }
            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('TUS GRUPOS', style: AppTypography.headline(size: 12, weight: FontWeight.w800, color: AppColors.textSecondary)),
                const SizedBox(height: 10),
                ...groups.map((g) => Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: InkWell(
                        borderRadius: BorderRadius.circular(12),
                        onTap: () async {
                          try {
                            await ref.read(groupServiceProvider).setActiveGroup(g.id);
                          } catch (e) {
                            if (context.mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e'), backgroundColor: AppColors.destructive));
                            }
                          }
                        },
                        child: Container(
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.border.withValues(alpha: 0.5))),
                          child: Row(
                            children: [
                              Icon(Icons.shield_outlined, color: AppColors.voltNeon),
                              const SizedBox(width: 12),
                              Expanded(child: Text(g.name, style: AppTypography.body(size: 14, weight: FontWeight.w700))),
                              Icon(Icons.chevron_right, color: AppColors.textMuted),
                            ],
                          ),
                        ),
                      ),
                    )),
              ],
            );
          },
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => Text('Error: $e'),
        ),
      ],
    );
  }
}

class _ActiveGroupView extends ConsumerWidget {
  final String groupId;
  final String uid;

  const _ActiveGroupView({required this.groupId, required this.uid});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final groupAsync = ref.watch(singleGroupStreamProvider(groupId));
    final teamsAsync = ref.watch(groupTeamsStreamProvider(groupId));
    final matchesAsync = ref.watch(matchesStreamProvider(groupId));
    final playersAsync = ref.watch(playersStreamProvider(groupId));
    final myGroups = ref.watch(userGroupsStreamProvider(uid)).value ?? const <GroupModel>[];
    final role = ref.watch(myGroupRoleProvider(groupId)).value;

    return groupAsync.when(
      data: (group) {
        if (group == null) return const SizedBox();

        final matches = matchesAsync.value ?? const <MatchModel>[];
        final players = playersAsync.value ?? const <PlayerModel>[];
        final playersById = {for (final p in players) p.id: p};

        DateTime dateOf(MatchModel m) =>
            DateTime.tryParse(m.date) ?? DateTime.fromMillisecondsSinceEpoch(0);

        final upcoming = matches.where((m) => m.status == 'upcoming').toList()
          ..sort((a, b) => dateOf(a).compareTo(dateOf(b)));

        // Mismo criterio que la web: los ya jugados, del más nuevo al más viejo.
        final recent = matches
            .where((m) => m.status == 'completed' || m.status == 'evaluated')
            .toList()
          ..sort((a, b) => dateOf(b).compareTo(dateOf(a)));

        // La web los busca con una query aparte (`type == 'intergroup_friendly'`);
        // acá ya tenemos todos los partidos del grupo en memoria, así que sale
        // de filtrar en vez de sumar otra suscripción.
        final friendlies =
            matches.where((m) => m.type == 'intergroup_friendly').toList()
              ..sort((a, b) => dateOf(b).compareTo(dateOf(a)));

        final canCreateTeam = hasPermission(role, GroupPermission.teamsCreate);

        return ListView(
          padding: const EdgeInsets.all(18),
          children: [
            _GroupHeroCard(group: group, role: role),
            const SizedBox(height: 20),

            // Cambiar de grupo. La web solo ofrece esta lista cuando NO hay
            // grupo activo; acá tiene que estar siempre, porque el grupo activo
            // es lo que decide qué jugadores y qué partidos ve la app entera.
            if (myGroups.length > 1) ...[
              _Section(
                icon: Icons.swap_horiz,
                title: 'CAMBIAR DE GRUPO',
                child: Column(
                  children: myGroups
                      .map((g) => _GroupSwitchRow(
                            group: g,
                            active: g.id == groupId,
                            onTap: g.id == groupId
                                ? null
                                : () async {
                                    try {
                                      await ref
                                          .read(groupServiceProvider)
                                          .setActiveGroup(g.id);
                                      if (context.mounted) {
                                        ScaffoldMessenger.of(context).showSnackBar(
                                          SnackBar(
                                            content: Text('Grupo activo: ${g.name}'),
                                            backgroundColor: AppColors.cardSurface,
                                          ),
                                        );
                                      }
                                    } catch (e) {
                                      if (context.mounted) {
                                        ScaffoldMessenger.of(context).showSnackBar(
                                          SnackBar(
                                            content: Text('$e'),
                                            backgroundColor: AppColors.destructive,
                                          ),
                                        );
                                      }
                                    }
                                  },
                          ))
                      .toList(),
                ),
              ),
              const SizedBox(height: 20),
            ],

            _Section(
              icon: Icons.shield_outlined,
              title: 'EQUIPOS GUARDADOS',
              // Sin permiso el botón no va: `createTeam` lo rechaza igual y el
              // usuario se comería un error después de llenar el formulario.
              action: canCreateTeam
                  ? TextButton.icon(
                      onPressed: () =>
                          context.push('/groups/teams/new?groupId=$groupId'),
                      icon: const Icon(Icons.add, size: 16),
                      label: const Text('Crear'),
                    )
                  : null,
              child: teamsAsync.when(
                data: (teams) {
                  if (teams.isEmpty) {
                    return Padding(
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      child: Text(
                        canCreateTeam
                            ? 'Todavía no hay equipos. Creá el primero.'
                            : 'Todavía no hay equipos en este grupo.',
                        style: AppTypography.body(size: 12, color: AppColors.textMuted),
                      ),
                    );
                  }
                  return Column(
                    children: teams
                        .map((team) => InkWell(
                              onTap: () => context.push('/groups/teams/${team.id}'),
                              borderRadius: BorderRadius.circular(10),
                              child: Container(
                                margin: const EdgeInsets.only(bottom: 8),
                                padding: const EdgeInsets.all(10),
                                decoration: BoxDecoration(
                                  color: AppColors.cardSurface.withValues(alpha: 0.5),
                                  borderRadius: BorderRadius.circular(10),
                                ),
                                child: Row(
                                  children: [
                                    JerseyWidget(jersey: team.jersey, size: 36),
                                    const SizedBox(width: 10),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text(team.name,
                                              style: AppTypography.body(
                                                  size: 14, weight: FontWeight.w700)),
                                          Text(
                                            _rosterLine(team),
                                            style: AppTypography.body(
                                                size: 11, color: AppColors.textMuted),
                                          ),
                                        ],
                                      ),
                                    ),
                                    Icon(Icons.chevron_right,
                                        size: 18, color: AppColors.textMuted),
                                  ],
                                ),
                              ),
                            ))
                        .toList(),
                  );
                },
                loading: () => const Padding(
                    padding: EdgeInsets.all(16),
                    child: Center(child: CircularProgressIndicator())),
                error: (e, _) => Text('Error: $e'),
              ),
            ),
            const SizedBox(height: 20),

            _Section(
              icon: Icons.newspaper_outlined,
              title: 'EN AGENDA',
              child: upcoming.isEmpty
                  ? Text('No hay partidos próximos.',
                      style: AppTypography.body(size: 12, color: AppColors.textMuted))
                  : Column(
                      children: upcoming
                          .take(5)
                          .map((m) => _MatchLine(
                                title: m.title,
                                trailing: m.time == null
                                    ? _fmtDate(m.date)
                                    : '${_fmtDate(m.date)} · ${m.time}',
                                onTap: () => context.push('/matches/${m.id}'),
                              ))
                          .toList(),
                    ),
            ),
            const SizedBox(height: 20),

            _Section(
              icon: Icons.history,
              title: 'ÚLTIMOS PARTIDOS',
              action: recent.isEmpty
                  ? null
                  : TextButton(
                      onPressed: () => context.push('/matches'),
                      child: const Text('Ver todos'),
                    ),
              child: recent.isEmpty
                  ? Text('Todavía no jugaron ningún partido.',
                      style: AppTypography.body(size: 12, color: AppColors.textMuted))
                  : Column(
                      children: recent.take(5).map((m) {
                        final mvp = m.bestPlayerId == null
                            ? null
                            : playersById[m.bestPlayerId];
                        return _PlayedMatchRow(
                          match: m,
                          mvpName: mvp?.name,
                          mvpPhoto: mvp?.photoUrl,
                          onTap: () => context.push('/matches/${m.id}'),
                        );
                      }).toList(),
                    ),
            ),

            if (friendlies.isNotEmpty) ...[
              const SizedBox(height: 20),
              _Section(
                icon: Icons.handshake_outlined,
                title: 'AMISTOSOS INTERGRUPOS',
                child: Column(
                  children: friendlies
                      .take(5)
                      .map((m) => _MatchLine(
                            title: m.title,
                            trailing: _fmtDate(m.date),
                            onTap: () => context.push('/matches/${m.id}'),
                          ))
                      .toList(),
                ),
              ),
            ],
          ],
        );
      },
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(child: Text('Error: $e')),
    );
  }
}

/// "5 jugadores" no alcanza cuando el equipo tiene banco.
String _rosterLine(GroupTeamModel team) {
  final starters = team.members.where((m) => m.status == 'titular').length;
  final subs = team.members.length - starters;
  if (subs == 0) {
    return '$starters ${starters == 1 ? 'jugador' : 'jugadores'}';
  }
  return '$starters ${starters == 1 ? 'titular' : 'titulares'} · $subs supl.';
}

/// El recuadro con título que ya usaba la pantalla, extraído para no repetirlo
/// cinco veces.
class _Section extends StatelessWidget {
  final IconData icon;
  final String title;
  final Widget? action;
  final Widget child;

  const _Section({
    required this.icon,
    required this.title,
    required this.child,
    this.action,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.card.withValues(alpha: 0.4),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border.withValues(alpha: 0.4)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 18, color: AppColors.voltNeon),
              const SizedBox(width: 8),
              Expanded(
                child: Text(title,
                    style: AppTypography.headline(
                        size: 13,
                        weight: FontWeight.w800,
                        color: AppColors.voltNeon)),
              ),
              ?action,
            ],
          ),
          const SizedBox(height: 10),
          child,
        ],
      ),
    );
  }
}

class _GroupSwitchRow extends StatelessWidget {
  final GroupModel group;
  final bool active;
  final VoidCallback? onTap;

  const _GroupSwitchRow({
    required this.group,
    required this.active,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(10),
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: active
              ? AppColors.voltNeon.withValues(alpha: 0.1)
              : AppColors.cardSurface.withValues(alpha: 0.5),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Row(
          children: [
            Icon(
              active ? Icons.radio_button_checked : Icons.radio_button_off,
              size: 18,
              color: active ? AppColors.voltNeon : AppColors.textMuted,
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                group.name,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AppTypography.body(
                  size: 13,
                  weight: active ? FontWeight.w800 : FontWeight.w600,
                  color: active ? AppColors.voltNeon : AppColors.textPrimary,
                ),
              ),
            ),
            if (active)
              Text('ACTIVO',
                  style: AppTypography.code(
                      size: 9,
                      weight: FontWeight.w800,
                      color: AppColors.voltNeon)),
          ],
        ),
      ),
    );
  }
}

class _MatchLine extends StatelessWidget {
  final String title;
  final String trailing;
  final VoidCallback onTap;

  const _MatchLine({
    required this.title,
    required this.trailing,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Row(
          children: [
            Expanded(
              child: Text(title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTypography.body(size: 13, weight: FontWeight.w600)),
            ),
            const SizedBox(width: 8),
            Text(trailing,
                style: AppTypography.body(size: 11, color: AppColors.textMuted)),
          ],
        ),
      ),
    );
  }
}

/// Un partido ya jugado: resultado si hay equipos, y el MVP cuando quedó
/// definido en la evaluación.
class _PlayedMatchRow extends StatelessWidget {
  final MatchModel match;
  final String? mvpName;
  final String? mvpPhoto;
  final VoidCallback onTap;

  const _PlayedMatchRow({
    required this.match,
    required this.mvpName,
    required this.mvpPhoto,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final a = match.teamA;
    final b = match.teamB;
    final hasScore = a != null && b != null;

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(10),
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: AppColors.cardSurface.withValues(alpha: 0.5),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    hasScore ? '${a.name}  ${a.score} — ${b.score}  ${b.name}' : match.title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppTypography.body(size: 13, weight: FontWeight.w700),
                  ),
                ),
                const SizedBox(width: 8),
                Text(_fmtDate(match.date),
                    style: AppTypography.body(size: 11, color: AppColors.textMuted)),
              ],
            ),
            if (mvpName != null) ...[
              const SizedBox(height: 6),
              Row(
                children: [
                  CircleAvatar(
                    radius: 9,
                    backgroundColor: AppColors.card,
                    backgroundImage: mvpPhoto != null && mvpPhoto!.isNotEmpty
                        ? NetworkImage(mvpPhoto!)
                        : null,
                    child: mvpPhoto == null || mvpPhoto!.isEmpty
                        ? Text(mvpName![0].toUpperCase(),
                            style: AppTypography.code(size: 8))
                        : null,
                  ),
                  const SizedBox(width: 6),
                  Icon(Icons.emoji_events_rounded,
                      size: 12, color: const Color(0xFFFFC64A)),
                  const SizedBox(width: 4),
                  Text('MVP · ${mvpName!}',
                      style: AppTypography.code(
                          size: 10, color: const Color(0xFFFFC64A))),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _GroupHeroCard extends StatelessWidget {
  final GroupModel group;
  final GroupRole? role;

  const _GroupHeroCard({required this.group, this.role});

  Future<void> _shareInvite(BuildContext context) async {
    final text = '¡Sumate a nuestro grupo de fútbol "${group.name}" en Pateá! Usá este código para unirte: ${group.inviteCode}';
    final uri = Uri.parse('https://wa.me/?text=${Uri.encodeComponent(text)}');
    if (await canLaunchUrl(uri)) await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [AppColors.card, AppColors.cardSurface]),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.border.withValues(alpha: 0.5), width: 1.5),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Icon(Icons.groups_2_outlined, size: 14, color: AppColors.voltNeon),
            const SizedBox(width: 6),
            Text('GRUPO ACTIVO', style: AppTypography.code(size: 10, weight: FontWeight.w800, color: AppColors.voltNeon)),
            if (role != null) ...[
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.07),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(roleLabel(role!).toUpperCase(),
                    style: AppTypography.code(
                        size: 9, weight: FontWeight.w800, color: AppColors.textSecondary)),
              ),
            ],
          ]),
          const SizedBox(height: 8),
          Text(group.name, style: AppTypography.headline(size: 24, weight: FontWeight.w900), maxLines: 2, overflow: TextOverflow.ellipsis),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: InkWell(
                  onTap: () {
                    Clipboard.setData(ClipboardData(text: group.inviteCode));
                    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('¡Código copiado!'), backgroundColor: AppColors.success));
                  },
                  borderRadius: BorderRadius.circular(8),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    decoration: BoxDecoration(color: AppColors.background, borderRadius: BorderRadius.circular(8), border: Border.all(color: AppColors.border)),
                    child: Row(
                      children: [
                        Text('CÓDIGO', style: AppTypography.body(size: 10, color: AppColors.textMuted)),
                        const SizedBox(width: 8),
                        Expanded(child: Text(group.inviteCode, style: AppTypography.code(size: 14, weight: FontWeight.w800), overflow: TextOverflow.ellipsis)),
                        Icon(Icons.copy, size: 14, color: AppColors.textMuted),
                      ],
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              ElevatedButton.icon(
                onPressed: () => _shareInvite(context),
                style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF25D366), foregroundColor: Colors.white),
                icon: const Icon(Icons.share, size: 16),
                label: const Text('Invitar'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
