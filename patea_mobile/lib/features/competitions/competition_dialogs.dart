import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/models/competition_model.dart';
import '../../core/services/competition_service.dart';
import '../../core/theme/app_typography.dart';
import '../../core/theme/patea_colors.dart';
import '../../core/widgets/patea_button_progress.dart';
import 'competition_insights.dart';
import 'competition_management.dart';

Future<Map<String, dynamic>?> competitionScheduleDialog(
  BuildContext context, {
  required String title,
  String? date,
  String time = '21:00',
  Map<String, dynamic> location = const {},
}) async {
  final venue = TextEditingController(
        text: location['name']?.toString() == 'A definir'
            ? ''
            : location['name']?.toString() ?? '',
      ),
      address = TextEditingController(
        text: location['address']?.toString() ?? '',
      );
  var day = DateTime.tryParse(date ?? ''), clock = time;
  String? error;
  final route = DialogRoute<Map<String, dynamic>>(
    context: context,
    builder: (context) => StatefulBuilder(
      builder: (context, setModal) => AlertDialog(
        title: Text(title, style: AppTypography.headline(size: 21)),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.calendar_today_outlined),
                title: Text(
                  day == null
                      ? 'Elegir fecha'
                      : '${day!.day}/${day!.month}/${day!.year}',
                ),
                onTap: () async {
                  final now = DateTime.now();
                  final d = await showDatePicker(
                    context: context,
                    initialDate: day != null && day!.isAfter(now)
                        ? day
                        : now.add(const Duration(days: 7)),
                    firstDate: now,
                    lastDate: DateTime(now.year + 3),
                  );
                  if (d != null && context.mounted) setModal(() => day = d);
                },
              ),
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.schedule),
                title: Text(clock),
                onTap: () async {
                  final raw = clock.split(':');
                  final t = await showTimePicker(
                    context: context,
                    initialTime: TimeOfDay(
                      hour: int.tryParse(raw.first) ?? 21,
                      minute: int.tryParse(raw.last) ?? 0,
                    ),
                  );
                  if (t != null && context.mounted) {
                    setModal(
                      () => clock =
                          '${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}',
                    );
                  }
                },
              ),
              const SizedBox(height: 12),
              TextField(
                controller: venue,
                decoration: const InputDecoration(labelText: 'Cancha o sede'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: address,
                decoration: const InputDecoration(labelText: 'Dirección'),
              ),
              if (error != null)
                Padding(
                  padding: const EdgeInsets.only(top: 12),
                  child: Text(
                    error!,
                    style: AppTypography.body(color: context.c.destructive),
                  ),
                ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () {
              if (day == null) {
                setModal(() => error = 'Elegí una fecha.');
                return;
              }
              final raw = clock.split(':');
              final chosen = DateTime(
                day!.year,
                day!.month,
                day!.day,
                int.parse(raw[0]),
                int.parse(raw[1]),
              );
              if (!chosen.isAfter(DateTime.now())) {
                setModal(() => error = 'El horario tiene que ser futuro.');
                return;
              }
              final unchanged =
                  venue.text.trim() == location['name'] &&
                  address.text.trim() == location['address'];
              Navigator.pop(context, {
                'date':
                    '${day!.year}-${day!.month.toString().padLeft(2, '0')}-${day!.day.toString().padLeft(2, '0')}',
                'time': clock,
                'location': {
                  'name': venue.text.trim(),
                  'address': address.text.trim(),
                  'lat': unchanged ? location['lat'] ?? 0 : 0,
                  'lng': unchanged ? location['lng'] ?? 0 : 0,
                  'placeId': unchanged ? location['placeId'] ?? '' : '',
                },
              });
            },
            child: const Text('Confirmar horario'),
          ),
        ],
      ),
    ),
  );
  final result = await Navigator.of(context, rootNavigator: true).push(route);
  await route.completed;
  venue.dispose();
  address.dispose();
  return result;
}

Future<String?> competitionSeedingDialog(BuildContext context) async {
  var value = 'random';
  return showDialog<String>(
    context: context,
    builder: (context) => StatefulBuilder(
      builder: (context, setModal) => AlertDialog(
        title: Text(
          'Cómo se juega la primera ronda',
          style: AppTypography.headline(size: 21),
        ),
        content: RadioGroup<String>(
          groupValue: value,
          onChanged: (v) => setModal(() => value = v!),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              RadioListTile<String>(
                value: 'random',
                title: const Text('Sorteo libre'),
                subtitle: const Text(
                  'Todos los equipos tienen la misma chance en el cuadro.',
                ),
              ),
              RadioListTile<String>(
                value: 'ovr_based',
                title: const Text('Cabezas por nivel'),
                subtitle: const Text(
                  'Separa a los equipos de mayor OVR en el cuadro.',
                ),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, value),
            child: const Text('Sortear e iniciar'),
          ),
        ],
      ),
    ),
  );
}

