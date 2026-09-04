import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../services/auth_service.dart';
import '../services/firestore_service.dart';
import '../services/push_permission.dart';
import '../theme/app_colors.dart';
import '../theme/app_radii.dart';
import '../theme/app_typography.dart';

/// Menú de usuario, port de `src/components/nav/user-menu.tsx`.
///
/// La web es un dropdown de 264px: una etiqueta con nombre y correo, y filas
/// planas de ícono + texto. Acá había una tarjeta de perfil con borde adentro
/// de la hoja, y adentro de esa tarjeta tres cajas más (aro del avatar, badge
/// de posición, píldora de OVR), cada una con su propio radio; más seis filas
/// con cuadradito de ícono, subtítulo y chevron. Cuatro niveles de caja para
/// mostrar un nombre.
///
/// Ahora la identidad va apoyada directo sobre la hoja y las filas son ícono +
/// etiqueta, como la web.
///
/// Faltan **Logros** y **Configuración**, que la web sí tiene: no existen
/// `/achievements` ni `/settings` en el router del móvil todavía. Y falta el
/// selector de tema, que no aplica: la app tiene un solo tema.
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
    final player = uid.isNotEmpty ? ref.watch(singlePlayerStreamProvider(uid)).value : null;

    final displayName = player?.name ?? currentUser?.displayName ?? 'Jugador';
    final email = currentUser?.email ?? '';
    final position = player?.position;
    final ovr = player?.ovr;
    final photoUrl = player?.photoUrl ?? currentUser?.photoURL;

    return Container(
      decoration: BoxDecoration(
        color: AppColors.popover,
        borderRadius: AppRadii.surfaceTop,
        border: Border(
          top: BorderSide(color: Colors.white.withValues(alpha: 0.15), width: 1),
        ),
      ),
      padding: const EdgeInsets.fromLTRB(12, 12, 12, 24),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
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

            // Identidad, sin tarjeta: es el equivalente del `DropdownMenuLabel`.
            Padding(
              padding: const EdgeInsets.fromLTRB(10, 0, 10, 18),
              child: Row(
                children: [
                  _Avatar(photoUrl: photoUrl, name: displayName),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          displayName,
                          style: AppTypography.headline(
                            size: 16,
                            weight: FontWeight.w900,
                            color: AppColors.textPrimary,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        if (email.isNotEmpty)
                          Text(
                            email,
                            style: AppTypography.body(size: 12, color: AppColors.textSecondary),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        // Posición como texto de color, igual que en el header
                        // y que el `textOnly` de la web. Antes era un badge
                        // con fondo y borde: el mismo dato pintado de dos
                        // formas distintas según dónde lo miraras.
                        if (position != null) ...[
                          const SizedBox(height: 3),
                          Text(
                            position.toUpperCase(),
                            style: AppTypography.headline(
                              size: 10,
                              weight: FontWeight.w800,
                              color: _getPositionColor(position),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),

                  // El OVR es lo único que lleva el color del tier. Antes era
                  // volt para todos, mientras el panel pintaba por tier: dos
                  // reglas de color para el mismo número.
                  if (ovr != null) ...[
                    const SizedBox(width: 10),
                    _OvrPill(ovr: ovr),
                  ],
                ],
              ),
            ),

            _MenuItem(
              icon: Icons.person_outline_rounded,
              label: 'Mi Perfil',
              onTap: () {
                Navigator.pop(context);
                context.push('/profile');
              },
            ),
            _MenuItem(
              icon: Icons.groups_2_outlined,
              label: 'Gestionar Grupos',
              onTap: () {
                Navigator.pop(context);
                context.push('/groups');
              },
            ),
            // Explorar y Evaluaciones estaban acá también, y las dos son
            // pestañas de la barra de abajo: abrías el menú de usuario para ir
            // a algo que está a un toque de distancia.
            _MenuItem(
              icon: Icons.notifications_active_outlined,
              label: 'Activar Notificaciones',
              onTap: () async {
                final messenger = ScaffoldMessenger.of(context);
                Navigator.pop(context);
                final granted = await PushPermission.requestNow();
                messenger.showSnackBar(
                  SnackBar(
                    content: Text(granted
                        ? 'Listo, te vamos a avisar.'
                        : 'Android tiene las notificaciones bloqueadas para Pateá. '
                            'Se habilitan desde Ajustes › Apps › Pateá › Notificaciones.'),
                    backgroundColor: granted ? AppColors.card : AppColors.destructive,
                    behavior: SnackBarBehavior.floating,
                  ),
                );
              },
            ),

            const SizedBox(height: 8),
            Divider(color: Colors.white.withValues(alpha: 0.10), height: 1),
            const SizedBox(height: 8),

            _MenuItem(
              icon: Icons.logout_rounded,
              label: 'Cerrar sesión',
              color: AppColors.destructive,
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
}

class _Avatar extends StatelessWidget {
  final String? photoUrl;
  final String name;

  const _Avatar({required this.photoUrl, required this.name});

  @override
  Widget build(BuildContext context) {
    final fallback = Container(
      color: AppColors.card,
      child: Center(
        child: Text(
          name.isNotEmpty ? name[0].toUpperCase() : 'P',
          style: AppTypography.headline(
            size: 18,
            weight: FontWeight.w900,
            color: AppColors.voltNeon,
          ),
        ),
      ),
    );

    final url = photoUrl;

    return SizedBox(
      width: 48,
      height: 48,
      child: ClipOval(
        child: url != null && url.isNotEmpty
            ? CachedNetworkImage(
                imageUrl: url,
                fit: BoxFit.cover,
                memCacheWidth: 192,
                maxWidthDiskCache: 384,
                placeholder: (context, url) => fallback,
                errorWidget: (context, url, error) => fallback,
              )
            : fallback,
      ),
    );
  }
}

class _OvrPill extends StatelessWidget {
  final int ovr;

  const _OvrPill({required this.ovr});

  @override
  Widget build(BuildContext context) {
    final tier = AppColors.getOvrBorderColor(ovr);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: tier.withValues(alpha: 0.12),
        borderRadius: AppRadii.chipAll,
        border: Border.all(color: tier.withValues(alpha: 0.35)),
      ),
      child: Text(
        '$ovr',
        style: AppTypography.headline(size: 16, weight: FontWeight.w900, color: tier),
      ),
    );
  }
}

class _MenuItem extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color? color;
  final VoidCallback onTap;

  const _MenuItem({
    required this.icon,
    required this.label,
    this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    // El ícono va suelto, del color del texto, como en la web. El cuadradito
    // teñido de 38x38 que tenía antes convertía cada fila en otra caja.
    final tint = color ?? AppColors.textPrimary;

    return InkWell(
      onTap: onTap,
      borderRadius: AppRadii.cardAll,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 14),
        child: Row(
          children: [
            Icon(icon, size: 20, color: color ?? AppColors.textSecondary),
            const SizedBox(width: 14),
            Text(
              label,
              style: AppTypography.headline(size: 14, weight: FontWeight.w700, color: tint),
            ),
          ],
        ),
      ),
    );
  }
}
