import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../services/auth_service.dart';
import '../services/firestore_service.dart';
import '../theme/app_colors.dart';
import '../theme/app_typography.dart';

/// Hoja de Menú de Usuario (port de src/components/nav/user-menu.tsx)
class PateaUserMenuSheet extends ConsumerWidget {
  const PateaUserMenuSheet({super.key});

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
    final player = ref.watch(singlePlayerStreamProvider(uid)).value;

    final displayName = player?.name ?? currentUser?.displayName ?? 'Jugador';
    final email = currentUser?.email ?? '';
    final position = player?.position ?? 'DEL';
    final ovr = player?.ovr ?? 50;
    final photoUrl = player?.photoUrl ?? currentUser?.photoURL;
    final posColor = _getPositionColor(position);

    return Container(
      decoration: BoxDecoration(
        color: const Color(0xF20F1624),
        borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
        border: Border(
          top: BorderSide(color: Colors.white.withValues(alpha: 0.15), width: 1),
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.6),
            blurRadius: 32,
            offset: const Offset(0, -8),
          ),
        ],
      ),
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Barra de agarre
            Center(
              child: Container(
                width: 44,
                height: 4,
                margin: const EdgeInsets.only(bottom: 20),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.25),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),

            // Cabecera de perfil
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: const Color(0xFF162032),
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: Colors.white.withValues(alpha: 0.1), width: 1),
              ),
              child: Row(
                children: [
                  // Avatar con aro
                  Container(
                    width: 50,
                    height: 50,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      border: Border.all(color: AppColors.voltNeon, width: 2),
                    ),
                    child: ClipOval(
                      child: photoUrl != null && photoUrl.isNotEmpty
                          ? CachedNetworkImage(
                              imageUrl: photoUrl,
                              fit: BoxFit.cover,
                              memCacheWidth: 192,
                              maxWidthDiskCache: 384,
                              errorWidget: (context, url, error) => _initialsAvatar(displayName),
                            )
                          : _initialsAvatar(displayName),
                    ),
                  ),
                  const SizedBox(width: 14),

                  // Nombre y Posición
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Flexible(
                              child: Text(
                                displayName,
                                style: AppTypography.headline(
                                  size: 16,
                                  weight: FontWeight.w900,
                                  color: AppColors.textPrimary,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                            const SizedBox(width: 8),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: posColor.withValues(alpha: 0.18),
                                borderRadius: BorderRadius.circular(6),
                                border: Border.all(color: posColor.withValues(alpha: 0.4)),
                              ),
                              child: Text(
                                position,
                                style: AppTypography.headline(
                                  size: 10,
                                  weight: FontWeight.w800,
                                  color: posColor,
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 2),
                        Text(
                          email,
                          style: AppTypography.body(
                            size: 12,
                            color: AppColors.textSecondary,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ),
                  ),

                  // Píldora OVR
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    decoration: BoxDecoration(
                      color: AppColors.voltNeon.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: AppColors.voltNeon.withValues(alpha: 0.3)),
                    ),
                    child: Column(
                      children: [
                        Text(
                          '$ovr',
                          style: AppTypography.headline(
                            size: 16,
                            weight: FontWeight.w900,
                            color: AppColors.voltNeon,
                          ),
                        ),
                        Text(
                          'OVR',
                          style: AppTypography.body(
                            size: 9,
                            weight: FontWeight.w700,
                            color: AppColors.textMuted,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // Opciones del Menú
            _MenuItem(
              icon: Icons.person_outline_rounded,
              title: 'Mi Perfil de Jugador',
              subtitle: 'Ver atributos, carta FIFA y progresión',
              onTap: () {
                Navigator.pop(context);
                if (uid.isNotEmpty) {
                  context.push('/players/$uid');
                }
              },
            ),
            _MenuItem(
              icon: Icons.groups_2_outlined,
              title: 'Mis Grupos',
              subtitle: 'Equipos, historial y código de invitación',
              onTap: () {
                Navigator.pop(context);
                context.push('/groups');
              },
            ),
            _MenuItem(
              icon: Icons.explore_outlined,
              title: 'Explorar Mercado y Partidos',
              subtitle: 'Buscar jugadores libres y partidos abiertos',
              onTap: () {
                Navigator.pop(context);
                context.go('/explorar');
              },
            ),
            _MenuItem(
              icon: Icons.rate_review_outlined,
              title: 'Bandeja de Evaluaciones',
              subtitle: 'Puntuar compañeros de tus últimos partidos',
              onTap: () {
                Navigator.pop(context);
                context.go('/evaluations');
              },
            ),

            const SizedBox(height: 10),
            Divider(color: Colors.white.withValues(alpha: 0.1), height: 1),
            const SizedBox(height: 10),

            // Cerrar Sesión
            _MenuItem(
              icon: Icons.logout_rounded,
              title: 'Cerrar Sesión',
              titleColor: AppColors.destructive,
              iconColor: AppColors.destructive,
              onTap: () async {
                Navigator.pop(context);
                await ref.read(authServiceProvider).signOut();
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _initialsAvatar(String name) {
    final initial = name.isNotEmpty ? name[0].toUpperCase() : 'P';
    return Container(
      color: const Color(0xFF1E293B),
      child: Center(
        child: Text(
          initial,
          style: AppTypography.headline(
            size: 18,
            weight: FontWeight.w900,
            color: AppColors.voltNeon,
          ),
        ),
      ),
    );
  }
}

class _MenuItem extends StatelessWidget {
  final IconData icon;
  final String title;
  final String? subtitle;
  final Color? titleColor;
  final Color? iconColor;
  final VoidCallback onTap;

  const _MenuItem({
    required this.icon,
    required this.title,
    this.subtitle,
    this.titleColor,
    this.iconColor,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
        child: Row(
          children: [
            Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                color: (iconColor ?? AppColors.textSecondary).withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(
                icon,
                size: 20,
                color: iconColor ?? AppColors.voltNeon,
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: AppTypography.headline(
                      size: 14,
                      weight: FontWeight.w700,
                      color: titleColor ?? AppColors.textPrimary,
                    ),
                  ),
                  if (subtitle != null) ...[
                    const SizedBox(height: 2),
                    Text(
                      subtitle!,
                      style: AppTypography.body(
                        size: 11,
                        color: AppColors.textMuted,
                      ),
                    ),
                  ],
                ],
              ),
            ),
            Icon(
              Icons.chevron_right_rounded,
              size: 18,
              color: Colors.white.withValues(alpha: 0.3),
            ),
          ],
        ),
      ),
    );
  }
}
