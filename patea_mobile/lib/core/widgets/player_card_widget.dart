import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../models/player_model.dart';
import '../theme/app_colors.dart';
import '../theme/app_typography.dart';
import 'player_position_badge.dart';

class PlayerCardWidget extends StatefulWidget {
  final PlayerModel player;
  final VoidCallback? onTap;

  const PlayerCardWidget({
    super.key,
    required this.player,
    this.onTap,
  });

  @override
  State<PlayerCardWidget> createState() => _PlayerCardWidgetState();
}

class _PlayerCardWidgetState extends State<PlayerCardWidget> {
  double _rotateX = 0;
  double _rotateY = 0;

  void _onPanUpdate(DragUpdateDetails details, Size size) {
    setState(() {
      _rotateX += details.delta.dy * 0.005;
      _rotateY -= details.delta.dx * 0.005;
      _rotateX = _rotateX.clamp(-0.25, 0.25);
      _rotateY = _rotateY.clamp(-0.25, 0.25);
    });
  }

  void _onPanEnd(DragEndDetails details) {
    setState(() {
      _rotateX = 0;
      _rotateY = 0;
    });
  }

  @override
  Widget build(BuildContext context) {
    final player = widget.player;
    final ovrColor = AppColors.getOvrBorderColor(player.ovr);
    final posColor = AppColors.getPositionColor(player.position);
    final isElite = player.ovr >= 86;
    final isGold = player.ovr >= 76 && player.ovr < 86;

    // Estadísticas
    final stats = [
      {'label': 'RIT', 'val': player.pac, 'key': 'PAC'},
      {'label': 'TIR', 'val': player.sho, 'key': 'SHO'},
      {'label': 'PAS', 'val': player.pas, 'key': 'PAS'},
      {'label': 'REG', 'val': player.dri, 'key': 'DRI'},
      {'label': 'DEF', 'val': player.def, 'key': 'DEF'},
      {'label': 'FIS', 'val': player.phy, 'key': 'PHY'},
    ];

    // Encontrar atributo más alto
    int maxVal = stats.map((s) => s['val'] as int).reduce((a, b) => a > b ? a : b);

    return LayoutBuilder(
      builder: (context, constraints) {
        final size = Size(constraints.maxWidth, constraints.maxHeight);

        return GestureDetector(
          onTap: widget.onTap,
          onPanUpdate: (d) => _onPanUpdate(d, size),
          onPanEnd: _onPanEnd,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 150),
            transform: Matrix4.identity()
              ..setEntry(3, 2, 0.001)
              ..rotateX(_rotateX)
              ..rotateY(_rotateY),
            transformAlignment: Alignment.center,
            decoration: BoxDecoration(
              color: AppColors.card,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(
                color: ovrColor.withValues(alpha: isElite ? 0.9 : isGold ? 0.75 : 0.45),
                width: isElite ? 2.0 : 1.5,
              ),
              boxShadow: [
                BoxShadow(
                  color: ovrColor.withValues(alpha: isElite ? 0.35 : isGold ? 0.25 : 0.1),
                  blurRadius: isElite ? 22 : 12,
                  spreadRadius: isElite ? 2 : 0,
                  offset: const Offset(0, 6),
                ),
              ],
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(19),
              child: Stack(
                children: [
                  // 1. Resplandor Aura de Fondo según Tier
                  Positioned.fill(
                    child: Container(
                      decoration: BoxDecoration(
                        gradient: RadialGradient(
                          center: const Alignment(0.0, -0.2),
                          radius: 0.9,
                          colors: [
                            ovrColor.withValues(alpha: isElite ? 0.22 : 0.14),
                            Colors.transparent,
                          ],
                        ),
                      ),
                    ),
                  ),

                  // 2. Marca de Agua de la Posición en Fondo
                  Positioned(
                    bottom: -10,
                    right: -10,
                    child: Opacity(
                      opacity: 0.07,
                      child: Text(
                        player.position,
                        style: AppTypography.sportNumber(
                          size: 90,
                          color: posColor,
                        ),
                      ),
                    ),
                  ),

                  // 3. Contenido de la Carta
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        // Cabecera: Posición + OVR con etiqueta
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            PlayerPositionBadge(position: player.position, fontSize: 11),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.end,
                              children: [
                                Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    if (player.ovr >= 90)
                                      const Padding(
                                        padding: EdgeInsets.only(right: 3),
                                        child: Icon(Icons.star, size: 13, color: AppColors.goldBorder),
                                      ),
                                    Text(
                                      '${player.ovr}',
                                      style: AppTypography.sportNumber(
                                        size: 26,
                                        color: ovrColor,
                                      ),
                                    ),
                                  ],
                                ),
                                Text(
                                  'OVR',
                                  style: AppTypography.code(
                                    size: 9,
                                    weight: FontWeight.w800,
                                    color: AppColors.textMuted,
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),

                        // Foto / Avatar con Borde de Tier
                        Center(
                          child: Container(
                            height: 62,
                            width: 62,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: AppColors.cardSurface,
                              border: Border.all(
                                color: ovrColor.withValues(alpha: 0.8),
                                width: 2.5,
                              ),
                              boxShadow: [
                                BoxShadow(
                                  color: ovrColor.withValues(alpha: 0.3),
                                  blurRadius: 8,
                                ),
                              ],
                            ),
                            child: ClipOval(
                              child: player.photoUrl != null && player.photoUrl!.isNotEmpty
                                  ? CachedNetworkImage(
                                      imageUrl: player.photoUrl!,
                                      fit: BoxFit.cover,
                                      placeholder: (context, url) => Center(
                                        child: Text(
                                          player.name.isNotEmpty ? player.name[0] : 'P',
                                          style: AppTypography.sportNumber(size: 24, color: ovrColor),
                                        ),
                                      ),
                                      errorWidget: (context, url, error) => Center(
                                        child: Text(
                                          player.name.isNotEmpty ? player.name[0] : 'P',
                                          style: AppTypography.sportNumber(size: 24, color: ovrColor),
                                        ),
                                      ),
                                    )
                                  : Center(
                                      child: Text(
                                        player.name.isNotEmpty ? player.name[0] : 'P',
                                        style: AppTypography.sportNumber(size: 24, color: ovrColor),
                                      ),
                                    ),
                            ),
                          ),
                        ),

                        // Nombre del Jugador
                        Text(
                          player.name,
                          style: AppTypography.headline(
                            size: 13,
                            weight: FontWeight.w800,
                            color: AppColors.textPrimary,
                          ),
                          textAlign: TextAlign.center,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),

                        // Grid de 6 Atributos (2x3)
                        Wrap(
                          spacing: 4,
                          runSpacing: 4,
                          children: stats.map((stat) {
                            final int val = stat['val'] as int;
                            final bool isTop = val == maxVal;
                            final double pct = (val / 99.0).clamp(0.0, 1.0);

                            return SizedBox(
                              width: (constraints.maxWidth - 28) / 2,
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 3),
                                decoration: BoxDecoration(
                                  color: isTop
                                      ? posColor.withValues(alpha: 0.15)
                                      : Colors.white.withValues(alpha: 0.05),
                                  borderRadius: BorderRadius.circular(6),
                                  border: Border.all(
                                    color: isTop ? posColor.withValues(alpha: 0.4) : Colors.transparent,
                                    width: 1,
                                  ),
                                ),
                                child: Row(
                                  children: [
                                    Text(
                                      stat['label'] as String,
                                      style: AppTypography.code(
                                        size: 9,
                                        weight: FontWeight.w700,
                                        color: isTop ? posColor : AppColors.textMuted,
                                      ),
                                    ),
                                    const SizedBox(width: 4),
                                    Expanded(
                                      child: ClipRRect(
                                        borderRadius: BorderRadius.circular(2),
                                        child: LinearProgressIndicator(
                                          value: pct,
                                          minHeight: 3,
                                          backgroundColor: Colors.white.withValues(alpha: 0.1),
                                          valueColor: AlwaysStoppedAnimation<Color>(
                                            isTop ? posColor : AppColors.textSecondary.withValues(alpha: 0.5),
                                          ),
                                        ),
                                      ),
                                    ),
                                    const SizedBox(width: 4),
                                    Text(
                                      '$val',
                                      style: AppTypography.sportNumber(
                                        size: 10,
                                        color: isTop ? AppColors.textPrimary : AppColors.textSecondary,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            );
                          }).toList(),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}
