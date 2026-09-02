import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../theme/app_colors.dart';
import '../theme/app_typography.dart';
import 'soccer_runner_icon.dart';

class PateaTopHeader extends StatelessWidget implements PreferredSizeWidget {
  final String userName;
  final String userPosition;
  final String? userPhotoUrl;
  final VoidCallback? onHelpTap;
  final VoidCallback? onInvitationsTap;
  final VoidCallback? onNotificationsTap;
  final VoidCallback? onProfileTap;

  const PateaTopHeader({
    super.key,
    this.userName = 'Briseida',
    this.userPosition = 'DEL',
    this.userPhotoUrl,
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
  Widget build(BuildContext context) {
    final posColor = _getPositionColor(userPosition);

    return Container(
      height: 60,
      decoration: BoxDecoration(
        color: const Color(0xCC0D121B),
        border: Border(
          bottom: BorderSide(
            color: AppColors.border.withValues(alpha: 0.35),
            width: 1,
          ),
        ),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 14),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          // 1. Logo del jugador corriendo en Amarillo Neón
          Row(
            children: const [
              SoccerRunnerIcon(size: 28, color: AppColors.voltNeon),
            ],
          ),

          // 2. Acciones e Información de Usuario
          Row(
            children: [
              // Botón de Ayuda (?)
              IconButton(
                icon: const Icon(Icons.help_outline_rounded, size: 20, color: AppColors.textSecondary),
                onPressed: onHelpTap,
                visualDensity: VisualDensity.compact,
                splashRadius: 18,
              ),

              // Botón de Invitaciones (Mail)
              IconButton(
                icon: const Icon(Icons.mail_outline_rounded, size: 20, color: AppColors.textSecondary),
                onPressed: onInvitationsTap,
                visualDensity: VisualDensity.compact,
                splashRadius: 18,
              ),

              // Botón de Notificaciones (Bell)
              IconButton(
                icon: const Icon(Icons.notifications_none_rounded, size: 20, color: AppColors.textSecondary),
                onPressed: onNotificationsTap,
                visualDensity: VisualDensity.compact,
                splashRadius: 18,
              ),

              const SizedBox(width: 4),

              // Píldora del Usuario
              InkWell(
                onTap: onProfileTap,
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

                      // Avatar Circular con borde fino
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
                          child: userPhotoUrl != null && userPhotoUrl!.isNotEmpty
                              ? CachedNetworkImage(
                                  imageUrl: userPhotoUrl!,
                                  fit: BoxFit.cover,
                                  placeholder: (context, url) => Container(
                                    color: const Color(0xFF1E293B),
                                    child: Center(
                                      child: Text(
                                        userName.isNotEmpty ? userName[0] : 'U',
                                        style: const TextStyle(fontWeight: FontWeight.w800, color: Colors.white70),
                                      ),
                                    ),
                                  ),
                                  errorWidget: (context, url, error) => Container(
                                    color: const Color(0xFF1E293B),
                                    child: Center(
                                      child: Text(
                                        userName.isNotEmpty ? userName[0] : 'U',
                                        style: const TextStyle(fontWeight: FontWeight.w800, color: Colors.white70),
                                      ),
                                    ),
                                  ),
                                )
                              : Container(
                                  color: const Color(0xFF1E293B),
                                  child: Center(
                                    child: Text(
                                      userName.isNotEmpty ? userName[0] : 'U',
                                      style: const TextStyle(fontWeight: FontWeight.w800, color: Colors.white70),
                                    ),
                                  ),
                                ),
                        ),
                      ),
                      const SizedBox(width: 4),
                      const Icon(Icons.keyboard_arrow_down_rounded, size: 16, color: AppColors.textMuted),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
