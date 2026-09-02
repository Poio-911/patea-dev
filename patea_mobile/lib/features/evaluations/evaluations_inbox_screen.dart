import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/services/auth_service.dart';
import '../../core/services/evaluation_service.dart';
import '../../core/models/evaluation_models.dart';

const _months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
String _fmtDay(String raw) {
  final d = DateTime.tryParse(raw);
  if (d == null) return '';
  final local = d.toLocal();
  return local.day.toString().padLeft(2, '0');
}

String _fmtMonth(String raw) {
  final d = DateTime.tryParse(raw);
  if (d == null) return '';
  return _months[d.toLocal().month - 1].toUpperCase();
}

({String label, Color color, bool urgent}) _urgency(String matchDate) {
  final d = DateTime.tryParse(matchDate);
  if (d == null) return (label: '', color: AppColors.textMuted, urgent: false);
  final deadline = d.toLocal().add(const Duration(hours: 72));
  final hoursLeft = deadline.difference(DateTime.now()).inHours;
  if (hoursLeft <= 0) return (label: 'Cerrada', color: AppColors.textMuted, urgent: false);
  if (hoursLeft <= 12) return (label: '${hoursLeft}h restantes', color: AppColors.destructive, urgent: true);
  if (hoursLeft <= 24) return (label: '${hoursLeft}h restantes', color: AppColors.warning, urgent: false);
  final days = (hoursLeft / 24).floor();
  return (label: '${days}d restantes', color: AppColors.textMuted, urgent: false);
}

/// Port de src/app/evaluations/page.tsx: 3 tabs — Pendientes, Historial,
/// Solicitudes (de revelación de identidad). El armado de items combina
/// assignments + matches + processedSubmissions client-side (ver
/// EvaluationService.loadInboxItems) en vez de listeners en vivo por
/// partido como la web — el pull-to-refresh cubre la reactividad.
///
/// Deliberadamente NO portado en esta pasada: el pedido de revelación
/// ("¿quién me evaluó?") desde el lado del jugador evaluado
/// (`requestIdentityRevelation`, se dispara desde `PlayerMatchDebriefView`,
/// deferred junto con el historial completo de evaluaciones del jugador).
class EvaluationsInboxScreen extends ConsumerStatefulWidget {
  const EvaluationsInboxScreen({super.key});

  @override
  ConsumerState<EvaluationsInboxScreen> createState() => _EvaluationsInboxScreenState();
}

