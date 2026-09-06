/// La foto de un jugador. Una sola forma de dibujarla.
///
/// Había tres. `PlayerAvatarFallback` —el diseño real, cuatro maniquíes por
/// diez duotonos— se usaba en 3 archivos; `CachedNetworkImage` en otros 3; y
/// en **14 pantallas** había un `CircleAvatar` con `NetworkImage` crudo, que
/// no cachea nada: la misma cara se vuelve a bajar de la red en cada scroll, y
/// cuando no hay foto queda un círculo gris en vez del maniquí.
///
/// Ver `docs/technical/AUDITORIA_DE_ESTILOS_Y_MODO_CLARO.md`.
library;

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../theme/patea_colors.dart';
import 'player_avatar_fallback.dart';

class PateaAvatar extends StatelessWidget {
  /// La URL de la foto. Si es nula o vacía, se dibuja el maniquí.
  final String? photoUrl;

  /// Con qué se elige el maniquí y su duotono: el id del jugador, o el nombre
  /// si no hay id. Tiene que ser estable, o la misma persona cambia de cara
  /// entre pantallas.
  final String seed;

  /// Diámetro. El default es el de una fila de lista.
  final double size;

  /// Un borde, para las cartas y los rosters que lo usan como acento.
  final Color? borderColor;
  final double borderWidth;

  const PateaAvatar({
    super.key,
    required this.photoUrl,
    required this.seed,
    this.size = 40,
    this.borderColor,
    this.borderWidth = 1.5,
  });

  @override
  Widget build(BuildContext context) {
    final tieneFoto = photoUrl != null && photoUrl!.isNotEmpty;

    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: context.c.cardSurface,
        border: borderColor == null
            ? null
            : Border.all(color: borderColor!, width: borderWidth),
      ),
      clipBehavior: Clip.antiAlias,
      child: tieneFoto
          ? CachedNetworkImage(
              imageUrl: photoUrl!,
              fit: BoxFit.cover,
              // Pedir la imagen al tamaño en que se va a ver. Sin esto una
              // foto de perfil de 1200px se decodifica entera para mostrarse
              // en 40, y eso se paga en memoria por cada fila de la lista.
              memCacheWidth: (size * MediaQuery.devicePixelRatioOf(context))
                  .round()
                  .clamp(48, 512),
              placeholder: (_, _) => _fallback,
              errorWidget: (_, _, _) => _fallback,
            )
          : _fallback,
    );
  }

  Widget get _fallback => PlayerAvatarFallback(seed: seed);
}
