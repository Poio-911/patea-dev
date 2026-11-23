import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/models/coach_models.dart';
import '../../core/services/coach_service.dart';
import '../../core/theme/app_insets.dart';
import '../../core/theme/app_radii.dart';
import '../../core/theme/app_typography.dart';
import '../../core/theme/patea_colors.dart';
import '../../core/widgets/patea_activity_cover.dart';
import '../../core/widgets/patea_card.dart';
import '../../core/widgets/patea_states.dart';

/// Tu análisis con IA: cómo venís, qué te sale y qué trabajar, a partir de tus
/// partidos y evaluaciones.
class PlayerAnalysisScreen extends ConsumerWidget {
  const PlayerAnalysisScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(playerAnalysisProvider);
    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        title: Text(
          'Tu análisis',
          style: AppTypography.headline(size: 20, weight: FontWeight.w700),
        ),
      ),
      body: async.when(
        loading: () => const _Thinking(),
        error: (e, _) => PateaError(
          error: e,
          message: coachErrorMessage(e),
          onRetry: () => ref.invalidate(playerAnalysisProvider),
        ),
        data: (result) => result.notEnoughData
            ? const PateaEmpty(
                icon: Icons.insights_rounded,
                title: 'Todavía no hay con qué analizarte',
                hint:
                    'Jugá un partido y que tus compañeros te evalúen. Con eso el DT te arma el análisis.',
              )
            : _Analysis(analysis: result.analysis!),
      ),
    );
  }
}

class _Thinking extends StatelessWidget {
  const _Thinking();

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 28),
        child: PateaCard(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 28),
          borderColor: c.primary.withValues(alpha: 0.3),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 60,
                height: 60,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: c.primary.withValues(alpha: 0.14),
                  border: Border.all(color: c.primary.withValues(alpha: 0.35)),
                ),
                child: Icon(Icons.insights_rounded, color: c.primary, size: 28),
              ),
              const SizedBox(height: 18),
              const SizedBox(
                width: 24,
                height: 24,
                child: CircularProgressIndicator(strokeWidth: 2.5),
              ),
              const SizedBox(height: 16),
              Text(
                'El DT está mirando tus números…',
                textAlign: TextAlign.center,
                style: AppTypography.headline(
                  size: 15.5,
                  weight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                'Cruzando partidos, evaluaciones y evolución reciente.',
                textAlign: TextAlign.center,
                style: AppTypography.body(size: 13, color: c.textSecondary),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Analysis extends StatelessWidget {
  final PlayerAnalysis analysis;
  const _Analysis({required this.analysis});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return ListView(
      padding: EdgeInsets.fromLTRB(18, 4, 18, bottomInset(context, extra: 24)),
      children: [
        PateaActivityCover(
          image: 'assets/brand/patea_coach.webp',
          compact: true,
          title: analysis.headline,
          details: analysis.summary,
        ),
        if (analysis.strengths.isNotEmpty)
          _Section(
            title: 'Lo que te sale',
            icon: Icons.check_circle_rounded,
            color: c.success,
            items: analysis.strengths,
          ),
        if (analysis.improvements.isNotEmpty)
          _Section(
            title: 'Para trabajar',
            icon: Icons.trending_up_rounded,
            color: c.primary,
            items: analysis.improvements,
          ),
        if (analysis.patterns.isNotEmpty) ...[
          const _Title('Lo que se repite'),
          for (final p in analysis.patterns)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: PateaCard(
                padding: const EdgeInsets.symmetric(
                  horizontal: 14,
                  vertical: 12,
                ),
                color: c.cardSurface.withValues(alpha: 0.65),
                borderColor: c.border.withValues(alpha: 0.45),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Padding(
                      padding: const EdgeInsets.only(top: 2),
                      child: Icon(
                        Icons.show_chart_rounded,
                        size: 18,
                        color: c.primary,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(p, style: AppTypography.body(size: 14)),
                    ),
                  ],
                ),
              ),
            ),
        ],
        if (analysis.plan.isNotEmpty) ...[
          const _Title('Para los próximos partidos'),
          PateaCard(
            padding: const EdgeInsets.all(16),
            borderColor: c.primary.withValues(alpha: 0.35),
            child: Column(
              children: [
                for (var i = 0; i < analysis.plan.length; i++)
                  Padding(
                    padding: EdgeInsets.only(
                      bottom: i == analysis.plan.length - 1 ? 0 : 12,
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          width: 28,
                          height: 28,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(
                            borderRadius: AppRadii.hairAll,
                            color: c.primary.withValues(alpha: 0.16),
                            border: Border.all(
                              color: c.primary.withValues(alpha: 0.35),
                            ),
                          ),
                          child: Text(
                            '${i + 1}',
                            style: AppTypography.sportNumber(
                              size: 15,
                              weight: FontWeight.w800,
                              color: c.primary,
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Padding(
                            padding: const EdgeInsets.only(top: 3),
                            child: Text(
                              analysis.plan[i],
                              style: AppTypography.body(size: 14),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          ),
        ],
        const SizedBox(height: 24),
        SizedBox(
          width: double.infinity,
          child: FilledButton.icon(
            onPressed: () => context.push('/coach/chat'),
            icon: const Icon(Icons.chat_bubble_outline_rounded),
            label: const Text('Preguntale al DT'),
          ),
        ),
      ],
    );
  }
}

class _Title extends StatelessWidget {
  final String text;
  const _Title(this.text);

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(top: 26, bottom: 12),
    child: Text(
      text,
      style: AppTypography.headline(size: 16, weight: FontWeight.w700),
    ),
  );
}

class _Section extends StatelessWidget {
  final String title;
  final IconData icon;
  final Color color;
  final List<AnalysisItem> items;
  const _Section({
    required this.title,
    required this.icon,
    required this.color,
    required this.items,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _Title(title),
        for (final item in items)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: PateaCard(
              padding: const EdgeInsets.all(14),
              color: color.withValues(alpha: 0.06),
              borderColor: color.withValues(alpha: 0.32),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 34,
                    height: 34,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: color.withValues(alpha: 0.16),
                    ),
                    child: Icon(icon, color: color, size: 18),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          item.title,
                          style: AppTypography.headline(
                            size: 15,
                            weight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(height: 3),
                        Text(
                          item.detail,
                          style: AppTypography.body(
                            size: 13.5,
                            color: c.textSecondary,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
      ],
    );
  }
}
