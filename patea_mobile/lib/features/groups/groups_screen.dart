import '../../core/services/ai_assist_service.dart';
import 'dart:io';

import '../../core/widgets/patea_activity_cover.dart';
import '../../core/widgets/patea_help_dialog.dart';
import '../../core/widgets/patea_section_scene.dart';
import '../../core/widgets/patea_button_progress.dart';
import 'package:flutter/material.dart';
import '../../core/widgets/patea_card.dart';
import '../../core/theme/app_radii.dart';
import '../../core/widgets/patea_snack.dart';
import '../../core/widgets/patea_avatar.dart';
import '../../core/widgets/patea_states.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/theme/patea_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/utils/dates.dart';
import '../../core/services/auth_service.dart';
import '../../core/services/firestore_service.dart';
import '../../core/services/group_service.dart';
import '../../core/services/location_service.dart';
import '../../core/models/group_model.dart';
import '../../core/models/match_model.dart';
import '../../core/models/player_model.dart';
import '../../core/models/venue_model.dart';
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
        title: Text(
          'Mis grupos',
          style: AppTypography.headline(size: 20, weight: FontWeight.w700),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.help_outline_rounded, size: 20),
            tooltip: 'Grupos y equipos',
            onPressed: () =>
                showContextualHelpSheet(context, topic: HelpTopic.groups),
          ),
          IconButton(
            icon: const Icon(Icons.login, size: 20),
            tooltip: 'Unirse a grupo',
            onPressed: () => _showJoinGroupDialog(context, ref),
          ),
          IconButton(
            icon: const Icon(Icons.add_circle_outline),
            tooltip: 'Crear grupo',
            onPressed: () => _showCreateGroupDialog(context, ref),
          ),
        ],
      ),
      body: uid == null ? const SizedBox() : _GroupsBody(uid: uid),
    );
  }

  static Future<void> _showCreateGroupDialog(
    BuildContext context,
    WidgetRef ref,
  ) async {
    final controller = TextEditingController();
    bool submitting = false;
    final route = DialogRoute<void>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          backgroundColor: context.c.card,
          title: Text('Crear grupo', style: AppTypography.headline(size: 20)),
          content: TextField(
            controller: controller,
            decoration: const InputDecoration(
              hintText: 'Nombre del grupo (ej. Los Pibes FC)',
            ),
          ),
          actions: [
            TextButton(
              onPressed: submitting ? null : () => Navigator.pop(context),
              child: const Text('Cancelar'),
            ),
            ElevatedButton(
              onPressed: submitting
                  ? null
                  : () async {
                      if (controller.text.trim().length < 3) return;
                      setDialogState(() => submitting = true);
                      try {
                        await ref
                            .read(groupServiceProvider)
                            .createGroup(controller.text.trim());
                        if (context.mounted) Navigator.pop(context);
                      } catch (e) {
                        setDialogState(() => submitting = false);
                        if (context.mounted) {
                          PateaSnack.error(context, '$e');
                        }
                      }
                    },
              style: ElevatedButton.styleFrom(
                backgroundColor: context.c.primary,
                foregroundColor: context.c.onPrimary,
              ),
              child: submitting
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: PateaButtonProgress(),
                    )
                  : const Text('Crear'),
            ),
          ],
        ),
      ),
    );
    await Navigator.of(context, rootNavigator: true).push(route);
    await route.completed;
    controller.dispose();
  }

  static Future<void> _showJoinGroupDialog(
    BuildContext context,
    WidgetRef ref,
  ) async {
    final controller = TextEditingController();
    bool submitting = false;
    final route = DialogRoute<void>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          backgroundColor: context.c.card,
          title: Text(
            'Unirse a grupo',
            style: AppTypography.headline(size: 20),
          ),
          content: TextField(
            controller: controller,
            decoration: const InputDecoration(hintText: 'Código de invitación'),
          ),
          actions: [
            TextButton(
              onPressed: submitting ? null : () => Navigator.pop(context),
              child: const Text('Cancelar'),
            ),
            ElevatedButton(
              onPressed: submitting
                  ? null
                  : () async {
                      if (controller.text.trim().isEmpty) return;
                      setDialogState(() => submitting = true);
                      try {
                        await ref
                            .read(groupServiceProvider)
                            .joinGroupByInviteCode(controller.text.trim());
                        if (context.mounted) Navigator.pop(context);
                      } catch (e) {
                        setDialogState(() => submitting = false);
                        if (context.mounted) {
                          PateaSnack.error(context, '$e');
                        }
                      }
                    },
              style: ElevatedButton.styleFrom(
                backgroundColor: context.c.primary,
                foregroundColor: context.c.onPrimary,
              ),
              child: submitting
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: PateaButtonProgress(),
                    )
                  : const Text('Unirme'),
            ),
          ],
        ),
      ),
    );
    await Navigator.of(context, rootNavigator: true).push(route);
    await route.completed;
    controller.dispose();
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
      loading: () => const PateaLoading(),
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
          color: context.c.primary.withValues(alpha: 0.08),
          radius: AppRadii.cardAll,
          borderColor: context.c.primary.withValues(alpha: 0.3),
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Icon(Icons.groups_2_outlined, color: context.c.primary),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  'No tenés un grupo seleccionado. Elegí uno debajo, o creá/unite a uno.',
                  style: AppTypography.body(
                    color: context.c.textSecondary,
                    size: 12,
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 18),
        groupsAsync.when(
          data: (groups) {
            if (groups.isEmpty) {
              return const PateaSectionScene(
                image: PateaSectionScene.groups,
                title: 'Tu cuadro empieza acá',
                description:
                    'Todavía no formás parte de ningún grupo. Creá uno o uníte con el código de tus amigos.',
              );
            }

            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Tus grupos',
                  style: AppTypography.headline(
                    size: 13,
                    weight: FontWeight.w800,
                    color: context.c.textSecondary,
                  ),
                ),
                const SizedBox(height: 10),
                ...groups.map(
                  (g) => Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: InkWell(
                      borderRadius: AppRadii.cardAll,
                      onTap: () async {
                        try {
                          await ref
                              .read(groupServiceProvider)
                              .setActiveGroup(g.id);
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
                            Icon(
                              Icons.shield_outlined,
                              color: context.c.primary,
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Text(
                                g.name,
                                style: AppTypography.body(
                                  color: context.c.textSecondary,
                                  size: 14,
                                  weight: FontWeight.w700,
                                ),
                              ),
                            ),
                            Icon(
                              Icons.chevron_right,
                              color: context.c.textSecondary,
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            );
          },
          loading: () => const PateaLoading(),
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
    final venuesAsync = ref.watch(groupVenuesStreamProvider(groupId));
    final matchesAsync = ref.watch(matchesStreamProvider(groupId));
    final playersAsync = ref.watch(playersStreamProvider(groupId));
    final myGroups =
        ref.watch(userGroupsStreamProvider(uid)).value ?? const <GroupModel>[];
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
        final recent =
            matches
                .where(
                  (m) => m.status == 'completed' || m.status == 'evaluated',
                )
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
            _GroupHeroCard(
              group: group,
              groups: myGroups,
              role: role,
              playersCount: playersAsync.value?.length,
              teamsCount: teamsAsync.value?.length,
              playedCount: matchesAsync.value == null ? null : recent.length,
            ),
            _GroupSummaryCard(groupId: groupId),
            const SizedBox(height: 20),

            _Section(
              icon: Icons.shield_outlined,
              title: 'Equipos',
              // Sin permiso el botón no va: `createTeam` lo rechaza igual y el
              // usuario se comería un error después de llenar el formulario.
              action: canCreateTeam
                  ? TextButton.icon(
                      onPressed: () =>
                          context.push('/groups/teams/new?groupId=$groupId'),
                      icon: const Icon(Icons.add, size: 16),
                      label: const Text('Crear equipo'),
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
                        style: AppTypography.body(
                          size: 12,
                          color: context.c.textSecondary,
                        ),
                      ),
                    );
                  }
                  return _GroupTeamDirectory(teams: teams);
                },
                loading: () => const PateaLoading(height: 96),
                error: (e, _) => PateaError(error: e, compact: true),
              ),
            ),
            const SizedBox(height: 20),

            _Section(
              icon: Icons.stadium_outlined,
              title: 'Canchas guardadas',
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  venuesAsync.when(
                    data: (venues) {
                      if (venues.isEmpty) {
                        return Padding(
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          child: Text(
                            'Todavía no hay canchas guardadas. Cuando creen un partido, la cancha se guarda acá automáticamente.',
                            style: AppTypography.body(
                              size: 12,
                              color: context.c.textSecondary,
                            ),
                          ),
                        );
                      }
                      return Column(
                        children: venues
                            .map(
                              (venue) => _GroupSavedVenueRow(
                                venue: venue,
                                groupId: groupId,
                              ),
                            )
                            .toList(),
                      );
                    },
                    loading: () => const PateaLoading(height: 80),
                    error: (e, _) => PateaError(error: e, compact: true),
                  ),
                  Divider(height: 16, color: context.c.overlayLine),
                  _GroupCountryRow(group: group, role: role),
                ],
              ),
            ),
            const SizedBox(height: 20),

            _Section(
              icon: Icons.manage_accounts_outlined,
              title: 'Miembros y roles (${group.members.length})',
              child: _GroupMembersSection(
                group: group,
                myRole: role,
                playersById: playersById,
              ),
            ),
            const SizedBox(height: 20),

            _Section(
              icon: Icons.newspaper_outlined,
              title: 'En agenda',
              child: upcoming.isEmpty
                  ? Text(
                      'No hay partidos próximos.',
                      style: AppTypography.body(
                        size: 12,
                        color: context.c.textSecondary,
                      ),
                    )
                  : Column(
                      children: upcoming
                          .take(5)
                          .map(
                            (m) => _MatchLine(
                              title: m.title,
                              trailing: m.time == null
                                  ? fmtDate(m.date)
                                  : '${fmtDate(m.date)} · ${m.time}',
                              onTap: () => context.push('/matches/${m.id}'),
                            ),
                          )
                          .toList(),
                    ),
            ),
            const SizedBox(height: 20),

            _Section(
              icon: Icons.history,
              title: 'Últimos partidos',
              action: recent.isEmpty
                  ? null
                  : TextButton(
                      onPressed: () => context.go('/matches'),
                      child: const Text('Ver todos'),
                    ),
              child: recent.isEmpty
                  ? Text(
                      'Todavía no jugaron ningún partido.',
                      style: AppTypography.body(
                        size: 12,
                        color: context.c.textSecondary,
                      ),
                    )
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
                title: 'Amistosos entre grupos',
                child: Column(
                  children: friendlies
                      .take(5)
                      .map(
                        (m) => _MatchLine(
                          title: m.title,
                          trailing: fmtDate(m.date),
                          onTap: () => context.push('/matches/${m.id}'),
                        ),
                      )
                      .toList(),
                ),
              ),
            ],
          ],
        );
      },
      loading: () => const PateaLoading(),
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

