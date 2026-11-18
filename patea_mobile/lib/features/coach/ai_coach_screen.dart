import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/models/player_model.dart';
import '../../core/services/auth_service.dart';
import '../../core/services/firestore_service.dart';
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
    final suggested = suggestedFocus(focuses);
    final focus =
        focuses.where((f) => f.id == _selected).firstOrNull ?? suggested;
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
        Text(
          'Por dónde empezar',
          style: AppTypography.headline(size: 19, weight: FontWeight.w700),
        ),
        const SizedBox(height: 7),
        Text(
          '${suggested.label} (${suggested.value}) es uno de tus atributos más bajos. Podés trabajar ese objetivo o elegir otro.',
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
                onSelected: (_) => setState(() => _selected = option.id),
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
                  Padding(
                    padding: const EdgeInsets.only(bottom: 14),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        SizedBox(
                          width: 30,
                          child: Text(
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
                            style: AppTypography.body(size: 14, height: 1.5),
                          ),
                        ),
                      ],
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
