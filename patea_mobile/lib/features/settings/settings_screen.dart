import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/services/auth_service.dart';
import '../../core/services/credits_store_service.dart';
import '../../core/services/firestore_service.dart';
import '../../core/services/push_permission.dart';
import '../../core/services/social_service.dart';
import '../../core/theme/app_insets.dart';
import '../../core/theme/app_typography.dart';
import '../../core/theme/patea_colors.dart';
import '../../core/theme/theme_mode_provider.dart';
import '../../core/utils/legal_links.dart';
import '../../core/widgets/credits_store_sheet.dart';
import '../../core/widgets/delete_account_flow.dart';
import '../../core/widgets/patea_avatar.dart';
import '../../core/widgets/patea_card.dart';
import '../../core/widgets/patea_snack.dart';

/// ¿Las notificaciones están permitidas en este teléfono? Se vuelve a leer
/// cuando se pide el permiso (`ref.invalidate`).
final notificationsAllowedProvider = FutureProvider.autoDispose<bool>((
  ref,
) async {
  final settings = await FirebaseMessaging.instance.getNotificationSettings();
  final status = settings.authorizationStatus;
  return status == AuthorizationStatus.authorized ||
      status == AuthorizationStatus.provisional;
});

/// Configuración: cuenta, apariencia, notificaciones, privacidad y sesión.
class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.c;
    final user = ref.watch(authStateProvider).value;
    final uid = user?.uid ?? '';
    final player = uid.isEmpty
        ? null
        : ref.watch(singlePlayerStreamProvider(uid)).value;
    final notificationsOn = ref.watch(notificationsAllowedProvider).value;
    final blocked = ref.watch(blockedUidsStreamProvider).value ?? const {};

    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        title: Text(
          'Configuración',
          style: AppTypography.headline(size: 20, weight: FontWeight.w700),
        ),
      ),
      body: ListView(
        padding: EdgeInsets.fromLTRB(
          18,
          4,
          18,
          bottomInset(context, extra: 24),
        ),
        children: [
          // Cuenta
          PateaCard(
            padding: const EdgeInsets.all(16),
            borderColor: c.border.withValues(alpha: 0.55),
            child: Row(
              children: [
                PateaAvatar(
                  photoUrl: player?.photoUrl,
                  seed: uid.isEmpty ? 'yo' : uid,
                  size: 56,
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        player?.name ?? user?.displayName ?? 'Jugador',
                        style: AppTypography.headline(
                          size: 17,
                          weight: FontWeight.w700,
                        ),
                      ),
                      if ((user?.email ?? '').isNotEmpty)
                        Text(
                          user!.email!,
                          style: AppTypography.body(
                            size: 13,
                            color: c.textSecondary,
                          ),
                        ),
                    ],
                  ),
                ),
                TextButton(
                  onPressed: uid.isEmpty
                      ? null
                      : () => context.push('/profile/edit'),
                  child: const Text('Editar'),
                ),
              ],
            ),
          ),

          const _SectionTitle('Apariencia'),
          PateaCard(
            padding: const EdgeInsets.all(14),
            borderColor: c.border.withValues(alpha: 0.45),
            child: SizedBox(
              width: double.infinity,
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
          ),

          const _SectionTitle('Notificaciones'),
          _Row(
            icon: notificationsOn == true
                ? Icons.notifications_active_rounded
                : Icons.notifications_off_outlined,
            title: 'Avisos de Pateá',
            subtitle: switch (notificationsOn) {
              true => 'Activados: partidos, invitaciones y recordatorios.',
              false => 'Desactivados en este teléfono.',
              null => 'Revisando…',
            },
            trailing: notificationsOn == false
                ? TextButton(
                    onPressed: () => _enableNotifications(context, ref),
                    child: const Text('Activar'),
                  )
                : null,
          ),

          const _SectionTitle('Privacidad'),
          _Row(
            icon: Icons.block_rounded,
            title: 'Usuarios bloqueados',
            subtitle: blocked.isEmpty
                ? 'No bloqueaste a nadie.'
                : '${blocked.length} ${blocked.length == 1 ? 'persona' : 'personas'}',
            onTap: blocked.isEmpty
                ? null
                : () => _showBlockedSheet(context),
          ),
          _Row(
            icon: Icons.privacy_tip_outlined,
            title: 'Política de privacidad',
            onTap: () => LegalLinks.open(context, LegalLinks.privacy),
          ),
          _Row(
            icon: Icons.description_outlined,
            title: 'Términos de uso',
            onTap: () => LegalLinks.open(context, LegalLinks.terms),
          ),

          // Solo en la versión de la App Store; en TestFlight y Android no existe.
          if (ref.watch(creditsStoreEnabledProvider).value ?? false) ...[
            const _SectionTitle('Créditos de IA'),
            _Row(
              icon: Icons.auto_awesome_outlined,
              title: 'Comprar créditos',
              subtitle: 'Para generar tu retrato con IA.',
              onTap: () => showCreditsStoreSheet(context),
            ),
          ],

          const _SectionTitle('Sesión'),
          _Row(
            icon: Icons.logout_rounded,
            title: 'Cerrar sesión',
            color: c.destructive,
            onTap: () => ref.read(authServiceProvider).signOut(),
          ),
          _Row(
            icon: Icons.delete_forever_outlined,
            title: 'Eliminar mi cuenta',
            subtitle: 'Borra tu perfil y tus publicaciones. No se puede deshacer.',
            color: c.destructive,
            onTap: () => showDeleteAccountFlow(context),
          ),
        ],
      ),
    );
  }

  Future<void> _enableNotifications(BuildContext context, WidgetRef ref) async {
    final avisar = PateaSnack.of(context);
    final granted = await PushPermission.requestNow();
    ref.invalidate(notificationsAllowedProvider);
    if (granted) {
      avisar.ok('Listo, te vamos a avisar.');
      return;
    }
    final isIos = defaultTargetPlatform == TargetPlatform.iOS;
    avisar.error(
      isIos
          ? 'iOS tiene las notificaciones bloqueadas para Pateá. Habilitalas desde Configuración › Pateá › Notificaciones.'
          : 'Android tiene las notificaciones bloqueadas para Pateá. Se habilitan desde Ajustes › Apps › Pateá › Notificaciones.',
    );
  }

  void _showBlockedSheet(BuildContext context) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const _BlockedUsersSheet(),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  final String text;
  const _SectionTitle(this.text);

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(top: 24, bottom: 10, left: 2),
    child: Text(
      text,
      style: AppTypography.headline(
        size: 14,
        weight: FontWeight.w700,
        color: context.c.textSecondary,
      ),
    ),
  );
}

