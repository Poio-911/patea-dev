import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/models/competition_model.dart';
import '../../core/services/competition_service.dart';
import '../../core/services/firestore_service.dart';
import '../../core/theme/app_insets.dart';
import '../../core/theme/app_typography.dart';
import '../../core/theme/patea_colors.dart';
import '../../core/widgets/patea_activity_cover.dart';
import '../../core/widgets/patea_card.dart';
import '../../core/widgets/patea_section_scene.dart';
import '../../core/widgets/patea_snack.dart';
import '../../core/widgets/patea_states.dart';
import '../../core/widgets/patea_tabs.dart';
import 'competition_management.dart';

String competitionStatusLabel(String status) => switch (status) {
  'draft' => 'Borrador',
  'open_for_applications' => 'Inscripciones abiertas',
  'in_progress' => 'En juego',
  'completed' => 'Finalizada',
  'cancelled' => 'Cancelada',
  'published' => 'Publicada',
  _ => 'Por definir',
};
String competitionFormat(CompetitionModel c) => c.type == 'cup'
    ? 'Eliminación directa'
    : c.format == 'double_round_robin'
    ? 'Ida y vuelta'
    : 'Todos contra todos';

class CompetitionsScreen extends ConsumerStatefulWidget {
  const CompetitionsScreen({super.key});
  @override
  ConsumerState<CompetitionsScreen> createState() => _CompetitionsState();
}

class _CompetitionsState extends ConsumerState<CompetitionsScreen> {
  int _kind = 0, _generation = 0;
  String _scope = 'group', _status = 'all', _search = '';
  String? _requestedKey;
  var _items = <CompetitionModel>[];
  CompetitionPage? _page;
  bool _loading = false, _more = false;
  Object? _error;
  String get _collection => _kind == 0 ? 'leagues' : 'cups';
  Future<void> _load({bool reset = true}) async {
    if (!reset && (_loading || !_more)) return;
    final generation = ++_generation,
        key = _requestedKey,
        collection = _collection,
        scope = _scope,
        uid = ref.read(currentUidProvider),
        group = ref.read(activeGroupIdProvider).value;
    setState(() {
      _loading = true;
      _error = null;
      if (reset) {
        _items = [];
        _page = null;
        _more = false;
      }
    });
    try {
      final result = await ref
          .read(competitionServiceProvider)
          .page(
            collection: collection,
            scope: scope,
            uid: uid,
            groupId: group,
            after: reset ? null : _page?.cursor,
          );
      if (!mounted || generation != _generation || key != _requestedKey) return;
      setState(() {
        _items = {
          for (final c in [..._items, ...result.items]) c.id: c,
        }.values.toList();
        _page = result;
        _more = result.hasMore;
        _loading = false;
      });
    } catch (e) {
      if (mounted && generation == _generation && key == _requestedKey) {
        setState(() {
          _loading = false;
          _error = e;
        });
      }
    }
  }

  Future<void> _create() async {
    final group = ref.read(activeGroupIdProvider).value;
    if (group == null) {
      PateaSnack.info(
        context,
        'Elegí un grupo desde Gestionar grupos para crear tu torneo.',
      );
      return;
    }
    final cup = _kind == 1;
    final result = await Navigator.of(context, rootNavigator: true).push(
      MaterialPageRoute(
        builder: (_) => CreateCompetitionScreen(isCup: cup, groupId: group),
      ),
    );
    if (!mounted || result == null) return;
    _load();
    if (result is String) {
      context.push('/competitions/${cup ? 'cup' : 'league'}/$result');
    }
  }

