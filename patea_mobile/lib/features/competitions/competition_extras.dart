import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/models/competition_extras_models.dart';
import '../../core/models/competition_model.dart';
import '../../core/services/coach_service.dart' show coachErrorMessage;
import '../../core/services/competition_extras_service.dart';
import '../../core/theme/app_typography.dart';
import '../../core/theme/patea_colors.dart';
import '../../core/utils/cost_split.dart';
import '../../core/widgets/patea_card.dart';
import '../../core/widgets/patea_snack.dart';
import '../../core/widgets/patea_states.dart';

/// Lo que el organizador maneja además de los partidos: avisos a los equipos,
/// sedes y patrocinadores.

// ───────────────────────────── Marco de las hojas ─────────────────────────────

class _SheetFrame extends StatelessWidget {
  final String title;
  final String? subtitle;
  final List<Widget> children;

  const _SheetFrame({
    required this.title,
    this.subtitle,
    required this.children,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: PateaCard(
        color: c.popover,
        radius: const BorderRadius.vertical(top: Radius.circular(24)),
        padding: EdgeInsets.fromLTRB(
          20,
          18,
          20,
          18 + MediaQuery.paddingOf(context).bottom,
        ),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: AppTypography.headline(size: 20, weight: FontWeight.w800),
              ),
              if (subtitle != null) ...[
                const SizedBox(height: 4),
                Text(
                  subtitle!,
                  style: AppTypography.body(size: 13, color: c.textSecondary),
                ),
              ],
              const SizedBox(height: 16),
              ...children,
            ],
          ),
        ),
      ),
    );
  }
}

Future<T?> _showSheet<T>(BuildContext context, WidgetBuilder builder) =>
    showModalBottomSheet<T>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: builder,
    );

Widget _saveRow(
  BuildContext context, {
  required bool saving,
  required VoidCallback onSave,
  VoidCallback? onRemove,
  String removeLabel = 'Quitar',
}) {
  return Row(
    children: [
      if (onRemove != null)
        TextButton(
          onPressed: saving ? null : onRemove,
          child: Text(removeLabel, style: TextStyle(color: context.c.destructive)),
        ),
      const Spacer(),
      FilledButton(
        onPressed: saving ? null : onSave,
        child: saving
            ? const SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(strokeWidth: 2),
              )
            : const Text('Guardar'),
      ),
    ],
  );
}

// ───────────────────────────── Sedes ─────────────────────────────

class CompetitionVenuesSection extends ConsumerWidget {
  final String collection;
  final String id;
  final bool canEdit;

  const CompetitionVenuesSection({
    super.key,
    required this.collection,
    required this.id,
    required this.canEdit,
  });

  Future<void> _remove(BuildContext context, WidgetRef ref, CompetitionVenue v) async {
    final avisar = PateaSnack.of(context);
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('¿Sacar ${v.name}?'),
        content: const Text('Deja de figurar entre las sedes del torneo.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Sacar'),
          ),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await ref.read(competitionExtrasServiceProvider).removeVenue(collection, id, v.id);
      avisar.ok('Sacaste la sede.');
    } catch (e) {
      avisar.error(coachErrorMessage(e));
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.c;
    final venues = ref.watch(competitionVenuesProvider((collection, id)));
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                'Sedes',
                style: AppTypography.headline(size: 22, weight: FontWeight.w800),
              ),
            ),
            if (canEdit)
              TextButton.icon(
                onPressed: () => _showSheet(
                  context,
                  (_) => _VenueSheet(collection: collection, id: id),
                ),
                icon: const Icon(Icons.add, size: 18),
                label: const Text('Agregar'),
              ),
          ],
        ),
        const SizedBox(height: 4),
        Text(
          'Dónde se juega el torneo.',
          style: AppTypography.body(size: 13, color: c.textSecondary),
        ),
        const SizedBox(height: 12),
        venues.when(
          loading: () => const PateaLoading(height: 80),
          error: (e, _) => PateaError(
            error: e,
            message: 'No pudimos cargar las sedes.',
            compact: true,
            onRetry: () => ref.invalidate(competitionVenuesProvider((collection, id))),
          ),
          data: (list) => list.isEmpty
              ? PateaEmpty(
                  icon: Icons.stadium_outlined,
                  title: canEdit
                      ? 'Todavía no cargaste sedes'
                      : 'Todavía no hay sedes cargadas',
                  hint: canEdit
                      ? 'Sumá las canchas donde se juega, con su dirección y cuánto cuesta cada partido.'
                      : null,
                  compact: true,
                )
              : Column(
                  children: [
                    for (final v in list)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 10),
                        child: _VenueTile(
                          venue: v,
                          onEdit: canEdit
                              ? () => _showSheet(
                                  context,
                                  (_) => _VenueSheet(
                                    collection: collection,
                                    id: id,
                                    venue: v,
                                  ),
                                )
                              : null,
                          onRemove: canEdit ? () => _remove(context, ref, v) : null,
                        ),
                      ),
                  ],
                ),
        ),
      ],
    );
  }
}

