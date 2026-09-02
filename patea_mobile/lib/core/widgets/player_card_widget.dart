import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter_svg/flutter_svg.dart';
import '../models/player_model.dart';
import '../theme/app_colors.dart';
import '../theme/app_typography.dart';

/// Carta de Jugador 100% idéntica a PlayerCard de la webapp (src/components/player-card.tsx)
/// Con auras radiales por rareza, borde sutil con glow, badge de posición estilizado y OVR por tier.
class PlayerCardWidget extends StatefulWidget {
  final Player player;
  final VoidCallback? onTap;
  final String? matchStatusText;

  const PlayerCardWidget({
    super.key,
    required this.player,
    this.onTap,
    this.matchStatusText,
  });

  @override
  State<PlayerCardWidget> createState() => _PlayerCardWidgetState();
}

class _PlayerCardWidgetState extends State<PlayerCardWidget> {
  double _rotateX = 0;
  double _rotateY = 0;

  String _getOvrTier(int ovr) {
    if (ovr >= 86) return 'elite';
    if (ovr >= 75) return 'gold';
    if (ovr >= 65) return 'silver';
    return 'bronze';
  }

  Color _getOvrColor(String tier) {
    switch (tier) {
      case 'elite':
        return const Color(0xFFF8FAFC); // Platinum
      case 'gold':
        return const Color(0xFFFACC15); // Gold
      case 'silver':
        return const Color(0xFFCBD5E1); // Silver
      default:
        return const Color(0xFFCD7F32); // Bronze amber
    }
  }

  Color _getPositionColor(String pos) {
    switch (pos.toUpperCase()) {
      case 'DEL':
        return AppColors.posDel;
      case 'MED':
        return AppColors.posMed;
      case 'DEF':
        return AppColors.posDef;
      case 'POR':
        return AppColors.posPor;
      default:
        return AppColors.voltNeon;
    }
  }

  List<String> _getKeyStats(String pos) {
    switch (pos.toUpperCase()) {
      case 'DEL':
        return ['PAC', 'SHO'];
      case 'MED':
        return ['PAS', 'DRI'];
      case 'DEF':
      case 'POR':
      default:
        return ['DEF', 'PHY'];
    }
  }

