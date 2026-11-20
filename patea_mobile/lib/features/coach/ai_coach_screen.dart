import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/models/player_model.dart';
import '../../core/services/auth_service.dart';
import '../../core/services/firestore_service.dart';
import '../../core/services/training_service.dart';
import '../../core/widgets/patea_snack.dart';
import '../../core/theme/patea_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/widgets/patea_activity_cover.dart';
import '../../core/widgets/patea_avatar.dart';
import '../../core/widgets/patea_card.dart';
import '../../core/widgets/patea_states.dart';
import 'training_focus.dart';

class AICoachScreen extends ConsumerStatefulWidget {
  const AICoachScreen({super.key});
  @override
  ConsumerState<AICoachScreen> createState() => _AICoachScreenState();
}

class _AICoachScreenState extends ConsumerState<AICoachScreen> {
  String? _selected;
  final Set<int> _done = {};
  bool _saving = false;

  Future<void> _finish(TrainingFocus focus) async {
    setState(() => _saving = true);
    final avisar = PateaSnack.of(context);
    try {
      await ref.read(trainingServiceProvider).logSession(focus.id);
      if (!mounted) return;
      setState(() {
        _done.clear();
        _selected = null; // la sugerencia rota con la sesión recién registrada
      });
      avisar.ok('Sesión registrada. ¡Bien ahí!');
    } catch (e) {
      avisar.error('$e');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final uid = ref.watch(authServiceProvider).currentUser?.uid;
    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        title: Text(
          'Tu entrenamiento',
          style: AppTypography.headline(size: 20, weight: FontWeight.w700),
        ),
      ),
      body: uid == null
          ? _missingProfile(context, false)
          : ref
                .watch(singlePlayerStreamProvider(uid))
                .when(
                  loading: () => const Center(child: PateaLoading()),
                  error: (error, _) => PateaError(error: error),
                  data: (player) => player == null
                      ? _missingProfile(context, true)
                      : _plan(context, player),
                ),
    );
  }

  Widget _cover(String details) => PateaActivityCover(
    image: 'assets/brand/patea_coach.webp',
    title: 'El próximo toque',
    details: details,
  );

  Widget _missingProfile(BuildContext context, bool canOpenRoster) => ListView(
    padding: const EdgeInsets.all(16),
    children: [
      _cover('Un objetivo. Una pelota. Algo para practicar.'),
      const SizedBox(height: 20),
      Text(
        'Necesitamos tu ficha para sugerirte un objetivo.',
        style: AppTypography.headline(size: 18),
      ),
      const SizedBox(height: 10),
      Text(
        'Los ejercicios se eligen a partir de tus atributos guardados.',
        style: AppTypography.body(size: 14, color: context.c.textSecondary),
      ),
      if (canOpenRoster)
        Padding(
          padding: const EdgeInsets.only(top: 18),
          child: FilledButton(
            onPressed: () => context.go('/players'),
            child: const Text('Ver mi plantel'),
          ),
        ),
    ],
  );

  Widget _plan(BuildContext context, PlayerModel player) {
    final focuses = trainingFocusFor(player);
    final log = ref.watch(trainingLogProvider(player.id)).asData?.value ??
        const <TrainingEntry>[];
    final now = DateTime.now();
    final summary = summarizeTraining(log, now);
    final suggested = suggestedFocusFor(focuses, log);
    final focus =
        focuses.where((f) => f.id == _selected).firstOrNull ?? suggested;
    final lastTrained = trainedAgoLabel(summary.lastByFocus[focus.id], now);
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
      children: [
        _cover('Práctica con pelota, a partir de tu ficha.'),
        const SizedBox(height: 20),
        Row(
          children: [
            PateaAvatar(photoUrl: player.photoUrl, seed: player.id, size: 52),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    player.name,
                    style: AppTypography.headline(
                      size: 20,
                      weight: FontWeight.w700,
                    ),
                  ),
                  Text(
                    '${player.position} · OVR ${player.ovr}',
                    style: AppTypography.body(
                      size: 13,
                      color: context.c.textSecondary,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 18),
        _WeekProgress(summary: summary),
        const SizedBox(height: 18),
        Text(
          'Por dónde empezar',
          style: AppTypography.headline(size: 19, weight: FontWeight.w700),
        ),
        const SizedBox(height: 7),
        Text(
          log.isEmpty
              ? '${suggested.label} (${suggested.value}) es uno de tus atributos más bajos. Podés trabajar ese objetivo o elegir otro.'
              : '${suggested.label} (${suggested.value}) es lo que más te conviene ahora: es de tus atributos más bajos y no lo trabajaste en tus últimas sesiones.',
          style: AppTypography.body(
            size: 13,
            height: 1.5,
            color: context.c.textSecondary,
          ),
        ),
        const SizedBox(height: 12),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final option in focuses)
              ChoiceChip(
              checkmarkColor: context.c.textPrimary,
                label: Text('${option.label} ${option.value}'),
                selected: focus.id == option.id,
                onSelected: (_) => setState(() {
                  _selected = option.id;
                  _done.clear();
                }),
              ),
          ],
        ),
        const SizedBox(height: 20),
        AnimatedSwitcher(
          duration: MediaQuery.disableAnimationsOf(context)
              ? Duration.zero
              : const Duration(milliseconds: 180),
          child: PateaCard(
            key: ValueKey(focus.id),
            padding: const EdgeInsets.all(20),
            borderColor: context.c.border,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  focus.label,
                  style: AppTypography.body(
                    size: 12,
                    weight: FontWeight.w700,
                    color: context.c.primary,
                  ),
                ),
                const SizedBox(height: 7),
                Text(
                  focus.exercise,
                  style: AppTypography.headline(
                    size: 23,
                    weight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  lastTrained == null
                      ? 'Todavía no lo trabajaste'
                      : 'Lo trabajaste $lastTrained',
                  style: AppTypography.body(
                    size: 12,
                    color: context.c.textSecondary,
                  ),
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Icon(
                      Icons.sports_soccer_outlined,
                      size: 18,
                      color: context.c.textSecondary,
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        focus.equipment,
                        style: AppTypography.body(
                          size: 12,
                          color: context.c.textSecondary,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 18),
                for (var i = 0; i < focus.steps.length; i++)
                  InkWell(
                    onTap: () => setState(
                      () => _done.contains(i) ? _done.remove(i) : _done.add(i),
                    ),
                    borderRadius: BorderRadius.circular(8),
                    child: Padding(
                      padding: const EdgeInsets.only(bottom: 14),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          SizedBox(
                            width: 30,
                            child: _done.contains(i)
                                ? Icon(
                                    Icons.check_circle_rounded,
                                    size: 22,
                                    color: context.c.success,
                                  )
                                : Text(
                                    '${i + 1}',
                                    style: AppTypography.sportNumber(
                                      size: 20,
                                      color: context.c.primary,
                                    ),
                                  ),
                          ),
                          Expanded(
                            child: Text(
                              focus.steps[i],
                              style: AppTypography.body(
                                size: 14,
                                height: 1.5,
                                color: _done.contains(i)
                                    ? context.c.textSecondary
                                    : context.c.textPrimary,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                const SizedBox(height: 4),
                FilledButton.icon(
                  onPressed: _saving ? null : () => _finish(focus),
                  icon: const Icon(Icons.check_rounded),
                  label: Text(
                    _done.length == focus.steps.length
                        ? 'Terminé este ejercicio'
                        : 'Registrar sesión',
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 12),
        Text(
          'Guía técnica basada en tus atributos. Tu OVR se actualiza con las evaluaciones de los partidos.',
          style: AppTypography.body(
            size: 12,
            height: 1.5,
            color: context.c.textSecondary,
          ),
        ),
        const SizedBox(height: 12),
        OutlinedButton.icon(
          onPressed: () => context.push('/players/${player.id}/progression'),
          icon: const Icon(Icons.insights_rounded),
          label: const Text('Ver mi progresión'),
        ),
      ],
    );
  }
}

/// Lo que va de la semana y la racha: el único estado que cambia entre visitas.
class _WeekProgress extends StatelessWidget {
  final TrainingSummary summary;
  const _WeekProgress({required this.summary});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final done = summary.sessionsThisWeek;
    const goal = TrainingSummary.weeklyGoal;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                summary.goalReached
                    ? 'Objetivo de la semana cumplido'
                    : 'Esta semana: $done de $goal sesiones',
                style: AppTypography.headline(size: 15, weight: FontWeight.w700),
              ),
            ),
            if (summary.streakDays > 0)
              Text(
                summary.streakDays == 1
                    ? '1 día seguido'
                    : '${summary.streakDays} días seguidos',
                style: AppTypography.body(
                  size: 12,
                  weight: FontWeight.w700,
                  color: c.primary,
                ),
              ),
          ],
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            for (var i = 0; i < goal; i++) ...[
              if (i > 0) const SizedBox(width: 6),
              Expanded(
                child: Container(
                  height: 6,
                  decoration: BoxDecoration(
                    color: i < done ? c.primary : c.border,
                    borderRadius: BorderRadius.circular(3),
                  ),
                ),
              ),
            ],
          ],
        ),
      ],
    );
  }
}