class _VenueTile extends StatelessWidget {
  final CompetitionVenue venue;
  final VoidCallback? onEdit;
  final VoidCallback? onRemove;

  const _VenueTile({required this.venue, this.onEdit, this.onRemove});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final details = [
      if (venue.capacity != null) 'Capacidad ${venue.capacity}',
      if (venue.costPerMatch != null)
        '${formatMoney(venue.costPerMatch!, 'UYU')} por partido',
    ];
    return PateaCard(
      padding: const EdgeInsets.fromLTRB(14, 12, 4, 12),
      borderColor: c.border.withValues(alpha: 0.45),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(top: 2),
            child: Icon(Icons.stadium_outlined, color: c.primary),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  venue.name,
                  style: AppTypography.headline(size: 15, weight: FontWeight.w700),
                ),
                if (venue.address != null)
                  Text(
                    venue.address!,
                    style: AppTypography.body(size: 13, color: c.textSecondary),
                  ),
                if (details.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Text(
                      details.join(' · '),
                      style: AppTypography.body(size: 12.5, weight: FontWeight.w600),
                    ),
                  ),
                if (venue.notes != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Text(
                      venue.notes!,
                      style: AppTypography.body(size: 12.5, color: c.textSecondary),
                    ),
                  ),
              ],
            ),
          ),
          if (onEdit != null)
            PopupMenuButton<String>(
              tooltip: 'Más opciones',
              onSelected: (v) => v == 'edit' ? onEdit!() : onRemove?.call(),
              itemBuilder: (_) => const [
                PopupMenuItem(value: 'edit', child: Text('Editar')),
                PopupMenuItem(value: 'remove', child: Text('Sacar')),
              ],
            ),
        ],
      ),
    );
  }
}

class _VenueSheet extends ConsumerStatefulWidget {
  final String collection;
  final String id;
  final CompetitionVenue? venue;

  const _VenueSheet({required this.collection, required this.id, this.venue});

  @override
  ConsumerState<_VenueSheet> createState() => _VenueSheetState();
}

