import 'dart:io';
import 'dart:math' as math;

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../models/player_model.dart';
import '../theme/app_typography.dart';
import '../theme/patea_colors.dart';
import 'player_avatar_fallback.dart';

/// Las dos presentaciones conservan los mismos datos y la relación 2:3.
enum CardPhotoStyle { circular, halfTop }

/// Ficha de plantel Pateá: retrato, identidad y rendimiento.
/// El color distingue la posición y el criterio de orden, nunca una rareza.
class PlayerCardWidget extends StatefulWidget {
  final Player player;
  final VoidCallback? onTap;
  final String? matchStatusText;
  static const double cardRadius = 16;
  final String? highlightStat;
  final File? localPhoto;
  final CardPhotoStyle photoStyle;
  final String? assetPhoto;

  /// Compatibilidad con previews guiadas. La ficha no captura arrastres.
  final double? manualTiltX;
  final double? manualTiltY;

  const PlayerCardWidget({
    super.key,
    required this.player,
    this.onTap,
    this.matchStatusText,
    this.localPhoto,
    this.highlightStat,
    this.photoStyle = CardPhotoStyle.circular,
    this.assetPhoto,
    this.manualTiltX,
    this.manualTiltY,
  });

  @override
  State<PlayerCardWidget> createState() => _PlayerCardWidgetState();
}

class _PlayerCardWidgetState extends State<PlayerCardWidget> {
  bool _pressed = false;

