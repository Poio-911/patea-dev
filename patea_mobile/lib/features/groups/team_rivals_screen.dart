import '../../core/utils/clock.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/models/group_model.dart';
import '../../core/models/team_rival_model.dart';
import '../../core/services/firestore_service.dart';
import '../../core/services/team_challenge_service.dart';
import '../../core/theme/app_typography.dart';
import '../../core/theme/patea_colors.dart';
import '../../core/widgets/jersey_painter.dart';
import '../../core/widgets/patea_card.dart';
import '../../core/widgets/patea_snack.dart';
import '../matches/challenge_team_screen.dart';

class TeamRivalsScreen extends ConsumerWidget {
  final String teamId;
  const TeamRivalsScreen({super.key, required this.teamId});
  @override
  Widget build(BuildContext context, WidgetRef ref) => Scaffold(
    backgroundColor: Colors.transparent,
    appBar: AppBar(
      title: const Text('Tus rivales'),
      backgroundColor: Colors.transparent,
    ),
    body: ref
        .watch(singleTeamStreamProvider(teamId))
        .when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (_, _) =>
              const Center(child: Text('No pudimos cargar el equipo.')),
          data: (team) => team == null
              ? const Center(child: Text('El equipo ya no existe.'))
              : RefreshIndicator(
                  onRefresh: () async {
                    ref.invalidate(teamRivalsProvider);
                  },
                  child: ListView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.all(16),
                    children: [
                      Text(
                        team.name,
                        style: AppTypography.headline(
                          size: 24,
                          weight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        'Una historia para volver a encontrarse.',
                        style: AppTypography.body(
                          size: 13,
                          color: context.c.textSecondary,
                        ),
                      ),
                      const SizedBox(height: 20),
                      TeamRivalsPanel(team: team),
                    ],
                  ),
                ),
        ),
  );
}

class TeamRivalsPanel extends ConsumerStatefulWidget {
  final GroupTeamModel team;
  final int? limit;
  final bool preview;
  const TeamRivalsPanel({
    super.key,
    required this.team,
    this.limit,
    this.preview = false,
  });
  @override
  ConsumerState<TeamRivalsPanel> createState() => _TeamRivalsPanelState();
}

