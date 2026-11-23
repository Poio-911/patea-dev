import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/venue_model.dart';
import '../services/coach_service.dart' show coachErrorMessage;
import '../services/group_service.dart';
import '../theme/app_typography.dart';
import '../theme/patea_colors.dart';
import 'patea_card.dart';
import 'patea_snack.dart';

/// Acepta «1500», «1.500» y «1500,50»; null si no es un monto.
double? parseMoneyInput(String raw) {
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

/// Cuánto cuesta jugar un partido en esta cancha. Se usa para dividir el costo
/// entre quienes juegan; con el monto vacío o en cero se saca.
Future<void> showVenueCostSheet(BuildContext context, VenueModel venue) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (_) => _VenueCostSheet(venue: venue),
  );
}

class _VenueCostSheet extends ConsumerStatefulWidget {
  final VenueModel venue;
  const _VenueCostSheet({required this.venue});

  @override
  ConsumerState<_VenueCostSheet> createState() => _VenueCostSheetState();
}

class _VenueCostSheetState extends ConsumerState<_VenueCostSheet> {
  late final TextEditingController _total;
  late String _currency;
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final cost = widget.venue.costPerMatch;
    _currency = widget.venue.costCurrency;
    _total = TextEditingController(
      text: cost == null
          ? ''
          : (cost == cost.roundToDouble()
                ? cost.toStringAsFixed(0)
                : cost.toString().replaceAll('.', ',')),
    );
  }

  @override
  void dispose() {
    _total.dispose();
    super.dispose();
  }

  Future<void> _save({bool remove = false}) async {
    final raw = _total.text.trim();
    final total = remove || raw.isEmpty ? 0.0 : parseMoneyInput(raw);
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
      await ref.read(groupServiceProvider).setVenueCost(
        groupId: widget.venue.groupId,
        venueId: widget.venue.id,
        total: total,
        currency: _currency,
      );
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
              'Costo de ${widget.venue.name}',
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: AppTypography.headline(size: 20, weight: FontWeight.w800),
            ),
            const SizedBox(height: 4),
            Text(
              'Lo que sale jugar un partido en esta cancha. Se divide entre quienes juegan y el organizador marca quién pagó.',
              style: AppTypography.body(size: 13, color: c.textSecondary),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _total,
              autofocus: true,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              decoration: InputDecoration(
                labelText: 'Costo por partido',
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
                if (widget.venue.costPerMatch != null)
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
