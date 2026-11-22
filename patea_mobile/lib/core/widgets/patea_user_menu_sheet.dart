import 'package:flutter/foundation.dart';
import 'patea_snack.dart';
import '../theme/theme_mode_provider.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_svg/flutter_svg.dart';
import '../services/auth_service.dart';
import '../services/firestore_service.dart';
import '../services/messages_service.dart';
import '../services/push_permission.dart';
import '../theme/patea_colors.dart';
import '../theme/app_radii.dart';
import '../theme/app_typography.dart';
import '../utils/photo_url.dart';
import '../models/player_model.dart';
import 'patea_account_avatar.dart';
import 'ovr_accent.dart';

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
    final player = uid.isNotEmpty
        ? ref.watch(singlePlayerStreamProvider(uid)).value
        : null;

    final displayName = player?.name ?? currentUser?.displayName ?? 'Jugador';
    final email = currentUser?.email ?? '';
    final position = player?.position;
    final ovr = player?.ovr;
    final photoUrl =
        nonEmptyPhotoUrl(player?.photoUrl) ??
        ref.watch(currentAuthPhotoUrlProvider);
    // Último cambio de OVR (de la evaluación más reciente), si hay historial.
    final history = player == null
        ? null
        : ref.watch(ovrHistoryStreamProvider(player.id)).asData?.value;
    final lastChange = (history == null || history.isEmpty)
        ? 0
        : history.last.newOVR - history.last.oldOVR;

    return Container(
      decoration: BoxDecoration(
        color: context.c.popover,
        borderRadius: AppRadii.surfaceTop,
        border: Border(top: BorderSide(color: context.c.overlayLine, width: 1)),
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

              // Identidad, apoyada directo sobre la hoja (sin tarjeta, aro ni
              // degradado). Foto más grande; nombre, correo y posición como texto
              // de color a la izquierda. El OVR sigue el diseño aprobado
              // (docs/design/OVR_ACCENTS_2026-11-18.md): número plano con el color
              // del tier, a su izquierda "OVR" y debajo la categoría, y prisma
              // desde 71. Toda la fila lleva al perfil.
              Padding(
                padding: const EdgeInsets.fromLTRB(4, 0, 4, 16),
                child: _AccountHeader(
                  name: displayName,
                  email: email,
                  position: position,
                  ovr: ovr,
                  lastChange: lastChange,
                  stats: player?.stats,
                  playerId: player?.id ?? uid,
                  avatar: PateaAccountAvatar(
                    photoUrl: photoUrl,
                    name: displayName,
                    size: 64,
                    cropX: player?.cropX ?? 50,
                    cropY: player?.cropY ?? 50,
                    cropZoom: player?.cropZoom ?? 1,
                  ),
                  onTap: () {
                    Navigator.pop(context);
                    context.push('/profile');
                  },
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
                icon: Icons.hub_outlined,
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
                  onSelectionChanged: (s) => ref
                      .read(themeControllerProvider.notifier)
                      .elegir(s.first),
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

class _AccountHeader extends StatelessWidget {
  final String name;
  final String email;
  final String? position;
  final int? ovr;
  final int lastChange;
  final PlayerStats? stats;
  final String playerId;
  final Widget avatar;
  final VoidCallback onTap;

  const _AccountHeader({
    required this.name,
    required this.email,
    required this.position,
    required this.ovr,
    required this.lastChange,
    required this.stats,
    required this.playerId,
    required this.avatar,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final value = ovr;
    final tier = value == null ? c.textSecondary : ovrAccentColor(c, value);
    final category = value == null ? '' : ovrCategory(value);
    // OVR y categoría comparten tamaño; la categoría pesa 700 y lleva el color
    // del número.
    final labelStyle = AppTypography.body(
      size: 11,
      weight: FontWeight.w500,
      color: c.textSecondary,
    ).copyWith(height: 1.2, letterSpacing: 0.4);

    return Semantics(
      button: true,
      label: 'Mi perfil. $name${value == null ? '' : ', OVR $value'}',
      child: InkWell(
        onTap: onTap,
        borderRadius: AppRadii.cardAll,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(6, 4, 6, 4),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  avatar,
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          name,
                          style: AppTypography.headline(
                            size: 18,
                            weight: FontWeight.w800,
                            color: c.textPrimary,
                          ).copyWith(height: 1.15),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        if (email.isNotEmpty) ...[
                          const SizedBox(height: 2),
                          Text(
                            email,
                            style: AppTypography.body(
                              size: 12,
                              color: c.textSecondary,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                        if (position != null) ...[
                          const SizedBox(height: 4),
                          Text(
                            position!.toUpperCase(),
                            style: AppTypography.body(
                              size: 12,
                              weight: FontWeight.w700,
                              color: c.positionColor(position!),
                            ).copyWith(letterSpacing: 0.6),
                          ),
                        ],
                      ],
                    ),
                  ),
                  if (value != null) ...[
                    const SizedBox(width: 10),
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        Column(
                          mainAxisSize: MainAxisSize.min,
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Text('OVR', style: labelStyle),
                            if (category.isNotEmpty)
                              Text(
                                category,
                                style: labelStyle.copyWith(
                                  color: tier,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                          ],
                        ),
                        const SizedBox(width: 6),
                        Column(
                          mainAxisSize: MainAxisSize.min,
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            OvrPrismNumber(
                              ovr: value,
                              seed: playerId,
                              style:
                                  AppTypography.sportNumber(
                                    size: 46,
                                    color: tier,
                                  ).copyWith(
                                    height: 1,
                                    fontWeight: FontWeight.w700,
                                  ),
                            ),
                            if (lastChange != 0)
                              Text(
                                '${lastChange > 0 ? '+' : ''}$lastChange',
                                style: AppTypography.code(
                                  size: 12,
                                  weight: FontWeight.w700,
                                  color: lastChange > 0
                                      ? c.success
                                      : c.destructive,
                                ),
                              ),
                          ],
                        ),
                      ],
                    ),
                  ],
                ],
              ),
              if (stats != null && stats!.matchesPlayed > 0) ...[
                const SizedBox(height: 14),
                Divider(height: 1, color: c.overlayLine),
                const SizedBox(height: 12),
                Row(
                  children: [
                    _HeaderStat(
                      value: '${stats!.matchesPlayed}',
                      label: 'Partidos',
                    ),
                    _HeaderStat(value: '${stats!.goals}', label: 'Goles'),
                    _HeaderStat(value: '${stats!.assists}', label: 'Asist.'),
                    _HeaderStat(
                      value: stats!.averageRating > 0
                          ? stats!.averageRating.toStringAsFixed(1)
                          : '—',
                      label: 'Nota',
                    ),
                  ],
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _HeaderStat extends StatelessWidget {
  final String value;
  final String label;

  const _HeaderStat({required this.value, required this.label});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Expanded(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            value,
            style: AppTypography.sportNumber(
              size: 22,
              color: c.textPrimary,
            ).copyWith(height: 1.1),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: AppTypography.body(size: 11, color: c.textSecondary),
          ),
        ],
      ),
    );
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
            Text(label, style: AppTypography.action(size: 15, color: tint)),
          ],
        ),
      ),
    );
  }
}
