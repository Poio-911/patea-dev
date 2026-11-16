import '../../core/widgets/patea_activity_cover.dart';
import '../../core/widgets/patea_evaluation_mark.dart';
import '../../core/widgets/patea_button_progress.dart';
import 'package:flutter/material.dart';
import '../../core/widgets/patea_card.dart';
import '../../core/theme/app_radii.dart';
import '../../core/widgets/patea_snack.dart';
import '../../core/widgets/patea_avatar.dart';
import '../../core/widgets/patea_states.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme/patea_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/utils/dates.dart';
import '../../core/services/auth_service.dart';
import '../../core/services/evaluation_service.dart';
import '../../core/models/evaluation_models.dart';
import '../../core/theme/app_insets.dart';
import '../../core/widgets/patea_tabs.dart';

({String label, Color color, bool urgent}) _urgency(
  BuildContext context,
  String matchDate,
) {
  final d = DateTime.tryParse(matchDate);
  if (d == null)
    return (label: '', color: context.c.textSecondary, urgent: false);
  final deadline = d.toLocal().add(const Duration(hours: 72));
  final hoursLeft = deadline.difference(DateTime.now()).inHours;
  if (hoursLeft <= 0)
    return (label: 'Cerrada', color: context.c.textSecondary, urgent: false);
  if (hoursLeft <= 12)
    return (
      label: '${hoursLeft}h restantes',
      color: context.c.destructive,
      urgent: true,
    );
  if (hoursLeft <= 24)
    return (
      label: '${hoursLeft}h restantes',
      color: context.c.warning,
      urgent: false,
    );
  final days = (hoursLeft / 24).floor();
  return (
    label: '${days}d restantes',
    color: context.c.textSecondary,
    urgent: false,
  );
}

/// Port de src/app/evaluations/page.tsx: 3 tabs — Pendientes, Historial,
/// Solicitudes (de revelación de identidad). El armado de items combina
/// assignments + matches + processedSubmissions client-side (ver
/// EvaluationService.watchInboxItems). Las asignaciones se escuchan en vivo;
/// el gesto de recarga sirve como recuperación manual.
///
/// Deliberadamente NO portado en esta pasada: el pedido de revelación
/// ("¿quién me evaluó?") desde el lado del jugador evaluado
/// (`requestIdentityRevelation`, se dispara desde `PlayerMatchDebriefView`,
/// deferred junto con el historial completo de evaluaciones del jugador).
class EvaluationsInboxScreen extends ConsumerStatefulWidget {
  const EvaluationsInboxScreen({super.key});

  @override
  ConsumerState<EvaluationsInboxScreen> createState() =>
      _EvaluationsInboxScreenState();
}