class _Row extends StatelessWidget {
  final IconData icon;
  final String title;
  final String? subtitle;
  final Widget? trailing;
  final VoidCallback? onTap;
  final Color? color;

  const _Row({
    required this.icon,
    required this.title,
    this.subtitle,
    this.trailing,
    this.onTap,
    this.color,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final tint = color ?? c.textPrimary;
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: PateaCard(
        borderColor: c.border.withValues(alpha: 0.45),
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            child: Row(
              children: [
                Icon(icon, color: tint, size: 22),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: AppTypography.body(
                          size: 15,
                          weight: FontWeight.w600,
                          color: tint,
                        ),
                      ),
                      if (subtitle != null)
                        Padding(
                          padding: const EdgeInsets.only(top: 2),
                          child: Text(
                            subtitle!,
                            style: AppTypography.body(
                              size: 12.5,
                              color: c.textSecondary,
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
                ?trailing,
                if (trailing == null && onTap != null && color == null)
                  Icon(
                    Icons.chevron_right_rounded,
                    color: c.textSecondary,
                    size: 20,
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _BlockedUsersSheet extends ConsumerWidget {
  const _BlockedUsersSheet();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.c;
    final blocked = (ref.watch(blockedUidsStreamProvider).value ?? const {})
        .toList();
    return PateaCard(
      color: c.popover,
      radius: const BorderRadius.vertical(top: Radius.circular(24)),
      padding: EdgeInsets.fromLTRB(
        20,
        16,
        20,
        16 + MediaQuery.of(context).padding.bottom,
      ),
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.of(context).size.height * 0.7,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Usuarios bloqueados',
              style: AppTypography.headline(size: 20, weight: FontWeight.w800),
            ),
            const SizedBox(height: 4),
            Text(
              'No ves sus publicaciones ni sus comentarios.',
              style: AppTypography.body(size: 13, color: c.textSecondary),
            ),
            const SizedBox(height: 12),
            if (blocked.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 20),
                child: Text(
                  'No bloqueaste a nadie.',
                  style: AppTypography.body(size: 14, color: c.textSecondary),
                ),
              )
            else
              Flexible(
                child: ListView(
                  shrinkWrap: true,
                  children: [for (final uid in blocked) _BlockedTile(uid: uid)],
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _BlockedTile extends ConsumerStatefulWidget {
  final String uid;
  const _BlockedTile({required this.uid});

  @override
  ConsumerState<_BlockedTile> createState() => _BlockedTileState();
}

class _BlockedTileState extends ConsumerState<_BlockedTile> {
  bool _busy = false;

  Future<void> _unblock() async {
    final avisar = PateaSnack.of(context);
    setState(() => _busy = true);
    try {
      await ref.read(socialServiceProvider).toggleBlock(widget.uid);
      avisar.ok('Desbloqueaste a esta persona.');
    } catch (e) {
      avisar.error('No se pudo desbloquear. Probá de nuevo.');
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final player = ref.watch(singlePlayerStreamProvider(widget.uid)).value;
    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: PateaAvatar(
        photoUrl: player?.photoUrl,
        seed: widget.uid,
        size: 40,
      ),
      title: Text(
        player?.name ?? 'Jugador',
        style: AppTypography.body(size: 15, weight: FontWeight.w600),
      ),
      trailing: _busy
          ? const SizedBox(
              width: 18,
              height: 18,
              child: CircularProgressIndicator(strokeWidth: 2),
            )
          : TextButton(onPressed: _unblock, child: const Text('Desbloquear')),
    );
  }
}
