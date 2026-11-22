import 'package:flutter/foundation.dart';
import 'patea_snack.dart';
import '../theme/theme_mode_provider.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../services/auth_service.dart';
import '../services/firestore_service.dart';
import '../services/messages_service.dart';
import '../services/push_permission.dart';
import '../theme/patea_colors.dart';
import '../theme/app_radii.dart';
import '../theme/app_typography.dart';
import '../utils/photo_url.dart';
import 'cropped_photo.dart';

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
/// `/achievements` ni `/settings` en el router del móvil todavía.
class PateaUserMenuSheet extends ConsumerWidget {
  const PateaUserMenuSheet({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final currentUser = ref.watch(authStateProvider).value;
    final uid = currentUser?.uid ?? '';
    final player = uid.isNotEmpty ? ref.watch(singlePlayerStreamProvider(uid)).value : null;

    final displayName = player?.name ?? currentUser?.displayName ?? 'Jugador';
    final email = currentUser?.email ?? '';
    final position = player?.position;
    final ovr = player?.ovr;
    final photoUrl =
        nonEmptyPhotoUrl(player?.photoUrl) ??
        ref.watch(currentAuthPhotoUrlProvider);

    return Container(
      decoration: BoxDecoration(
        color: context.c.popover,
        borderRadius: AppRadii.surfaceTop,
        border: Border(
          top: BorderSide(color: context.c.overlayLine, width: 1),
        ),
      ),
      padding: const EdgeInsets.fromLTRB(12, 12, 12, 24),
      child: SafeArea(
        top: false,
        child: SingleChildScrollView(
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
                  color: context.c.overlayStrong,
                  borderRadius: AppRadii.hairAll,
                ),
              ),
            ),

            // Identidad, sin tarjeta: es el equivalente del `DropdownMenuLabel`.
            Padding(
              padding: const EdgeInsets.fromLTRB(10, 0, 10, 18),
              child: Row(
                children: [
                  _Avatar(
                    photoUrl: photoUrl,
                    name: displayName,
                    cropX: player?.cropX ?? 50,
                    cropY: player?.cropY ?? 50,
                    cropZoom: player?.cropZoom ?? 1,
                  ),
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
                            color: context.c.textPrimary,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        if (email.isNotEmpty)
                          Text(
                            email,
                            style: AppTypography.body(size: 12, color: context.c.textSecondary),
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
                            style: AppTypography.body(
                              size: 12,
                              weight: FontWeight.w600,
                              color: context.c.positionColor(position),
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
            Consumer(
              builder: (context, ref, _) {
                final unread = ref.watch(unreadMessagesCountProvider);
                return _MenuItem(
                  icon: Icons.mark_chat_unread_outlined,
                  label: unread > 0 ? 'Mensajes ($unread)' : 'Mensajes',
                  color: unread > 0 ? context.c.primary : null,
                  onTap: () {
                    Navigator.pop(context);
                    context.push('/messages');
                  },
                );
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
            _MenuItem(
              icon: Icons.leaderboard_outlined,
              label: 'Ranking del plantel',
              onTap: () {
                Navigator.pop(context);
                context.push('/leaderboard');
              },
            ),
            _MenuItem(
              icon: Icons.photo_camera_outlined,
              svgAsset: 'assets/icons/nav-social-community.svg',
              label: 'Comunidad Pateá',
              onTap: () {
                Navigator.pop(context);
                context.push('/social');
              },
            ),
            _MenuItem(
              icon: Icons.sports_soccer_outlined,
              label: 'Mi entrenamiento',
              onTap: () {
                Navigator.pop(context);
                context.push('/coach');
              },
            ),
            // Explorar y Evaluaciones estaban acá también, y las dos son
            // pestañas de la barra de abajo: abrías el menú de usuario para ir
            // a algo que está a un toque de distancia.
            _MenuItem(
              icon: Icons.notifications_active_outlined,
              label: 'Activar Notificaciones',
              onTap: () async {
                // Se captura antes del await: después el contexto puede no
                // valer, y esta hoja además se cierra en el medio.
                final avisar = PateaSnack.of(context);
                Navigator.pop(context);
                final granted = await PushPermission.requestNow();
                if (granted) {
                  avisar.ok('Listo, te vamos a avisar.');
                } else {
                  final isIos = defaultTargetPlatform == TargetPlatform.iOS;
                  avisar.error(
                    isIos
                        ? 'iOS tiene las notificaciones bloqueadas para Pateá. '
                            'Habilitalas desde Configuración › Pateá › Notificaciones.'
                        : 'Android tiene las notificaciones bloqueadas para Pateá. '
                            'Se habilitan desde Ajustes › Apps › Pateá › Notificaciones.',
                  );
                }
              },
            ),

            const SizedBox(height: 8),
            Divider(color: context.c.overlayLine, height: 1),
            const SizedBox(height: 8),

            // El tema. Dos opciones, no tres: ver theme_mode_provider.
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 4, 20, 10),
              child: SegmentedButton<PateaTheme>(
                showSelectedIcon: false,
                segments: [
                  for (final t in PateaTheme.values)
                    ButtonSegment(
                      value: t,
                      icon: Icon(
                        t == PateaTheme.game
                            ? Icons.sports_soccer_rounded
                            : Icons.light_mode_rounded,
                        size: 16,
                      ),
                      label: Text(t.etiqueta),
                    ),
                ],
                selected: {ref.watch(themeControllerProvider)},
                onSelectionChanged: (s) =>
                    ref.read(themeControllerProvider.notifier).elegir(s.first),
              ),
            ),

            // La galeria del sistema de diseno. Solo en debug: es la vista con
            // la que se aprueba un cambio de paleta sin recorrer la app.
            if (kDebugMode)
              _MenuItem(
                icon: Icons.palette_outlined,
                label: 'Sistema de diseño',
                onTap: () {
                  Navigator.pop(context);
                  context.push('/dev/gallery');
                },
              ),

            _MenuItem(
              icon: Icons.logout_rounded,
              label: 'Cerrar sesión',
              color: context.c.destructive,
              onTap: () async {
                Navigator.pop(context);
                await ref.read(authServiceProvider).signOut();
              },
            ),
          ],
        ),
        ),
      ),
    );
  }
}

class _Avatar extends StatelessWidget {
  final String? photoUrl;
  final String name;
  final double cropX;
  final double cropY;
  final double cropZoom;