class _EvaluationsInboxScreenState extends ConsumerState<EvaluationsInboxScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    // Las pestañas dibujan `_tabController.index`, así que también tienen que
    // seguir el deslizamiento del TabBarView, no sólo el toque.
    _tabController.addListener(() {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final uid = ref.watch(authServiceProvider).currentUser?.uid;
    if (uid == null) {
      return Scaffold(
        backgroundColor: Colors.transparent,
        body: Center(
          child: Text(
            'Debés iniciar sesión.',
            style: AppTypography.body(color: context.c.textSecondary),
          ),
        ),
      );
    }

    final itemsAsync = ref.watch(evaluationInboxItemsProvider(uid));
    final requestsAsync = ref.watch(identityRevealRequestsProvider(uid));

    void refresh() {
      ref.invalidate(evaluationInboxItemsProvider(uid));
      ref.invalidate(identityRevealRequestsProvider(uid));
    }

    return Scaffold(
      backgroundColor: Colors.transparent,
      body: RefreshIndicator(
        // The vertical lists live inside a horizontal TabBarView viewport.
        notificationPredicate: (notification) =>
            notification.metrics.axis == Axis.vertical,
        onRefresh: () async {
          refresh();
          await ref.read(evaluationInboxItemsProvider(uid).future);
        },
        child: itemsAsync.when(
          data: (items) {
            final pending = items.where((i) => !i.isSubmitted).toList();
            final history = items.where((i) => i.isSubmitted).toList();
            final requestsCount = requestsAsync.asData?.value.length ?? 0;
            final urgentCount = pending
                .where((i) => _urgency(context, i.matchDate).urgent)
                .length;

            return Column(
              children: [
                Padding(
                  padding: EdgeInsets.fromLTRB(
                    16,
                    MediaQuery.paddingOf(context).top + 12,
                    16,
                    0,
                  ),
                  child: PateaActivityCover(
                    image: 'assets/brand/patea_evaluations.webp',
                    compact: true,
                    title: 'Evaluaciones',
                    details: pending.isEmpty
                        ? 'Todo al día · ${history.length} ${history.length == 1 ? 'completada' : 'completadas'}.\nTu devolución también hace equipo.'
                        : '${pending.length} ${pending.length == 1 ? 'pendiente' : 'pendientes'} · ${history.length} ${history.length == 1 ? 'completada' : 'completadas'}.\nTu devolución también hace equipo.',
                  ),
                ),
                if (urgentCount > 0)
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 10, 16, 0),
                    child: Row(
                      children: [
                        Icon(
                          Icons.schedule_rounded,
                          size: 18,
                          color: context.c.destructive,
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            '$urgentCount ${urgentCount == 1 ? 'evaluación cierra' : 'evaluaciones cierran'} en menos de 12 horas',
                            style: AppTypography.body(
                              size: 13,
                              color: context.c.destructive,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                const SizedBox(height: 12),
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                  child: PateaTabs(
                    tabs: [
                      PateaTab('Pendientes', count: pending.length),
                      PateaTab('Historial', count: history.length),
                      PateaTab('Solicitudes', count: requestsCount),
                    ],
                    active: _tabController.index,
                    onChanged: (i) => _tabController.animateTo(
                      i,
                      duration: MediaQuery.disableAnimationsOf(context)
                          ? Duration.zero
                          : const Duration(milliseconds: 220),
                    ),
                  ),
                ),
                Expanded(
                  child: TabBarView(
                    controller: _tabController,
                    children: [
                      _PendingList(items: pending),
                      _HistoryList(items: history),
                      _RequestsList(requestsAsync: requestsAsync, uid: uid),
                    ],
                  ),
                ),
              ],
            );
          },
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => PateaError(error: e, onRetry: refresh),
        ),
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  final IconData icon;
  final String title;
  final String description;

  const _EmptyState({
    required this.icon,
    required this.title,
    required this.description,
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 44, color: context.c.textSecondary),
            const SizedBox(height: 12),
            Text(title, style: AppTypography.headline(size: 15)),
            const SizedBox(height: 6),
            Text(
              description,
              textAlign: TextAlign.center,
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

class _PendingList extends StatelessWidget {
  final List<EvaluationInboxItem> items;

  const _PendingList({required this.items});

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) {
      return SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(28, 48, 28, 30),
        child: Column(
          children: [
            const PateaEvaluationMark(),
            const SizedBox(height: 20),
            Text(
              '¡Todo al día!',
              style: AppTypography.headline(size: 22, weight: FontWeight.w600),
            ),
            const SizedBox(height: 9),
            Text(
              'No tenés evaluaciones pendientes. Cuando termine el próximo partido, vas a poder valorar a tus compañeros.',
              textAlign: TextAlign.center,
              style: AppTypography.body(
                size: 14,
                color: context.c.textSecondary,
              ),
            ),
          ],
        ),
      );
    }
    return ListView.separated(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: EdgeInsets.fromLTRB(16, 16, 16, bottomInset(context)),
      itemCount: items.length,
      separatorBuilder: (_, __) => const SizedBox(height: 12),
      itemBuilder: (context, index) {
        final item = items[index];
        final urgency = _urgency(context, item.matchDate);
        return PateaCard(
          color: context.c.card,
          radius: AppRadii.cardAll,
          borderColor: context.c.border.withValues(alpha: 0.4),
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 6,
                    ),
                    decoration: BoxDecoration(
                      color: context.c.cardSurface,
                      borderRadius: AppRadii.chipAll,
                    ),
                    child: Column(
                      children: [
                        Text(
                          fmtMonthShort(item.matchDate),
                          style: AppTypography.body(
                            size: 12,
                            weight: FontWeight.w600,
                            color: context.c.primary,
                          ),
                        ),
                        Text(
                          fmtDayNumber(item.matchDate),
                          style: AppTypography.headline(
                            size: 16,
                            weight: FontWeight.w900,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          item.matchTitle,
                          style: AppTypography.body(
                            color: context.c.textSecondary,
                            size: 14,
                            weight: FontWeight.w700,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        if (urgency.label.isNotEmpty)
                          Padding(
                            padding: const EdgeInsets.only(top: 4),
                            child: Text(
                              urgency.label,
                              style: AppTypography.body(
                                size: 12,
                                weight: FontWeight.w600,
                                color: urgency.color,
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                ],
              ),
              if (item.assignedPlayers.isNotEmpty) ...[
                const SizedBox(height: 10),
                Text(
                  'Evaluás a',
                  style: AppTypography.body(
                    size: 12,
                    weight: FontWeight.w600,
                    color: context.c.textSecondary,
                  ),
                ),
                const SizedBox(height: 6),
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: item.assignedPlayers.map((p) {
                    return Padding(
                      padding: const EdgeInsets.only(right: 12, bottom: 6),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          PateaAvatar(
                            photoUrl: p.photoURL,
                            seed: p.name,
                            size: 18,
                          ),
                          const SizedBox(width: 6),
                          Flexible(
                            child: Text(
                              p.name,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: AppTypography.body(
                                color: context.c.textSecondary,
                                size: 12,
                                weight: FontWeight.w600,
                              ),
                            ),
                          ),
                        ],
                      ),
                    );
                  }).toList(),
                ),
              ],
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: () => context.push('/evaluations/${item.matchId}'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: context.c.primary,
                    foregroundColor: context.c.onPrimary,
                  ),
                  icon: const Icon(Icons.edit_outlined, size: 16),
                  label: const Text('Evaluar ahora'),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _HistoryList extends StatelessWidget {
  final List<EvaluationInboxItem> items;

  const _HistoryList({required this.items});

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) {
      return const _EmptyState(
        icon: Icons.history,
        title: 'Historial vacío',
        description: 'Acá van a aparecer tus evaluaciones enviadas.',
      );
    }
    return ListView.separated(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: EdgeInsets.fromLTRB(16, 16, 16, bottomInset(context)),
      itemCount: items.length,
      separatorBuilder: (_, __) => const SizedBox(height: 10),
      itemBuilder: (context, index) {
        final item = items[index];
        return PateaCard(
          color: context.c.card,
          radius: AppRadii.cardAll,
          borderColor: context.c.success.withValues(alpha: 0.2),
          padding: const EdgeInsets.all(14),
          child: Row(
            children: [
              Icon(Icons.check_circle, color: context.c.success, size: 20),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item.matchTitle,
                      style: AppTypography.body(
                        color: context.c.textSecondary,
                        size: 14,
                        weight: FontWeight.w700,
                      ),
                    ),
                    Text(
                      'Evaluaste ${item.submittedEvaluationsCount ?? 0} jugador(es)'
                      '${item.submittedGoals != null ? ' · ${item.submittedGoals} goles · ${item.submittedAssists ?? 0} asis.' : ''}',
                      style: AppTypography.body(
                        size: 12,
                        color: context.c.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _RequestsList extends ConsumerWidget {
  final AsyncValue<List<IdentityRevealRequest>> requestsAsync;
  final String uid;

  const _RequestsList({required this.requestsAsync, required this.uid});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return requestsAsync.when(
      data: (requests) {
        if (requests.isEmpty) {
          return const _EmptyState(
            icon: Icons.help_outline,
            title: 'Sin solicitudes',
            description:
                'Cuando alguien quiera saber que fuiste vos quien lo evaluó, va a aparecer acá.',
          );
        }
        return ListView.separated(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: EdgeInsets.fromLTRB(16, 16, 16, bottomInset(context)),
          itemCount: requests.length,
          separatorBuilder: (_, __) => const SizedBox(height: 12),
          itemBuilder: (context, index) => _IdentityRequestCard(
            request: requests[index],
            onResponded: () =>
                ref.invalidate(identityRevealRequestsProvider(uid)),
          ),
        );
      },
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => PateaError(error: e),
    );
  }
}

class _IdentityRequestCard extends ConsumerStatefulWidget {
  final IdentityRevealRequest request;
  final VoidCallback onResponded;

  const _IdentityRequestCard({
    required this.request,
    required this.onResponded,
  });

  @override
  ConsumerState<_IdentityRequestCard> createState() =>
      _IdentityRequestCardState();
}

class _IdentityRequestCardState extends ConsumerState<_IdentityRequestCard> {
  String? _loading;

  Future<void> _respond(String response) async {
    setState(() => _loading = response);
    try {
      await ref
          .read(evaluationServiceProvider)
          .respondToIdentityReveal(widget.request.evaluationId, response);
      if (mounted) {
        widget.onResponded();
        PateaSnack.ok(
          context,
          response == 'accepted'
              ? 'Identidad revelada.'
              : 'Anonimato mantenido.',
        );
      }
    } catch (e) {
      if (mounted) {
        PateaSnack.error(context, '$e');
        setState(() => _loading = null);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final r = widget.request;
    return PateaCard(
      color: context.c.card,
      radius: AppRadii.cardAll,
      borderColor: context.c.border.withValues(alpha: 0.4),
      padding: EdgeInsets.fromLTRB(16, 16, 16, bottomInset(context)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              PateaAvatar(
                photoUrl: r.fromPlayerPhotoUrl,
                seed: r.fromPlayerName,
                size: 40,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      r.fromPlayerName,
                      style: AppTypography.body(
                        color: context.c.textSecondary,
                        size: 13,
                        weight: FontWeight.w700,
                      ),
                    ),
                    Text(
                      r.matchTitle,
                      style: AppTypography.body(
                        size: 12,
                        color: context.c.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            '${r.fromPlayerName} quiere saber que fuiste vos quien lo evaluó.',
            style: AppTypography.body(size: 12, color: context.c.textSecondary),
          ),
          const SizedBox(height: 12),
          Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              OutlinedButton.icon(
                onPressed: _loading != null ? null : () => _respond('rejected'),
                icon: _loading == 'rejected'
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.visibility_off_outlined, size: 18),
                label: Text(
                  'Mantener anonimato',
                  style: AppTypography.action(size: 14),
                ),
              ),
              const SizedBox(height: 8),
              ElevatedButton.icon(
                onPressed: _loading != null ? null : () => _respond('accepted'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: context.c.primary,
                  foregroundColor: context.c.onPrimary,
                ),
                icon: _loading == 'accepted'
                    ? SizedBox(
                        width: 16,
                        height: 16,
                        child: const PateaButtonProgress(),
                      )
                    : const Icon(Icons.visibility_outlined, size: 18),
                label: Text(
                  'Revelar identidad',
                  style: AppTypography.action(size: 14),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