class _VenueSheetState extends ConsumerState<_VenueSheet> {
  late final _name = TextEditingController(text: widget.venue?.name ?? '');
  late final _address = TextEditingController(text: widget.venue?.address ?? '');
  late final _capacity = TextEditingController(
    text: widget.venue?.capacity?.toString() ?? '',
  );
  late final _cost = TextEditingController(
    text: widget.venue?.costPerMatch == null
        ? ''
        : widget.venue!.costPerMatch!.toString().replaceAll(RegExp(r'\.0$'), ''),
  );
  late final _notes = TextEditingController(text: widget.venue?.notes ?? '');
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    for (final c in [_name, _address, _capacity, _cost, _notes]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _save() async {
    if (_name.text.trim().length < 2) {
      setState(() => _error = 'La sede necesita un nombre.');
      return;
    }
    final navigator = Navigator.of(context);
    final avisar = PateaSnack.of(context);
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await ref.read(competitionExtrasServiceProvider).saveVenue(
        widget.collection,
        widget.id,
        venueId: widget.venue?.id,
        name: _name.text,
        address: _address.text,
        capacity: _capacity.text.trim(),
        costPerMatch: _cost.text.trim().replaceAll(',', '.'),
        notes: _notes.text,
      );
      navigator.pop();
      avisar.ok('Sede guardada.');
    } catch (e) {
      if (mounted) {
        setState(() {
          _saving = false;
          _error = coachErrorMessage(e);
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return _SheetFrame(
      title: widget.venue == null ? 'Agregar sede' : 'Editar sede',
      children: [
        TextField(
          controller: _name,
          autofocus: widget.venue == null,
          textCapitalization: TextCapitalization.sentences,
          decoration: InputDecoration(labelText: 'Nombre', errorText: _error),
        ),
        const SizedBox(height: 10),
        TextField(
          controller: _address,
          decoration: const InputDecoration(labelText: 'Dirección (opcional)'),
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(
              child: TextField(
                controller: _capacity,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Capacidad'),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: TextField(
                controller: _cost,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(labelText: 'Costo por partido'),
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        TextField(
          controller: _notes,
          maxLength: 200,
          decoration: const InputDecoration(
            labelText: 'Notas (opcional)',
            counterText: '',
          ),
        ),
        const SizedBox(height: 16),
        _saveRow(context, saving: _saving, onSave: _save),
      ],
    );
  }
}

// ───────────────────────────── Patrocinadores ─────────────────────────────

class CompetitionSponsorsSection extends ConsumerWidget {
  final CompetitionModel competition;
  final String collection;
  final bool canEdit;

  const CompetitionSponsorsSection({
    super.key,
    required this.competition,
    required this.collection,
    required this.canEdit,
  });

  Future<void> _open(BuildContext context, CompetitionSponsor s) async {
    final avisar = PateaSnack.of(context);
    final url = s.websiteUrl;
    if (url == null) return;
    final ok = await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
    if (!ok) avisar.error('No se pudo abrir el enlace.');
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.c;
    final sponsors = competition.sponsors;
    if (sponsors.isEmpty && !canEdit) return const SizedBox.shrink();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                canEdit ? 'Patrocinadores' : 'Con el apoyo de',
                style: AppTypography.headline(size: canEdit ? 18 : 15, weight: FontWeight.w700),
              ),
            ),
            if (canEdit)
              TextButton.icon(
                onPressed: () => _showSheet(
                  context,
                  (_) => _SponsorSheet(collection: collection, id: competition.id),
                ),
                icon: const Icon(Icons.add, size: 18),
                label: const Text('Agregar'),
              ),
          ],
        ),
        const SizedBox(height: 8),
        if (sponsors.isEmpty)
          Text(
            'Sumá a quienes apoyan el torneo: aparecen en el resumen.',
            style: AppTypography.body(size: 13, color: c.textSecondary),
          )
        else
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final s in sponsors)
                InputChip(
                  avatar: Icon(
                    s.websiteUrl == null ? Icons.handshake_outlined : Icons.open_in_new,
                    size: 16,
                  ),
                  label: Text(s.name),
                  onPressed: canEdit
                      ? () => _showSheet(
                          context,
                          (_) => _SponsorSheet(
                            collection: collection,
                            id: competition.id,
                            sponsor: s,
                          ),
                        )
                      : (s.websiteUrl == null ? null : () => _open(context, s)),
                ),
            ],
          ),
      ],
    );
  }
}

class _SponsorSheet extends ConsumerStatefulWidget {
  final String collection;
  final String id;
  final CompetitionSponsor? sponsor;

  const _SponsorSheet({required this.collection, required this.id, this.sponsor});

  @override
  ConsumerState<_SponsorSheet> createState() => _SponsorSheetState();
}

