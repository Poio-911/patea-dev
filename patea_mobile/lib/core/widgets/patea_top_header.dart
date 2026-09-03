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

/// Barra Superior idéntica a Header de la webapp (src/components/nav/header.tsx)
/// Con efecto Glassmorphism (BackdropFilter), datos en vivo y acciones funcionales.
class PateaTopHeader extends ConsumerWidget implements PreferredSizeWidget {
  final String? overrideUserName;
  final String? overrideUserPosition;
  final String? overrideUserPhotoUrl;
  final VoidCallback? onHelpTap;
  final VoidCallback? onInvitationsTap;
  final VoidCallback? onNotificationsTap;
  final VoidCallback? onProfileTap;

  const PateaTopHeader({
    super.key,
    this.overrideUserName,
    this.overrideUserPosition,
    this.overrideUserPhotoUrl,
    this.onHelpTap,
    this.onInvitationsTap,
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

    final userName = overrideUserName ??
        player?.name.split(' ').first ??
        currentUser?.displayName?.split(' ').first ??
        'Briseida';

    final userPosition = overrideUserPosition ??
        player?.position ??
        'DEL';

    final userPhotoUrl = overrideUserPhotoUrl ??
        player?.photoUrl ??
        currentUser?.photoURL;

    final posColor = _getPositionColor(userPosition);

    return ClipRect(
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 18, sigmaY: 18),
        child: Container(
          decoration: BoxDecoration(
            color: const Color(0xB3090E17), // 70% dark carbon glass
            border: Border(
              bottom: BorderSide(
                color: Colors.white.withValues(alpha: 0.12),
                width: 1,
              ),
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.35),
                blurRadius: 16,
                offset: const Offset(0, 4),
              ),
            ],
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
                    // 1. Logo del futbolista corriendo en Amarillo Neón
                    InkWell(
                      onTap: () => context.go('/'),
                      borderRadius: BorderRadius.circular(8),
                      child: const Padding(
                        padding: EdgeInsets.all(4.0),
                        child: SoccerRunnerIcon(size: 28, color: AppColors.voltNeon),
                      ),
                    ),

                    // 2. Acciones e Información de Usuario
                    Row(
                      children: [
                        // Botón de Ayuda (?) -> Abre HelpDialog
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

                        // Botón de Invitaciones (Mail) -> Navega a Explorar / Invitaciones
                        IconButton(
                          icon: const Icon(
                            Icons.mail_outline_rounded,
                            size: 20,
                            color: AppColors.textSecondary,
                          ),
                          onPressed: onInvitationsTap ??
                              () {
                                context.go('/explorar');
                              },
                          visualDensity: VisualDensity.compact,
                          splashRadius: 18,
                        ),

                        // Botón de Notificaciones (Bell) -> Abre NotificationsSheet
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

                        const SizedBox(width: 4),

                        // Píldora del Usuario -> Abre UserMenuSheet
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
                                Column(
                                  crossAxisAlignment: CrossAxisAlignment.end,
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Text(
                                      userName,
                                      style: AppTypography.headline(
                                        size: 13,
                                        weight: FontWeight.w800,
                                        color: AppColors.textPrimary,
                                      ),
                                    ),
                                    Text(
                                      userPosition,
                                      style: AppTypography.headline(
                                        size: 10,
                                        weight: FontWeight.w800,
                                        color: posColor,
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(width: 8),

                                // Avatar Circular
                                Container(
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
                                    child: userPhotoUrl != null && userPhotoUrl.isNotEmpty
                                        ? CachedNetworkImage(
                                            imageUrl: userPhotoUrl,
                                            fit: BoxFit.cover,
                                            memCacheWidth: 128,
                                            maxWidthDiskCache: 256,
                                            placeholder: (context, url) => Container(
                                              color: const Color(0xFF1E293B),
                                              child: Center(
                                                child: Text(
                                                  userName.isNotEmpty ? userName[0].toUpperCase() : 'P',
                                                  style: AppTypography.headline(
                                                    size: 14,
                                                    weight: FontWeight.w800,
                                                    color: AppColors.voltNeon,
                                                  ),
                                                ),
                                              ),
                                            ),
                                            errorWidget: (context, url, error) => Container(
                                              color: const Color(0xFF1E293B),
                                              child: Center(
                                                child: Text(
                                                  userName.isNotEmpty ? userName[0].toUpperCase() : 'P',
                                                  style: AppTypography.headline(
                                                    size: 14,
                                                    weight: FontWeight.w800,
                                                    color: AppColors.voltNeon,
                                                  ),
                                                ),
                                              ),
                                            ),
                                          )
                                        : Container(
                                            color: const Color(0xFF1E293B),
                                            child: Center(
                                              child: Text(
                                                userName.isNotEmpty ? userName[0].toUpperCase() : 'P',
                                                style: AppTypography.headline(
                                                  size: 14,
                                                  weight: FontWeight.w800,
                                                  color: AppColors.voltNeon,
                                                ),
                                              ),
                                            ),
                                          ),
                                  ),
                                ),

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
