import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../theme/app_typography.dart';
import '../theme/patea_colors.dart';
import 'cropped_photo.dart';

/// Shared photo framing for the account menu and its header trigger.
class PateaAccountAvatar extends StatelessWidget {
  final String? photoUrl;
  final String name;
  final double cropX;
  final double cropY;
  final double cropZoom;
  final double size;

  const PateaAccountAvatar({
    super.key,
    required this.photoUrl,
    required this.name,
    required this.size,
    this.cropX = 50,
    this.cropY = 50,
    this.cropZoom = 1,
  });

  @override
  Widget build(BuildContext context) {
    final fallback = Container(
      decoration: BoxDecoration(
        color: context.c.cardSurface,
        shape: BoxShape.circle,
        border: Border.all(color: context.c.border),
      ),
      child: Center(
        child: Text(
          name.isNotEmpty ? name[0].toUpperCase() : 'P',
          style: AppTypography.headline(
            size: size * (18 / 64),
            weight: FontWeight.w900,
            color: context.c.primary,
          ),
        ),
      ),
    );

    final url = photoUrl;

    return SizedBox(
      width: size,
      height: size,
      child: ClipOval(
        child: url != null && url.isNotEmpty
            ? CroppedPhoto(
                cropX: cropX,
                cropY: cropY,
                cropZoom: cropZoom,
                child: CachedNetworkImage(
                  imageUrl: url,
                  fit: BoxFit.cover,
                  alignment: Alignment.topCenter,
                  memCacheWidth: 256,
                  maxWidthDiskCache: 512,
                  placeholder: (context, url) => fallback,
                  errorWidget: (context, url, error) => fallback,
                ),
              )
            : fallback,
      ),
    );
  }
}
