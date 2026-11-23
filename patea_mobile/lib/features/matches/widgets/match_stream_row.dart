import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/models/match_model.dart';
import '../../../core/services/coach_service.dart' show coachErrorMessage;
import '../../../core/services/match_service.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/theme/patea_colors.dart';
import '../../../core/widgets/patea_card.dart';
import '../../../core/widgets/patea_snack.dart';

/// Transmisión del partido. Quien lo organiza pega el enlace (YouTube, Twitch o
/// Kick) y todos los que miran el partido lo abren con un toque. La transmisión
/// en sí no pasa por Pateá: se ve en la app del servicio.
class MatchStreamRow extends StatelessWidget {
  final MatchModel match;
  final bool isManager;

  const MatchStreamRow({
    super.key,
    required this.match,
    required this.isManager,
  });

  static String providerName(String provider) => switch (provider) {
    'youtube' => 'YouTube',
    'twitch' => 'Twitch',
    'kick' => 'Kick',
    _ => 'el servicio',
  };

  Future<void> _open(BuildContext context, MatchStream stream) async {
    final avisar = PateaSnack.of(context);
    final ok = await launchUrl(
      Uri.parse(stream.url),
      mode: LaunchMode.externalApplication,
    );
    if (!ok) avisar.error('No se pudo abrir la transmisión.');
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final stream = match.stream;
    final canEdit = isManager && !match.isCancelled;

    if (stream == null) {
      if (!canEdit) return const SizedBox.shrink();
      return Align(
        alignment: Alignment.centerLeft,
        child: OutlinedButton.icon(
          onPressed: () => showStreamSheet(context, match),
          icon: const Icon(Icons.live_tv_outlined, size: 18),
          label: const Text('Agregar transmisión'),
        ),
      );
    }

    return PateaCard(
      padding: const EdgeInsets.fromLTRB(12, 8, 8, 8),
      borderColor: c.border,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.live_tv_rounded, color: c.primary),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  'Transmisión del partido',
                  style: AppTypography.headline(
                    size: 15,
                    weight: FontWeight.w700,
                  ),
                ),
              ),
              if (canEdit)
                IconButton(
                  tooltip: 'Cambiar la transmisión',
                  onPressed: () => showStreamSheet(context, match),
                  icon: const Icon(Icons.edit_outlined, size: 20),
                ),
            ],
          ),
          if (!canEdit) const SizedBox(height: 6),
          TextButton.icon(
            onPressed: () => _open(context, stream),
            icon: const Icon(Icons.open_in_new_rounded, size: 17),
            label: Text('Ver en ${providerName(stream.provider)}'),
          ),
        ],
      ),
    );
  }
}

Future<void> showStreamSheet(BuildContext context, MatchModel match) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (_) => _StreamSheet(match: match),
  );
}

class _StreamSheet extends ConsumerStatefulWidget {
  final MatchModel match;
  const _StreamSheet({required this.match});

  @override
  ConsumerState<_StreamSheet> createState() => _StreamSheetState();
}

class _StreamSheetState extends ConsumerState<_StreamSheet> {
  late final TextEditingController _url;
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _url = TextEditingController(text: widget.match.stream?.url ?? '');
  }

  @override
  void dispose() {
    _url.dispose();
    super.dispose();
  }

  Future<void> _save({bool remove = false}) async {
    final text = remove ? '' : _url.text.trim();
    if (!remove && text.isEmpty) {
      setState(() => _error = 'Pegá el enlace de la transmisión.');
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
          .setStream(widget.match.id, text.isEmpty ? null : text);
      navigator.pop();
      avisar.ok(
        text.isEmpty ? 'Sacaste la transmisión.' : 'Transmisión guardada.',
      );
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
              'Transmisión del partido',
              style: AppTypography.headline(size: 20, weight: FontWeight.w800),
            ),
            const SizedBox(height: 4),
            Text(
              'Pegá el enlace de YouTube, Twitch o Kick. Quienes miran el partido lo abren desde acá.',
              style: AppTypography.body(size: 13, color: c.textSecondary),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _url,
              autofocus: true,
              keyboardType: TextInputType.url,
              autocorrect: false,
              decoration: InputDecoration(
                labelText: 'Enlace',
                hintText: 'https://www.youtube.com/watch?v=…',
                errorText: _error,
                errorMaxLines: 2,
              ),
              onSubmitted: (_) => _save(),
            ),
            const SizedBox(height: 18),
            Row(
              children: [
                if (widget.match.stream != null)
                  TextButton(
                    onPressed: _saving ? null : () => _save(remove: true),
                    child: Text(
                      'Sacar transmisión',
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