class _TeamRivalsPanelState extends ConsumerState<TeamRivalsPanel> {
  bool _showHidden = false, _busy = false;
  final List<TeamRival> _more = [];
  String? _cursor;
  bool? _hasMore;
  @override
  void didUpdateWidget(TeamRivalsPanel oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.team.id != widget.team.id) {
      _more.clear();
      _cursor = null;
      _hasMore = null;
      _showHidden = false;
    }
  }

  void _refresh() {
    _more.clear();
    _cursor = null;
    _hasMore = null;
    ref.invalidate(teamRivalsProvider);
  }

  Future<void> _change(TeamRival rival, {bool? favorite, bool? hidden}) async {
    if (!mounted || _busy) return;
    setState(() => _busy = true);
    try {
      await ref
          .read(teamChallengeServiceProvider)
          .setTeamRival(
            widget.team.id,
            rival.id,
            favorite: favorite,
            hidden: hidden,
          );
      _refresh();
      if (mounted && hidden == true) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Text('Rival olvidado. Su historial se conserva.'),
            action: SnackBarAction(
              label: 'Deshacer',
              onPressed: () => _change(rival, hidden: false),
            ),
          ),
        );
      }
    } catch (e) {
      if (mounted) PateaSnack.error(context, challengeErrorMessage(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _forget(TeamRival rival) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('¿Olvidar a ${rival.name}?'),
        content: const Text(
          'Su historial se conserva. Si vuelven a acordar un partido, reaparecerá entre tus rivales.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancelar'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Olvidar'),
          ),
        ],
      ),
    );
    if (ok == true) await _change(rival, hidden: true);
  }

  Future<void> _challenge(TeamRival rival) async {
    final sent = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => ChallengeSheet(
        from: widget.team,
        to: rival.searchResult,
        isRematch: rival.played > 0,
      ),
    );
    if (sent == true && mounted) _refresh();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return ref
        .watch(teamRivalsProvider((widget.team.id, _showHidden)))
        .when(
          loading: () => const Padding(
            padding: EdgeInsets.all(20),
            child: Center(child: CircularProgressIndicator()),
          ),
          error: (_, _) => Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('No pudimos cargar tus rivales.'),
              TextButton(onPressed: _refresh, child: const Text('Reintentar')),
            ],
          ),
          data: (page) {
            final unique = {
              for (final rival in [...page.rivals, ..._more]) rival.id: rival,
            };
            final ordered = unique.values.toList()
              ..sort((a, b) {
                final favorite = (b.favorite ? 1 : 0).compareTo(
                  a.favorite ? 1 : 0,
                );
                if (favorite != 0) return favorite;
                final date = (b.lastPlayedAt ?? b.createdAt).compareTo(
                  a.lastPlayedAt ?? a.createdAt,
                );
                return date != 0 ? date : a.name.compareTo(b.name);
              });
            final rivals = ordered
                .take(widget.limit ?? ordered.length)
                .toList();
            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        'Tus rivales',
                        style: AppTypography.headline(
                          size: 18,
                          weight: FontWeight.w700,
                        ),
                      ),
                    ),
                    if (widget.preview)
                      TextButton(
                        onPressed: () => context.push(
                          '/groups/teams/${widget.team.id}/rivals',
                        ),
                        child: const Text('Ver todos'),
                      ),
                  ],
                ),
                if (!widget.preview)
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Mostrar olvidados'),
                    value: _showHidden,
                    onChanged: (v) => setState(() {
                      _showHidden = v;
                      _more.clear();
                      _cursor = null;
                      _hasMore = null;
                    }),
                  ),
                if (rivals.isEmpty)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    child: Text(
                      'Todavía no guardaste rivales. Buscá un equipo arriba o acordá tu primer partido.',
                      style: AppTypography.body(
                        size: 13,
                        color: c.textSecondary,
                      ),
                    ),
                  ),
                for (final rival in rivals)
                  PateaCard(
                    margin: const EdgeInsets.only(bottom: 12),
                    padding: const EdgeInsets.all(14),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Row(
                          children: [
                            JerseyWidget(jersey: rival.jersey, size: 44),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    rival.name,
                                    style: AppTypography.body(
                                      size: 16,
                                      weight: FontWeight.w700,
                                    ),
                                  ),
                                  Text(
                                    rival.groupName,
                                    style: AppTypography.body(
                                      size: 12,
                                      color: c.textSecondary,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            if (page.canManage)
                              IconButton(
                                tooltip: rival.favorite
                                    ? 'Quitar de favoritos'
                                    : 'Marcar como favorito',
                                onPressed: _busy
                                    ? null
                                    : () => _change(
                                        rival,
                                        favorite: !rival.favorite,
                                      ),
                                icon: Icon(
                                  rival.favorite
                                      ? Icons.star_rounded
                                      : Icons.star_outline_rounded,
                                  color: rival.favorite
                                      ? c.primary
                                      : c.textSecondary,
                                ),
                              ),
                          ],
                        ),
                        const SizedBox(height: 14),
                        Text(
                          rival.played > 0 ? rival.record : 'Rival guardado',
                          style: AppTypography.headline(
                            size: 20,
                            weight: FontWeight.w700,
                            color: c.textPrimary,
                          ),
                        ),
                        Text(
                          rival.lastPlayedLabel(ref.watch(clockProvider)()),
                          style: AppTypography.body(
                            size: 12,
                            color: c.textSecondary,
                          ),
                        ),
                        if (!widget.preview && rival.played > 0) ...[
                          const SizedBox(height: 8),
                          Text(
                            '${rival.goalsFor} goles a favor · ${rival.goalsAgainst} en contra',
                            style: AppTypography.body(
                              size: 12,
                              color: c.textSecondary,
                            ),
                          ),
                          const SizedBox(height: 10),
                          Wrap(
                            spacing: 8,
                            runSpacing: 8,
                            children: [
                              for (final match in rival.recent)
                                OutlinedButton(
                                  onPressed: () => context.push(
                                    '/matches/${match['matchId']}',
                                  ),
                                  style: OutlinedButton.styleFrom(
                                    foregroundColor:
                                        match['scoreFor'] >
                                            match['scoreAgainst']
                                        ? c.primary
                                        : match['scoreFor'] <
                                              match['scoreAgainst']
                                        ? c.destructive
                                        : c.textSecondary,
                                  ),
                                  child: Text(
                                    '${match['scoreFor']} – ${match['scoreAgainst']}',
                                  ),
                                ),
                            ],
                          ),
                        ],
                        if (rival.hidden)
                          Text(
                            'Olvidado · historial conservado',
                            style: AppTypography.body(
                              size: 12,
                              color: c.textSecondary,
                            ),
                          ),
                        if (rival.upcomingMatchId != null)
                          TextButton(
                            onPressed: () => context.push(
                              '/matches/${rival.upcomingMatchId}',
                            ),
                            child: const Text('Ver partido acordado'),
                          )
                        else if (page.canManage) ...[
                          const SizedBox(height: 10),
                          OutlinedButton(
                            onPressed: rival.canChallenge && !_busy
                                ? () => _challenge(rival)
                                : null,
                            child: Text(
                              rival.pendingChallenge
                                  ? 'Desafío pendiente'
                                  : rival.reason.isNotEmpty
                                  ? rival.reason
                                  : rival.played > 0
                                  ? 'Revancha'
                                  : 'Desafiar',
                            ),
                          ),
                        ],
                        if (page.canManage && !widget.preview)
                          Align(
                            alignment: Alignment.centerRight,
                            child: TextButton(
                              onPressed: _busy
                                  ? null
                                  : rival.hidden
                                  ? () => _change(rival, hidden: false)
                                  : () => _forget(rival),
                              child: Text(
                                rival.hidden ? 'Recuperar rival' : 'Olvidar',
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                if (_showHidden && (_hasMore ?? page.hasMoreHidden))
                  TextButton(
                    onPressed: _busy
                        ? null
                        : () async {
                            setState(() => _busy = true);
                            try {
                              final next = await ref
                                  .read(teamChallengeServiceProvider)
                                  .getTeamRivals(
                                    widget.team.id,
                                    includeHidden: true,
                                    hiddenCursor: _cursor ?? page.hiddenCursor,
                                  );
                              if (mounted) {
                                setState(() {
                                  _more.addAll(next.rivals);
                                  _cursor = next.hiddenCursor;
                                  _hasMore = next.hasMoreHidden;
                                });
                              }
                            } catch (e) {
                              if (context.mounted) {
                                PateaSnack.error(
                                  context,
                                  challengeErrorMessage(e),
                                );
                              }
                            } finally {
                              if (mounted) setState(() => _busy = false);
                            }
                          },
                    child: const Text('Cargar más olvidados'),
                  ),
              ],
            );
          },
        );
  }
}
