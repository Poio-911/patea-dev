import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/constants/sections.dart';
import '../../core/models/competition_model.dart';
import '../../core/services/competition_service.dart';
import '../../core/services/firestore_service.dart';
import '../../core/theme/app_insets.dart';
import '../../core/theme/app_radii.dart';
import '../../core/theme/app_typography.dart';
import '../../core/theme/patea_colors.dart';
import '../../core/widgets/patea_activity_cover.dart';
import '../../core/widgets/patea_button_progress.dart';
import '../../core/widgets/patea_card.dart';
import '../../core/widgets/patea_help_dialog.dart';
import '../../core/widgets/patea_page_header.dart';
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
  int get _activeFilterCount =>
      (_scope != 'group' ? 1 : 0) + (_status != 'all' ? 1 : 0);

  void _openFiltersSheet() {
    var draftScope = _scope;
    var draftStatus = _status;
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: context.c.popover,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: AppRadii.surfaceTop),
      builder: (sheetCtx) => StatefulBuilder(
        builder: (sheetCtx, setSheet) => SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 18, 20, 20),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    Text(
                      'Filtrar torneos',
                      style: AppTypography.headline(
                        size: 18,
                        weight: FontWeight.w700,
                      ),
                    ),
                    const Spacer(),
                    if (draftScope != 'group' || draftStatus != 'all')
                      TextButton(
                        onPressed: () => setSheet(() {
                          draftScope = 'group';
                          draftStatus = 'all';
                        }),
                        child: const Text('Limpiar'),
                      ),
                  ],
                ),
                const SizedBox(height: 14),
                DropdownButtonFormField<String>(
                  key: ValueKey('sheet-scope-$draftScope'),
                  initialValue: draftScope,
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
                  onChanged: (v) => setSheet(() => draftScope = v!),
                ),
                const SizedBox(height: 14),
                DropdownButtonFormField<String>(
                  key: ValueKey('sheet-status-$draftStatus'),
                  initialValue: draftStatus,
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
                    DropdownMenuItem(
                      value: 'in_progress',
                      child: Text('En juego'),
                    ),
                    DropdownMenuItem(
                      value: 'completed',
                      child: Text('Finalizadas'),
                    ),
                    DropdownMenuItem(
                      value: 'archived',
                      child: Text('Archivadas'),
                    ),
                  ],
                  onChanged: (v) => setSheet(() => draftStatus = v!),
                ),
                const SizedBox(height: 20),
                FilledButton(
                  onPressed: () {
                    Navigator.pop(sheetCtx);
                    setState(() {
                      _scope = draftScope;
                      _status = draftStatus;
                    });
                  },
                  child: const Text('Aplicar filtros'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
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
      body: RefreshIndicator(
        onRefresh: () => _load(),
        child: ListView(
          padding: EdgeInsets.fromLTRB(
            16,
            MediaQuery.paddingOf(context).top + 12,
            16,
            bottomInset(context, extra: 24),
          ),
          physics: const AlwaysScrollableScrollPhysics(),
          children: [
            PateaPageHeader(
              section: Section.competitions,
              title: spec(Section.competitions).title,
              description: spec(Section.competitions).description,
              showCountRow: false,
              helpTooltip: 'Torneos: Ligas y Copas',
              onHelpTap: () => showContextualHelpSheet(
                context,
                topic: HelpTopic.competitions,
              ),
              actionButton: PateaHeaderActionButton(
                label: _kind == 0 ? 'Crear liga' : 'Crear copa',
                onPressed: _create,
              ),
            ),
            const SizedBox(height: 16),
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
            Row(
              children: [
                Expanded(
                  child: TextField(
                    decoration: const InputDecoration(
                      prefixIcon: Icon(Icons.search),
                      hintText: 'Buscar torneo…',
                      isDense: true,
                    ),
                    onChanged: (v) => setState(() => _search = v),
                  ),
                ),
                const SizedBox(width: 10),
                OutlinedButton.icon(
                  onPressed: _openFiltersSheet,
                  style: OutlinedButton.styleFrom(
                    foregroundColor: _activeFilterCount > 0
                        ? context.c.primary
                        : context.c.textPrimary,
                    side: BorderSide(
                      color: _activeFilterCount > 0
                          ? context.c.primary
                          : context.c.controlBorder,
                    ),
                    minimumSize: const Size(0, 48),
                  ),
                  icon: const Icon(Icons.filter_list_rounded, size: 18),
                  label: Text(
                    _activeFilterCount > 0
                        ? 'Filtros ($_activeFilterCount)'
                        : 'Filtros',
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
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
                    borderRadius: AppRadii.cardAll,
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
                          child: PateaButtonProgress(),
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