class _SponsorSheetState extends ConsumerState<_SponsorSheet> {
  late final _name = TextEditingController(text: widget.sponsor?.name ?? '');
  late final _url = TextEditingController(text: widget.sponsor?.websiteUrl ?? '');
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _name.dispose();
    _url.dispose();
    super.dispose();
  }

  Future<void> _run(Future<void> Function() action, String done) async {
    final navigator = Navigator.of(context);
    final avisar = PateaSnack.of(context);
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await action();
      navigator.pop();
      avisar.ok(done);
    } catch (e) {
      if (mounted) {
        setState(() {
          _saving = false;
          _error = coachErrorMessage(e);
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final service = ref.read(competitionExtrasServiceProvider);
    final existing = widget.sponsor;
    return _SheetFrame(
      title: existing == null ? 'Agregar patrocinador' : 'Editar patrocinador',
      subtitle: 'Se muestra en el resumen del torneo. El enlace es opcional.',
      children: [
        TextField(
          controller: _name,
          autofocus: existing == null,
          textCapitalization: TextCapitalization.words,
          decoration: InputDecoration(labelText: 'Nombre', errorText: _error),
        ),
        const SizedBox(height: 10),
        TextField(
          controller: _url,
          keyboardType: TextInputType.url,
          autocorrect: false,
          decoration: const InputDecoration(
            labelText: 'Enlace (opcional)',
            hintText: 'https://…',
          ),
        ),
        const SizedBox(height: 16),
        _saveRow(
          context,
          saving: _saving,
          onSave: () => _run(
            () => service.saveSponsor(
              widget.collection,
              widget.id,
              sponsorId: existing?.id,
              name: _name.text,
              websiteUrl: _url.text.trim(),
            ),
            'Patrocinador guardado.',
          ),
          onRemove: existing == null
              ? null
              : () => _run(
                  () => service.removeSponsor(widget.collection, widget.id, existing.id),
                  'Lo sacaste.',
                ),
        ),
      ],
    );
  }
}

// ───────────────────────────── Avisos ─────────────────────────────

class CompetitionMessagesSection extends ConsumerStatefulWidget {
  final String collection;
  final String id;

  const CompetitionMessagesSection({
    super.key,
    required this.collection,
    required this.id,
  });

  @override
  ConsumerState<CompetitionMessagesSection> createState() =>
      _CompetitionMessagesSectionState();
}

class _CompetitionMessagesSectionState
    extends ConsumerState<CompetitionMessagesSection> {
  final _subject = TextEditingController();
  final _body = TextEditingController();
  String _audience = 'all';
  bool _sending = false;
  String? _error;

  @override
  void dispose() {
    _subject.dispose();
    _body.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final avisar = PateaSnack.of(context);
    setState(() {
      _sending = true;
      _error = null;
    });
    try {
      final count = await ref.read(competitionExtrasServiceProvider).sendMessage(
        widget.collection,
        widget.id,
        subject: _subject.text,
        body: _body.text,
        audience: _audience,
      );
      _subject.clear();
      _body.clear();
      avisar.ok(
        count == 1 ? 'Aviso enviado a 1 persona.' : 'Aviso enviado a $count personas.',
      );
    } catch (e) {
      setState(() => _error = coachErrorMessage(e));
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final history = ref.watch(
      competitionMessagesProvider((widget.collection, widget.id)),
    );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Avisos',
          style: AppTypography.headline(size: 22, weight: FontWeight.w800),
        ),
        const SizedBox(height: 4),
        Text(
          'Le llegan como notificación a quienes juegan el torneo.',
          style: AppTypography.body(size: 13, color: c.textSecondary),
        ),
        const SizedBox(height: 14),
        SegmentedButton<String>(
          showSelectedIcon: false,
          segments: const [
            ButtonSegment(value: 'all', label: Text('Todos los equipos')),
            ButtonSegment(value: 'captains', label: Text('Solo capitanes')),
          ],
          selected: {_audience},
          onSelectionChanged: (s) => setState(() => _audience = s.first),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _subject,
          maxLength: 80,
          textCapitalization: TextCapitalization.sentences,
          decoration: const InputDecoration(labelText: 'Asunto', counterText: ''),
        ),
        const SizedBox(height: 10),
        TextField(
          controller: _body,
          minLines: 3,
          maxLines: 6,
          maxLength: 500,
          textCapitalization: TextCapitalization.sentences,
          decoration: InputDecoration(labelText: 'Mensaje', errorText: _error),
        ),
        const SizedBox(height: 6),
        Align(
          alignment: Alignment.centerRight,
          child: FilledButton.icon(
            onPressed: _sending ? null : _send,
            icon: _sending
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.send_rounded, size: 18),
            label: const Text('Enviar aviso'),
          ),
        ),
        const SizedBox(height: 22),
        Text(
          'Enviados',
          style: AppTypography.headline(size: 16, weight: FontWeight.w700),
        ),
        const SizedBox(height: 10),
        history.when(
          loading: () => const PateaLoading(height: 60),
          error: (e, _) => PateaError(
            error: e,
            message: 'No pudimos cargar los avisos.',
            compact: true,
          ),
          data: (list) => list.isEmpty
              ? Text(
                  'Todavía no mandaste ningún aviso.',
                  style: AppTypography.body(size: 13, color: c.textSecondary),
                )
              : Column(
                  children: [
                    for (final m in list)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 10),
                        child: _MessageTile(message: m),
                      ),
                  ],
                ),
        ),
      ],
    );
  }
}

class _MessageTile extends StatelessWidget {
  final CompetitionMessage message;
  const _MessageTile({required this.message});

  static String _when(DateTime? d) {
    if (d == null) return '';
    final l = d.toLocal();
    String two(int n) => n.toString().padLeft(2, '0');
    return '${two(l.day)}/${two(l.month)} ${two(l.hour)}:${two(l.minute)}';
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return PateaCard(
      padding: const EdgeInsets.all(14),
      borderColor: c.border.withValues(alpha: 0.45),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            message.subject,
            style: AppTypography.headline(size: 15, weight: FontWeight.w700),
          ),
          const SizedBox(height: 4),
          Text(message.body, style: AppTypography.body(size: 14)),
          const SizedBox(height: 8),
          Text(
            '${_when(message.createdAt)} · ${message.audience == 'captains' ? 'Capitanes' : 'Todos'} · llegó a ${message.recipientCount}',
            style: AppTypography.body(size: 12, color: c.textSecondary),
          ),
        ],
      ),
    );
  }
}
