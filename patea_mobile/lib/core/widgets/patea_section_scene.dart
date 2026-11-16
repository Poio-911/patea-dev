import 'package:flutter/material.dart';

import '../theme/app_typography.dart';
import '../theme/patea_colors.dart';

/// Section photography lives above copy, never behind form controls or data.
class PateaSectionScene extends StatelessWidget {
  static const matches = 'assets/brand/patea_ready_pitch.webp';
  static const players = 'assets/brand/patea_locker_room.webp';
  static const league = 'assets/brand/patea_league.webp';
  static const groups = 'assets/brand/patea_groups.webp';
  static const competitions = 'assets/brand/patea_competitions.webp';
  static const explore = 'assets/brand/patea_explore.webp';

  final String image;
  final String title;
  final String description;

  const PateaSectionScene({
    super.key,
    required this.image,
    required this.title,
    required this.description,
  });

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    mainAxisSize: MainAxisSize.min,
    children: [
      ClipRRect(
        borderRadius: BorderRadius.circular(18),
        child: AspectRatio(
          aspectRatio: 2,
          child: LayoutBuilder(
            builder: (context, constraints) {
              final photo = Image.asset(
                image,
                fit: BoxFit.cover,
                alignment: Alignment.centerRight,
                cacheWidth:
                    (constraints.maxWidth *
                            MediaQuery.devicePixelRatioOf(context))
                        .round()
                        .clamp(1, 1200),
                excludeFromSemantics: true,
                errorBuilder: (_, error, stack) => ColoredBox(
                  color: context.c.cardSurface,
                  child: Icon(
                    Icons.sports_soccer_outlined,
                    color: context.c.textSecondary,
                    size: 34,
                  ),
                ),
              );
              if (MediaQuery.disableAnimationsOf(context)) return photo;
              return TweenAnimationBuilder<double>(
                tween: Tween(begin: 1.035, end: 1),
                duration: const Duration(milliseconds: 420),
                curve: Curves.easeOutCubic,
                child: photo,
                builder: (context, scale, child) =>
                    Transform.scale(scale: scale, child: child),
              );
            },
          ),
        ),
      ),
      const SizedBox(height: 17),
      Text(
        title,
        style: AppTypography.headline(size: 19, weight: FontWeight.w600),
      ),
      const SizedBox(height: 7),
      Text(
        description,
        style: AppTypography.body(
          size: 13,
          color: context.c.textSecondary,
          height: 1.5,
        ),
      ),
    ],
  );
}
