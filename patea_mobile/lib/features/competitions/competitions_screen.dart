import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/services/firestore_service.dart';
import '../../core/models/competition_model.dart';

class CompetitionsScreen extends ConsumerStatefulWidget {
  const CompetitionsScreen({super.key});

  @override
  ConsumerState<CompetitionsScreen> createState() => _CompetitionsScreenState();
}

class _CompetitionsScreenState extends ConsumerState<CompetitionsScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
  }

  @override
  Widget build(BuildContext context) {
    final leaguesAsync = ref.watch(leaguesStreamProvider);
    final cupsAsync = ref.watch(cupsStreamProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text(
          'TORNEOS Y COPAS',
          style: AppTypography.headline(size: 18, weight: FontWeight.w800),
        ),
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: AppColors.voltNeon,
          labelColor: AppColors.voltNeon,
          unselectedLabelColor: AppColors.textMuted,
          labelStyle: AppTypography.headline(size: 14, weight: FontWeight.w700),
          tabs: const [
            Tab(text: 'LIGAS'),
            Tab(text: 'COPAS (ELIMINATORIAS)'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          // Ligas
          leaguesAsync.when(
            data: (leagues) => _CompetitionsList(competitions: leagues, isCup: false),
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (err, _) => Center(child: Text('Error: $err')),
          ),
          // Copas
          cupsAsync.when(
            data: (cups) => _CompetitionsList(competitions: cups, isCup: true),
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (err, _) => Center(child: Text('Error: $err')),
          ),
        ],
      ),
    );
  }
}

class _CompetitionsList extends StatelessWidget {
  final List<CompetitionModel> competitions;
  final bool isCup;

  const _CompetitionsList({required this.competitions, required this.isCup});

  @override
  Widget build(BuildContext context) {
    if (competitions.isEmpty) {
      return Center(
        child: Text(
          isCup ? 'No hay copas activas' : 'No hay ligas activas',
          style: AppTypography.body(color: AppColors.textMuted),
        ),
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: competitions.length,
      separatorBuilder: (_, index) => const SizedBox(height: 12),
      itemBuilder: (context, index) {
        final comp = competitions[index];
        return InkWell(
          onTap: () {
            if (isCup) {
              context.push('/competitions/cup/${comp.id}');
            }
          },
          borderRadius: BorderRadius.circular(16),
          child: Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.card,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppColors.border),
            ),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppColors.voltNeon.withValues(alpha: 0.12),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    isCup ? Icons.emoji_events : Icons.table_chart_outlined,
                    color: AppColors.voltNeon,
                    size: 24,
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        comp.name,
                        style: AppTypography.headline(size: 16, weight: FontWeight.w700),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        comp.status.toUpperCase(),
                        style: AppTypography.code(size: 11, color: AppColors.voltNeon),
                      ),
                    ],
                  ),
                ),
                const Icon(Icons.chevron_right, color: AppColors.textMuted),
              ],
            ),
          ),
        );
      },
    );
  }
}
