import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/models/competition_model.dart';
import '../../core/models/group_model.dart';
import '../../core/services/competition_service.dart';
import '../../core/services/firestore_service.dart';
import '../../core/theme/app_typography.dart';
import '../../core/theme/patea_colors.dart';
import '../../core/widgets/jersey_painter.dart';
import '../../core/widgets/patea_avatar.dart';
import '../../core/widgets/patea_card.dart';
import '../../core/widgets/patea_snack.dart';
import '../../core/widgets/patea_states.dart';
import '../../core/widgets/patea_tabs.dart';
import 'competition_applications.dart';
import 'competition_dialogs.dart';
import 'competition_insights.dart';
import 'competition_management.dart';
import 'competition_match_card.dart';
import 'competitions_screen.dart'
    show competitionStatusLabel, competitionFormat;

class CompetitionHubScreen extends ConsumerStatefulWidget {
  final String collection, id;
  const CompetitionHubScreen({
    super.key,
    required this.collection,
    required this.id,
  });
  @override
  ConsumerState<CompetitionHubScreen> createState() => _HubState();
}

class _HubState extends ConsumerState<CompetitionHubScreen> {
  int _tab = 0, _stat = 0;
  String? _teamId, _cupRound;
  int? _leagueRound;
  bool _busy = false, _mineOnly = false, _fullBracket = false;
  (String, String) get _key => (widget.collection, widget.id);
  Future<Map<String, dynamic>?> _command(
    String action, [
    Map<String, dynamic> data = const {},
  ]) async {
    if (_busy) return null;
    setState(() => _busy = true);
    try {
      return await ref
          .read(competitionServiceProvider)
          .command(widget.collection, widget.id, action, data);
    } catch (e) {
      if (mounted) PateaSnack.error(context, competitionError(e));
      return null;
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _start(CompetitionModel c) async {
    if (c.type == 'cup') {
      final seeding = await competitionSeedingDialog(context);
      if (seeding != null && mounted) {
        await _command('startCup', {'seedingType': seeding});
      }
    } else {
      final schedule = await competitionScheduleDialog(
        context,
        title: 'La primera fecha de tu liga',
        date: c.startDate,
        time: c.matchTime,
        location: c.defaultLocation,
      );
      if (schedule == null || !mounted) return;
      setState(() => _busy = true);
      try {
        await ref
            .read(competitionServiceProvider)
            .startLeague(c.id, schedule, c.matchFrequency);
      } catch (e) {
        if (mounted) PateaSnack.error(context, competitionError(e));
      } finally {
        if (mounted) setState(() => _busy = false);
      }
    }
  }

  Future<void> _schedule(CompetitionModel c, Map<String, dynamic> m) async {
    final data = await competitionScheduleDialog(
      context,
      title: 'Programar este partido',
      date: m['date'] as String?,
      time: m['time'] as String? ?? c.matchTime,
      location: m['location'] is Map
          ? Map<String, dynamic>.from(m['location'])
          : {},
    );
    if (data != null && mounted) {
      await _command('scheduleMatch', {'matchId': m['id'], ...data});
    }
  }

  Future<void> _openCup(BracketMatchModel b) async {
    if (b.matchId != null) {
      context.push('/matches/${b.matchId}');
      return;
    }
    if (_busy) return;
    setState(() => _busy = true);
    try {
      final id = await ref
          .read(competitionServiceProvider)
          .prepareCupMatch(widget.id, b);
      if (mounted) context.push('/matches/$id');
    } catch (e) {
      if (mounted) PateaSnack.error(context, competitionError(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _finishLeague() async {
    final accepted = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Cerrar la liga'),
        content: const Text(
          'Se comprobará que todas las fechas estén resueltas. El campeón se define por puntos, diferencia y goles a favor. Si persiste un empate, vas a poder confirmar el desempate.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Comprobar y cerrar'),
          ),
        ],
      ),
    );
    if (accepted != true || !mounted) return;
    final result = await _command('completeLeague');
    if (result?['requiresTiebreaker'] == true && mounted) {
      final candidates = result!['candidates'] as List;
      final id = await showDialog<String>(
        context: context,
        builder: (context) => SimpleDialog(
          title: const Text('Confirmar el desempate deportivo'),
          children: [
            const Padding(
              padding: EdgeInsets.all(16),
              child: Text(
                'Estos equipos están igualados en los criterios de la tabla. Elegí al ganador del desempate acordado antes de cerrar.',
              ),
            ),
            for (final c in candidates)
              SimpleDialogOption(
                onPressed: () => Navigator.pop(context, c['id'] as String),
                child: Text(c['name'] as String),
              ),
          ],
        ),
      );
      if (id != null && mounted) {
        await _command('completeLeague', {'championTeamId': id});
      }
    }
  }

  Future<void> _menu(String action, CompetitionModel c) async {
    if (action == 'edit') {
      await Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => CreateCompetitionScreen(
            isCup: c.type == 'cup',
            groupId: c.groupId ?? '',
            competition: c,
          ),
        ),
      );
      return;
    }
    if (action == 'delete') {
      if (await confirmDeleteCompetition(context, ref, c) && mounted) {
        context.pop();
      }
      return;
    }
    if (action == 'archive') {
      final yes = await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('Archivar torneo'),
          content: const Text(
            'Conserva partidos, resultados y planteles. Se oculta de la lista habitual y podés restaurarlo desde Archivadas.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancelar'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Archivar'),
            ),
          ],
        ),
      );
      if (yes != true) return;
    }
    if (mounted) await _command(action);
  }

  @override
  Widget build(BuildContext context) {
    final detail = ref.watch(competitionDetailProvider(_key)),
        uid = ref.watch(currentUidProvider),
        c = detail.value;
    final owner = c != null && uid != null && c.ownerUid == uid;
    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        title: Text(
          c?.name ?? (widget.collection == 'cups' ? 'Copa' : 'Liga'),
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
          style: AppTypography.headline(size: 20, weight: FontWeight.w700),
        ),
        actions: [
          if (owner)
            PopupMenuButton<String>(
              tooltip: 'Administrar torneo',
              enabled: !_busy,
              onSelected: (v) => _menu(v, c),
              itemBuilder: (_) => [
                if (['draft', 'open_for_applications'].contains(c.status) &&
                    !c.isArchived)
                  const PopupMenuItem(
                    value: 'edit',
                    child: Text('Configurar torneo'),
                  ),
                PopupMenuItem(
                  value: c.isArchived ? 'restore' : 'archive',
                  child: Text(
                    c.isArchived ? 'Restaurar torneo' : 'Archivar torneo',
                  ),
                ),
                if (['draft', 'open_for_applications'].contains(c.status))
                  const PopupMenuItem(
                    value: 'delete',
                    child: Text('Eliminar borrador'),
                  ),
              ],
            ),
        ],
      ),
      body: detail.when(
        loading: () => const PateaLoading(),
        error: (e, _) => PateaError(
          error: e,
          onRetry: () => ref.invalidate(competitionDetailProvider(_key)),
        ),
        data: (comp) {
          if (comp == null) {
            return const PateaEmpty(
              icon: Icons.emoji_events_outlined,
              title: 'El torneo ya no existe',
              hint: 'Puede haber sido eliminado por su organizador.',
            );
          }
          final teamState = ref.watch(
                competitionTeamsProvider((
                  widget.collection,
                  widget.id,
                  comp.teamIds.join(','),
                )),
              ),
              matchState = ref.watch(competitionMatchesProvider(_key));
          if (teamState.hasError) {
            return PateaError(
              error: teamState.error!,
              onRetry: () => ref.invalidate(
                competitionTeamsProvider((
                  widget.collection,
                  widget.id,
                  comp.teamIds.join(','),
                )),
              ),
            );
          }
          if (matchState.hasError) {
            return PateaError(
              error: matchState.error!,
              onRetry: () => ref.invalidate(competitionMatchesProvider(_key)),
            );
          }
          if (teamState.isLoading || matchState.isLoading) {
            return const PateaLoading();
          }
          final teams = teamState.value ?? [], matches = matchState.value ?? [];
          final names = <String, String>{
            for (final id in comp.teamIds)
              id: (comp.teamSnapshots[id]?['name'] ?? 'Equipo no disponible')
                  .toString(),
            for (final t in teams) t.id: t.name,
          };
          for (final m in matches) {
            final ids = m['participantTeamIds'] as List? ?? [],
                sides = m['teams'] as List? ?? [];
            for (var i = 0; i < ids.length && i < sides.length; i++) {
              names.putIfAbsent(
                ids[i].toString(),
                () => sides[i]['name']?.toString() ?? 'Equipo',
              );
            }
          }
          final table = competitionStandings(comp, names, matches);
          final mine =
              teams
                  .where(
                    (t) =>
                        uid != null &&
                        (t.createdBy == uid ||
                            t.members.any((m) => m.playerId == uid)),
                  )
                  .toList()
                ..sort((a, b) {
                  bool member(GroupTeamModel t) =>
                      t.members.any((m) => m.playerId == uid);
                  return member(a) == member(b)
                      ? a.name.compareTo(b.name)
                      : member(a)
                      ? -1
                      : 1;
                });
          final team =
              mine.where((t) => t.id == _teamId).firstOrNull ??
              mine.firstOrNull;
          final tabs = [
            'Resumen',
            comp.type == 'cup' ? 'Cruces' : 'Fechas',
            if (comp.type == 'league') 'Tabla',
            'Equipos',
            'Datos',
            if (owner) 'Gestión',
          ];
          final selected = _tab.clamp(0, tabs.length - 1),
              active = tabs[selected];
          return Column(
            children: [
              if (_busy) const LinearProgressIndicator(minHeight: 3),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                child: PateaTabs(
                  tabs: [for (final label in tabs) PateaTab(label)],
                  active: selected,
                  onChanged: (i) => setState(() => _tab = i),
                ),
              ),
              Expanded(
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(18, 20, 18, 32),
                  children: [
                    if (active == 'Resumen')
                      ..._overview(
                        comp,
                        owner,
                        uid,
                        teams,
                        matches,
                        table,
                        names,
                        mine,
                        team,
                      ),
                    if (active == 'Fechas')
                      ..._fixtures(comp, owner, matches, team),
                    if (active == 'Cruces') ..._bracket(comp, owner, matches),
                    if (active == 'Tabla')
                      ..._table(comp, table, teams, team?.id),
                    if (active == 'Equipos') ..._teams(comp, teams, names),
                    if (active == 'Datos') ..._stats(matches),
                    if (active == 'Gestión') ...[
                      Text(
                        'Tu torneo, bien organizado',
                        style: AppTypography.headline(size: 24),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        comp.isArchived
                            ? 'Está archivado. Restauralo para volver a administrar sus acciones.'
                            : 'Los cambios deportivos se habilitan según el estado del torneo.',
                        style: AppTypography.body(
                          size: 14,
                          color: context.c.textSecondary,
                        ),
                      ),
                      const SizedBox(height: 16),
                      if ([
                            'draft',
                            'open_for_applications',
                          ].contains(comp.status) &&
                          !comp.isArchived)
                        Wrap(
                          spacing: 12,
                          runSpacing: 8,
                          children: [
                            OutlinedButton.icon(
                              onPressed: _busy
                                  ? null
                                  : () => _menu('edit', comp),
                              icon: const Icon(Icons.tune),
                              label: const Text('Configurar torneo'),
                            ),
                            FilledButton.icon(
                              onPressed: _busy ? null : () => _start(comp),
                              icon: const Icon(Icons.play_arrow),
                              label: Text(
                                comp.type == 'cup'
                                    ? 'Sortear e iniciar'
                                    : 'Iniciar liga',
                              ),
                            ),
                          ],
                        ),
                      if (comp.type == 'league' &&
                          comp.status == 'in_progress' &&
                          !comp.isArchived)
                        OutlinedButton.icon(
                          onPressed: _busy ? null : _finishLeague,
                          icon: const Icon(Icons.emoji_events_outlined),
                          label: const Text('Cerrar liga y confirmar campeón'),
                        ),
                      const SizedBox(height: 28),
                      CompetitionApplicationsPanel(competition: comp),
                    ],
                  ],
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  List<Widget> _overview(
    CompetitionModel c,
    bool owner,
    String? uid,
    List<GroupTeamModel> teams,
    List<Map<String, dynamic>> matches,
    List<StandingRow> table,
    Map<String, String> names,
    List<GroupTeamModel> mine,
    GroupTeamModel? team,
  ) {
    final active =
        matches
            .where(
              (m) => ![
                'completed',
                'evaluated',
                'cancelled',
              ].contains(m['status']),
            )
            .toList()
          ..sort((a, b) {
            int rank(Map m) => m['status'] == 'active'
                ? 0
                : m['status'] == 'upcoming'
                ? 1
                : 2;
            return rank(a) != rank(b)
                ? rank(a).compareTo(rank(b))
                : (a['date'] ?? '9999').toString().compareTo(
                    (b['date'] ?? '9999').toString(),
                  );
          });
    final next =
        (team == null
                ? active
                : active.where(
                    (m) => (m['participantTeamIds'] as List? ?? []).contains(
                      team.id,
                    ),
                  ))
            .firstOrNull;
    final row = table.where((r) => r.teamId == team?.id).firstOrNull;
    final done = matches.where(confirmedMatch).length;
    return [
      Text(
        c.isArchived ? 'Archivada' : competitionStatusLabel(c.status),
        style: AppTypography.body(
          size: 14,
          color: c.status == 'in_progress'
              ? context.c.primary
              : context.c.textSecondary,
        ),
      ),
      const SizedBox(height: 8),
      Text(c.name, style: AppTypography.headline(size: 29)),
      const SizedBox(height: 8),
      Text(
        '${competitionFormat(c)} · ${c.teamIds.length}/${c.maxTeams} equipos${c.type == 'league' ? ' · ${c.matchFrequency == 'biweekly' ? 'Quincenal' : 'Semanal'}' : ''}',
        style: AppTypography.body(size: 14, color: context.c.textSecondary),
      ),
      if (c.description?.isNotEmpty == true)
        Padding(
          padding: const EdgeInsets.only(top: 12),
          child: Text(c.description!, style: AppTypography.body(size: 15)),
        ),
      const SizedBox(height: 20),
      Wrap(
        spacing: 28,
        runSpacing: 16,
        children: [
          _Metric('$done', 'Partidos finalizados'),
          _Metric('${matches.length}', 'Partidos creados'),
        ],
      ),
      if (c.championTeamId != null) ...[
        const SizedBox(height: 24),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(Icons.emoji_events, color: context.c.primary, size: 36),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Campeón',
                    style: AppTypography.body(
                      size: 13,
                      color: context.c.textSecondary,
                    ),
                  ),
                  Text(
                    c.championTeamName ??
                        names[c.championTeamId] ??
                        'Equipo campeón',
                    style: AppTypography.headline(size: 25),
                  ),
                ],
              ),
            ),
          ],
        ),
      ],
      if (c.resultConflict != null) ...[
        const SizedBox(height: 16),
        Text(
          'Hay un resultado que necesita revisión del organizador.',
          style: AppTypography.body(size: 14, color: context.c.destructive),
        ),
      ],
      const SizedBox(height: 28),
      if (team != null) ...[
        Text(
          mine.length > 1 ? 'Tus equipos en este torneo' : 'Tu equipo',
          style: AppTypography.headline(size: 21),
        ),
        const SizedBox(height: 12),
        if (mine.length > 1)
          DropdownButtonFormField<String>(
            key: ValueKey('my-team-${team.id}'),
            initialValue: team.id,
            isExpanded: true,
            decoration: const InputDecoration(labelText: 'Seguir a'),
            items: [
              for (final t in mine)
                DropdownMenuItem(
                  value: t.id,
                  child: Text(t.name, overflow: TextOverflow.ellipsis),
                ),
            ],
            onChanged: (v) => setState(() => _teamId = v),
          ),
        const SizedBox(height: 12),
        _TeamIdentity(team: team),
        const SizedBox(height: 12),
        if (c.type == 'league' && row != null)
          Wrap(
            spacing: 28,
            runSpacing: 12,
            children: [
              _Metric('${table.indexOf(row) + 1}°', 'Posición'),
              _Metric('${row.points}', 'Puntos'),
              _Metric('${row.played}', 'Jugados'),
            ],
          ),
        if (c.type == 'cup')
          Text(
            c.championTeamId == team.id
                ? 'Campeón del torneo'
                : c.bracket.any(
                    (b) =>
                        (b.team1Id == team.id || b.team2Id == team.id) &&
                        b.winnerId != null &&
                        b.winnerId != team.id,
                  )
                ? 'Participación finalizada'
                : 'Seguís en carrera',
            style: AppTypography.body(size: 15, color: context.c.primary),
          ),
        const SizedBox(height: 24),
      ],
      if (next != null) ...[
        Text(
          team != null ? 'Tu próximo partido' : 'Lo próximo que se juega',
          style: AppTypography.headline(size: 21),
        ),
        const SizedBox(height: 12),
        _card(c, next, owner),
      ],
      if (owner &&
          ['draft', 'open_for_applications'].contains(c.status) &&
          !c.isArchived) ...[
        const SizedBox(height: 20),
        FilledButton.icon(
          onPressed: _busy ? null : () => _start(c),
          icon: const Icon(Icons.play_arrow),
          label: Text(
            c.type == 'cup'
                ? 'Sortear e iniciar la copa'
                : 'Programar e iniciar la liga',
          ),
        ),
        const SizedBox(height: 8),
        Text(
          'Revisá participantes, planteles y configuración antes de comenzar.',
          style: AppTypography.body(size: 13, color: context.c.textSecondary),
        ),
      ],
      if (!owner && uid != null) ...[
        const SizedBox(height: 20),
        _myApplications(c, uid),
        if (c.isPublic && c.status == 'open_for_applications' && !c.isArchived)
          FilledButton.icon(
            onPressed: c.teamIds.length >= c.maxTeams
                ? null
                : () async {
                    final sent = await showModalBottomSheet<bool>(
                      context: context,
                      isScrollControlled: true,
                      builder: (_) => CompetitionApplySheet(competition: c),
                    );
                    if (sent == true && mounted) {
                      PateaSnack.ok(
                        context,
                        'Solicitud enviada al organizador.',
                      );
                    }
                  },
            icon: const Icon(Icons.shield_outlined),
            label: Text(
              c.teamIds.length >= c.maxTeams
                  ? 'Cupo completo'
                  : 'Inscribir mi equipo',
            ),
          ),
      ],
      const SizedBox(height: 24),
      Text('Información del torneo', style: AppTypography.headline(size: 20)),
      const SizedBox(height: 10),
      Text(
        'Visibilidad: ${c.isPublic ? 'Pública' : 'Del grupo'}',
        style: AppTypography.body(size: 14),
      ),
      const SizedBox(height: 6),
      if ((c.defaultLocation['name'] ?? '').toString().isNotEmpty)
        Text(
          'Sede: ${c.defaultLocation['name']}',
          style: AppTypography.body(size: 14),
        ),
      if (c.type == 'league')
        Padding(
          padding: const EdgeInsets.only(top: 6),
          child: Text(
            'Victoria ${c.rules['pointsForWin'] ?? 3} puntos · Empate ${c.rules['pointsForDraw'] ?? 1}',
            style: AppTypography.body(size: 14),
          ),
        ),
    ];
  }

  Widget _myApplications(CompetitionModel c, String uid) => ref
      .watch(myCompetitionApplicationsProvider((widget.collection, c.id, uid)))
      .when(
        loading: () => const SizedBox.shrink(),
        error: (e, _) => PateaError(error: e),
        data: (items) => Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            for (final a in items.where(
              (a) => ['pending', 'approved'].contains(a['status']),
            ))
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '${a['teamName'] ?? 'Tu equipo'}: ${a['status'] == 'approved' ? 'participación aprobada' : 'solicitud pendiente'}',
                      style: AppTypography.body(size: 14),
                    ),
                    if (a['status'] == 'pending')
                      TextButton(
                        onPressed: _busy
                            ? null
                            : () => _command('withdrawApplication', {
                                'applicationId': a['id'],
                              }),
                        child: const Text('Retirar solicitud'),
                      ),
                  ],
                ),
              ),
          ],
        ),
      );
  Widget _card(CompetitionModel c, Map<String, dynamic> m, bool owner) {
    final score = competitionScore(m);
    final unresolved =
        c.type == 'cup' &&
        confirmedMatch(m) &&
        score != null &&
        score['team1'] == score['team2'] &&
        m['penaltyWinnerId'] == null;
    return CompetitionMatchCard(
      match: m,
      busy: _busy,
      schedule:
          owner &&
              !c.isArchived &&
              ['planning', 'upcoming'].contains(m['status'])
          ? () => _schedule(c, m)
          : null,
      result:
          owner &&
              !c.isArchived &&
              c.status == 'in_progress' &&
              m['status'] != 'cancelled' &&
              (!confirmedMatch(m) || unresolved)
          ? () => competitionResultDialog(context, ref, c, m)
          : null,
    );
  }

  List<Widget> _fixtures(
    CompetitionModel c,
    bool owner,
    List<Map<String, dynamic>> matches,
    GroupTeamModel? team,
  ) {
    final rounds =
        matches
            .map(
              (m) =>
                  ((m['leagueInfo'] as Map?)?['round'] as num?)?.toInt() ?? 0,
            )
            .toSet()
            .toList()
          ..sort();
    if (rounds.isEmpty) {
      return const [
        PateaEmpty(
          icon: Icons.calendar_month_outlined,
          title: 'Las fechas se arman al iniciar',
          hint: 'El organizador elige el inicio y el ritmo de las jornadas.',
        ),
      ];
    }
    final pending = rounds
        .where(
          (r) => matches.any(
            (m) =>
                (m['leagueInfo']?['round'] ?? 0) == r &&
                !['completed', 'evaluated', 'cancelled'].contains(m['status']),
          ),
        )
        .firstOrNull;
    final selected = rounds.contains(_leagueRound)
        ? _leagueRound!
        : pending ?? rounds.last;
    final current =
        matches
            .where(
              (m) =>
                  (m['leagueInfo']?['round'] ?? 0) == selected &&
                  (!_mineOnly ||
                      team == null ||
                      (m['participantTeamIds'] as List? ?? []).contains(
                        team.id,
                      )),
            )
            .toList()
          ..sort(
            (a, b) => (a['date'] ?? '9999').toString().compareTo(
              (b['date'] ?? '9999').toString(),
            ),
          );
    return [
      Text('Una fecha a la vez', style: AppTypography.headline(size: 24)),
      const SizedBox(height: 12),
      PateaTabs(
        tabs: [for (final r in rounds) PateaTab('Fecha $r')],
        active: rounds.indexOf(selected),
        onChanged: (i) => setState(() => _leagueRound = rounds[i]),
      ),
      if (team != null)
        CheckboxListTile(
          contentPadding: EdgeInsets.zero,
          title: const Text('Sólo mi equipo'),
          value: _mineOnly,
          onChanged: (v) => setState(() => _mineOnly = v ?? false),
        ),
      const SizedBox(height: 16),
      if (current.isEmpty)
        const PateaEmpty(
          icon: Icons.self_improvement,
          title: 'Tu equipo descansa esta fecha',
          hint: 'Podés ver los otros partidos desmarcando el filtro.',
        ),
      for (final m in current)
        Padding(
          padding: const EdgeInsets.only(bottom: 14),
          child: _card(c, m, owner),
        ),
    ];
  }

  List<Widget> _bracket(
    CompetitionModel c,
    bool owner,
    List<Map<String, dynamic>> matches,
  ) {
    if (c.bracket.isEmpty) {
      return [
        const PateaEmpty(
          icon: Icons.account_tree_outlined,
          title: 'El cuadro todavía está abierto',
          hint:
              'Los cruces se generan al iniciar la copa. El sorteo puede ser libre o con cabezas por nivel.',
        ),
        if (owner && !c.isArchived)
          FilledButton.icon(
            onPressed: _busy ? null : () => _start(c),
            icon: const Icon(Icons.shuffle),
            label: const Text('Sortear e iniciar'),
          ),
      ];
    }
    const order = [
      'round_of_32',
      'round_of_16',
      'round_of_8',
      'semifinals',
      'final',
    ];
    final available = order
        .where((r) => c.bracket.any((b) => b.round == r))
        .toList();
    final selected = available.contains(_cupRound)
        ? _cupRound!
        : available.contains(c.currentRound)
        ? c.currentRound!
        : c.bracket.where((b) => b.winnerId == null).firstOrNull?.round ??
              available.last;
    final cards = [
      for (final b in c.bracket.where(
        (b) => _fullBracket || b.round == selected,
      ))
        Padding(
          padding: const EdgeInsets.only(bottom: 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (_fullBracket)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Text(
                    roundLabel(b.round),
                    style: AppTypography.body(
                      size: 13,
                      color: context.c.textSecondary,
                    ),
                  ),
                ),
              if (matches.any((m) => m['id'] == b.matchId))
                _card(c, matches.firstWhere((m) => m['id'] == b.matchId), owner)
              else
                PateaCard(
                  color: context.c.card,
                  borderColor: context.c.border,
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text(
                        '${b.team1Name ?? 'Equipo por definir'}  vs  ${b.team2Name ?? 'Equipo por definir'}',
                        style: AppTypography.headline(size: 18),
                      ),
                      if (b.scoreTeam1 != null && b.scoreTeam2 != null)
                        Padding(
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          child: Text(
                            '${b.scoreTeam1} — ${b.scoreTeam2}',
                            style: AppTypography.sportNumber(size: 30),
                          ),
                        ),
                      if (b.winnerId != null)
                        Padding(
                          padding: const EdgeInsets.only(top: 8),
                          child: Text(
                            'Avanza ${b.winnerId == b.team1Id ? b.team1Name : b.team2Name}',
                            style: AppTypography.body(
                              size: 14,
                              color: context.c.primary,
                            ),
                          ),
                        ),
                      if (b.matchId != null)
                        Consumer(
                          builder: (context, ref, _) => ref
                              .watch(singleMatchStreamProvider(b.matchId!))
                              .when(
                                loading: () => const LinearProgressIndicator(),
                                error: (e, _) => TextButton(
                                  onPressed: () => ref.invalidate(
                                    singleMatchStreamProvider(b.matchId!),
                                  ),
                                  child: const Text(
                                    'Reintentar vínculo al partido',
                                  ),
                                ),
                                data: (match) => match == null
                                    ? Padding(
                                        padding: const EdgeInsets.only(top: 12),
                                        child: Text(
                                          'El partido vinculado ya no está disponible. Se conserva el resultado del cruce.',
                                          style: AppTypography.body(
                                            size: 13,
                                            color: context.c.textSecondary,
                                          ),
                                        ),
                                      )
                                    : TextButton.icon(
                                        onPressed: () => _openCup(b),
                                        icon: const Icon(Icons.open_in_new),
                                        label: const Text('Abrir partido'),
                                      ),
                              ),
                        )
                      else if (b.winnerId == null &&
                          b.team1Id != null &&
                          b.team2Id != null &&
                          owner &&
                          !c.isArchived)
                        FilledButton.icon(
                          onPressed: _busy ? null : () => _openCup(b),
                          icon: const Icon(Icons.sports_soccer),
                          label: const Text('Preparar y abrir partido'),
                        )
                      else
                        Padding(
                          padding: const EdgeInsets.only(top: 10),
                          child: Text(
                            b.winnerId != null
                                ? 'Resultado histórico sin partido vinculado'
                                : b.team1Id == null || b.team2Id == null
                                ? 'Esperando ganadores de la ronda anterior'
                                : 'El organizador todavía no preparó el partido.',
                            style: AppTypography.body(
                              size: 13,
                              color: context.c.textSecondary,
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
            ],
          ),
        ),
    ];
    return [
      Row(
        children: [
          Expanded(
            child: Text(
              'La próxima ronda se gana acá',
              style: AppTypography.headline(size: 23),
            ),
          ),
          IconButton(
            tooltip: _fullBracket ? 'Ver ronda actual' : 'Ver cuadro completo',
            onPressed: () => setState(() => _fullBracket = !_fullBracket),
            icon: Icon(
              _fullBracket
                  ? Icons.view_agenda_outlined
                  : Icons.account_tree_outlined,
            ),
          ),
        ],
      ),
      const SizedBox(height: 12),
      if (!_fullBracket)
        PateaTabs(
          tabs: [for (final r in available) PateaTab(roundLabel(r))],
          active: available.indexOf(selected),
          onChanged: (i) => setState(() => _cupRound = available[i]),
        ),
      const SizedBox(height: 16),
      ...cards,
    ];
  }

  List<Widget> _table(
    CompetitionModel c,
    List<StandingRow> rows,
    List<GroupTeamModel> teams,
    String? mine,
  ) {
    return [
      Text('Cada punto cuenta', style: AppTypography.headline(size: 24)),
      const SizedBox(height: 8),
      Text(
        'Orden: puntos, diferencia de goles y goles a favor. Tocá un equipo para ver su campaña.',
        style: AppTypography.body(size: 14, color: context.c.textSecondary),
      ),
      const SizedBox(height: 18),
      Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12),
        child: Row(
          children: [
            Expanded(
              child: Text('Equipo', style: AppTypography.body(size: 12)),
            ),
            for (final s in ['PJ', 'DG', 'Pts'])
              SizedBox(
                width: 38,
                child: Text(
                  s,
                  textAlign: TextAlign.center,
                  style: AppTypography.body(
                    size: 12,
                    color: context.c.textSecondary,
                  ),
                ),
              ),
          ],
        ),
      ),
      for (var i = 0; i < rows.length; i++)
        ExpansionTile(
          tilePadding: const EdgeInsets.symmetric(horizontal: 8),
          childrenPadding: const EdgeInsets.fromLTRB(12, 0, 12, 18),
          showTrailingIcon: false,
          title: Row(
            children: [
              SizedBox(
                width: 24,
                child: Text(
                  '${i + 1}',
                  style: AppTypography.body(
                    size: 14,
                    color: rows[i].teamId == mine
                        ? context.c.primary
                        : context.c.textSecondary,
                  ),
                ),
              ),
              Expanded(
                child: Text(
                  rows[i].teamName,
                  style: AppTypography.body(
                    size: 15,
                    weight: FontWeight.w600,
                    color: rows[i].teamId == mine ? context.c.primary : null,
                  ),
                ),
              ),
              for (final v in [
                rows[i].played,
                rows[i].goalDiff,
                rows[i].points,
              ])
                SizedBox(
                  width: 38,
                  child: Text(
                    '$v',
                    textAlign: TextAlign.center,
                    style: AppTypography.body(
                      size: 15,
                      weight: FontWeight.w600,
                    ),
                  ),
                ),
            ],
          ),
          children: [
            Wrap(
              spacing: 24,
              runSpacing: 12,
              children: [
                _Metric('${rows[i].won}', 'Ganados'),
                _Metric('${rows[i].drawn}', 'Empatados'),
                _Metric('${rows[i].lost}', 'Perdidos'),
                _Metric('${rows[i].goalsFor}', 'Goles a favor'),
                _Metric('${rows[i].goalsAgainst}', 'En contra'),
              ],
            ),
            if (teams.any(
              (t) => t.id == rows[i].teamId && t.groupId.isNotEmpty,
            ))
              TextButton(
                onPressed: () =>
                    context.push('/groups/teams/${rows[i].teamId}'),
                child: const Text('Ver equipo'),
              ),
          ],
        ),
      if (rows.isEmpty)
        const PateaEmpty(
          icon: Icons.leaderboard_outlined,
          title: 'La tabla espera a los equipos',
          hint: 'Se completa cuando haya participantes.',
        ),
    ];
  }

  List<Widget> _teams(
    CompetitionModel c,
    List<GroupTeamModel> teams,
    Map<String, String> names,
  ) => [
    Text('Los que salen a la cancha', style: AppTypography.headline(size: 24)),
    const SizedBox(height: 16),
    for (final id in c.teamIds) ...[
      if (teams.any((t) => t.id == id))
        Builder(
          builder: (context) {
            final t = teams.firstWhere((t) => t.id == id);
            return ExpansionTile(
              tilePadding: EdgeInsets.zero,
              leading: JerseyWidget(jersey: t.jersey, size: 38),
              title: Text(
                t.name,
                style: AppTypography.body(size: 16, weight: FontWeight.w600),
              ),
              subtitle: Text('${t.members.length} jugadores'),
              children: [
                if (t.members.isEmpty)
                  const Padding(
                    padding: EdgeInsets.all(12),
                    child: Text(
                      'El equipo necesita completar su plantel antes de jugar en la app.',
                    ),
                  ),
                for (final member in t.members)
                  Consumer(
                    builder: (context, ref, _) => ref
                        .watch(singlePlayerStreamProvider(member.playerId))
                        .when(
                          loading: () => const LinearProgressIndicator(),
                          error: (e, _) => Padding(
                            padding: const EdgeInsets.all(8),
                            child: Text(
                              'No se pudo cargar un jugador',
                              style: AppTypography.body(size: 13),
                            ),
                          ),
                          data: (p) => ListTile(
                            contentPadding: const EdgeInsets.symmetric(
                              horizontal: 8,
                            ),
                            leading: PateaAvatar(
                              photoUrl: p?.photoUrl,
                              seed: member.playerId,
                              size: 38,
                            ),
                            title: Text(
                              p?.name ?? 'Jugador no disponible',
                              style: AppTypography.body(size: 15),
                            ),
                            subtitle: Text(
                              '${member.status == 'suplente' ? 'Suplente' : 'Titular'} · ${member.number > 0 ? 'Dorsal ${member.number}' : 'Sin dorsal'}',
                              style: AppTypography.body(size: 12),
                            ),
                            trailing: p == null
                                ? null
                                : Text(
                                    '${p.ovr}',
                                    style: AppTypography.sportNumber(size: 24),
                                  ),
                            onTap: p == null
                                ? null
                                : () => context.push('/players/${p.id}'),
                          ),
                        ),
                  ),
                if (t.groupId.isNotEmpty)
                  TextButton.icon(
                    onPressed: () => context.push('/groups/teams/${t.id}'),
                    icon: const Icon(Icons.open_in_new, size: 18),
                    label: const Text('Abrir detalle del equipo'),
                  ),
              ],
            );
          },
        )
      else
        ListTile(
          contentPadding: EdgeInsets.zero,
          leading: const Icon(Icons.shield_outlined),
          title: Text(names[id] ?? 'Equipo no disponible'),
          subtitle: const Text('Se conserva su participación histórica.'),
        ),
      Divider(height: 1, color: context.c.overlayLine),
    ],
  ];
  List<Widget> _stats(List<Map<String, dynamic>> matches) {
    final stats = competitionPlayerStats(matches);
    final sorted = [...stats]
      ..sort((a, b) {
        int value(CompetitionPlayerStat p) => _stat == 0
            ? p.goals
            : _stat == 1
            ? p.assists
            : p.yellow + p.red;
        return value(b).compareTo(value(a)) != 0
            ? value(b).compareTo(value(a))
            : a.name.compareTo(b.name);
      });
    final filtered = sorted
        .where(
          (p) => _stat == 0
              ? p.goals > 0
              : _stat == 1
              ? p.assists > 0
              : p.yellow + p.red > 0,
        )
        .toList();
    return [
      Text(
        'Los nombres de este torneo',
        style: AppTypography.headline(size: 24),
      ),
      const SizedBox(height: 8),
      Text(
        'Sólo partidos finalizados. Se muestran goles, asistencias y tarjetas con autor registrado.',
        style: AppTypography.body(size: 14, color: context.c.textSecondary),
      ),
      const SizedBox(height: 16),
      PateaTabs(
        tabs: const [
          PateaTab('Goles'),
          PateaTab('Asistencias'),
          PateaTab('Disciplina'),
        ],
        active: _stat,
        onChanged: (v) => setState(() => _stat = v),
      ),
      const SizedBox(height: 12),
      if (filtered.isEmpty)
        const PateaEmpty(
          icon: Icons.insights_outlined,
          title: 'Todavía no hay registros individuales',
          hint:
              'Los eventos que se cargan en Dirigir alimentan estas estadísticas.',
        ),
      for (var i = 0; i < filtered.length; i++)
        ListTile(
          contentPadding: EdgeInsets.zero,
          leading: Text(
            '${i + 1}',
            style: AppTypography.body(size: 14, color: context.c.textSecondary),
          ),
          title: Text(
            filtered[i].name,
            style: AppTypography.body(size: 16, weight: FontWeight.w600),
          ),
          subtitle: _stat == 2
              ? Text(
                  '${filtered[i].yellow} amarillas · ${filtered[i].red} rojas',
                )
              : null,
          trailing: Text(
            '${_stat == 0
                ? filtered[i].goals
                : _stat == 1
                ? filtered[i].assists
                : filtered[i].yellow + filtered[i].red}',
            style: AppTypography.sportNumber(size: 28),
          ),
          onTap: () => context.push('/players/${filtered[i].id}'),
        ),
    ];
  }
}

class _Metric extends StatelessWidget {
  final String value, label;
  const _Metric(this.value, this.label);
  @override
  Widget build(BuildContext context) => Column(
    mainAxisSize: MainAxisSize.min,
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(
        value,
        style: AppTypography.headline(size: 25, weight: FontWeight.w700),
      ),
      const SizedBox(height: 3),
      Text(
        label,
        style: AppTypography.body(size: 12, color: context.c.textSecondary),
      ),
    ],
  );
}

class _TeamIdentity extends StatelessWidget {
  final GroupTeamModel team;
  const _TeamIdentity({required this.team});
  @override
  Widget build(BuildContext context) => Row(
    children: [
      JerseyWidget(jersey: team.jersey, size: 48),
      const SizedBox(width: 14),
      Expanded(child: Text(team.name, style: AppTypography.headline(size: 21))),
    ],
  );
}