  @override
  Widget build(BuildContext context) {
    final uid = ref.watch(currentUidProvider),
        group = ref.watch(activeGroupIdProvider);
    final key = '$_kind/$_scope/$uid/${group.value}';
    if (_requestedKey != key) {
      _requestedKey = key;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted && _requestedKey == key) _load();
      });
    }
    final items =
        _items
            .where(
              (c) =>
                  (_status == 'archived' ? c.isArchived : !c.isArchived) &&
                  (_status == 'all' ||
                      _status == 'archived' ||
                      c.status == _status) &&
                  c.name.toLowerCase().contains(_search.trim().toLowerCase()),
            )
            .toList()
          ..sort((a, b) {
            int rank(CompetitionModel c) => c.status == 'in_progress'
                ? 0
                : c.status == 'open_for_applications'
                ? 1
                : c.status == 'draft'
                ? 2
                : 3;
            return rank(a).compareTo(rank(b)) != 0
                ? rank(a).compareTo(rank(b))
                : a.name.compareTo(b.name);
          });
    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        title: Text('Torneos y Copas', style: AppTypography.headline(size: 20)),
      ),
      floatingActionButton: Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.paddingOf(context).bottom),
        child: FloatingActionButton.extended(
          onPressed: _create,
          icon: const Icon(Icons.add),
          label: Text(_kind == 0 ? 'Crear liga' : 'Crear copa'),
        ),
      ),
      body: RefreshIndicator(
        onRefresh: () => _load(),
        child: ListView(
          padding: EdgeInsets.fromLTRB(
            16,
            4,
            16,
            bottomInset(context, extra: 105),
          ),
          physics: const AlwaysScrollableScrollPhysics(),
          children: [
            PateaActivityCover(
              image: _kind == 0
                  ? PateaSectionScene.league
                  : PateaSectionScene.competitions,
              title: 'Hay un nuevo desafío',
              details: 'Tu equipo, la próxima fecha y todo lo que se juega.',
              compact: true,
            ),
            const SizedBox(height: 18),
            PateaTabs(
              tabs: const [PateaTab('Ligas'), PateaTab('Copas')],
              active: _kind,
              onChanged: (v) => setState(() => _kind = v),
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              key: ValueKey('scope-$_scope'),
              initialValue: _scope,
              isExpanded: true,
              decoration: const InputDecoration(labelText: 'Dónde buscar'),
              items: const [
                DropdownMenuItem(
                  value: 'group',
                  child: Text('Del grupo activo'),
                ),
                DropdownMenuItem(
                  value: 'owner',
                  child: Text('Las que organizo'),
                ),
                DropdownMenuItem(
                  value: 'public',
                  child: Text('Competiciones públicas'),
                ),
              ],
              onChanged: (v) => setState(() => _scope = v!),
            ),
            const SizedBox(height: 12),
            TextField(
              decoration: const InputDecoration(
                prefixIcon: Icon(Icons.search),
                labelText: 'Buscar entre los torneos cargados',
              ),
              onChanged: (v) => setState(() => _search = v),
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              initialValue: _status,
              isExpanded: true,
              decoration: const InputDecoration(labelText: 'Estado'),
              items: const [
                DropdownMenuItem(
                  value: 'all',
                  child: Text('Todos los estados'),
                ),
                DropdownMenuItem(
                  value: 'open_for_applications',
                  child: Text('Inscripciones abiertas'),
                ),
                DropdownMenuItem(value: 'draft', child: Text('Borradores')),
                DropdownMenuItem(value: 'in_progress', child: Text('En juego')),
                DropdownMenuItem(
                  value: 'completed',
                  child: Text('Finalizadas'),
                ),
                DropdownMenuItem(value: 'archived', child: Text('Archivadas')),
              ],
              onChanged: (v) => setState(() => _status = v!),
            ),
            const SizedBox(height: 20),
            if (group.isLoading && _scope == 'group')
              const PateaLoading(height: 110)
            else if (group.hasError && _scope == 'group')
              PateaError(error: group.error!)
            else if (_scope == 'group' && group.value == null)
              PateaEmpty(
                icon: Icons.groups_outlined,
                title: 'Elegí tu grupo',
                hint:
                    'Desde Gestionar grupos podés crear uno o activar el tuyo.',
                action: TextButton(
                  onPressed: () => context.push('/groups'),
                  child: const Text('Gestionar grupos'),
                ),
              )
            else ...[
              if (_error != null)
                PateaError(error: _error!, onRetry: () => _load()),
              if (_loading && _items.isEmpty) const PateaLoading(height: 140),
              if (!_loading && _error == null && items.isEmpty)
                PateaEmpty(
                  icon: Icons.emoji_events_outlined,
                  title: _search.isNotEmpty
                      ? 'No hay coincidencias'
                      : 'Todavía no hay torneos para mostrar',
                  hint: _more
                      ? 'Podés cargar más resultados o cambiar el filtro.'
                      : _scope == 'public'
                      ? 'Las competiciones con inscripciones abiertas aparecerán acá.'
                      : 'Creá el próximo desafío de tu equipo.',
                ),
              for (final c in items)
                Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: InkWell(
                    borderRadius: BorderRadius.circular(18),
                    onTap: () => context
                        .push(
                          '/competitions/${c.type == 'cup' ? 'cup' : 'league'}/${c.id}',
                        )
                        .then((_) {
                          if (mounted) _load();
                        }),
                    child: PateaCard(
                      padding: const EdgeInsets.all(16),
                      color: context.c.card,
                      borderColor: context.c.border,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Icon(
                                c.type == 'cup'
                                    ? Icons.emoji_events_outlined
                                    : Icons.leaderboard_outlined,
                                color: context.c.primary,
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Text(
                                  c.name,
                                  style: AppTypography.headline(size: 19),
                                ),
                              ),
                              const Icon(Icons.chevron_right),
                            ],
                          ),
                          const SizedBox(height: 10),
                          Text(
                            c.isArchived
                                ? 'Archivada'
                                : competitionStatusLabel(c.status),
                            style: AppTypography.body(
                              size: 13,
                              color: c.status == 'in_progress'
                                  ? context.c.primary
                                  : context.c.textSecondary,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            '${c.teamIds.length}/${c.maxTeams} equipos · ${competitionFormat(c)}',
                            style: AppTypography.body(
                              size: 13,
                              color: context.c.textSecondary,
                            ),
                          ),
                          if (c.ownerUid == uid)
                            Padding(
                              padding: const EdgeInsets.only(top: 8),
                              child: Text(
                                'Organizás este torneo',
                                style: AppTypography.body(
                                  size: 12,
                                  color: context.c.textSecondary,
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),
                  ),
                ),
              if (_more)
                OutlinedButton.icon(
                  onPressed: _loading ? null : () => _load(reset: false),
                  icon: _loading
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.expand_more),
                  label: Text(_loading ? 'Cargando…' : 'Cargar más torneos'),
                ),
            ],
          ],
        ),
      ),
    );
  }
}
