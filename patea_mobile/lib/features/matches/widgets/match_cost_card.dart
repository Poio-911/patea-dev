import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/models/match_model.dart';
import '../../../core/services/coach_service.dart' show coachErrorMessage;
import '../../../core/services/match_service.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/theme/patea_colors.dart';
import '../../../core/utils/cost_split.dart';
import '../../../core/widgets/patea_card.dart';
import '../../../core/widgets/patea_snack.dart';

/// Cuánto cuesta el partido y quién ya puso su parte.
///
/// El organizador carga el total de la cancha; se divide en partes iguales entre
/// quienes juegan y él marca a medida que le van pagando. La app no mueve
/// plata: es la planilla del que junta.
class MatchCostCard extends ConsumerStatefulWidget {
  final MatchModel match;
  final String? uid;
  final bool isManager;

  const MatchCostCard({
    super.key,
    required this.match,
    required this.uid,
    required this.isManager,
  });

  @override
  ConsumerState<MatchCostCard> createState() => _MatchCostCardState();
}

class _MatchCostCardState extends ConsumerState<MatchCostCard> {
  /// Quiénes tienen un cambio en camino, para frenar el doble toque.
  final _busy = <String>{};

  Future<void> _toggle(String playerId, bool paid) async {
    if (_busy.contains(playerId)) return;
    final avisar = PateaSnack.of(context);
    setState(() => _busy.add(playerId));
    try {
      await ref
          .read(matchServiceProvider)
          .markPayment(widget.match.id, playerId, paid: paid);
    } catch (e) {
      avisar.error(coachErrorMessage(e));
    } finally {
      if (mounted) setState(() => _busy.remove(playerId));
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final match = widget.match;
    final cost = match.cost;

    if (cost == null) {
      if (!widget.isManager || match.isCancelled) return const SizedBox.shrink();
      return PateaCard(
        padding: const EdgeInsets.all(14),
        borderColor: c.border.withValues(alpha: 0.45),
        child: Row(
          children: [
            Icon(Icons.payments_outlined, color: c.textSecondary),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                'Cargá lo que cuesta la cancha y dividilo entre los que juegan.',
                style: AppTypography.body(size: 13, color: c.textSecondary),
              ),
            ),
            TextButton(
              onPressed: () => showCostSheet(context, match),
              child: const Text('Cargar costo'),
            ),
          ],
        ),
      );
    }

    final summary = summarizeCost(cost, match.playerUids, match.costPaidUids);
    final names = {for (final p in match.players) p.uid: p.displayName};
    final paid = match.costPaidUids.toSet();
    final roster = match.playerUids.toSet().toList()
      // Primero los que faltan pagar.
      ..sort((a, b) {
        final pa = paid.contains(a);
        final pb = paid.contains(b);
        if (pa != pb) return pa ? 1 : -1;
        return (names[a] ?? '').compareTo(names[b] ?? '');
      });

    return PateaCard(
      padding: const EdgeInsets.all(16),
      borderColor: c.border.withValues(alpha: 0.5),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.payments_outlined, color: c.primary),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  'Costo del partido',
                  style: AppTypography.headline(size: 16, weight: FontWeight.w700),
                ),
              ),
              if (widget.isManager && !match.isCancelled)
                IconButton(
                  tooltip: 'Cambiar el costo',
                  onPressed: () => showCostSheet(context, match),
                  icon: const Icon(Icons.edit_outlined, size: 20),
                ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            summary.players == 0
                ? formatMoney(cost.total, cost.currency)
                : '${formatMoney(summary.share, cost.currency)} por persona',
            style: AppTypography.headline(size: 24, weight: FontWeight.w800),
          ),
          Text(
            summary.players == 0
                ? 'Todavía no hay jugadores para dividirlo.'
                : 'Total ${formatMoney(cost.total, cost.currency)} entre ${summary.players}',
            style: AppTypography.body(size: 13, color: c.textSecondary),
          ),
          if (summary.players > 0) ...[
            const SizedBox(height: 14),
            ClipRRect(
              borderRadius: AppRadii.hairAll,
              child: LinearProgressIndicator(
                value: summary.progress,
                minHeight: 6,
                backgroundColor: c.border.withValues(alpha: 0.4),
                color: summary.allPaid ? c.success : c.primary,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              summary.allPaid
                  ? '¡Pagaron todos!'
                  : '${summary.paidCount} de ${summary.players} pagaron · faltan ${formatMoney(summary.pending, cost.currency)}',
              style: AppTypography.body(
                size: 13,
                weight: FontWeight.w600,
                color: summary.allPaid ? c.success : c.textSecondary,
              ),
            ),
            const SizedBox(height: 10),
            for (final id in roster)
              _PersonRow(
                name: names[id] ?? 'Jugador',
                isMe: id == widget.uid,
                paid: paid.contains(id),
                amount: formatMoney(summary.share, cost.currency),
                busy: _busy.contains(id),
                onChanged: widget.isManager && !match.isCancelled
                    ? (value) => _toggle(id, value)
                    : null,
              ),
          ],
        ],
      ),
    );
  }
}

