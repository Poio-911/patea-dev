import 'dart:io';
import '../../core/theme/app_radii.dart';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter_svg/flutter_svg.dart';
import '../models/player_model.dart';
import '../theme/patea_colors.dart';
import '../theme/app_typography.dart';
import 'card_foil.dart';
import 'player_avatar_fallback.dart';

/// Estilo de visualización de la foto del jugador en la tarjeta.
enum CardPhotoStyle {
  /// Avatar circular central con borde y glow según el Tier (estilo web).
  circular,

  /// Foto expandida en la mitad superior con degradado suave hacia la base.
  halfTop,
}

/// Carta de Jugador 100% idéntica a PlayerCard de la webapp (src/components/player-card.tsx)
/// Con auras radiales por rareza, borde sutil con glow, badge de posición estilizado y OVR por tier.
class PlayerCardWidget extends StatefulWidget {
  final Player player;
  final VoidCallback? onTap;
  final String? matchStatusText;

  /// Radio de curvatura de las 4 esquinas de la carta (16.0 px en diseño estándar).
  static const double cardRadius = 16.0;

  /// Atributo por el que está ordenada la grilla ('PAC','SHO',...). Cuando
  /// está, esa caja se resalta en todas las cartas: al ordenar por tiro querés
  /// ver de un vistazo el tiro de cada uno, no buscarlo.
  final String? highlightStat;

  /// Foto recién elegida del teléfono, todavía sin subir. Cuando está, se
  /// dibuja en lugar de `player.photoUrl`: es lo que permite ver la carta con
  /// la foto nueva antes de guardar.
  final File? localPhoto;

  /// Estilo de foto: circular o mitad superior.
  final CardPhotoStyle photoStyle;

  /// Foto opcional desde assets locales.
  final String? assetPhoto;

  /// Inclinación X forzada opcional (para previews, pruebas o animaciones guiadas).
  final double? manualTiltX;

