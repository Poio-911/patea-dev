import 'package:flutter/material.dart';
import '../../core/theme/app_radii.dart';
import '../../core/constants/sections.dart';
import '../../core/widgets/patea_states.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme/patea_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/widgets/patea_tabs.dart';
import '../../core/services/firestore_service.dart';
import '../../core/models/competition_model.dart';

class CompetitionsScreen extends ConsumerStatefulWidget {
  const CompetitionsScreen({super.key});

  @override
  ConsumerState<CompetitionsScreen> createState() => _CompetitionsScreenState();
}

class _CompetitionsScreenState extends ConsumerState<CompetitionsScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  int _tab = 0;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    // El swipe del TabBarView tambien tiene que mover la barra.
    _tabController.addListener(() {
      if (_tabController.index != _tab) {
        setState(() => _tab = _tabController.index);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final leaguesAsync = ref.watch(leaguesStreamProvider);
    final cupsAsync = ref.watch(cupsStreamProvider);

    return Scaffold(
      // El router envuelve esta ruta en `PateaBackground`. Sin esto, el
      // Scaffold pinta su color opaco encima y tapa la foto de cancha.
      backgroundColor: Colors.transparent,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        title: Text(
          spec(Section.competitions).title.toUpperCase(),
          style: AppTypography.headline(size: 18, weight: FontWeight.w800),
        ),
        // Antes era el `TabBar` de Material sin tocar, que en medio de la app
        // cambiaba de idioma visual. "COPAS (ELIMINATORIAS)" tampoco entraba:
        // en la barra compartida el rótulo va corto.
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(41),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: PateaTabs(
              tabs: const [PateaTab('Ligas'), PateaTab('Copas')],
              active: _tab,
              onChanged: (i) {
                setState(() => _tab = i);
                _tabController.animateTo(i);
              },
            ),
          ),
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          // Ligas
          leaguesAsync.when(
            data: (leagues) => _CompetitionsList(competitions: leagues, isCup: false),
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (err, _) => PateaError(error: err),
          ),
          // Copas
          cupsAsync.when(
            data: (cups) => _CompetitionsList(competitions: cups, isCup: true),
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (err, _) => PateaError(error: err),
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
          style: AppTypography.body(color: context.c.textSecondary),
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
          borderRadius: AppRadii.cardAll,
          child: Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: context.c.card,
              borderRadius: AppRadii.cardAll,
              border: Border.all(color: context.c.border),
            ),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: context.c.brandVolt.withValues(alpha: 0.12),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    isCup ? Icons.emoji_events : Icons.table_chart_outlined,
                    color: context.c.primary,
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
                        style: AppTypography.code(size: 11, color: context.c.primary),
                      ),
                    ],
                  ),
                ),
                Icon(Icons.chevron_right, color: context.c.textSecondary),
              ],
            ),
          ),
        );
      },
    );
  }
}