class _GroupTeamDirectory extends StatelessWidget {
  final List<GroupTeamModel> teams;

  const _GroupTeamDirectory({required this.teams});

  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, constraints) {
      const gap = 10.0;
      final grid =
          constraints.maxWidth >= 300 &&
          MediaQuery.textScalerOf(context).scale(16) <= 20;
      return Wrap(
        spacing: gap,
        runSpacing: gap,
        children: [
          for (final team in teams)
            SizedBox(
              width: grid
                  ? (constraints.maxWidth - gap) / 2
                  : constraints.maxWidth,
              child: _GroupTeamTile(team: team, compact: !grid),
            ),
        ],
      );
    },
  );
}

class _GroupTeamTile extends StatelessWidget {
  final GroupTeamModel team;
  final bool compact;

  const _GroupTeamTile({required this.team, required this.compact});

  @override
  Widget build(BuildContext context) {
    final colors = context.c;
    final jersey = JerseyWidget(
      jersey: team.jersey,
      teamName: team.name,
      size: compact ? 42 : 52,
    );
    const nameSize = 16.0;
    const nameLineHeight = 1.25;
    final name = Text(
      team.name,
      maxLines: compact ? null : 2,
      overflow: compact ? null : TextOverflow.ellipsis,
      style: AppTypography.headline(
        size: nameSize,
        weight: FontWeight.w800,
      ).copyWith(height: nameLineHeight),
    );
    final identity = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (compact)
          name
        else
          ConstrainedBox(
            constraints: BoxConstraints(
              minHeight:
                  MediaQuery.textScalerOf(context).scale(nameSize) *
                  nameLineHeight *
                  2,
            ),
            child: name,
          ),
        const SizedBox(height: 3),
        Text(
          _rosterLine(team),
          style: AppTypography.body(size: 12, color: colors.textSecondary),
        ),
      ],
    );
    final arrow = Icon(
      Icons.chevron_right_rounded,
      size: 19,
      color: colors.textSecondary,
    );

    return Material(
      color: colors.card,
      shape: RoundedRectangleBorder(
        borderRadius: AppRadii.cardAll,
        side: BorderSide(color: colors.border),
      ),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => context.push('/groups/teams/${team.id}'),
        child: compact
            ? Padding(
                padding: const EdgeInsets.all(12),
                child: Row(
                  children: [
                    jersey,
                    const SizedBox(width: 12),
                    Expanded(child: identity),
                    arrow,
                  ],
                ),
              )
            : Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  ColoredBox(
                    color: Color.alphaBlend(
                      parseJerseyHexColor(
                        team.jersey.primaryColor,
                      ).withValues(alpha: 0.15),
                      colors.cardSurface,
                    ),
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(14, 9, 10, 9),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [jersey, arrow],
                      ),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(12, 9, 12, 11),
                    child: identity,
                  ),
                ],
              ),
      ),
    );
  }
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
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 18, color: context.c.primary),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  title,
                  style: AppTypography.headline(
                    size: 19,
                    weight: FontWeight.w800,
                    color: context.c.textPrimary,
                  ),
                ),
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
              child: Text(
                title,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AppTypography.body(
                  color: context.c.textSecondary,
                  size: 13,
                  weight: FontWeight.w600,
                ),
              ),
            ),
            const SizedBox(width: 8),
            Text(
              trailing,
              style: AppTypography.body(
                size: 12,
                color: context.c.textSecondary,
              ),
            ),
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
                    hasScore
                        ? '${a.name}  ${a.score} — ${b.score}  ${b.name}'
                        : match.title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppTypography.body(
                      color: context.c.textSecondary,
                      size: 13,
                      weight: FontWeight.w700,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Text(
                  fmtDate(match.date),
                  style: AppTypography.body(
                    size: 12,
                    color: context.c.textSecondary,
                  ),
                ),
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
                  Icon(
                    Icons.emoji_events_rounded,
                    size: 12,
                    color: context.c.goldText,
                  ),
                  const SizedBox(width: 4),
                  // Un nombre largo desbordaba la fila 84 px a 1,3×.
                  Expanded(
                    child: Text(
                      'MVP · ${mvpName!}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppTypography.body(
                        size: 12,
                        color: context.c.goldText,
                      ),
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

/// Un párrafo sobre el grupo, escrito con IA a partir de sus números. Es un
/// agregado: si todavía no está o falla, la pantalla sigue sin él.
class _GroupSummaryCard extends ConsumerWidget {
  final String groupId;
  const _GroupSummaryCard({required this.groupId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.c;
    final summary = ref.watch(groupSummaryProvider(groupId));
    final text = summary.asData?.value;
    if (summary.isLoading) {
      return Padding(
        padding: const EdgeInsets.only(top: 14),
        child: Text(
          'Armando el resumen del grupo…',
          style: AppTypography.body(size: 13, color: c.textSecondary),
        ),
      );
    }
    if (text == null || text.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(top: 14),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(top: 2),
            child: Icon(Icons.auto_awesome_outlined, size: 16, color: c.primary),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              text,
              style: AppTypography.body(size: 14, color: c.textSecondary),
            ),
          ),
        ],
      ),
    );
  }
}

