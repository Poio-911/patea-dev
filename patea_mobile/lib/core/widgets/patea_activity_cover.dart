import 'package:flutter/material.dart';

import '../theme/app_radii.dart';
import '../theme/app_typography.dart';
import '../theme/patea_colors.dart';

/// Editorial photography contextualizes real, already populated sections.
/// The scene is illustrative; identity and counts always come from app data.
class PateaActivityCover extends StatelessWidget {
  final String image;
  final String title;
  final String details;
  final bool compact;
  const PateaActivityCover({
    super.key,
    required this.image,
    required this.title,
    required this.details,
    this.compact = false,
  });

  @override
  Widget build(BuildContext context) => ClipRRect(
    borderRadius: AppRadii.cardAll,
    child: Stack(
      children: [
        Positioned.fill(
          child: Image.asset(
            image,
            fit: BoxFit.cover,
            alignment: Alignment.centerRight,
            excludeFromSemantics: true,
            errorBuilder: (_, error, stack) =>
                ColoredBox(color: context.c.photoFallback),
          ),
        ),
        Positioned.fill(
          child: DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: context.c.activityPhotoGradient,
                stops: const [0, .60, 1],
              ),
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            mainAxisSize: MainAxisSize.min,
            children: [
              SizedBox(height: compact ? 24 : 76),
              Text(
                title,
                style: AppTypography.headline(
                  size: 25,
                  weight: FontWeight.w700,
                  color: context.c.activityPhotoTitle,
                ),
              ),
              if (details.isNotEmpty) ...[
                const SizedBox(height: 8),
                Text(
                  details,
                  style: AppTypography.body(
                    size: 13,
                    color: context.c.activityPhotoDetails,
                  ),
                ),
              ],
            ],
          ),
        ),
      ],
    ),
  );
}