  const _Avatar({
    required this.photoUrl,
    required this.name,
    this.cropX = 50,
    this.cropY = 50,
    this.cropZoom = 1,
  });

  @override
  Widget build(BuildContext context) {
    final fallback = Container(
      decoration: BoxDecoration(
        color: context.c.cardSurface,
        shape: BoxShape.circle,
        border: Border.all(color: context.c.border),
      ),
      child: Center(
        child: Text(
          name.isNotEmpty ? name[0].toUpperCase() : 'P',
          style: AppTypography.headline(
            size: 18,
            weight: FontWeight.w900,
            color: context.c.primary,
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
            ? CroppedPhoto(
                cropX: cropX,
                cropY: cropY,
                cropZoom: cropZoom,
                child: CachedNetworkImage(
                  imageUrl: url,
                  fit: BoxFit.cover,
                  alignment: Alignment.topCenter,
                  memCacheWidth: 192,
                  maxWidthDiskCache: 384,
                  placeholder: (context, url) => fallback,
                  errorWidget: (context, url, error) => fallback,
                ),
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
    final tier = context.c.ovrTextColor(ovr);

    return Semantics(label: 'OVR $ovr', child: Column(mainAxisSize: MainAxisSize.min, children: [
      Text('$ovr', style: AppTypography.sportNumber(size: 28, color: tier)),
      Text('OVR', style: AppTypography.body(size: 12, weight: FontWeight.w700, color: context.c.textSecondary)),
    ]));
  }
}

class _MenuItem extends StatelessWidget {
  final IconData icon;
  final String? svgAsset;
  final String label;
  final Color? color;
  final VoidCallback onTap;

  const _MenuItem({
    required this.icon,
    this.svgAsset,
    required this.label,
    this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    // El ícono va suelto, del color del texto, como en la web. El cuadradito
    // teñido de 38x38 que tenía antes convertía cada fila en otra caja.
    final tint = color ?? context.c.textPrimary;
    final iconColor = color ?? context.c.textSecondary;

    return InkWell(
      onTap: onTap,
      borderRadius: AppRadii.cardAll,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 14),
        child: Row(
          children: [
            if (svgAsset != null)
              SvgPicture.asset(
                svgAsset!,
                width: 20,
                height: 20,
                colorFilter: ColorFilter.mode(iconColor, BlendMode.srcIn),
              )
            else
              Icon(icon, size: 20, color: iconColor),
            const SizedBox(width: 14),
            Text(
              label,
              style: AppTypography.action(size: 15, color: tint),
            ),
          ],
        ),
      ),
    );
  }
}