Future<bool?> competitionResultDialog(
  BuildContext context,
  WidgetRef ref,
  CompetitionModel comp,
  Map<String, dynamic> match,
) async {
  final score = competitionScore(match),
      a = TextEditingController(text: '${score?['team1'] ?? 0}'),
      b = TextEditingController(text: '${score?['team2'] ?? 0}');
  final teams = match['teams'] as List? ?? [],
      ids = match['participantTeamIds'] as List? ?? [];
  String? winner = match['penaltyWinnerId'] as String?, error;
  var busy = false;
  String name(int i) => teams.length > i
      ? (teams[i]['name'] ?? 'Equipo ${i + 1}').toString()
      : 'Equipo ${i + 1}';
  final route = DialogRoute<bool>(
    context: context,
    barrierDismissible: false,
    builder: (context) => StatefulBuilder(
      builder: (context, setModal) {
        final tied = int.tryParse(a.text) == int.tryParse(b.text),
            cup = comp.type == 'cup';
        return PopScope(
          canPop: !busy,
          child: AlertDialog(
            title: Text(
              'Confirmar resultado',
              style: AppTypography.headline(size: 21),
            ),
            content: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    'Este marcador cierra el partido. Los penales sólo deciden quién avanza.',
                    style: AppTypography.body(
                      size: 14,
                      color: context.c.textSecondary,
                    ),
                  ),
                  const SizedBox(height: 16),
                  for (var i = 0; i < 2; i++)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 14),
                      child: TextField(
                        controller: i == 0 ? a : b,
                        enabled: !busy && !confirmedMatch(match),
                        keyboardType: TextInputType.number,
                        inputFormatters: [
                          FilteringTextInputFormatter.digitsOnly,
                          LengthLimitingTextInputFormatter(3),
                        ],
                        decoration: InputDecoration(labelText: name(i)),
                        onChanged: (_) => setModal(() => winner = null),
                      ),
                    ),
                  if (cup && tied && ids.length == 2)
                    DropdownButtonFormField<String>(
                      key: ValueKey('penalty-$winner'),
                      initialValue: winner,
                      isExpanded: true,
                      decoration: const InputDecoration(
                        labelText: 'Ganador por penales',
                      ),
                      items: [
                        for (var i = 0; i < 2; i++)
                          DropdownMenuItem(
                            value: ids[i] as String,
                            child: Text(
                              name(i),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                      ],
                      onChanged: busy
                          ? null
                          : (v) => setModal(() => winner = v),
                    ),
                  const SizedBox(height: 10),
                  const Text(
                    'Para registrar goleadores y eventos individuales, usá Dirigir dentro del partido.',
                  ),
                  if (error != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 12),
                      child: Text(
                        error!,
                        style: AppTypography.body(color: context.c.destructive),
                      ),
                    ),
                ],
              ),
            ),
            actions: [
              TextButton(
                onPressed: busy ? null : () => Navigator.pop(context, false),
                child: const Text('Cancelar'),
              ),
              FilledButton.icon(
                onPressed: busy
                    ? null
                    : () async {
                        final x = int.tryParse(a.text),
                            y = int.tryParse(b.text);
                        if (x == null ||
                            y == null ||
                            (cup && x == y && winner == null)) {
                          setModal(
                            () => error =
                                'Ingresá el marcador y resolvé el empate si corresponde.',
                          );
                          return;
                        }
                        setModal(() {
                          busy = true;
                          error = null;
                        });
                        try {
                          await ref
                              .read(competitionServiceProvider)
                              .recordResult(
                                cup ? 'cups' : 'leagues',
                                comp.id,
                                match['id'] as String,
                                x,
                                y,
                                penaltyWinnerId: cup && x == y ? winner : null,
                              );
                          if (context.mounted) Navigator.pop(context, true);
                        } catch (e) {
                          if (context.mounted) {
                            setModal(() {
                              busy = false;
                              error = competitionError(e);
                            });
                          }
                        }
                      },
                icon: busy
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: PateaButtonProgress(),
                      )
                    : const Icon(Icons.check),
                label: Text(busy ? 'Guardando…' : 'Confirmar resultado'),
              ),
            ],
          ),
        );
      },
    ),
  );
  final result = await Navigator.of(context, rootNavigator: true).push(route);
  await route.completed;
  a.dispose();
  b.dispose();
  return result;
}