  List<_Attribute> get _attributes {
    final p = widget.player;
    return p.position.toUpperCase() == 'POR'
        ? [
            _Attribute('DEF', 'EST', 'Estirada', p.def),
            _Attribute('DRI', 'REF', 'Reflejos', p.dri),
            _Attribute('SHO', 'PAR', 'Paradas', p.sho),
            _Attribute('PAC', 'VEL', 'Velocidad', p.pac),
            _Attribute('PAS', 'SAQ', 'Saque', p.pas),
            _Attribute('PHY', 'POS', 'Posicionamiento', p.phy),
          ]
        : [
            _Attribute('PAC', 'RIT', 'Ritmo', p.pac),
            _Attribute('SHO', 'TIR', 'Tiro', p.sho),
            _Attribute('PAS', 'PAS', 'Pase', p.pas),
            _Attribute('DRI', 'REG', 'Regate', p.dri),
            _Attribute('DEF', 'DEF', 'Defensa', p.def),
            _Attribute('PHY', 'FIS', 'Físico', p.phy),
          ];
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final reduced = MediaQuery.disableAnimationsOf(context);
    final attributes = _attributes;
    final sorted = attributes
        .where((stat) => stat.key == widget.highlightStat?.toUpperCase())
        .firstOrNull;
    final maximum = attributes.map((stat) => stat.value).reduce(math.max);
    final best = attributes.where((stat) => stat.value == maximum).toList();
    final status = widget.matchStatusText?.trim();
    final semanticLabel = [
      widget.player.name,
      widget.player.position,
      'OVR ${widget.player.ovr}',
      for (final stat in attributes) '${stat.description} ${stat.value}',
      '${best.length == 1 ? 'Mejor atributo' : 'Mejores atributos'}: ${best.map((stat) => stat.description).join(', ')}',
      if (sorted != null) 'Ordenado por ${sorted.description.toLowerCase()}',
      if (status != null && status.isNotEmpty) status,
    ].join(', ');

    return Semantics(
      label: semanticLabel,
      button: widget.onTap != null,
      onTap: widget.onTap,
      child: ExcludeSemantics(
        child: AnimatedScale(
          scale: _pressed && !reduced ? 0.985 : 1,
          duration: reduced ? Duration.zero : const Duration(milliseconds: 120),
          curve: Curves.easeOutCubic,
          child: Transform(
            alignment: Alignment.center,
            transform: Matrix4.identity()
              ..setEntry(3, 2, 0.0008)
              ..rotateX(
                reduced ? 0 : (widget.manualTiltX ?? 0).clamp(-0.12, 0.12),
              )
              ..rotateY(
                reduced ? 0 : (widget.manualTiltY ?? 0).clamp(-0.12, 0.12),
              ),
            child: AspectRatio(
              aspectRatio: 2 / 3,
              child: Material(
                color: c.card,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(
                    PlayerCardWidget.cardRadius,
                  ),
                  side: BorderSide(color: c.border),
                ),
                clipBehavior: Clip.antiAlias,
                child: InkWell(
                  onTap: widget.onTap == null
                      ? null
                      : () {
                          HapticFeedback.selectionClick();
                          widget.onTap!();
                        },
                  onHighlightChanged: (pressed) {
                    if (pressed != _pressed) setState(() => _pressed = pressed);
                  },
                  child: LayoutBuilder(
                    builder: (context, constraints) {
                      final compact = constraints.maxWidth < 210;
                      final padding = compact ? 8.0 : 14.0;
                      final nameSize = compact ? 14.0 : 20.0;
                      final numberSize = compact ? 12.0 : 15.0;
                      final scaler = MediaQuery.textScalerOf(context);
                      final statHeight = (scaler.scale(numberSize) * 1.2)
                          .ceilToDouble();
                      final rowGap = compact ? 4.0 : 5.0;
                      final statsTop = compact ? 8.0 : 10.0;
                      final statsBottom = compact ? 10.0 : 14.0;
                      final photoHeight = math.max(
                        0.0,
                        constraints.maxHeight -
                            statHeight * 3 -
                            rowGap * 2 -
                            statsTop -
                            statsBottom -
                            1,
                      );
                      return Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          SizedBox(
                            height: photoHeight,
                            child: _portrait(
                              context,
                              photoHeight,
                              constraints.maxWidth,
                              compact,
                              nameSize,
                              status,
                            ),
                          ),
                          Padding(
                            padding: EdgeInsets.fromLTRB(
                              padding,
                              0,
                              padding,
                              statsBottom,
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                Divider(
                                  height: 1,
                                  thickness: 1,
                                  color: c.overlayLine,
                                ),
                                SizedBox(height: statsTop),
                                for (var row = 0; row < 3; row++) ...[
                                  if (row > 0) SizedBox(height: rowGap),
                                  SizedBox(
                                    height: statHeight,
                                    child: Row(
                                      children: [
                                        Expanded(
                                          child: _stat(
                                            context,
                                            attributes[row * 2],
                                            numberSize,
                                          ),
                                        ),
                                        const SizedBox(width: 10),
                                        Expanded(
                                          child: _stat(
                                            context,
                                            attributes[row * 2 + 1],
                                            numberSize,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ],
                              ],
                            ),
                          ),
                        ],
                      );
                    },
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _portrait(
    BuildContext context,
    double height,
    double width,
    bool compact,
    double nameSize,
    String? status,
  ) {
    final c = context.c;
    final scaler = MediaQuery.textScalerOf(context);
    final inset = compact ? 8.0 : 14.0;
    final bottom = compact ? 8.0 : 10.0;
    final nameGap = compact ? 7.0 : 9.0;
    final nameHeight = (scaler.scale(nameSize) * 1.2 * 2).ceilToDouble();
    final hasStatus = status != null && status.isNotEmpty;
    final statusHeight = hasStatus
        ? (scaler.scale(12) * 1.25).ceilToDouble() + 6
        : 0.0;
    final available = math.max(
      0.0,
      height - bottom - nameHeight - nameGap - statusHeight - 4,
    );
    final positionColor = c.isDarkSurface
        ? c.positionColor(widget.player.position)
        : Color.lerp(
            c.positionColor(widget.player.position),
            c.textPrimary,
            0.4,
          )!;
    final captionStyle = AppTypography.body(
      size: 12,
      height: 1.2,
      color: c.textSecondary,
    );
    double measure(String text, TextStyle style) {
      final painter = TextPainter(
        text: TextSpan(text: text, style: style),
        textDirection: Directionality.of(context),
        textScaler: scaler,
      )..layout();
      final result = painter.height;
      painter.dispose();
      return result;
    }

    var scoreSize = compact ? math.min(36.0, width * 0.196) : 44.0;
    TextStyle scoreStyle() => AppTypography.sportNumber(
      size: scoreSize,
      color: c.ratingAccent,
    ).copyWith(height: 1, fontWeight: FontWeight.w700);
    final captionHeight = measure('OVR', captionStyle);
    var showCaption = true;
    while (scoreSize > 18 &&
        measure('${widget.player.ovr}', scoreStyle()) + captionHeight >
            available) {
      scoreSize -= 0.5;
    }
    if (measure('${widget.player.ovr}', scoreStyle()) + captionHeight >
        available) {
      showCaption = false;
    }
    while (scoreSize > 12 &&
        measure('${widget.player.ovr}', scoreStyle()) > available) {
      scoreSize -= 0.5;
    }
    return ClipRect(
      child: Stack(
        fit: StackFit.expand,
        children: [
          ColoredBox(color: c.cardSurface),
          if (widget.photoStyle == CardPhotoStyle.halfTop)
            _photo(context)
          else
            Align(
              alignment: Alignment.topCenter,
              child: Padding(
                padding: EdgeInsets.all(inset),
                child: SizedBox.square(
                  dimension: math.max(0, math.min(height - inset * 2, 160)),
                  child: ClipOval(child: _photo(context)),
                ),
              ),
            ),
          DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                stops: const [0, 0.25, 0.4, 0.65, 1],
                colors: [
                  c.card.withValues(alpha: 0),
                  c.card.withValues(alpha: 0),
                  c.card.withValues(alpha: 0.2),
                  c.card.withValues(alpha: 0.8),
                  c.card,
                ],
              ),
            ),
          ),
          Positioned(
            left: inset,
            right: inset,
            bottom: bottom,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Padding(
                      padding: const EdgeInsets.only(bottom: 3),
                      child: Text(
                        widget.player.position.toUpperCase(),
                        style: AppTypography.body(
                          size: 14,
                          height: 1.2,
                          weight: FontWeight.w700,
                          color: positionColor,
                        ),
                      ),
                    ),
                    Expanded(
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(9, 0, 9, 7),
                        child: SizedBox(
                          height: 1,
                          child: Stack(
                            clipBehavior: Clip.none,
                            children: [
                              Positioned.fill(
                                child: ColoredBox(
                                  color: c.ratingAccent.withValues(alpha: 0.7),
                                ),
                              ),
                              Positioned(
                                right: -1,
                                top: -1.5,
                                child: Container(
                                  width: 4,
                                  height: 4,
                                  decoration: BoxDecoration(
                                    color: c.ratingAccent,
                                    shape: BoxShape.circle,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                    Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        if (showCaption) Text('OVR', style: captionStyle),
                        Transform(
                          transform: Matrix4.identity()..setEntry(0, 1, -0.12),
                          child: Text(
                            '${widget.player.ovr}',
                            style: scoreStyle(),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
                SizedBox(height: nameGap),
                SizedBox(
                  height: nameHeight,
                  child: Align(
                    alignment: Alignment.centerLeft,
                    child: Text(
                      widget.player.name,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: AppTypography.headline(
                        size: nameSize,
                        weight: FontWeight.w600,
                        color: c.textPrimary,
                      ).copyWith(height: 1.2, letterSpacing: 0),
                    ),
                  ),
                ),
                if (hasStatus) ...[
                  const SizedBox(height: 6),
                  Text(
                    status,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppTypography.body(
                      size: 12,
                      height: 1.25,
                      color: c.textSecondary,
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

  Widget _stat(BuildContext context, _Attribute stat, double numberSize) {
    final c = context.c;
    final highlighted = stat.key == widget.highlightStat?.toUpperCase();
    final maximum = _attributes
        .map((attribute) => attribute.value)
        .reduce(math.max);
    final isMaximum = stat.value == maximum;
    final accent = isMaximum
        ? c.ratingAccent
        : highlighted
        ? c.primary
        : null;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: highlighted
            ? c.primary.withValues(alpha: 0.08)
            : Colors.transparent,
        borderRadius: BorderRadius.circular(4),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 2),
        child: Row(
          children: [
            Expanded(
              child: Text(
                stat.label,
                maxLines: 1,
                style: AppTypography.body(
                  size: 12,
                  height: 1.2,
                  weight: highlighted || isMaximum
                      ? FontWeight.w600
                      : FontWeight.w400,
                  color: accent ?? c.textSecondary,
                ),
              ),
            ),
            const SizedBox(width: 2),
            Text(
              '${stat.value}',
              style: AppTypography.body(
                size: numberSize,
                height: 1.2,
                weight: FontWeight.w600,
                color: accent ?? c.textPrimary,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget get _fallback => PlayerAvatarFallback(
    seed: widget.player.id.isEmpty ? widget.player.name : widget.player.id,
  );

  Widget _photo(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final width =
            (constraints.maxWidth * MediaQuery.devicePixelRatioOf(context))
                .round()
                .clamp(160, 1200);
        Widget photo;
        if (widget.assetPhoto?.isNotEmpty == true) {
          photo = Image.asset(
            widget.assetPhoto!,
            fit: BoxFit.cover,
            alignment: Alignment.topCenter,
            cacheWidth: width,
            errorBuilder: (_, _, _) => _fallback,
          );
        } else if (widget.localPhoto != null) {
          photo = Image.file(
            widget.localPhoto!,
            fit: BoxFit.cover,
            alignment: Alignment.topCenter,
            cacheWidth: width,
            errorBuilder: (_, _, _) => _fallback,
          );
        } else if (widget.player.photoUrl?.isNotEmpty == true) {
          photo = CachedNetworkImage(
            imageUrl: widget.player.photoUrl!,
            fit: BoxFit.cover,
            alignment: Alignment.topCenter,
            memCacheWidth: width,
            maxWidthDiskCache: 1200,
            placeholder: (_, _) => _fallback,
            errorWidget: (_, _, _) => _fallback,
          );
        } else {
          photo = _fallback;
        }
        final player = widget.player;
        final zoom = player.cropZoom.isFinite
            ? player.cropZoom.clamp(1.0, 4.0)
            : 1.0;
        return ClipRect(
          child: Transform.scale(
            scale: zoom,
            alignment: Alignment(
              (player.cropX / 50 - 1),
              (player.cropY / 50 - 1),
            ),
            child: photo,
          ),
        );
      },
    );
  }
}

class _Attribute {
  final String key;
  final String label;
  final String description;
  final int value;
  const _Attribute(this.key, this.label, this.description, this.value);
}