class _GroupHeroCard extends ConsumerWidget {
  final GroupModel group;
  final List<GroupModel> groups;
  final GroupRole? role;
  final int? playersCount, teamsCount, playedCount;
  const _GroupHeroCard({
    required this.group,
    required this.groups,
    this.role,
    this.playersCount,
    this.teamsCount,
    this.playedCount,
  });
  Future<void> _shareInvite(BuildContext context) async {
    final text =
        '¡Sumate a nuestro grupo de fútbol "${group.name}" en Pateá! Usá este código para unirte: ${group.inviteCode}';
    final uri = Uri.parse('https://wa.me/?text=${Uri.encodeComponent(text)}');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        PateaActivityCover(
          image: PateaSectionScene.groups,
          title: group.name,
          compact: true,
          details: [
            if (playersCount != null) '$playersCount jugadores',
            if (teamsCount != null) '$teamsCount equipos',
            if (playedCount != null) '$playedCount partidos jugados',
          ].join(' · '),
        ),
        const SizedBox(height: 14),
        PateaCard(
          borderColor: context.c.border,
          padding: const EdgeInsets.fromLTRB(12, 12, 12, 4),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Wrap(
                spacing: 14,
                runSpacing: 6,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: [
                  if (groups.length > 1)
                    PopupMenuButton<GroupModel>(
                      tooltip: 'Cambiar de grupo',
                      initialValue: group,
                      onSelected: (selected) async {
                        if (selected.id == group.id) return;
                        try {
                          await ref
                              .read(groupServiceProvider)
                              .setActiveGroup(selected.id);
                          if (context.mounted) {
                            PateaSnack.info(
                              context,
                              'Grupo activo: ${selected.name}',
                            );
                          }
                        } catch (e) {
                          if (context.mounted) PateaSnack.error(context, '$e');
                        }
                      },
                      itemBuilder: (_) => [
                        for (final option in groups)
                          CheckedPopupMenuItem(
                            value: option,
                            checked: option.id == group.id,
                            child: Text(option.name),
                          ),
                      ],
                      child: Padding(
                        padding: const EdgeInsets.symmetric(vertical: 10),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              'Grupo activo',
                              style: AppTypography.body(
                                size: 13,
                                weight: FontWeight.w700,
                                color: context.c.primary,
                              ),
                            ),
                            Icon(
                              Icons.expand_more,
                              size: 17,
                              color: context.c.primary,
                            ),
                          ],
                        ),
                      ),
                    )
                  else
                    Text(
                      'Grupo activo',
                      style: AppTypography.body(
                        size: 13,
                        weight: FontWeight.w700,
                        color: context.c.primary,
                      ),
                    ),
                  if (role != null)
                    Text(
                      roleLabel(role!),
                      style: AppTypography.body(
                        size: 13,
                        color: context.c.textSecondary,
                      ),
                    ),
                ],
              ),
              Divider(height: 16, color: context.c.overlayLine),
              Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Código de invitación',
                          style: AppTypography.body(
                            size: 12,
                            color: context.c.textSecondary,
                          ),
                        ),
                        const SizedBox(height: 4),
                        SelectableText(
                          group.inviteCode,
                          style: AppTypography.body(
                            size: 17,
                            weight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    tooltip: 'Copiar código de invitación',
                    onPressed: () async {
                      await Clipboard.setData(
                        ClipboardData(text: group.inviteCode),
                      );
                      if (context.mounted) {
                        PateaSnack.ok(context, '¡Código copiado!');
                      }
                    },
                    icon: const Icon(Icons.copy_outlined, size: 21),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Align(
                alignment: AlignmentDirectional.centerStart,
                child: TextButton.icon(
                  onPressed: () => _shareInvite(context),
                  icon: const Icon(Icons.share_outlined, size: 17),
                  label: const Text('Invitar al grupo'),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _GroupCountryRow extends ConsumerWidget {
  final GroupModel group;
  final GroupRole? role;

  const _GroupCountryRow({required this.group, required this.role});

  Future<void> _pickGroupCountry(BuildContext context, WidgetRef ref) async {
    final options = kSupportedCountries.where((c) => c.code != null).toList();
    final current = LocationService.defaultCountryCode(
      groupCountryCode: group.countryCode,
    );
    final picked = await showModalBottomSheet<String>(
      context: context,
      backgroundColor: context.c.card,
      shape: const RoundedRectangleBorder(borderRadius: AppRadii.surfaceTop),
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: 12),
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: ctx.c.border,
                borderRadius: AppRadii.hairAll,
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 14, 20, 8),
              child: Row(
                children: [
                  Icon(Icons.public, size: 20, color: ctx.c.primary),
                  const SizedBox(width: 8),
                  Text(
                    'País por defecto del grupo',
                    style: AppTypography.headline(size: 16),
                  ),
                ],
              ),
            ),
            Flexible(
              child: ListView.builder(
                shrinkWrap: true,
                itemCount: options.length,
                itemBuilder: (ctx, i) {
                  final option = options[i];
                  final selected = option.code == current;
                  return ListTile(
                    leading: Text(
                      option.flag,
                      style: const TextStyle(fontSize: 22),
                    ),
                    title: Text(
                      option.name,
                      style: AppTypography.body(
                        color: ctx.c.textPrimary,
                        weight: selected ? FontWeight.w700 : FontWeight.w500,
                      ),
                    ),
                    trailing: selected
                        ? Icon(Icons.check_circle, color: ctx.c.primary)
                        : null,
                    onTap: () => Navigator.of(ctx).pop(option.code),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
    if (picked == null || !context.mounted) return;
    try {
      await ref
          .read(groupServiceProvider)
          .setGroupCountry(groupId: group.id, countryCode: picked);
      if (context.mounted) {
        final chosen = findCountryOption(picked);
        PateaSnack.ok(
          context,
          'País del grupo actualizado a ${chosen.flag} ${chosen.name}',
        );
      }
    } catch (e) {
      if (context.mounted) {
        PateaSnack.error(context, 'No se pudo cambiar el país: $e');
      }
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final country = findCountryOption(
      LocationService.defaultCountryCode(groupCountryCode: group.countryCode),
    );
    final canEditCountry =
        role == GroupRole.admin || role == GroupRole.moderator;
    return Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'País de búsqueda de canchas',
                style: AppTypography.body(
                  size: 12,
                  color: context.c.textSecondary,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                '${country.flag} ${country.name}',
                style: AppTypography.body(size: 15, weight: FontWeight.w600),
              ),
            ],
          ),
        ),
        if (canEditCountry)
          TextButton.icon(
            onPressed: () => _pickGroupCountry(context, ref),
            icon: const Icon(Icons.edit_outlined, size: 17),
            label: const Text('Cambiar'),
          ),
      ],
    );
  }
}

class _GroupSavedVenueRow extends ConsumerStatefulWidget {
  final VenueModel venue;
  final String groupId;

  const _GroupSavedVenueRow({required this.venue, required this.groupId});

  @override
  ConsumerState<_GroupSavedVenueRow> createState() =>
      _GroupSavedVenueRowState();
}

class _GroupSavedVenueRowState extends ConsumerState<_GroupSavedVenueRow> {
  bool _uploading = false;

  Future<void> _uploadPhoto() async {
    final picker = ImagePicker();
    final xfile = await picker.pickImage(
      source: ImageSource.gallery,
      maxWidth: 1280,
      imageQuality: 85,
    );
    if (xfile == null || !mounted) return;

    setState(() => _uploading = true);
    try {
      final photoUrl = await LocationService().uploadCustomVenuePhoto(
        groupId: widget.groupId,
        venueId: widget.venue.id,
        file: File(xfile.path),
      );
      await ref
          .read(groupServiceProvider)
          .updateGroupVenue(
            groupId: widget.groupId,
            venueId: widget.venue.id,
            photoUrl: photoUrl,
          );
      if (mounted) {
        PateaSnack.ok(context, 'Foto de ${widget.venue.name} actualizada');
      }
    } catch (e) {
      if (mounted) {
        PateaSnack.error(context, 'No se pudo subir la foto: $e');
      }
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final v = widget.venue;
    final hasPhoto = v.photoUrl != null && v.photoUrl!.isNotEmpty;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 7),
      child: Row(
        children: [
          ClipRRect(
            borderRadius: AppRadii.chipAll,
            child: SizedBox(
              width: 48,
              height: 48,
              child: hasPhoto
                  ? Image.network(
                      v.photoUrl!,
                      fit: BoxFit.cover,
                      errorBuilder: (_, _, _) => Container(
                        color: context.c.card,
                        child: Icon(
                          Icons.stadium_outlined,
                          color: context.c.textSecondary,
                        ),
                      ),
                    )
                  : Container(
                      color: context.c.card,
                      child: Icon(
                        Icons.stadium_outlined,
                        color: context.c.textSecondary,
                      ),
                    ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  v.name,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: AppTypography.body(
                    size: 14,
                    weight: FontWeight.w700,
                    color: context.c.textPrimary,
                  ),
                ),
                if (v.address.trim().isNotEmpty &&
                    v.address.trim() != v.name.trim())
                  Text(
                    v.address,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: AppTypography.body(
                      size: 12,
                      color: context.c.textSecondary,
                    ),
                  ),
                const SizedBox(height: 2),
                Text(
                  '${v.usageCount} ${v.usageCount == 1 ? 'partido' : 'partidos'}',
                  style: AppTypography.body(
                    size: 11,
                    weight: FontWeight.w600,
                    color: context.c.textSecondary,
                  ),
                ),
              ],
            ),
          ),
          IconButton(
            onPressed: _uploading ? null : _uploadPhoto,
            tooltip: hasPhoto ? 'Cambiar foto' : 'Subir foto',
            icon: _uploading
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : Icon(
                    Icons.add_a_photo_outlined,
                    size: 20,
                    color: context.c.textSecondary,
                  ),
          ),
        ],
      ),
    );
  }
}

