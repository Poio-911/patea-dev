import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../models/player_model.dart';
import '../theme/app_colors.dart';
import '../theme/app_typography.dart';

/// Carta de Jugador idéntica a PlayerCard de la webapp (src/components/player-card.tsx)
class PlayerCardWidget extends StatefulWidget {
  final Player player;
  final VoidCallback? onTap;
  final String? matchStatusText; // ej: "Sin chaleco vs Con chaleco | 🕥 1:00"

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

  Color _getTierBorderColor(String tier) {
    switch (tier) {
      case 'elite':
        return const Color(0xE0F8FAFC);
      case 'gold':
        return const Color(0xCCFFD700);
      case 'silver':
        return const Color(0xB3CBD5E1);
      default:
        return const Color(0x99CD7F32);
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
    final tierBorderColor = _getTierBorderColor(tier);
    final posColor = _getPositionColor(player.position);
    final keyStats = _getKeyStats(player.position);

    // Identificar el atributo más alto para resaltarlo como en la web
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

    return GestureDetector(
      onTap: widget.onTap,
      onPanUpdate: (details) {
        setState(() {
          _rotateY += details.delta.dx * 0.003;
          _rotateX -= details.delta.dy * 0.003;
          _rotateX = _rotateX.clamp(-0.2, 0.2);
          _rotateY = _rotateY.clamp(-0.2, 0.2);
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
              color: const Color(0xFF141923),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(
                color: tierBorderColor.withValues(alpha: 0.55),
                width: 1.2,
              ),
              boxShadow: [
                BoxShadow(
                  color: tierBorderColor.withValues(alpha: 0.12),
                  blurRadius: 16,
                  offset: const Offset(0, 6),
                ),
                const BoxShadow(
                  color: Color(0x80000000),
                  blurRadius: 12,
                  offset: Offset(0, 4),
                ),
              ],
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(19),
              child: Stack(
                children: [
                  // 1. Marca de agua vectorial de jugador pateando (esquina inferior derecha)
                  Positioned(
                    right: -10,
                    bottom: -10,
                    width: 110,
                    height: 110,
                    child: Opacity(
                      opacity: 0.08,
                      child: CustomPaint(
                        painter: _PlayerWatermarkPainter(color: posColor),
                      ),
                    ),
                  ),

                  // 2. Contenido de la Carta
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 12),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        // Fila Superior: Posición (texto puro blanco) y OVR (número grande)
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            // Posición en texto puro sin caja (idéntico a la web)
                            Padding(
                              padding: const EdgeInsets.only(top: 2, left: 2),
                              child: Text(
                                player.position.toUpperCase(),
                                style: AppTypography.headline(
                                  size: 14,
                                  weight: FontWeight.w900,
                                  color: Colors.white,
                                ),
                              ),
                            ),

                            // OVR + etiqueta "OVR"
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.end,
                              children: [
                                Text(
                                  '${player.ovr}',
                                  style: AppTypography.sportNumber(
                                    size: 28,
                                    color: Colors.white,
                                  ),
                                ),
                                Text(
                                  'OVR',
                                  style: AppTypography.code(
                                    size: 9,
                                    weight: FontWeight.w800,
                                    color: Colors.white60,
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),

                        // Avatar Circular con borde de tier
                        Stack(
                          alignment: Alignment.bottomCenter,
                          clipBehavior: Clip.none,
                          children: [
                            Container(
                              width: 76,
                              height: 76,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                border: Border.all(
                                  color: tierBorderColor,
                                  width: 3.5,
                                ),
                                boxShadow: [
                                  BoxShadow(
                                    color: tierBorderColor.withValues(alpha: 0.35),
                                    blurRadius: 10,
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
                                              style: AppTypography.sportNumber(size: 24, color: Colors.white),
                                            ),
                                          ),
                                        ),
                                        errorWidget: (context, url, error) => Container(
                                          color: const Color(0xFF1E2636),
                                          child: Center(
                                            child: Text(
                                              player.name.isNotEmpty ? player.name[0] : 'P',
                                              style: AppTypography.sportNumber(size: 24, color: Colors.white),
                                            ),
                                          ),
                                        ),
                                      )
                                    : Container(
                                        color: const Color(0xFF1E2636),
                                        child: Center(
                                          child: Text(
                                            player.name.isNotEmpty ? player.name[0] : 'P',
                                            style: AppTypography.sportNumber(size: 24, color: Colors.white),
                                          ),
                                        ),
                                      ),
                              ),
                            ),

                            // Píldora de estado de partido si aplica (ej: "Sin chaleco vs Con chaleco")
                            if (widget.matchStatusText != null)
                              Positioned(
                                bottom: -8,
                                child: Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: const Color(0xEB0D131F),
                                    borderRadius: BorderRadius.circular(8),
                                    border: Border.all(color: Colors.white24, width: 0.8),
                                  ),
                                  child: Text(
                                    widget.matchStatusText!,
                                    style: const TextStyle(fontSize: 8, color: Colors.white70, fontWeight: FontWeight.w600),
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
                            style: AppTypography.headline(
                              size: 13,
                              weight: FontWeight.w800,
                              color: Colors.white,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            textAlign: TextAlign.center,
                          ),
                        ),

                        // Grid 2x3 de Atributos (idéntico a AttributesGrid de la webapp)
                        Padding(
                          padding: const EdgeInsets.only(top: 2),
                          child: Column(
                            children: [
                              Row(
                                children: [
                                  _buildStatPill(statsList[0], keyStats, topKey, posColor),
                                  const SizedBox(width: 4),
                                  _buildStatPill(statsList[1], keyStats, topKey, posColor),
                                ],
                              ),
                              const SizedBox(height: 3),
                              Row(
                                children: [
                                  _buildStatPill(statsList[2], keyStats, topKey, posColor),
                                  const SizedBox(width: 4),
                                  _buildStatPill(statsList[3], keyStats, topKey, posColor),
                                ],
                              ),
                              const SizedBox(height: 3),
                              Row(
                                children: [
                                  _buildStatPill(statsList[4], keyStats, topKey, posColor),
                                  const SizedBox(width: 4),
                                  _buildStatPill(statsList[5], keyStats, topKey, posColor),
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

  Widget _buildStatPill(Map<String, dynamic> stat, List<String> keyStats, String topKey, Color posColor) {
    final key = stat['key'] as String;
    final label = stat['label'] as String;
    final val = stat['val'] as int;
    final isKey = keyStats.contains(key);
    final isTop = key == topKey;
    final pct = (val / 99.0).clamp(0.0, 1.0);

    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 3.5),
        decoration: BoxDecoration(
          color: isTop ? AppColors.voltNeon.withValues(alpha: 0.08) : const Color(0x14FFFFFF),
          borderRadius: BorderRadius.circular(6),
          border: isTop ? Border.all(color: AppColors.voltNeon.withValues(alpha: 0.25), width: 0.8) : null,
        ),
        child: Row(
          children: [
            // Sigla del atributo (coloreada si es key stat para la posición)
            Text(
              label,
              style: AppTypography.code(
                size: 9,
                weight: FontWeight.w800,
                color: isKey ? posColor : const Color(0x99FFFFFF),
              ),
            ),
            const SizedBox(width: 4),

            // Mini barra horizontal
            Expanded(
              child: ClipRRect(
                borderRadius: BorderRadius.circular(2),
                child: Container(
                  height: 2.5,
                  color: const Color(0x24FFFFFF),
                  child: FractionallySizedBox(
                    alignment: Alignment.centerLeft,
                    widthFactor: pct,
                    child: Container(
                      color: isTop ? posColor.withValues(alpha: 0.7) : const Color(0x55FFFFFF),
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(width: 4),

            // Valor numérico
            Text(
              '$val',
              style: AppTypography.code(
                size: 10,
                weight: FontWeight.w800,
                color: Colors.white,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Painter para la silueta vectorial del jugador en la marca de agua
class _PlayerWatermarkPainter extends CustomPainter {
  final Color color;

  _PlayerWatermarkPainter({required this.color});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.fill;

    final scale = size.width / 100.0;
    canvas.scale(scale, scale);

    // Cabeza
    canvas.drawCircle(const Offset(60, 10), 10, paint);

    // Cuerpo en movimiento de remate
    final path = Path();
    path.moveTo(58, 22);
    path.lineTo(48, 40);
    path.lineTo(25, 48);
    path.lineTo(30, 56);
    path.lineTo(45, 50);
    path.lineTo(40, 75);
    path.lineTo(20, 88);
    path.lineTo(25, 96);
    path.lineTo(52, 78);
    path.lineTo(60, 52);
    path.lineTo(72, 60);
    path.lineTo(82, 85);
    path.lineTo(92, 82);
    path.lineTo(78, 52);
    path.lineTo(68, 30);
    path.close();

    canvas.drawPath(path, paint);

    // Pelota
    canvas.drawCircle(const Offset(88, 92), 7, paint);
  }

  @override
  bool shouldRepaint(covariant _PlayerWatermarkPainter oldDelegate) {
    return oldDelegate.color != color;
  }
}
