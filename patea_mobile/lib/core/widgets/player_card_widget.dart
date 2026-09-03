import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter_svg/flutter_svg.dart';
import '../models/player_model.dart';
import '../theme/app_colors.dart';
import '../theme/app_typography.dart';
import 'card_foil.dart';

/// Carta de Jugador 100% idéntica a PlayerCard de la webapp (src/components/player-card.tsx)
/// Con auras radiales por rareza, borde sutil con glow, badge de posición estilizado y OVR por tier.
class PlayerCardWidget extends StatefulWidget {
  final Player player;
  final VoidCallback? onTap;
  final String? matchStatusText;

  /// Atributo por el que está ordenada la grilla ('PAC','SHO',...). Cuando
  /// está, esa caja se resalta en todas las cartas: al ordenar por tiro querés
  /// ver de un vistazo el tiro de cada uno, no buscarlo.
  final String? highlightStat;

  /// Foto recién elegida del teléfono, todavía sin subir. Cuando está, se
  /// dibuja en lugar de `player.photoUrl`: es lo que permite ver la carta con
  /// la foto nueva antes de guardar.
  final File? localPhoto;

  const PlayerCardWidget({
    super.key,
    required this.player,
    this.onTap,
    this.matchStatusText,
    this.localPhoto,
    this.highlightStat,
  });

  @override
  State<PlayerCardWidget> createState() => _PlayerCardWidgetState();
}

