import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../services/auth_service.dart';
import '../services/firestore_service.dart';
import '../theme/app_colors.dart';
import '../theme/app_typography.dart';
import 'soccer_runner_icon.dart';
import 'patea_help_dialog.dart';
import 'patea_user_menu_sheet.dart';
import 'patea_notifications_sheet.dart';

/// Barra superior, port de `src/components/nav/header.tsx`.
///
/// Se replica lo que la web muestra **en teléfono**, no en escritorio: allá el
/// círculo de OVR, el separador y el nombre completo están detrás de `hidden
/// sm:*`, así que en un celular no existen. Lo que sí se ve en mobile es el
/// nombre de pila más la posición abreviada, y eso es lo que hay acá.
///
/// Lo único que la web hace y acá no: en pantallas chicas el nombre aparece 4
/// segundos y se esconde 15, en loop, para liberar ancho. Se dejó fijo a
/// propósito — el loop distrae más de lo que ahorra.
class PateaTopHeader extends ConsumerWidget implements PreferredSizeWidget {
  final String? overrideUserName;
  final String? overrideUserPosition;
  final String? overrideUserPhotoUrl;
  final VoidCallback? onHelpTap;
  final VoidCallback? onNotificationsTap;
  final VoidCallback? onProfileTap;

  const PateaTopHeader({
    super.key,
    this.overrideUserName,
    this.overrideUserPosition,
    this.overrideUserPhotoUrl,
    this.onHelpTap,
    this.onNotificationsTap,
    this.onProfileTap,
  });

  @override
  Size get preferredSize => const Size.fromHeight(60);

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

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final currentUser = ref.watch(authStateProvider).value;
    final uid = currentUser?.uid ?? '';
    final player = uid.isNotEmpty
        ? ref.watch(singlePlayerStreamProvider(uid)).value
        : null;

    // La web dibuja el bloque de identidad sólo si hay jugador cargado
    // (`{player && (...)}`). Acá el fallback era el literal 'Briseida', el
    // nombre de la cuenta de prueba: cualquier usuario veía ese nombre
    // mientras su documento no había llegado. Ahora, sin jugador, no se
    // dibuja nada — queda el avatar, que es el disparador del menú.
    final firstName = overrideUserName ??
        player?.name.split(' ').first ??
        currentUser?.displayName?.split(' ').first;

    final userPosition = overrideUserPosition ?? player?.position;
    final userPhotoUrl = overrideUserPhotoUrl ?? player?.photoUrl ?? currentUser?.photoURL;
    final initial = (firstName != null && firstName.isNotEmpty)
        ? firstName[0].toUpperCase()
        : 'P';

    final unread = ref.watch(unreadNotificationsCountProvider).value ?? 0;

