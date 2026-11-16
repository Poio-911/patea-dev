import 'package:flutter/material.dart';

import '../theme/patea_colors.dart';

/// Football + confirmation using the app's native icon system.
/// Animate only in response to a successful submission, never in a loop.
class PateaEvaluationMark extends StatelessWidget {
  final bool animate;
  final double size;
  const PateaEvaluationMark({super.key, this.animate = false, this.size = 76});

  @override
  Widget build(BuildContext context) {
    final mark = ExcludeSemantics(
      child: SizedBox(
        width: size,
        height: size,
        child: Stack(
          children: [
            Positioned.fill(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: context.c.primary.withValues(alpha: .10),
                ),
                child: Icon(
                  Icons.sports_soccer_outlined,
                  size: size * .52,
                  color: context.c.textPrimary,
                ),
              ),
            ),
            Positioned(
              right: 0,
              bottom: 0,
              child: DecoratedBox(
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: context.c.cardSurface,
                ),
                child: Padding(
                  padding: const EdgeInsets.all(3),
                  child: Icon(
                    Icons.check_circle,
                    color: context.c.primary,
                    size: size * .37,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
    if (!animate || MediaQuery.disableAnimationsOf(context)) return mark;
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: .75, end: 1),
      duration: const Duration(milliseconds: 420),
      curve: Curves.easeOutCubic,
      child: mark,
      builder: (context, value, child) =>
          Transform.scale(scale: value, child: child),
    );
  }
}
