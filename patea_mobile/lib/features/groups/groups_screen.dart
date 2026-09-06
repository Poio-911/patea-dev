import 'package:flutter/material.dart';
import '../../core/widgets/patea_card.dart';
import '../../core/theme/app_radii.dart';
import '../../core/widgets/patea_snack.dart';
import '../../core/widgets/patea_avatar.dart';
import '../../core/widgets/patea_states.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/theme/patea_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/utils/dates.dart';
import '../../core/services/auth_service.dart';
import '../../core/services/firestore_service.dart';
import '../../core/services/group_service.dart';
import '../../core/models/group_model.dart';
import '../../core/models/match_model.dart';
import '../../core/models/player_model.dart';
import '../../core/models/group_permissions.dart';
import '../../core/widgets/jersey_painter.dart';




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
      // El router envuelve esta ruta en `PateaBackground`. Sin esto, el
      // Scaffold pinta su color opaco encima y tapa la foto de cancha.
      backgroundColor: Colors.transparent,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
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
          backgroundColor: context.c.card,
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
                          PateaSnack.error(context, '$e');
                        }
                      }
                    },
              style: ElevatedButton.styleFrom(backgroundColor: context.c.primary, foregroundColor: context.c.onPrimary),
              child: submitting
                  ? SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: context.c.onPrimary))
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
          backgroundColor: context.c.card,
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
                          PateaSnack.error(context, '$e');
                        }
                      }
                    },
              style: ElevatedButton.styleFrom(backgroundColor: context.c.primary, foregroundColor: context.c.onPrimary),
              child: submitting
                  ? SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: context.c.onPrimary))
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
      error: (e, _) => PateaError(error: e),
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
        PateaCard(
          color: context.c.brandVolt.withValues(alpha: 0.08),
          radius: AppRadii.cardAll,
          borderColor: context.c.brandVolt.withValues(alpha: 0.3),
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Icon(Icons.groups_2_outlined, color: context.c.primary),
              const SizedBox(width: 12),
              Expanded(
                child: Text('No tenés un grupo seleccionado. Elegí uno debajo, o creá/unite a uno.', style: AppTypography.body(color: context.c.textSecondary, size: 12)),
              ),
            ],
          ),
        ),
        const SizedBox(height: 18),
        groupsAsync.when(
          data: (groups) {
            if (groups.isEmpty) {
              return PateaCard(
                       color: context.c.card,
                       radius: AppRadii.cardAll,
                       padding: const EdgeInsets.all(28),
                       child: Column(
                  children: [
                    Icon(Icons.groups_2_outlined, size: 40, color: context.c.textSecondary),
                    const SizedBox(height: 10),
                    Text('Todavía no formás parte de ningún grupo', style: AppTypography.body(size: 13, color: context.c.textSecondary), textAlign: TextAlign.center),
                  ],
                ),
                     );
            }
            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('TUS GRUPOS', style: AppTypography.headline(size: 12, weight: FontWeight.w800, color: context.c.textSecondary)),
                const SizedBox(height: 10),
                ...groups.map((g) => Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: InkWell(
                        borderRadius: AppRadii.cardAll,
                        onTap: () async {
                          try {
                            await ref.read(groupServiceProvider).setActiveGroup(g.id);
                          } catch (e) {
                            if (context.mounted) {
                              PateaSnack.error(context, '$e');
                            }
                          }
                        },
                        child: PateaCard(
                                 color: context.c.card,
                                 radius: AppRadii.cardAll,
                                 borderColor: context.c.border.withValues(alpha: 0.5),
                                 padding: const EdgeInsets.all(14),
                                 child: Row(
                            children: [
                              Icon(Icons.shield_outlined, color: context.c.primary),
                              const SizedBox(width: 12),
                              Expanded(child: Text(g.name, style: AppTypography.body(color: context.c.textSecondary, size: 14, weight: FontWeight.w700))),
                              Icon(Icons.chevron_right, color: context.c.textSecondary),
                            ],
                          ),
                               ),
                      ),
                    )),
              ],
            );
          },
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => PateaError(error: e, compact: true),
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
                                        PateaSnack.info(context, 'Grupo activo: ${g.name}');
                                      }
                                    } catch (e) {
                                      if (context.mounted) {
                                        PateaSnack.error(context, '$e');
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
                        style: AppTypography.body(size: 12, color: context.c.textSecondary),
                      ),
                    );
                  }
                  return Column(
                    children: teams
                        .map((team) => InkWell(
                              onTap: () => context.push('/groups/teams/${team.id}'),
                              borderRadius: AppRadii.cardAll,
                              child: PateaCard(
                                       color: context.c.cardSurface.withValues(alpha: 0.5),
                                       radius: AppRadii.cardAll,
                                       margin: const EdgeInsets.only(bottom: 8),
                                       padding: const EdgeInsets.all(10),
                                       child: Row(
                                  children: [
                                    JerseyWidget(jersey: team.jersey, size: 36),
                                    const SizedBox(width: 10),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text(team.name,
                                              style: AppTypography.body(color: context.c.textSecondary, size: 14, weight: FontWeight.w700)),
                                          Text(
                                            _rosterLine(team),
                                            style: AppTypography.body(
                                                size: 11, color: context.c.textSecondary),
                                          ),
                                        ],
                                      ),
                                    ),
                                    Icon(Icons.chevron_right,
                                        size: 18, color: context.c.textSecondary),
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
                error: (e, _) => PateaError(error: e, compact: true),
              ),
            ),
            const SizedBox(height: 20),

            _Section(
              icon: Icons.newspaper_outlined,
              title: 'EN AGENDA',
              child: upcoming.isEmpty
                  ? Text('No hay partidos próximos.',
                      style: AppTypography.body(size: 12, color: context.c.textSecondary))
                  : Column(
                      children: upcoming
                          .take(5)
                          .map((m) => _MatchLine(
                                title: m.title,
                                trailing: m.time == null
                                    ? fmtDate(m.date)
                                    : '${fmtDate(m.date)} · ${m.time}',
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
                      style: AppTypography.body(size: 12, color: context.c.textSecondary))
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
                            trailing: fmtDate(m.date),
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
      error: (e, _) => PateaError(error: e),
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
    return PateaCard(
             color: context.c.card.withValues(alpha: 0.4),
             radius: AppRadii.cardAll,
             borderColor: context.c.border.withValues(alpha: 0.4),
             padding: const EdgeInsets.all(16),
             child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 18, color: context.c.primary),
              const SizedBox(width: 8),
              Expanded(
                child: Text(title,
                    style: AppTypography.headline(
                        size: 13,
                        weight: FontWeight.w800,
                        color: context.c.primary)),
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
      borderRadius: AppRadii.cardAll,
      child: PateaCard(
               color: active
              ? context.c.primary.withValues(alpha: 0.1)
              : context.c.cardSurface.withValues(alpha: 0.5),
               radius: AppRadii.cardAll,
               margin: const EdgeInsets.only(bottom: 8),
               padding: const EdgeInsets.all(10),
               child: Row(
          children: [
            Icon(
              active ? Icons.radio_button_checked : Icons.radio_button_off,
              size: 18,
              color: active ? context.c.primary : context.c.textSecondary,
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
                  color: active ? context.c.primary : context.c.textPrimary,
                ),
              ),
            ),
            if (active)
              Text('ACTIVO',
                  style: AppTypography.code(
                      size: 9,
                      weight: FontWeight.w800,
                      color: context.c.primary)),
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
                  style: AppTypography.body(color: context.c.textSecondary, size: 13, weight: FontWeight.w600)),
            ),
            const SizedBox(width: 8),
            Text(trailing,
                style: AppTypography.body(size: 11, color: context.c.textSecondary)),
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
      borderRadius: AppRadii.cardAll,
      child: PateaCard(
               color: context.c.cardSurface.withValues(alpha: 0.5),
               radius: AppRadii.cardAll,
               margin: const EdgeInsets.only(bottom: 8),
               padding: const EdgeInsets.all(10),
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
                    style: AppTypography.body(color: context.c.textSecondary, size: 13, weight: FontWeight.w700),
                  ),
                ),
                const SizedBox(width: 8),
                Text(fmtDate(match.date),
                    style: AppTypography.body(size: 11, color: context.c.textSecondary)),
              ],
            ),
            if (mvpName != null) ...[
              const SizedBox(height: 6),
              Row(
                children: [
                  PateaAvatar(
                    photoUrl: mvpPhoto,
                    seed: mvpName ?? '',
                    size: 18,
                  ),
                  const SizedBox(width: 6),
                  Icon(Icons.emoji_events_rounded,
                      size: 12, color: context.c.goldBorder),
                  const SizedBox(width: 4),
                  Text('MVP · ${mvpName!}',
                      style: AppTypography.code(
                          size: 10, color: context.c.goldBorder)),
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
        gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [context.c.card, context.c.cardSurface]),
        borderRadius: AppRadii.surfaceAll,
        border: Border.all(color: context.c.border.withValues(alpha: 0.5), width: 1.5),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Icon(Icons.groups_2_outlined, size: 14, color: context.c.primary),
            const SizedBox(width: 6),
            Text('GRUPO ACTIVO', style: AppTypography.code(size: 10, weight: FontWeight.w800, color: context.c.primary)),
            if (role != null) ...[
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: context.c.overlaySubtle,
                  borderRadius: AppRadii.surfaceAll,
                ),
                child: Text(roleLabel(role!).toUpperCase(),
                    style: AppTypography.code(
                        size: 9, weight: FontWeight.w800, color: context.c.textSecondary)),
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
                    PateaSnack.ok(context, '¡Código copiado!');
                  },
                  borderRadius: AppRadii.chipAll,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    decoration: BoxDecoration(color: context.c.background, borderRadius: AppRadii.chipAll, border: Border.all(color: context.c.border)),
                    child: Row(
                      children: [
                        Text('CÓDIGO', style: AppTypography.body(size: 10, color: context.c.textSecondary)),
                        const SizedBox(width: 8),
                        Expanded(child: Text(group.inviteCode, style: AppTypography.code(color: context.c.textSecondary, size: 14, weight: FontWeight.w800), overflow: TextOverflow.ellipsis)),
                        Icon(Icons.copy, size: 14, color: context.c.textSecondary),
                      ],
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              ElevatedButton.icon(
                onPressed: () => _shareInvite(context),
                style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF25D366), foregroundColor: context.c.textPrimary),
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