class _GroupMembersSection extends ConsumerStatefulWidget {
  final GroupModel group;
  final GroupRole? myRole;
  final Map<String, PlayerModel> playersById;

  const _GroupMembersSection({
    required this.group,
    required this.myRole,
    required this.playersById,
  });

  @override
  ConsumerState<_GroupMembersSection> createState() =>
      _GroupMembersSectionState();
}

class _GroupMembersSectionState extends ConsumerState<_GroupMembersSection> {
  String? _busyUid;

  GroupRole _parseRole(String raw) => switch (raw) {
    'admin' => GroupRole.admin,
    'moderator' => GroupRole.moderator,
    _ => GroupRole.member,
  };

  Future<void> _changeRole(String memberUid, GroupRole nextRole) async {
    setState(() => _busyUid = memberUid);
    try {
      await ref
          .read(groupServiceProvider)
          .setGroupMemberRole(
            groupId: widget.group.id,
            userId: memberUid,
            role: nextRole,
          );
      if (mounted) {
        PateaSnack.ok(context, 'Rol actualizado a ${roleLabel(nextRole)}');
      }
    } catch (e) {
      if (mounted) {
        PateaSnack.error(context, 'No se pudo cambiar el rol: $e');
      }
    } finally {
      if (mounted) setState(() => _busyUid = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final canManageRoles = widget.myRole == GroupRole.admin;
    final members = widget.group.members;
    if (members.isEmpty) {
      return Text(
        'No hay miembros en el grupo.',
        style: AppTypography.body(size: 12, color: context.c.textSecondary),
      );
    }

    return Column(
      children: members.map((memberUid) {
        final player = widget.playersById[memberUid];
        final isOwner = memberUid == widget.group.ownerUid;
        final memberRole = _parseRole(widget.group.roleFor(memberUid));
        final displayName =
            player?.name ?? (isOwner ? 'Creador del grupo' : 'Jugador');

        return PateaCard(
          color: context.c.cardSurface.withValues(alpha: 0.5),
          radius: AppRadii.cardAll,
          margin: const EdgeInsets.only(bottom: 8),
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
          child: Row(
            children: [
              PateaAvatar(
                photoUrl: player?.photoUrl,
                seed: displayName,
                size: 36,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      displayName,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppTypography.body(
                        size: 13,
                        weight: FontWeight.w700,
                        color: context.c.textPrimary,
                      ),
                    ),
                    Text(
                      isOwner ? 'Creador · Admin' : roleLabel(memberRole),
                      style: AppTypography.body(
                        size: 11,
                        color: memberRole == GroupRole.member
                            ? context.c.textSecondary
                            : context.c.primary,
                      ),
                    ),
                  ],
                ),
              ),
              if (canManageRoles && !isOwner)
                _busyUid == memberUid
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : PopupMenuButton<GroupRole>(
                        initialValue: memberRole,
                        onSelected: (next) {
                          if (next != memberRole) _changeRole(memberUid, next);
                        },
                        itemBuilder: (_) => [
                          const PopupMenuItem(
                            value: GroupRole.admin,
                            child: Text('Admin (grupo y partidos)'),
                          ),
                          const PopupMenuItem(
                            value: GroupRole.moderator,
                            child: Text('Moderador (equipos y partidos)'),
                          ),
                          const PopupMenuItem(
                            value: GroupRole.member,
                            child: Text('Miembro'),
                          ),
                        ],
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 6,
                          ),
                          decoration: BoxDecoration(
                            color: context.c.card,
                            borderRadius: AppRadii.pillAll,
                            border: Border.all(color: context.c.border),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                roleLabel(memberRole),
                                style: AppTypography.body(
                                  size: 11,
                                  weight: FontWeight.w700,
                                  color: context.c.textPrimary,
                                ),
                              ),
                              const SizedBox(width: 2),
                              Icon(
                                Icons.arrow_drop_down,
                                size: 16,
                                color: context.c.textSecondary,
                              ),
                            ],
                          ),
                        ),
                      ),
            ],
          ),
        );
      }).toList(),
    );
  }
}