class _EvaluationsInboxScreenState extends ConsumerState<EvaluationsInboxScreen> with SingleTickerProviderStateMixin {
  late final TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
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
        appBar: AppBar(title: Text('EVALUACIONES', style: AppTypography.headline(size: 20, weight: FontWeight.w800))),
        body: Center(child: Text('Debés iniciar sesión.', style: AppTypography.body(color: AppColors.textMuted))),
      );
    }

    final itemsAsync = ref.watch(evaluationInboxItemsProvider(uid));
    final requestsAsync = ref.watch(identityRevealRequestsProvider(uid));

    void refresh() {
      ref.invalidate(evaluationInboxItemsProvider(uid));
      ref.invalidate(identityRevealRequestsProvider(uid));
    }

    return Scaffold(
      appBar: AppBar(
        title: Text('EVALUACIONES', style: AppTypography.headline(size: 20, weight: FontWeight.w800)),
        actions: [IconButton(onPressed: refresh, icon: const Icon(Icons.refresh))],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          refresh();
          await ref.read(evaluationInboxItemsProvider(uid).future);
        },
        child: itemsAsync.when(
          data: (items) {
            final pending = items.where((i) => !i.isSubmitted).toList();
            final history = items.where((i) => i.isSubmitted).toList();
            final requestsCount = requestsAsync.value?.length ?? 0;

            return Column(
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                  child: Row(
                    children: [
                      Expanded(child: _StatBox(value: '${pending.length}', label: 'Pendientes')),
                      const SizedBox(width: 10),
                      Expanded(child: _StatBox(value: '${history.length}', label: 'Completadas', color: AppColors.success)),
                      const SizedBox(width: 10),
                      Expanded(
                        child: _StatBox(
                          value: '${pending.where((i) => _urgency(i.matchDate).urgent).length}',
                          label: 'Urgentes',
                          color: AppColors.destructive,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                TabBar(
                  controller: _tabController,
                  labelColor: AppColors.voltNeon,
                  unselectedLabelColor: AppColors.textMuted,
                  indicatorColor: AppColors.voltNeon,
                  tabs: [
                    const Tab(text: 'Pendientes'),
                    const Tab(text: 'Historial'),
                    Tab(text: requestsCount > 0 ? 'Solicitudes ($requestsCount)' : 'Solicitudes'),
                  ],
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
          error: (e, _) => Center(child: Text('Error: $e', style: AppTypography.body(color: AppColors.textMuted))),
        ),
      ),
    );
  }
}

class _StatBox extends StatelessWidget {
  final String value;
  final String label;
  final Color? color;

  const _StatBox({required this.value, required this.label, this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 10),
      decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.border.withValues(alpha: 0.4))),
      child: Column(
        children: [
          Text(value, style: AppTypography.headline(size: 20, weight: FontWeight.w900, color: color ?? AppColors.textPrimary)),
          Text(label.toUpperCase(), style: AppTypography.code(size: 9, weight: FontWeight.w700, color: AppColors.textMuted)),
        ],
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  final IconData icon;
  final String title;
  final String description;

  const _EmptyState({required this.icon, required this.title, required this.description});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 44, color: AppColors.textMuted),
            const SizedBox(height: 12),
            Text(title, style: AppTypography.headline(size: 15)),
            const SizedBox(height: 6),
            Text(description, textAlign: TextAlign.center, style: AppTypography.body(size: 12, color: AppColors.textMuted)),
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
      return const _EmptyState(icon: Icons.verified_outlined, title: '¡Todo al día!', description: 'No tenés evaluaciones pendientes.');
    }
    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: items.length,
      separatorBuilder: (_, __) => const SizedBox(height: 12),
      itemBuilder: (context, index) {
        final item = items[index];
        final urgency = _urgency(item.matchDate);
        return Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(14), border: Border.all(color: AppColors.border.withValues(alpha: 0.4))),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                    decoration: BoxDecoration(color: AppColors.cardSurface, borderRadius: BorderRadius.circular(8)),
                    child: Column(
                      children: [
                        Text(_fmtMonth(item.matchDate), style: AppTypography.code(size: 9, weight: FontWeight.w800, color: AppColors.voltNeon)),
                        Text(_fmtDay(item.matchDate), style: AppTypography.headline(size: 16, weight: FontWeight.w900)),
                      ],
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(item.matchTitle, style: AppTypography.body(size: 14, weight: FontWeight.w700), maxLines: 1, overflow: TextOverflow.ellipsis),
                        if (urgency.label.isNotEmpty)
                          Container(
                            margin: const EdgeInsets.only(top: 4),
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                            decoration: BoxDecoration(color: urgency.color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(20)),
                            child: Text(urgency.label, style: AppTypography.code(size: 10, weight: FontWeight.w700, color: urgency.color)),
                          ),
                      ],
                    ),
                  ),
                ],
              ),
              if (item.assignedPlayers.isNotEmpty) ...[
                const SizedBox(height: 10),
                Text('EVALUÁS A', style: AppTypography.code(size: 9, weight: FontWeight.w800, color: AppColors.textMuted)),
                const SizedBox(height: 6),
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: item.assignedPlayers.map((p) {
                    return Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(color: AppColors.cardSurface, borderRadius: BorderRadius.circular(20)),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          CircleAvatar(
                            radius: 9,
                            backgroundColor: AppColors.voltNeon.withValues(alpha: 0.2),
                            backgroundImage: (p.photoURL != null && p.photoURL!.isNotEmpty) ? NetworkImage(p.photoURL!) : null,
                            child: (p.photoURL == null || p.photoURL!.isEmpty) ? Text(p.name.isNotEmpty ? p.name[0].toUpperCase() : '?', style: AppTypography.code(size: 9)) : null,
                          ),
                          const SizedBox(width: 6),
                          Text(p.name.split(' ').first, style: AppTypography.body(size: 11, weight: FontWeight.w600)),
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
                  style: ElevatedButton.styleFrom(backgroundColor: AppColors.voltNeon, foregroundColor: Colors.black),
                  icon: const Icon(Icons.edit_outlined, size: 16),
                  label: const Text('EVALUAR AHORA'),
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
      return const _EmptyState(icon: Icons.history, title: 'Historial vacío', description: 'Acá van a aparecer tus evaluaciones enviadas.');
    }
    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: items.length,
      separatorBuilder: (_, __) => const SizedBox(height: 10),
      itemBuilder: (context, index) {
        final item = items[index];
        return Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(14), border: Border.all(color: AppColors.success.withValues(alpha: 0.2))),
          child: Row(
            children: [
              Icon(Icons.check_circle, color: AppColors.success, size: 20),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(item.matchTitle, style: AppTypography.body(size: 14, weight: FontWeight.w700)),
                    Text(
                      'Evaluaste ${item.submittedEvaluationsCount ?? 0} jugador(es)'
                      '${item.submittedGoals != null ? ' · ${item.submittedGoals} goles · ${item.submittedAssists ?? 0} asis.' : ''}',
                      style: AppTypography.body(size: 11, color: AppColors.textMuted),
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
            description: 'Cuando alguien quiera saber que fuiste vos quien lo evaluó, va a aparecer acá.',
          );
        }
        return ListView.separated(
          padding: const EdgeInsets.all(16),
          itemCount: requests.length,
          separatorBuilder: (_, __) => const SizedBox(height: 12),
          itemBuilder: (context, index) => _IdentityRequestCard(
            request: requests[index],
            onResponded: () => ref.invalidate(identityRevealRequestsProvider(uid)),
          ),
        );
      },
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(child: Text('Error: $e', style: AppTypography.body(color: AppColors.textMuted))),
    );
  }
}