  @override
  Widget build(BuildContext context) {
    final player = widget.player;
    final tier = _getOvrTier(player.ovr);
    final ovrColor = _getOvrColor(tier);
    final posColor = _getPositionColor(player.position);
    final keyStats = _getKeyStats(player.position);

    // Identificar el atributo más alto para resaltarlo
    final statsList = [
      {'key': 'PAC', 'label': 'RIT', 'val': player.pac},
      {'key': 'SHO', 'label': 'TIR', 'val': player.sho},
      {'key': 'PAS', 'label': 'PAS', 'val': player.pas},
      {'key': 'DRI', 'label': 'REG', 'val': player.dri},
      {'key': 'DEF', 'label': 'DEF', 'val': player.def},
      {'key': 'PHY', 'label': 'FIS', 'val': player.phy},
    ];
    int maxVal = -1;
    String topKey = 'PAC';
    for (var s in statsList) {
      if ((s['val'] as int) > maxVal) {
        maxVal = s['val'] as int;
        topKey = s['key'] as String;
      }
    }

    // Configuración visual por tier según src/app/globals.css
    Border cardBorder;
    List<BoxShadow> cardShadows;
    RadialGradient auraGradient;
    Color avatarBorderColor;

    switch (tier) {
      case 'elite':
        cardBorder = Border.all(color: const Color(0xFFBED2FF).withValues(alpha: 0.65), width: 1.5);
        cardShadows = [
          BoxShadow(color: const Color(0xFFBED2FF).withValues(alpha: 0.28), blurRadius: 16),
          const BoxShadow(color: Color(0x99000000), blurRadius: 10, offset: Offset(0, 4)),
        ];
        auraGradient = const RadialGradient(
          center: Alignment.topCenter,
          radius: 1.2,
          colors: [Color(0x52BED2FF), Colors.transparent],
        );
        avatarBorderColor = const Color(0xFFBED2FF);
        break;

      case 'gold':
        cardBorder = Border.all(color: const Color(0xFFFACC15).withValues(alpha: 0.45), width: 1.0);
        cardShadows = [
          BoxShadow(color: const Color(0xFFFACC15).withValues(alpha: 0.16), blurRadius: 8),
          const BoxShadow(color: Color(0x99000000), blurRadius: 10, offset: Offset(0, 4)),
        ];
        auraGradient = const RadialGradient(
          center: Alignment.topRight,
          radius: 1.3,
          colors: [Color(0x40FACC15), Colors.transparent],
        );
        avatarBorderColor = const Color(0xFFFACC15);
        break;

      case 'silver':
        cardBorder = Border.all(color: const Color(0xFFCBD5E1).withValues(alpha: 0.38), width: 1.0);
        cardShadows = [
          BoxShadow(color: const Color(0xFFCBD5E1).withValues(alpha: 0.12), blurRadius: 6),
          const BoxShadow(color: Color(0x99000000), blurRadius: 10, offset: Offset(0, 4)),
        ];
        auraGradient = const RadialGradient(
          center: Alignment.topCenter,
          radius: 1.1,
          colors: [Color(0x33CBD5E1), Colors.transparent],
        );
        avatarBorderColor = const Color(0xFFCBD5E1);
        break;

      default: // bronze
        cardBorder = Border.all(color: const Color(0xFFCD7F32).withValues(alpha: 0.35), width: 1.0);
        cardShadows = [
          BoxShadow(color: const Color(0xFFCD7F32).withValues(alpha: 0.14), blurRadius: 6),
          const BoxShadow(color: Color(0x99000000), blurRadius: 10, offset: Offset(0, 4)),
        ];
        auraGradient = const RadialGradient(
          center: Alignment.bottomLeft,
          radius: 1.4,
          colors: [Color(0x38CD7F32), Colors.transparent],
        );
        avatarBorderColor = const Color(0xFFCD7F32);
        break;
    }

    return GestureDetector(
      onTap: widget.onTap,
      onPanUpdate: (details) {
        setState(() {
          _rotateY += details.delta.dx * 0.003;
          _rotateX -= details.delta.dy * 0.003;
          _rotateX = _rotateX.clamp(-0.15, 0.15);
          _rotateY = _rotateY.clamp(-0.15, 0.15);
        });
      },
      onPanEnd: (_) {
        setState(() {
          _rotateX = 0;
          _rotateY = 0;
        });
      },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        transform: Matrix4.identity()
          ..setEntry(3, 2, 0.0012)
          ..rotateX(_rotateX)
          ..rotateY(_rotateY),
        transformAlignment: Alignment.center,
        child: AspectRatio(
          aspectRatio: 2.0 / 3.0,
          child: Container(
            decoration: BoxDecoration(
              color: const Color(0xFF141923), // bg-card
              borderRadius: BorderRadius.circular(16),
              border: cardBorder,
              boxShadow: cardShadows,
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(15),
              child: Stack(
                children: [
                  // 1. Efecto Aura por Tier
                  Positioned.fill(
                    child: Container(
                      decoration: BoxDecoration(
                        gradient: auraGradient,
                      ),
                    ),
                  ),

                  // 2. Marca de agua vectorial oficial según posición (DEL, MED, DEF, POR)
                  Positioned(
                    right: -6,
                    bottom: -6,
                    width: 110,
                    height: 110,
                    child: Opacity(
                      opacity: 0.08,
                      child: SvgPicture.asset(
                        'assets/icons-pos/pos-${player.position.toLowerCase()}.svg',
                        colorFilter: ColorFilter.mode(
                          posColor,
                          BlendMode.srcIn,
                        ),
                        fit: BoxFit.contain,
                        errorBuilder: (context, error, stackTrace) => const SizedBox(),
                      ),
                    ),
                  ),

                  // 3. Contenido de la Carta
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        // Fila Superior: Badge de Posición y OVR clasificado por color
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            // Badge de posición con borde y fondo translúcido (web exacto)
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                              decoration: BoxDecoration(
                                color: posColor.withValues(alpha: 0.14),
                                borderRadius: BorderRadius.circular(6),
                                border: Border.all(
                                  color: posColor.withValues(alpha: 0.45),
                                  width: 1,
                                ),
                              ),
                              child: Text(
                                player.position.toUpperCase(),
                                style: AppTypography.headline(
                                  size: 11,
                                  weight: FontWeight.w800,
                                  color: posColor,
                                ),
                              ),
                            ),

                            // OVR clasificado por color (Bronze, Silver, Gold, Elite) + label OVR
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.end,
                              children: [
                                Text(
                                  '${player.ovr}',
                                  style: AppTypography.sportNumber(
                                    size: 26,
                                    color: ovrColor,
                                  ),
                                ),
                                Text(
                                  'OVR',
                                  style: AppTypography.code(
                                    size: 8,
                                    weight: FontWeight.w800,
                                    color: Colors.white54,
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),

                        // Avatar Circular con aro brillante según el Tier de OVR
                        Stack(
                          alignment: Alignment.bottomCenter,
                          clipBehavior: Clip.none,
                          children: [
                            Container(
                              width: 72,
                              height: 72,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                border: Border.all(
                                  color: avatarBorderColor.withValues(alpha: 0.75),
                                  width: 2.5,
                                ),
                                boxShadow: [
                                  BoxShadow(
                                    color: avatarBorderColor.withValues(alpha: 0.35),
                                    blurRadius: 8,
                                  ),
                                ],
                              ),
                              child: ClipOval(
                                child: player.photoUrl != null && player.photoUrl!.isNotEmpty
                                    ? CachedNetworkImage(
                                        imageUrl: player.photoUrl!,
                                        fit: BoxFit.cover,
                                        placeholder: (context, url) => Container(
                                          color: const Color(0xFF1E2636),
                                          child: Center(
                                            child: Text(
                                              player.name.isNotEmpty ? player.name[0] : 'P',
                                              style: AppTypography.sportNumber(size: 22, color: ovrColor),
                                            ),
                                          ),
                                        ),
                                        errorWidget: (context, url, error) => Container(
                                          color: const Color(0xFF1E2636),
                                          child: Center(
                                            child: Text(
                                              player.name.isNotEmpty ? player.name[0] : 'P',
                                              style: AppTypography.sportNumber(size: 22, color: ovrColor),
                                            ),
                                          ),
                                        ),
                                      )
                                    : Container(
                                        color: const Color(0xFF1E2636),
                                        child: Center(
                                          child: Text(
                                            player.name.isNotEmpty ? player.name[0] : 'P',
                                            style: AppTypography.sportNumber(size: 22, color: ovrColor),
                                          ),
                                        ),
                                      ),
                              ),
                            ),
                          ],
                        ),

                        // Nombre del Jugador
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 4),
                          child: Text(
                            player.name,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            textAlign: TextAlign.center,
                            style: AppTypography.headline(
                              size: 13,
                              weight: FontWeight.w700,
                              color: Colors.white,
                            ),
                          ),
                        ),

                        // Grilla de 6 Atributos (2 columnas x 3 filas) con cajas translúcidas
                        Padding(
                          padding: const EdgeInsets.only(bottom: 2),
                          child: Column(
                            children: [
                              Row(
                                children: [
                                  Expanded(child: _buildAttributeBox(statsList[0], topKey, posColor, keyStats)),
                                  const SizedBox(width: 5),
                                  Expanded(child: _buildAttributeBox(statsList[1], topKey, posColor, keyStats)),
                                ],
                              ),
                              const SizedBox(height: 4),
                              Row(
                                children: [
                                  Expanded(child: _buildAttributeBox(statsList[2], topKey, posColor, keyStats)),
                                  const SizedBox(width: 5),
                                  Expanded(child: _buildAttributeBox(statsList[3], topKey, posColor, keyStats)),
                                ],
                              ),
                              const SizedBox(height: 4),
                              Row(
                                children: [
                                  Expanded(child: _buildAttributeBox(statsList[4], topKey, posColor, keyStats)),
                                  const SizedBox(width: 5),
                                  Expanded(child: _buildAttributeBox(statsList[5], topKey, posColor, keyStats)),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildAttributeBox(
    Map<String, dynamic> stat,
    String topKey,
    Color posColor,
    List<String> keyStats,
  ) {
    final key = stat['key'] as String;
    final label = stat['label'] as String;
    final val = stat['val'] as int;
    final isTop = key == topKey;
    final isKeyStat = keyStats.contains(key);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 3),
      decoration: BoxDecoration(
        color: isTop ? AppColors.voltNeon.withValues(alpha: 0.08) : Colors.white.withValues(alpha: 0.04),
        borderRadius: BorderRadius.circular(5),
        border: Border.all(
          color: isTop ? AppColors.voltNeon.withValues(alpha: 0.3) : Colors.white.withValues(alpha: 0.05),
          width: 0.8,
        ),
      ),
      child: Row(
        children: [
          // Etiqueta (ej: RIT)
          SizedBox(
            width: 22,
            child: Text(
              label,
              style: AppTypography.code(
                size: 9,
                weight: FontWeight.w800,
                color: isKeyStat ? posColor : const Color(0xFF94A3B8),
              ),
            ),
          ),
          const SizedBox(width: 3),

          // Mini Barra de Progreso
          Expanded(
            child: ClipRRect(
              borderRadius: BorderRadius.circular(2),
              child: Container(
                height: 3.5,
                color: Colors.white.withValues(alpha: 0.12),
                child: FractionallySizedBox(
                  alignment: Alignment.centerLeft,
                  widthFactor: (val / 99.0).clamp(0.05, 1.0),
                  child: Container(
                    decoration: BoxDecoration(
                      color: isTop ? posColor : (isKeyStat ? posColor.withValues(alpha: 0.7) : Colors.white.withValues(alpha: 0.45)),
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(width: 4),

          // Valor Numérico
          Text(
            '$val',
            style: AppTypography.code(
              size: 10,
              weight: FontWeight.w800,
              color: isTop ? AppColors.voltNeon : Colors.white,
            ),
          ),
        ],
      ),
    );
  }
}