class _PersonRow extends StatelessWidget {
  final String name;
  final bool isMe;
  final bool paid;
  final String amount;
  final bool busy;
  final ValueChanged<bool>? onChanged;

  const _PersonRow({
    required this.name,
    required this.isMe,
    required this.paid,
    required this.amount,
    required this.busy,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final tint = paid ? c.success : c.textSecondary;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Icon(
            paid ? Icons.check_circle_rounded : Icons.radio_button_unchecked,
            size: 20,
            color: tint,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              isMe ? '$name (vos)' : name,
              style: AppTypography.body(
                size: 14,
                weight: isMe ? FontWeight.w700 : FontWeight.w500,
              ),
            ),
          ),
          Text(
            amount,
            style: AppTypography.body(size: 13, color: c.textSecondary),
          ),
          if (onChanged != null) ...[
            const SizedBox(width: 8),
            busy
                ? const SizedBox(
                    width: 40,
                    height: 24,
                    child: Center(
                      child: SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      ),
                    ),
                  )
                : Switch(
                    value: paid,
                    onChanged: onChanged,
                    materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  ),
          ] else
            Padding(
              padding: const EdgeInsets.only(left: 8),
              child: Text(
                paid ? 'Pagó' : 'Falta',
                style: AppTypography.body(
                  size: 12,
                  weight: FontWeight.w700,
                  color: tint,
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// Cuánto sale la cancha: monto y moneda. Con el monto en cero se saca el costo.
Future<void> showCostSheet(BuildContext context, MatchModel match) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (_) => _CostSheet(match: match),
  );
}

class _CostSheet extends ConsumerStatefulWidget {
  final MatchModel match;
  const _CostSheet({required this.match});

  @override
  ConsumerState<_CostSheet> createState() => _CostSheetState();
}

class _CostSheetState extends ConsumerState<_CostSheet> {
  late final TextEditingController _total;
  late String _currency;
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final cost = widget.match.cost;
    _currency = cost?.currency ?? 'UYU';
    _total = TextEditingController(
      text: cost == null
          ? ''
          : (cost.total == cost.total.roundToDouble()
                ? cost.total.toStringAsFixed(0)
                : cost.total.toString().replaceAll('.', ',')),
    );
  }

  @override
  void dispose() {
    _total.dispose();
    super.dispose();
  }

  /// Acepta «1500», «1.500» y «1500,50»; null si no es un monto.
  static double? parseAmount(String raw) {
    var text = raw.trim().replaceAll(RegExp(r'\s'), '');
    if (text.isEmpty) return null;
    if (text.contains(',')) {
      // «1.234,50»: el punto separa miles y la coma decimales.
      text = text.replaceAll('.', '').replaceAll(',', '.');
    } else if (RegExp(r'^\d{1,3}(\.\d{3})+$').hasMatch(text)) {
      text = text.replaceAll('.', '');
    }
    final value = double.tryParse(text);
    return value != null && value.isFinite && value >= 0 ? value : null;
  }

  Future<void> _save({bool remove = false}) async {
    final total = remove ? 0.0 : parseAmount(_total.text);
    if (total == null) {
      setState(() => _error = 'Escribí un monto, por ejemplo 1500.');
      return;
    }
    final navigator = Navigator.of(context);
    final avisar = PateaSnack.of(context);
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await ref
          .read(matchServiceProvider)
          .setCost(widget.match.id, total: total, currency: _currency);
      navigator.pop();
      avisar.ok(total == 0 ? 'Sacaste el costo.' : 'Costo guardado.');
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
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Costo del partido',
              style: AppTypography.headline(size: 20, weight: FontWeight.w800),
            ),
            const SizedBox(height: 4),
            Text(
              'Lo que sale la cancha en total. Se divide en partes iguales entre quienes juegan.',
              style: AppTypography.body(size: 13, color: c.textSecondary),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _total,
              autofocus: true,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              decoration: InputDecoration(
                labelText: 'Total',
                errorText: _error,
              ),
              onSubmitted: (_) => _save(),
            ),
            const SizedBox(height: 12),
            SegmentedButton<String>(
              showSelectedIcon: false,
              segments: const [
                ButtonSegment(value: 'UYU', label: Text(r'$ UYU')),
                ButtonSegment(value: 'ARS', label: Text(r'$ ARS')),
                ButtonSegment(value: 'USD', label: Text('US\$')),
              ],
              selected: {_currency},
              onSelectionChanged: (s) => setState(() => _currency = s.first),
            ),
            const SizedBox(height: 18),
            Row(
              children: [
                if (widget.match.cost != null)
                  TextButton(
                    onPressed: _saving ? null : () => _save(remove: true),
                    child: Text(
                      'Sacar costo',
                      style: TextStyle(color: c.destructive),
                    ),
                  ),
                const Spacer(),
                FilledButton(
                  onPressed: _saving ? null : _save,
                  child: _saving
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Text('Guardar'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