class _IdentityRequestCard extends ConsumerStatefulWidget {
  final IdentityRevealRequest request;
  final VoidCallback onResponded;

  const _IdentityRequestCard({required this.request, required this.onResponded});

  @override
  ConsumerState<_IdentityRequestCard> createState() => _IdentityRequestCardState();
}

class _IdentityRequestCardState extends ConsumerState<_IdentityRequestCard> {
  String? _loading;

  Future<void> _respond(String response) async {
    setState(() => _loading = response);
    try {
      await ref.read(evaluationServiceProvider).respondToIdentityReveal(widget.request.evaluationId, response);
      if (mounted) {
        widget.onResponded();
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(response == 'accepted' ? 'Identidad revelada.' : 'Anonimato mantenido.'),
          backgroundColor: AppColors.success,
        ));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e'), backgroundColor: AppColors.destructive));
        setState(() => _loading = null);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final r = widget.request;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(14), border: Border.all(color: AppColors.border.withValues(alpha: 0.4))),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              CircleAvatar(
                radius: 20,
                backgroundColor: AppColors.voltNeon.withValues(alpha: 0.15),
                backgroundImage: r.fromPlayerPhotoUrl.isNotEmpty ? NetworkImage(r.fromPlayerPhotoUrl) : null,
                child: r.fromPlayerPhotoUrl.isEmpty ? Text(r.fromPlayerName.isNotEmpty ? r.fromPlayerName[0].toUpperCase() : '?', style: AppTypography.headline(size: 14)) : null,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(r.fromPlayerName, style: AppTypography.body(size: 13, weight: FontWeight.w700)),
                    Text(r.matchTitle, style: AppTypography.body(size: 11, color: AppColors.textMuted)),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text('${r.fromPlayerName} quiere saber que fuiste vos quien lo evaluó.', style: AppTypography.body(size: 12, color: AppColors.textSecondary)),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: _loading != null ? null : () => _respond('rejected'),
                  icon: _loading == 'rejected' ? const SizedBox(width: 12, height: 12, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.visibility_off_outlined, size: 14),
                  label: const Text('Mantener anonimato', style: TextStyle(fontSize: 11)),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: _loading != null ? null : () => _respond('accepted'),
                  style: ElevatedButton.styleFrom(backgroundColor: AppColors.voltNeon, foregroundColor: Colors.black),
                  icon: _loading == 'accepted' ? const SizedBox(width: 12, height: 12, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.black)) : const Icon(Icons.visibility_outlined, size: 14),
                  label: const Text('Revelar identidad', style: TextStyle(fontSize: 11)),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