class _PlayerCardWidgetState extends State<PlayerCardWidget>
    with TickerProviderStateMixin {
  static const _maxTilt = 0.16;

  double _rotateX = 0;
  double _rotateY = 0;
  bool _holding = false;

  /// Vuelta al centro con rebote. Antes la carta volvía de golpe con un
  /// AnimatedContainer lineal; una carta física tiene inercia.
  late final AnimationController _settle = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 900),
  );
  double _fromX = 0;
  double _fromY = 0;

  @override
  void initState() {
    super.initState();
    _settle.addListener(() {
      final t = Curves.elasticOut.transform(_settle.value);
      setState(() {
        _rotateX = _fromX * (1 - t);
        _rotateY = _fromY * (1 - t);
      });
    });
  }

  @override
  void dispose() {
    _settle.dispose();
    super.dispose();
  }

  String _getOvrTier(int ovr) {
    if (ovr >= 86) return 'elite';
    if (ovr >= 76) return 'gold';
    if (ovr >= 65) return 'silver';
    return 'bronze';
  }

  /// Colores por posición EXACTOS del tema `.game` (`--pos-del/med/def/por`
  /// en globals.css: hues más pastel/claros que `AppColors.posDel` etc.,
  /// que son del tema claro por defecto y se usan en otras pantallas — acá
  /// se define aparte a propósito, para no tocar ese constante global.
  Color _getPositionColor(String pos) {
    switch (pos.toUpperCase()) {
      case 'DEL':
        return const Color(0xFFF47171); // hsl(0,85%,70%)
      case 'MED':
        return const Color(0xFFB87BF4); // hsl(270,85%,72%)
      case 'DEF':
        return const Color(0xFF7BB8F4); // hsl(210,85%,72%)
      case 'POR':
        return const Color(0xFFF7B36E); // hsl(30,90%,70%)
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

    // Configuración visual por tier — valores exactos de `.game .aura-*` y
    // `photoBorderClasses` en src/app/globals.css / player-styles.tsx (no
    // aproximados: mismo hue/alpha que la web para ese tier). Este color NO
    // se usa para el texto de OVR ni de posición: en `globals.css`,
    // `.game .player-card [class*="font-bold"] { color: rgba(255,255,255,.95) !important }`
    // pisa cualquier color-por-tier en elementos con `font-bold` (OVR y
    // posición lo son), así que en el tema game ambos quedan blancos siempre.
    Border cardBorder;
    List<BoxShadow> cardShadows;
    Alignment auraAlignment;
    List<Color> auraColors;
    Color avatarBorderColor;
    double avatarBorderAlpha;
    BoxShadow? avatarGlow; // solo gold y elite tienen drop-shadow real

    switch (tier) {
      case 'elite':
        cardBorder = Border.all(color: const Color(0xFFC8D2F0).withValues(alpha: 0.65), width: 1.5);
        cardShadows = [
          BoxShadow(color: const Color(0xFFC8D2F0).withValues(alpha: 0.28), blurRadius: 16),
          const BoxShadow(color: Color(0x99000000), blurRadius: 10, offset: Offset(0, 4)),
        ];
        // .game .aura-elite: dos capas (bloom superior + relleno central)
        auraAlignment = Alignment.topCenter;
        auraColors = [const Color(0xFFD2DEFF).withValues(alpha: 0.62), Colors.transparent];
        avatarBorderColor = const Color(0xFFC8D2F0);
        avatarBorderAlpha = 0.88;
        avatarGlow = BoxShadow(color: const Color(0xFFC8D2F0).withValues(alpha: 0.60), blurRadius: 8);
        break;

      case 'gold':
        cardBorder = Border.all(color: const Color(0xFFFBC437).withValues(alpha: 0.45), width: 1.0);
        cardShadows = [
          BoxShadow(color: const Color(0xFFFBC437).withValues(alpha: 0.16), blurRadius: 8),
          const BoxShadow(color: Color(0x99000000), blurRadius: 10, offset: Offset(0, 4)),
        ];
        auraAlignment = Alignment.topRight;
        auraColors = [const Color(0xFFFBC437).withValues(alpha: 0.38), Colors.transparent];
        avatarBorderColor = const Color(0xFFFBC437);
        avatarBorderAlpha = 0.8;
        avatarGlow = BoxShadow(color: const Color(0xFFFBBF24).withValues(alpha: 0.4), blurRadius: 4);
        break;

      case 'silver':
        cardBorder = Border.all(color: const Color(0xFFC4C9D4).withValues(alpha: 0.38), width: 1.0);
        cardShadows = [
          BoxShadow(color: const Color(0xFFC4C9D4).withValues(alpha: 0.12), blurRadius: 6),
          const BoxShadow(color: Color(0x99000000), blurRadius: 10, offset: Offset(0, 4)),
        ];
        auraAlignment = Alignment.topCenter;
        auraColors = [const Color(0xFFC4C9D4).withValues(alpha: 0.32), Colors.transparent];
        avatarBorderColor = const Color(0xFFC4C9D4);
        avatarBorderAlpha = 0.7;
        avatarGlow = null; // silver no tiene drop-shadow en la web
        break;

      default: // bronze
        cardBorder = Border.all(color: const Color(0xFFD18C47).withValues(alpha: 0.35), width: 1.0);
        cardShadows = [
          BoxShadow(color: const Color(0xFFD18C47).withValues(alpha: 0.14), blurRadius: 6),
          const BoxShadow(color: Color(0x99000000), blurRadius: 10, offset: Offset(0, 4)),
        ];
        auraAlignment = Alignment.bottomLeft;
        auraColors = [const Color(0xFFCD7F32).withValues(alpha: 0.28), Colors.transparent];
        avatarBorderColor = const Color(0xFFD18C47);
        avatarBorderAlpha = 0.6;
        avatarGlow = null; // bronze no tiene drop-shadow en la web
        break;
    }

    return GestureDetector(
      onTap: widget.onTap,
      onPanDown: (_) {
        _settle.stop();
        _holding = true;
        HapticFeedback.selectionClick();
      },
      onPanUpdate: (details) {
        setState(() {
          _rotateY = (_rotateY + details.delta.dx * 0.003).clamp(-_maxTilt, _maxTilt);
          _rotateX = (_rotateX - details.delta.dy * 0.003).clamp(-_maxTilt, _maxTilt);
        });
      },
      onPanEnd: (_) {
        _holding = false;
        _fromX = _rotateX;
        _fromY = _rotateY;
        _settle.forward(from: 0);
      },
      onPanCancel: () {
        _holding = false;
        _fromX = _rotateX;
        _fromY = _rotateY;
        _settle.forward(from: 0);
      },
      child: Transform(
        transform: Matrix4.identity()
          ..setEntry(3, 2, 0.0012)
          ..rotateX(_rotateX)
          ..rotateY(_rotateY),
        alignment: Alignment.center,
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
                  // 1. Efecto Aura por Tier (radial-gradient de `.game .aura-*`).
                  // Se desplaza con la inclinación pero MENOS que el resto: es
                  // la capa del fondo, y esa diferencia de recorrido entre
                  // capas es lo que da la sensación de profundidad real.
                  Positioned.fill(
                    child: Transform.translate(
                      offset: Offset(_rotateY * 90, -_rotateX * 90),
                      child: Container(
                        decoration: BoxDecoration(
                          gradient: RadialGradient(center: auraAlignment, radius: 1.2, colors: auraColors),
                        ),
                      ),
                    ),
                  ),
                  // Élite tiene una 2da capa de relleno central más tenue en la web
                  if (tier == 'elite')
                    Positioned.fill(
                      child: Container(
                        decoration: BoxDecoration(
                          gradient: RadialGradient(
                            center: Alignment.center,
                            radius: 1.4,
                            colors: [const Color(0xFFD7E0FF).withValues(alpha: 0.22), Colors.transparent],
                          ),
                        ),
                      ),
                    ),

                  // 2. Material de la carta según el tier (fragment shader).
                  // Bronce mate, plata cepillada, oro pulido, élite holográfico.
                  // Es lo que hace que se distingan de un vistazo en la grilla:
                  // antes los cuatro eran el mismo fondo con otro borde.
                  Positioned.fill(
                    child: IgnorePointer(
                      child: CardFoil(
                        tier: tier,
                        tiltX: _rotateX / _maxTilt,
                        tiltY: _rotateY / _maxTilt,
                        seed: (player.id.hashCode % 1000) / 1000.0 * 6.28,
                      ),
                    ),
                  ),

                  // 3. Marca de agua vectorial por posición — la web usa
                  // `h-2/5 w-2/5` (40% del card, proporcional, no un tamaño
                  // fijo en px) desplazada `-bottom-2 -right-2` (~8px fuera
                  // del borde) al 10% de opacidad con el color pastel real
                  // de esa posición en el tema game.
                  Positioned.fill(
                    child: Align(
                      alignment: Alignment.bottomRight,
                      child: FractionallySizedBox(
                        widthFactor: 0.4,
                        heightFactor: 0.4,
                        child: Transform.translate(
                          offset: Offset(8 - _rotateY * 40, 8 + _rotateX * 40),
                          child: Opacity(
                            opacity: 0.10,
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
                      ),
                    ),
                  ),

                  // 4. Brillo especular. Es lo que hace que la carta se
                  // sienta un objeto físico: la franja de luz se corre según
                  // hacia dónde la inclinás, como el reflejo en una lámina.
                  // Necesita el dato del gesto en tiempo real, así que en la
                  // web no existe.
                  if (_holding || _settle.isAnimating)
                    Positioned.fill(
                      child: IgnorePointer(
                        child: Container(
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              begin: Alignment(
                                (-_rotateY / _maxTilt) - 0.9,
                                (_rotateX / _maxTilt) - 0.9,
                              ),
                              end: Alignment(
                                (-_rotateY / _maxTilt) + 0.9,
                                (_rotateX / _maxTilt) + 0.9,
                              ),
                              colors: [
                                Colors.transparent,
                                Colors.white.withValues(
                                  alpha: 0.10 * (_rotateX.abs() + _rotateY.abs()) / _maxTilt,
                                ),
                                Colors.transparent,
                              ],
                              stops: const [0.32, 0.5, 0.68],
                            ),
                          ),
                        ),
                      ),
                    ),

                  // 5. Contenido de la Carta
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        // Fila Superior: Posición (texto puro, sin caja — la web
                        // usa PlayerPositionBadge textOnly=true, y en el tema
                        // game el color por posición queda pisado a blanco por
                        // `.game .player-card [class*="font-bold"]`) y OVR.
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              player.position.toUpperCase(),
                              style: AppTypography.headline(
                                size: 14,
                                weight: FontWeight.w700,
                                color: Colors.white,
                              ),
                            ),

                            // OVR — también texto blanco puro en tema game (no
                            // coloreado por tier: mismo pisado de `font-bold`).
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.end,
                              children: [
                                Text(
                                  '${player.ovr}',
                                  style: AppTypography.sportNumber(
                                    size: 36,
                                    color: Colors.white,
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

                        // Avatar Circular — 96x96 (h-24 w-24 real) con borde de
                        // 4px (border-4 real) coloreado por tier; glow solo en
                        // gold/elite, igual que `photoBorderClasses` en la web.
                        Stack(
                          alignment: Alignment.bottomCenter,
                          clipBehavior: Clip.none,
                          children: [
                            Container(
                              width: 96,
                              height: 96,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                border: Border.all(
                                  color: avatarBorderColor.withValues(alpha: avatarBorderAlpha),
                                  width: 4,
                                ),
                                boxShadow: avatarGlow != null ? [avatarGlow] : null,
                              ),
                              child: ClipOval(
                                // El encuadre guardado (cropX/cropY en % y
                                // cropZoom) se aplica con Transform: es el
                                // mismo modelo que usa la web con object-position
                                // y scale sobre la imagen.
                                child: Transform.scale(
                                  scale: player.cropZoom,
                                  alignment: Alignment(
                                    (player.cropX / 50) - 1,
                                    (player.cropY / 50) - 1,
                                  ),
                                  child: widget.localPhoto != null
                                    ? Image.file(
                                        widget.localPhoto!,
                                        fit: BoxFit.cover,
                                        cacheWidth: 288,
                                      )
                                    : player.photoUrl != null && player.photoUrl!.isNotEmpty
                                    ? CachedNetworkImage(
                                        imageUrl: player.photoUrl!,
                                        fit: BoxFit.cover,
                                        // El avatar se dibuja a 96 px. Sin estos
                                        // límites, una foto de 5 MB subida desde
                                        // un celular se decodificaba entera en
                                        // memoria por cada carta de la grilla.
                                        memCacheWidth: 288, // 96 * 3 (densidad máx.)
                                        maxWidthDiskCache: 512,
                                        placeholder: (context, url) => Container(
                                          color: const Color(0xFF1E2636),
                                          child: Center(
                                            child: Text(
                                              player.name.isNotEmpty ? player.name[0] : 'P',
                                              style: AppTypography.sportNumber(size: 28, color: Colors.white),
                                            ),
                                          ),
                                        ),
                                        errorWidget: (context, url, error) => Container(
                                          color: const Color(0xFF1E2636),
                                          child: Center(
                                            child: Text(
                                              player.name.isNotEmpty ? player.name[0] : 'P',
                                              style: AppTypography.sportNumber(size: 28, color: Colors.white),
                                            ),
                                          ),
                                        ),
                                      )
                                    : Container(
                                        color: const Color(0xFF1E2636),
                                        child: Center(
                                          child: Text(
                                            player.name.isNotEmpty ? player.name[0] : 'P',
                                            style: AppTypography.sportNumber(size: 28, color: Colors.white),
                                          ),
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
                                  Expanded(child: _attributeBox(statsList[0], topKey, posColor, keyStats)),
                                  const SizedBox(width: 5),
                                  Expanded(child: _attributeBox(statsList[1], topKey, posColor, keyStats)),
                                ],
                              ),
                              const SizedBox(height: 4),
                              Row(
                                children: [
                                  Expanded(child: _attributeBox(statsList[2], topKey, posColor, keyStats)),
                                  const SizedBox(width: 5),
                                  Expanded(child: _attributeBox(statsList[3], topKey, posColor, keyStats)),
                                ],
                              ),
                              const SizedBox(height: 4),
                              Row(
                                children: [
                                  Expanded(child: _attributeBox(statsList[4], topKey, posColor, keyStats)),
                                  const SizedBox(width: 5),
                                  Expanded(child: _attributeBox(statsList[5], topKey, posColor, keyStats)),
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

  Widget _attributeBox(
    Map<String, dynamic> stat,
    String topKey,
    Color posColor,
    List<String> keyStats,
  ) {
    final key = stat['key'] as String;
    final label = stat['label'] as String;
    final val = stat['val'] as int;
    final isSorted = widget.highlightStat == key;

    // Antes se coloreaban dos cosas más, heredadas de la web: la barra del
    // atributo más alto y la etiqueta de los atributos "clave" de la posición.
    // Se sacaron porque no comunicaban nada: en un delantero, RIT y TIR salían
    // los dos en rojo sin que ese rojo significara algo, y con los atributos
    // parejos el "más alto" caía siempre en el mismo por orden de la lista.
    // El único resaltado que queda es el del criterio de orden, que sí dice
    // algo: por qué está ordenada la grilla así.
    return AnimatedContainer(
      duration: const Duration(milliseconds: 220),
      padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 3),
      decoration: BoxDecoration(
        color: isSorted
            ? AppColors.voltNeon.withValues(alpha: 0.16)
            : Colors.white.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(5),
        border: Border.all(
          color: isSorted
              ? AppColors.voltNeon.withValues(alpha: 0.65)
              : Colors.white.withValues(alpha: 0.10),
          width: isSorted ? 1.2 : 0.8,
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
                color: const Color(0xFF94A3B8),
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
                color: Colors.white.withValues(alpha: 0.15),
                child: FractionallySizedBox(
                  alignment: Alignment.centerLeft,
                  widthFactor: (val / 99.0).clamp(0.05, 1.0),
                  child: Container(
                    decoration: BoxDecoration(
                      color: isSorted
                          ? AppColors.voltNeon.withValues(alpha: 0.75)
                          : Colors.white.withValues(alpha: 0.30),
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(width: 4),

          // Valor Numérico — siempre blanco (font-bold pisado a blanco)
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
    );
  }
}