    return ClipRect(
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 18, sigmaY: 18),
        child: Container(
          decoration: BoxDecoration(
            // `bg-card/40` en la web. Estaba al 70% sobre un negro casi puro,
            // y por eso el desenfoque no se notaba: el vidrio tapaba lo que
            // tenía que dejar pasar. El blur se ve cuando baja la opacidad,
            // no cuando sube el sigma.
            color: AppColors.card.withValues(alpha: 0.40),
            border: Border(
              bottom: BorderSide(
                color: Colors.white.withValues(alpha: 0.12),
                width: 1,
              ),
            ),
          ),
          child: SafeArea(
            bottom: false,
            child: SizedBox(
              height: 60,
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 14),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    // Logo
                    InkWell(
                      onTap: () => context.go('/'),
                      borderRadius: BorderRadius.circular(8),
                      child: const Padding(
                        padding: EdgeInsets.all(4.0),
                        child: SoccerRunnerIcon(size: 28, color: AppColors.voltNeon),
                      ),
                    ),

                    Row(
                      children: [
                        // Ayuda
                        IconButton(
                          icon: const Icon(
                            Icons.help_outline_rounded,
                            size: 20,
                            color: AppColors.textSecondary,
                          ),
                          onPressed: onHelpTap ??
                              () {
                                showDialog(
                                  context: context,
                                  builder: (_) => const PateaHelpDialog(),
                                );
                              },
                          visualDensity: VisualDensity.compact,
                          splashRadius: 18,
                        ),

                        // Notificaciones, con el punto de no leídas que la web
                        // tiene en `NotificationBell` y acá nunca se dibujó.
                        //
                        // Al lado iba un sobre de invitaciones. Se sacó: en la
                        // web abre `/invitations`, una ruta que en el móvil no
                        // existe, así que apuntaba a `/explorar` y no mostraba
                        // el contador. Y sobra: las invitaciones a partido
                        // llegan como notificación (`on-invitation-create.ts`
                        // escribe una con `type: 'match_invite'`), o sea que
                        // ya salen por esta campana.
                        Stack(
                          clipBehavior: Clip.none,
                          children: [
                            IconButton(
                              icon: const Icon(
                                Icons.notifications_none_rounded,
                                size: 20,
                                color: AppColors.textSecondary,
                              ),
                              onPressed: onNotificationsTap ??
                                  () {
                                    showModalBottomSheet(
                                      context: context,
                                      backgroundColor: Colors.transparent,
                                      isScrollControlled: true,
                                      builder: (_) => const PateaNotificationsSheet(),
                                    );
                                  },
                              visualDensity: VisualDensity.compact,
                              splashRadius: 18,
                            ),
                            if (unread > 0)
                              Positioned(
                                top: 6,
                                right: 6,
                                child: IgnorePointer(
                                  child: Container(
                                    width: 10,
                                    height: 10,
                                    decoration: BoxDecoration(
                                      color: AppColors.voltNeon,
                                      shape: BoxShape.circle,
                                      border: Border.all(
                                        color: AppColors.background,
                                        width: 1.5,
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                          ],
                        ),

                        const SizedBox(width: 4),

                        // Identidad -> abre el menú de usuario
                        InkWell(
                          onTap: onProfileTap ??
                              () {
                                showModalBottomSheet(
                                  context: context,
                                  backgroundColor: Colors.transparent,
                                  isScrollControlled: true,
                                  builder: (_) => const PateaUserMenuSheet(),
                                );
                              },
                          borderRadius: BorderRadius.circular(20),
                          child: Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                            child: Row(
                              children: [
                                if (firstName != null) ...[
                                  Column(
                                    crossAxisAlignment: CrossAxisAlignment.end,
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      Text(
                                        firstName,
                                        style: AppTypography.headline(
                                          size: 13,
                                          weight: FontWeight.w800,
                                          color: AppColors.textPrimary,
                                        ),
                                      ),
                                      // La web usa `PlayerPositionBadge` con
                                      // `textOnly`: texto de color, sin caja.
                                      if (userPosition != null)
                                        Text(
                                          userPosition.toUpperCase(),
                                          style: AppTypography.headline(
                                            size: 10,
                                            weight: FontWeight.w800,
                                            color: _getPositionColor(userPosition),
                                          ),
                                        ),
                                    ],
                                  ),
                                  const SizedBox(width: 8),
                                ],

                                _Avatar(photoUrl: userPhotoUrl, initial: initial),

                                const SizedBox(width: 3),
                                const Icon(
                                  Icons.keyboard_arrow_down_rounded,
                                  size: 15,
                                  color: AppColors.textSecondary,
                                ),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Avatar del header. Estaba escrito tres veces seguidas —placeholder, error y
/// caso sin foto— con el mismo `Container` de relleno copiado en cada rama.
class _Avatar extends StatelessWidget {
  final String? photoUrl;
  final String initial;

  const _Avatar({required this.photoUrl, required this.initial});

  Widget get _fallback => Container(
        color: AppColors.card,
        child: Center(
          child: Text(
            initial,
            style: AppTypography.headline(
              size: 14,
              weight: FontWeight.w800,
              color: AppColors.voltNeon,
            ),
          ),
        ),
      );

  @override
  Widget build(BuildContext context) {
    final url = photoUrl;

    return Container(
      width: 36,
      height: 36,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(
          color: Colors.white.withValues(alpha: 0.25),
          width: 1.5,
        ),
      ),
      child: ClipOval(
        child: url != null && url.isNotEmpty
            ? CachedNetworkImage(
                imageUrl: url,
                fit: BoxFit.cover,
                memCacheWidth: 128,
                maxWidthDiskCache: 256,
                placeholder: (context, url) => _fallback,
                errorWidget: (context, url, error) => _fallback,
              )
            : _fallback,
      ),
    );
  }
}