  /// Inclinación Y forzada opcional (para previews, pruebas o animaciones guiadas).
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

class _PlayerCardWidgetState extends State<PlayerCardWidget>
    with TickerProviderStateMixin {
  static const _maxTilt = 0.16;

  double _rotateX = 0;
  double _rotateY = 0;
  bool _holding = false;

  double get _curX => (widget.manualTiltX ?? _rotateX).clamp(-_maxTilt, _maxTilt);
  double get _curY => (widget.manualTiltY ?? _rotateY).clamp(-_maxTilt, _maxTilt);

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

  @override
  Widget build(BuildContext context) {
    return Theme(
      data: Theme.of(context).copyWith(
        extensions: <ThemeExtension<dynamic>>[PateaColors.game],
      ),
      child: Builder(
        builder: (cardContext) => _buildCard(cardContext),
      ),
    );
  }

  Widget _buildCard(BuildContext context) {
    final c = context.c;
    final player = widget.player;
    final tier = _getOvrTier(player.ovr);
    final posColor = c.positionColor(player.position);

    final isGk = player.position.toUpperCase() == 'POR';
    final statsList = isGk
        ? [
            {'key': 'DEF', 'label': 'EST', 'val': player.def},
            {'key': 'DRI', 'label': 'REF', 'val': player.dri},
            {'key': 'SHO', 'label': 'PAR', 'val': player.sho},
            {'key': 'PAC', 'label': 'VEL', 'val': player.pac},
            {'key': 'PAS', 'label': 'SAQ', 'val': player.pas},
            {'key': 'PHY', 'label': 'POS', 'val': player.phy},
          ]
        : [
            {'key': 'PAC', 'label': 'RIT', 'val': player.pac},
            {'key': 'SHO', 'label': 'TIR', 'val': player.sho},
            {'key': 'PAS', 'label': 'PAS', 'val': player.pas},
            {'key': 'DRI', 'label': 'REG', 'val': player.dri},
            {'key': 'DEF', 'label': 'DEF', 'val': player.def},
            {'key': 'PHY', 'label': 'FIS', 'val': player.phy},
          ];

    // Configuración visual por tier (OVR)
    Alignment auraAlignment;
    List<Color> auraColors;
    Color avatarBorderColor;
    double avatarBorderAlpha;
    BoxShadow? avatarGlow;
    double borderWidth;

    switch (tier) {
      case 'elite':
        borderWidth = 5.5;
        auraAlignment = Alignment.topCenter;
        auraColors = [c.eliteBorder.withValues(alpha: 0.62), c.eliteBorder.withValues(alpha: 0)];
        avatarBorderColor = c.eliteBorder;
        avatarBorderAlpha = 0.88;
        avatarGlow = BoxShadow(color: c.eliteBorder.withValues(alpha: 0.60), blurRadius: 8);
        break;

      case 'gold':
        borderWidth = 5.0;
        auraAlignment = Alignment.topRight;
        auraColors = [c.goldBorder.withValues(alpha: 0.32), c.goldBorder.withValues(alpha: 0)];
        avatarBorderColor = c.goldBorder;
        avatarBorderAlpha = 0.85;
        avatarGlow = BoxShadow(color: c.goldBorder.withValues(alpha: 0.40), blurRadius: 8);
        break;

      case 'silver':
        borderWidth = 4.5;
        auraAlignment = Alignment.topCenter;
        auraColors = [c.silverBorder.withValues(alpha: 0.25), c.silverBorder.withValues(alpha: 0)];
        avatarBorderColor = c.silverBorder;
        avatarBorderAlpha = 0.75;
        avatarGlow = null; // el glow separa oro y elite del resto
        break;

      default: // bronze
        borderWidth = 4.5;
        auraAlignment = Alignment.bottomLeft;
        auraColors = [c.bronzeBorder.withValues(alpha: 0.28), c.bronzeBorder.withValues(alpha: 0)];
        avatarBorderColor = c.bronzeBorder;
        avatarBorderAlpha = 0.70;
        avatarGlow = null; // idem bronce
        break;
    }

    final borderGradient = LinearGradient(
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
      colors: [
        Color.lerp(avatarBorderColor, Colors.white, 0.28)!,
        avatarBorderColor,
        Color.lerp(avatarBorderColor, Colors.black, 0.30)!,
      ],
      stops: const [0.0, 0.45, 1.0],
    );

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
      // La carta es un gráfico de proporción fija 2:3 con las tipografías
      // puestas a mano, igual que `.player-card` en la web: no reflowa, se
      // escala entera. La preferencia de texto del sistema sí agrandaba el
      // contenido pero no la carta, y a 1,3× desbordaba 6,8 px sobre la
      // grilla de atributos. Con techo en 1,15× sigue respetando al usuario
      // que agranda la letra —hasta donde la carta lo aguanta— y no recorta.
      child: MediaQuery.withClampedTextScaling(
        maxScaleFactor: 1.15,
        child: AspectRatio(
          aspectRatio: 2.0 / 3.0,
          child: Transform(
          transform: Matrix4.identity()
            ..setEntry(3, 2, 0.0012)
            ..rotateX(_curX)
            ..rotateY(_curY),
          alignment: Alignment.center,
          child: ClipPath(
            clipper: const _CardClipper(),
            clipBehavior: Clip.antiAliasWithSaveLayer,
            child: LayoutBuilder(
              builder: (context, constraints) {
                final cardH = constraints.maxHeight;
                return ColoredBox(
                  color: c.card,
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
                                (auraAlignment.x + (_curY / _maxTilt) * 0.35).clamp(-1.0, 1.0),
                                (auraAlignment.y - (_curX / _maxTilt) * 0.35).clamp(-1.0, 1.0),
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
                                colors: [c.eliteBorder.withValues(alpha: 0.22), c.eliteBorder.withValues(alpha: 0)],
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
                            tiltX: _curX / _maxTilt,
                            tiltY: _curY / _maxTilt,
                            seed: (player.id.hashCode % 1000) / 1000.0 * 6.28,
                          ),
                        ),
                      ),

                      // 2.5. Foto en la mitad superior con degradado suave hacia abajo (halfTop)
                      if (widget.photoStyle == CardPhotoStyle.halfTop)
                        Positioned(
                          top: 0,
                          left: 0,
                          right: 0,
                          height: cardH * 0.54,
                          child: ShaderMask(
                            // Los blancos de este degradado no son un color:
                            // son la mascara de opacidad del ShaderMask. No
                            // pasan a token.
                            shaderCallback: (rect) {
                              return const LinearGradient(
                                begin: Alignment.topCenter,
                                end: Alignment.bottomCenter,
                                colors: [
                                  Colors.white,
                                  Colors.white,
                                  Colors.transparent,
                                ],
                                stops: [0.0, 0.65, 1.0],
                              ).createShader(rect);
                            },
                            blendMode: BlendMode.dstIn,
                            child: _buildPhotoImage(cacheWidth: 380),
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
                          offset: Offset(8 - _curY * 40, 8 + _curX * 40),
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
                  if ((_holding || _settle.isAnimating || widget.manualTiltX != null || widget.manualTiltY != null) &&
                      (_curX != 0 || _curY != 0))
                    Positioned.fill(
                      child: IgnorePointer(
                        child: Container(
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              begin: Alignment(
                                (-_curY / _maxTilt) - 0.9,
                                (_curX / _maxTilt) - 0.9,
                              ),
                              end: Alignment(
                                (-_curY / _maxTilt) + 0.9,
                                (_curX / _maxTilt) + 0.9,
                              ),
                              colors: [
                                c.onPhoto.withValues(alpha: 0),
                                // Brillo especular: la opacidad sale de la
                                // inclinacion, no es una veladura del tema.
                                c.onPhoto.withValues(
                                  alpha: 0.10 * (_curX.abs() + _curY.abs()) / _maxTilt,
                                ),
                                c.onPhoto.withValues(alpha: 0),
                              ],
                              stops: const [0.32, 0.5, 0.68],
                            ),
                          ),
                        ),
                      ),
                    ),

                  // 5. Borde metálico de la carta con el mismo estilo y foil
                  // que la pastilla de OVR: degradado del tier + CardFoil reactivo.
                  Positioned.fill(
                    child: IgnorePointer(
                      child: ClipPath(
                        clipper: _CardBorderRingClipper(borderWidth),
                        child: Stack(
                          children: [
                            Positioned.fill(
                              child: DecoratedBox(
                                decoration: BoxDecoration(
                                  gradient: borderGradient,
                                ),
                              ),
                            ),
                            Positioned.fill(
                              child: CardFoil(
                                tier: tier,
                                tiltX: _curX / _maxTilt,
                                tiltY: _curY / _maxTilt,
                                seed: (player.id.hashCode % 1000) / 1000.0 * 6.28,
                              ),
                            ),
                          ],
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
                                color: c.textPrimary,
                                letterSpacing: 0.5,
                              ).copyWith(
                                shadows: [
                                  Shadow(
                                    color: Colors.black.withValues(alpha: 0.8),
                                    blurRadius: 4,
                                    offset: const Offset(0, 1),
                                  ),
                                ],
                              ),
                            ),

                            // OVR protagónico en blanco y más grande
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.end,
                              children: [
                                Text(
                                  '${player.ovr}',
                                  style: AppTypography.sportNumber(
                                    size: 38,
                                    color: c.textPrimary,
                                  ).copyWith(
                                    height: 0.92,
                                    shadows: [
                                      Shadow(
                                        color: Colors.black.withValues(alpha: 0.9),
                                        blurRadius: 6,
                                        offset: const Offset(0, 1),
                                      ),
                                    ],
                                  ),
                                ),
                                const SizedBox(height: 2),
                                _ovrBadge(c, tier, avatarBorderColor, player.id),
                              ],
                            ),
                          ],
                        ),

                        // Avatar Circular — 96x96 con aro y glow del Tier (si circular)
                        // O espacio libre para la foto en la mitad superior (si halfTop)
                        if (widget.photoStyle == CardPhotoStyle.circular)
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
                                  child: _buildPhotoImage(cacheWidth: 288),
                                ),
                              ),
                            ],
                          )
                        else
                          const SizedBox(height: 50),

                        // Nombre del Jugador — siempre en mayúsculas y más protagónico
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 4),
                          child: Text(
                            player.name.toUpperCase(),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            textAlign: TextAlign.center,
                            style: AppTypography.headline(
                              size: 15,
                              weight: FontWeight.w800,
                              color: c.textPrimary,
                              letterSpacing: 0.6,
                            ).copyWith(
                              shadows: [
                                Shadow(
                                  color: Colors.black.withValues(alpha: 0.85),
                                  blurRadius: 4,
                                  offset: const Offset(0, 1),
                                ),
                              ],
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
                                  Expanded(child: _attributeBox(c, statsList[0])),
                                  const SizedBox(width: 5),
                                  Expanded(child: _attributeBox(c, statsList[1])),
                                ],
                              ),
                              const SizedBox(height: 4),
                              Row(
                                children: [
                                  Expanded(child: _attributeBox(c, statsList[2])),
                                  const SizedBox(width: 5),
                                  Expanded(child: _attributeBox(c, statsList[3])),
                                ],
                              ),
                              const SizedBox(height: 4),
                              Row(
                                children: [
                                  Expanded(child: _attributeBox(c, statsList[4])),
                                  const SizedBox(width: 5),
                                  Expanded(child: _attributeBox(c, statsList[5])),
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
            );
          },
        ),
      ),
    ),
  ),
),
);
}

  /// La pastilla de "OVR", con el material del tier.
  ///
  /// Entra desde el borde derecho de la carta —redondeada del lado izquierdo,
  /// al ras del lado derecho— porque el OVR vive en esa esquina y una pastilla
  /// flotando en el medio se leería como un botón.
  ///
  /// El relleno es el mismo shader que le da material a la carta
  /// (`CardFoil`), así que el brillo se corre al inclinarla igual que el
  /// fondo: oro pulido, plata cepillada, élite holográfico, bronce mate. Sin
  /// eso sería un rectángulo de color y no se leería como metal.
  ///
  /// Debajo del shader va el color del tier plano con un degradado corto, para
  /// que también se lea como oro o plata **quieta**, no sólo al moverla.
  Widget _ovrBadge(PateaColors c, String tier, Color tierColor, String playerId) {
    // Texto oscuro sobre los metales claros, blanco sobre el bronce. Se
    // decide por luminancia y no por tier para que siga andando si algún día
    // cambian los colores.
    final onMetal =
        tierColor.computeLuminance() > 0.45 ? c.background : c.textPrimary;

    return Transform.translate(
      // Sale del padding del contenido (10) para tocar el borde de la carta.
      offset: const Offset(10, 0),
      child: ClipRRect(
        borderRadius: const BorderRadius.only(
          topLeft: Radius.circular(AppRadii.chip),
          bottomLeft: Radius.circular(AppRadii.chip),
        ),
        child: Stack(
          children: [
            Positioned.fill(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [
                      Color.lerp(tierColor, Colors.white, 0.28)!,
                      tierColor,
                      Color.lerp(tierColor, Colors.black, 0.30)!,
                    ],
                    stops: const [0.0, 0.45, 1.0],
                  ),
                ),
              ),
            ),
            Positioned.fill(
              child: IgnorePointer(
                child: CardFoil(
                  tier: tier,
                  tiltX: _curX / _maxTilt,
                  tiltY: _curY / _maxTilt,
                  seed: (playerId.hashCode % 1000) / 1000.0 * 6.28,
                ),
              ),
            ),
            // Sin Positioned: es este hijo el que le da tamaño al Stack.
            Padding(
              padding: const EdgeInsets.fromLTRB(9, 2.5, 11, 3),
              child: Text(
                'OVR',
                style: AppTypography.code(
                  size: 8.5,
                  weight: FontWeight.w800,
                  color: onMetal,
                ).copyWith(letterSpacing: 0.6),
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// El avatar generado, para los tres casos sin foto: no hay, está cargando,
  /// o falló la descarga.
  Widget get _fallbackAvatar => PlayerAvatarFallback(
        seed: widget.player.id.isNotEmpty ? widget.player.id : widget.player.name,
      );

  Widget _buildPhotoImage({
    required double? cacheWidth,
    BoxFit fit = BoxFit.cover,
    Alignment alignment = Alignment.topCenter,
  }) {
    Widget imageWidget;
    if (widget.assetPhoto != null && widget.assetPhoto!.isNotEmpty) {
      imageWidget = Image.asset(
        widget.assetPhoto!,
        fit: fit,
        alignment: alignment,
        cacheWidth: cacheWidth?.toInt(),
      );
    } else if (widget.localPhoto != null) {
      imageWidget = Image.file(
        widget.localPhoto!,
        fit: fit,
        alignment: alignment,
        cacheWidth: cacheWidth?.toInt(),
      );
    } else if (widget.player.photoUrl != null && widget.player.photoUrl!.isNotEmpty) {
      imageWidget = CachedNetworkImage(
        imageUrl: widget.player.photoUrl!,
        fit: fit,
        alignment: alignment,
        memCacheWidth: cacheWidth?.toInt(),
        maxWidthDiskCache: 512,
        // Mientras carga y si falla: el mismo avatar que cuando no hay foto.
        // Antes eran dos recuadros grises con la inicial, y la transición a
        // la foto real era un salto.
        placeholder: (context, url) => _fallbackAvatar,
        errorWidget: (context, url, error) => _fallbackAvatar,
      );
    } else {
      imageWidget = _fallbackAvatar;
    }

    return Transform.scale(
      scale: widget.player.cropZoom,
      alignment: Alignment(
        (widget.player.cropX / 50) - 1,
        (widget.player.cropY / 50) - 1,
      ),
      child: imageWidget,
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
  Widget _attributeBox(PateaColors c, Map<String, dynamic> stat) {
    final key = stat['key'] as String;
    final label = stat['label'] as String;
    final val = stat['val'] as int;
    final isSorted = widget.highlightStat == key;

    return AnimatedContainer(
      duration: const Duration(milliseconds: 220),
      padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 3),
      decoration: BoxDecoration(
        color: isSorted
            ? c.brandVolt.withValues(alpha: 0.16)
            : c.overlaySubtle,
        borderRadius: AppRadii.hairAll,
        border: Border.all(
          color: isSorted
              ? c.brandVolt.withValues(alpha: 0.65)
              : c.overlayLine,
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
                    ? c.primary
                    : c.textSecondary,
              ),
            ),
          ),
          const SizedBox(width: 3),

          // Mini Barra de Progreso
          Expanded(
            child: ClipRRect(
              borderRadius: AppRadii.hairAll,
              child: Container(
                height: 3.5,
                color: c.overlayLine,
                child: FractionallySizedBox(
                  alignment: Alignment.centerLeft,
                  widthFactor: (val / 99.0).clamp(0.05, 1.0),
                  child: Container(
                    decoration: BoxDecoration(
                      color: isSorted
                          ? c.brandVolt.withValues(alpha: 0.75)
                          : c.textSecondary.withValues(alpha: 0.65),
                      borderRadius: AppRadii.hairAll,
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
              color: c.textPrimary,
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
        const Radius.circular(PlayerCardWidget.cardRadius),
      ));
  }

  @override
  bool shouldReclip(covariant CustomClipper<Path> oldClipper) => false;
}

/// Clipper que aísla exactamente el anillo perimetral de la carta
/// para estamparle el CardFoil shader y degradado metálico idéntico al OVR.
class _CardBorderRingClipper extends CustomClipper<Path> {
  final double borderWidth;
  const _CardBorderRingClipper(this.borderWidth);

  @override
  Path getClip(Size size) {
    // El rectángulo exterior se expande levemente (1 px) para que la silueta
    // exterior la defina de forma unificada _CardClipper en el borde de la carta,
    // garantizando que el metal cubra hasta el último subpixel del perímetro
    // sin que el fondo de la carta asome por ningún vértice.
    final outer = RRect.fromRectAndRadius(
      Rect.fromLTWH(-1, -1, size.width + 2, size.height + 2),
      const Radius.circular(PlayerCardWidget.cardRadius + 1),
    );
    final inner = RRect.fromRectAndRadius(
      (Offset.zero & size).deflate(borderWidth),
      Radius.circular((PlayerCardWidget.cardRadius - borderWidth).clamp(0.0, PlayerCardWidget.cardRadius)),
    );
    return Path()
      ..addRRect(outer)
      ..addRRect(inner)
      ..fillType = PathFillType.evenOdd;
  }

  @override
  bool shouldReclip(_CardBorderRingClipper oldClipper) =>
      oldClipper.borderWidth != borderWidth;
}
