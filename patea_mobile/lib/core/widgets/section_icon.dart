import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import '../constants/sections.dart';
import '../theme/patea_colors.dart';

/// The approved Tabler artwork keeps its original 24×24 viewBox and stroke.
class SectionIcon extends StatelessWidget {
  final Section section;
  final bool active;
  final double size;
  final Color? color;

  const SectionIcon({
    super.key,
    required this.section,
    this.active = false,
    this.size = 24,
    this.color,
  });

  @override
  Widget build(BuildContext context) {
    final definition = spec(section);
    final tint =
        color ?? (active ? context.c.primary : context.c.textSecondary);
    final asset = definition.iconAsset;
    if (asset == null) {
      return Icon(
        active ? definition.activeIcon : definition.icon,
        size: size,
        color: tint,
      );
    }
    return SvgPicture.asset(
      asset,
      width: size,
      height: size,
      fit: BoxFit.contain,
      colorFilter: ColorFilter.mode(tint, BlendMode.srcIn),
      excludeFromSemantics: true,
    );
  }
}
