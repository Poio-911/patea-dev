import '../../core/theme/app_insets.dart';
import 'competition_management.dart';
import 'league_detail_screen.dart';
import '../../core/widgets/patea_section_scene.dart';
import 'package:flutter/material.dart';
import '../../core/widgets/patea_card.dart';
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

class _CompetitionsScreenState extends ConsumerState<CompetitionsScreen>
    with SingleTickerProviderStateMixin {
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
  void dispose() {
    _tabController.dispose();
    super.dispose();
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
          spec(Section.competitions).title,
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
      floatingActionButton: Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.paddingOf(context).bottom),
        child: FloatingActionButton.extended(
          onPressed: () async {
            final groupId = ref.read(activeGroupIdProvider).value;
            if (groupId == null || groupId.isEmpty) {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text(
                    'Elegí un grupo desde Gestionar grupos para crear un torneo.',
                  ),
                ),
              );
              return;
            }
            await Navigator.of(context).push(
              MaterialPageRoute<bool>(
                builder: (_) =>
                    CreateCompetitionScreen(isCup: _tab == 1, groupId: groupId),
              ),
            );
          },
          icon: const Icon(Icons.add),
          label: Text(_tab == 1 ? 'Crear copa' : 'Crear liga'),
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          // Ligas
          leaguesAsync.when(
            data: (leagues) =>
                _CompetitionsList(competitions: leagues, isCup: false),
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

class _CompetitionsList extends ConsumerWidget {
  final List<CompetitionModel> competitions;
  final bool isCup;

  const _CompetitionsList({required this.competitions, required this.isCup});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (competitions.isEmpty) {
      return SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: PateaSectionScene(
          image: isCup
              ? PateaSectionScene.competitions
              : PateaSectionScene.league,
          title: isCup ? 'No hay copas activas' : 'No hay ligas activas',
          description:
              'Las competiciones de tu grupo aparecen acá, con sus fechas, equipos y resultados.',
        ),
      );
    }

    return ListView.separated(
      padding: EdgeInsets.fromLTRB(
        16,
        16,
        16,
        bottomInset(context, extra: 100),
      ),
      itemCount: competitions.length + 1,
      separatorBuilder: (_, index) => const SizedBox(height: 12),
      itemBuilder: (context, index) {
        if (index == 0) {
          return Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: PateaSectionScene(
              image: isCup
                  ? PateaSectionScene.competitions
                  : PateaSectionScene.league,
              title: isCup ? 'Copas del grupo' : 'Ligas del grupo',
              description: isCup
                  ? 'Seguí las llaves, los cruces y los resultados.'
                  : 'Seguí cada fecha y los resultados de tus equipos.',
            ),
          );
        }
        final comp = competitions[index - 1];
        return InkWell(
          onTap: () {
            if (isCup) {
              context.push('/competitions/cup/${comp.id}');
            } else {
              context.push('/competitions/league/${comp.id}');
            }
          },
          borderRadius: AppRadii.cardAll,
          child: PateaCard(
            color: context.c.card,
            radius: AppRadii.cardAll,
            borderColor: context.c.border,
            padding: const EdgeInsets.all(16),
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
                        style: AppTypography.headline(
                          size: 16,
                          weight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        competitionStatusLabel(comp.status),
                        style: AppTypography.body(
                          size: 12,
                          color: context.c.primary,
                        ),
                      ),
                    ],
                  ),
                ),
                if (ref.watch(currentUidProvider) == comp.ownerUid)
                  IconButton(
                    tooltip: 'Eliminar torneo',
                    icon: const Icon(Icons.delete_outline),
                    onPressed: () async {
                      try {
                        await confirmDeleteCompetition(context, ref, comp);
                      } catch (e) {
                        if (context.mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(content: Text('No se pudo eliminar: $e')),
                          );
                        }
                      }
                    },
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
