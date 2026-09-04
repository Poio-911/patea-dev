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


  @override
  Widget build(BuildContext context) {
    final player = widget.player;
    final tier = _getOvrTier(player.ovr);
    final posColor = _getPositionColor(player.position);

    final statsList = [
      {'key': 'PAC', 'label': 'RIT', 'val': player.pac},
      {'key': 'SHO', 'label': 'TIR', 'val': player.sho},
      {'key': 'PAS', 'label': 'PAS', 'val': player.pas},
      {'key': 'DRI', 'label': 'REG', 'val': player.dri},
      {'key': 'DEF', 'label': 'DEF', 'val': player.def},
      {'key': 'PHY', 'label': 'FIS', 'val': player.phy},
    ];

    // Configuración visual por tier (OVR)
    Color tierColor;
    Border cardBorder;
    Alignment auraAlignment;
    List<Color> auraColors;
    Color avatarBorderColor;
    double avatarBorderAlpha;
    BoxShadow? avatarGlow;

    switch (tier) {
      case 'elite':
        tierColor = const Color(0xFFC8D2F0); // Platino
        cardBorder = Border.all(color: const Color(0xFFC8D2F0).withValues(alpha: 0.65), width: 1.5);
        auraAlignment = Alignment.topCenter;
        auraColors = [const Color(0xFFD2DEFF).withValues(alpha: 0.62), Colors.transparent];
        avatarBorderColor = const Color(0xFFC8D2F0);
        avatarBorderAlpha = 0.88;
        avatarGlow = BoxShadow(color: const Color(0xFFC8D2F0).withValues(alpha: 0.60), blurRadius: 8);
        break;

      case 'gold':
        tierColor = const Color(0xFFFBC437); // Gold
        cardBorder = Border.all(color: const Color(0xFFFBC437).withValues(alpha: 0.55), width: 1.2);
        auraAlignment = Alignment.topRight;
        auraColors = [const Color(0xFFFBC437).withValues(alpha: 0.32), Colors.transparent];
        avatarBorderColor = const Color(0xFFFBC437);
        avatarBorderAlpha = 0.85;
        avatarGlow = BoxShadow(color: const Color(0xFFFBBF24).withValues(alpha: 0.40), blurRadius: 8);
        break;

      case 'silver':
        tierColor = const Color(0xFFCBD5E1); // Silver
        cardBorder = Border.all(color: const Color(0xFFCBD5E1).withValues(alpha: 0.45), width: 1.0);
        auraAlignment = Alignment.topCenter;
        auraColors = [const Color(0xFFCBD5E1).withValues(alpha: 0.25), Colors.transparent];
        avatarBorderColor = const Color(0xFFCBD5E1);
        avatarBorderAlpha = 0.75;
        avatarGlow = null; // el glow separa oro y elite del resto
        break;

      default: // bronze
        tierColor = const Color(0xFFCD7F32); // Bronze
        cardBorder = Border.all(color: const Color(0xFFCD7F32).withValues(alpha: 0.45), width: 1.0);
        auraAlignment = Alignment.bottomLeft;
        auraColors = [const Color(0xFFCD7F32).withValues(alpha: 0.28), Colors.transparent];
        avatarBorderColor = const Color(0xFFCD7F32);
        avatarBorderAlpha = 0.70;
        avatarGlow = null; // idem bronce
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
      // Arquitectura visual de la carta:
      //
      // 1) Sombra en el plano base (fuera del Transform 3D):
      //    Se dibuja sobre la superficie 2D de la pantalla pero se atenúa
      //    hasta desaparecer al inclinar la carta. Si la sombra se dejara
      //    estática afuera, al rotar la carta en 3D la huella 2D queda
      //    expuesta como un "rectángulo fijo" detrás. Y si se intenta meter
      //    un BoxShadow adentro del Transform, Skia no proyecta desenfoques
      //    gaussianos en matrices 3D y genera un bloque rectangular rígido.
      //
      // 2) Recorte por Path con antiAliasWithSaveLayer:
      //    Garantiza que la carta conserve sus esquinas redondeadas de 16 px
      //    impecables en cualquier ángulo 3D, sin sangrado de hijos ni
      //    esquinas degradadas a 90°.
      //
      // 3) Borde y foil trazados como Path (no RRect primitivo):
      //    Evita cualquier degradación en el pipeline Skia/Impeller.
      child: AspectRatio(
        aspectRatio: 2.0 / 3.0,
        child: Transform(
          transform: Matrix4.identity()
            ..setEntry(3, 2, 0.0012)
            ..rotateX(_rotateX)
            ..rotateY(_rotateY),
          alignment: Alignment.center,
          child: ClipPath(
            clipper: const _CardClipper(),
            clipBehavior: Clip.antiAliasWithSaveLayer,
            child: ColoredBox(
              color: const Color(0xFF141923), // bg-card
              child: Stack(
                children: [
                  // 1. Efecto Aura por Tier (radial-gradient de `.game .aura-*`).
                  // El centro del gradiente se desplaza con la inclinación para
                  // dar sensación de profundidad física sin mover el contenedor
                  // ni generar cortes rectangulares en los bordes.
                  Positioned.fill(
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        gradient: RadialGradient(
                          center: Alignment(
                            (auraAlignment.x + (_rotateY / _maxTilt) * 0.35).clamp(-1.0, 1.0),
                            (auraAlignment.y - (_rotateX / _maxTilt) * 0.35).clamp(-1.0, 1.0),
                          ),
                          radius: 1.2,
                          colors: auraColors,
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

                  // 5. Borde, trazado como path por el mismo motivo que la
                  // forma: con BoxDecoration se pierde una esquina al
                  // inclinar la carta.
                  Positioned.fill(
                    child: IgnorePointer(
                      child: CustomPaint(
                        painter: _CardBorderPainter(
                          color: cardBorder.top.color,
                          width: cardBorder.top.width,
                        ),
                      ),
                    ),
                  ),

                  // 6. Contenido de la Carta
                  // Vertical 9 y no 10: con la relación de aspecto 2:3 el
                  // contenido entra justo, y el borde de élite (1,5 px contra
                  // 1 del resto) se come esa diferencia — la carta élite
                  // desbordaba por 0,229 px y en debug eso pinta la franja
                  // amarilla y negra sobre los atributos.
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        // Fila Superior: Badge deportivo de posición & OVR por Tier
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            // Posición: el código corto, blanco y en negrita.
                            // El nombre completo vive como marca de agua
                            // detrás del contenido, así el puesto se lee dos
                            // veces sin que ninguna de las dos grite.
                            Text(
                              player.position.toUpperCase(),
                              style: AppTypography.headline(
                                size: 14,
                                weight: FontWeight.w800,
                                color: Colors.white,
                                letterSpacing: 0.5,
                              ),
                            ),

                            // OVR protagónico coloreado por Tier
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.end,
                              children: [
                                Text(
                                  '${player.ovr}',
                                  style: AppTypography.sportNumber(
                                    size: 34,
                                    color: tierColor,
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

                        // Avatar Circular — 96x96 con aro y glow del Tier
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
                                  width: 3,
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
                                  Expanded(child: _attributeBox(statsList[0])),
                                  const SizedBox(width: 5),
                                  Expanded(child: _attributeBox(statsList[1])),
                                ],
                              ),
                              const SizedBox(height: 4),
                              Row(
                                children: [
                                  Expanded(child: _attributeBox(statsList[2])),
                                  const SizedBox(width: 5),
                                  Expanded(child: _attributeBox(statsList[3])),
                                ],
                              ),
                              const SizedBox(height: 4),
                              Row(
                                children: [
                                  Expanded(child: _attributeBox(statsList[4])),
                                  const SizedBox(width: 5),
                                  Expanded(child: _attributeBox(statsList[5])),
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

  /// Una fila de la grilla de atributos.
  ///
  /// Recibe sólo el atributo: el resaltado por posición y por "atributo más
  /// alto" se sacaron (no comunicaban nada — en un delantero se prendían RIT
  /// y TIR sin que eso significara algo), y el color por tier también, porque
  /// en una carta bronce salían las seis barras marrones sobre oscuro. El
  /// único resaltado que queda es el del criterio de orden, que sí dice por
  /// qué la grilla está ordenada así.
  Widget _attributeBox(Map<String, dynamic> stat) {
    final key = stat['key'] as String;
    final label = stat['label'] as String;
    final val = stat['val'] as int;
    final isSorted = widget.highlightStat == key;

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
              : Colors.white.withValues(alpha: 0.08),
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
                color: isSorted
                    ? AppColors.voltNeon
                    : const Color(0xFF94A3B8),
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

          // Valor Numérico
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

/// Clipper exacto por Path para garantizar bordes redondeados (16 px)
/// suaves y anti-aliaseados bajo cualquier matriz de perspectiva 3D.
class _CardClipper extends CustomClipper<Path> {
  const _CardClipper();

  @override
  Path getClip(Size size) {
    return Path()
      ..addRRect(RRect.fromRectAndRadius(
        Offset.zero & size,
        const Radius.circular(16),
      ));
  }

  @override
  bool shouldReclip(covariant CustomClipper<Path> oldClipper) => false;
}

/// El borde de la carta, trazado como path.
///
/// No es un capricho: ver la nota en el build. Un borde de `BoxDecoration`
/// se pierde en una esquina cuando la carta se inclina.
class _CardBorderPainter extends CustomPainter {
  final Color color;
  final double width;

  const _CardBorderPainter({required this.color, required this.width});

  @override
  void paint(Canvas canvas, Size size) {
    // El trazo se centra en el path, así que se mete media pincelada hacia
    // adentro para que no lo coma el recorte.
    final rect = Offset.zero & size;
    final inset = rect.deflate(width / 2);
    final path = Path()
      ..addRRect(RRect.fromRectAndRadius(inset, Radius.circular(16 - width / 2)));
    canvas.drawPath(
      path,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = width
        ..color = color,
    );
  }

  @override
  bool shouldRepaint(_CardBorderPainter old) =>
      old.color != color || old.width != width;
}
