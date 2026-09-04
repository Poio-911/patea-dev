import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../theme/app_colors.dart';
import '../theme/app_typography.dart';
import 'notifications_service.dart';

/// Cuándo y cómo pedir el permiso de notificaciones.
///
/// El backend ya manda push (recordatorios de partido, invitaciones, partidos
/// nuevos) y la app ya sabe guardar el token, pero `requestPermission()` no lo
/// llamaba nadie: en Android 13+ el permiso es explícito, así que sin este
/// pedido no llega ni una sola notificación.
///
/// No se pide en el primer arranque. El sistema deja mostrar su diálogo una
/// sola vez —si el usuario dice que no ahí, ya no se puede volver a preguntar
/// desde la app— así que primero va una explicación nuestra, en un momento en
/// el que el permiso tiene sentido (te anotaste a un partido: te vamos a
/// avisar). Recién si acepta esa, se dispara el diálogo del sistema.
class PushPermission {
  static const _askedKey = 'pushPermissionAsked';

  /// Pide el permiso una sola vez en la vida de la instalación, con una
  /// explicación previa. Si el usuario dice "ahora no", queda marcado igual:
  /// insistir solo, sin que lo pida, es lo que hace que la gente lo bloquee
  /// para siempre. Queda el pedido manual desde el menú de usuario.
  static Future<void> askOnce(BuildContext context, {required String reason}) async {
    final prefs = await SharedPreferences.getInstance();
    if (prefs.getBool(_askedKey) ?? false) return;
    if (!context.mounted) return;

    final accepted = await _showRationale(context, reason);
    await prefs.setBool(_askedKey, true);
    if (accepted != true) return;

    await NotificationsService.requestPermission();
  }

  /// Pedido explícito desde el menú de usuario. Acá no hay explicación previa
  /// —el usuario ya la pidió— y devuelve si quedó activado, para poder decirle
  /// que tiene que habilitarlo desde los ajustes del teléfono si antes lo negó.
  static Future<bool> requestNow() => NotificationsService.requestPermission();

  static Future<bool?> _showRationale(BuildContext context, String reason) {
    return showModalBottomSheet<bool>(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        padding: EdgeInsets.fromLTRB(
            22, 18, 22, 18 + MediaQuery.of(ctx).padding.bottom),
        decoration: const BoxDecoration(
          color: Color(0xFF141B27),
          borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 48,
              height: 5,
              margin: const EdgeInsets.only(bottom: 18),
              decoration: BoxDecoration(
                color: AppColors.textMuted.withValues(alpha: 0.3),
                borderRadius: BorderRadius.circular(3),
              ),
            ),
            Text('¿Te avisamos?',
                style:
                    AppTypography.headline(size: 21, weight: FontWeight.w800)),
            const SizedBox(height: 8),
            Text(
              reason,
              style: AppTypography.body(size: 13, color: AppColors.textSecondary),
            ),
            const SizedBox(height: 18),
            Row(
              children: [
                Expanded(
                  child: TextButton(
                    onPressed: () => Navigator.pop(ctx, false),
                    style: TextButton.styleFrom(
                      foregroundColor: AppColors.textMuted,
                      padding: const EdgeInsets.symmetric(vertical: 13),
                    ),
                    child: Text('Ahora no',
                        style: AppTypography.headline(
                            size: 13,
                            weight: FontWeight.w600,
                            color: AppColors.textMuted)),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: ElevatedButton(
                    onPressed: () => Navigator.pop(ctx, true),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.voltNeon,
                      foregroundColor: Colors.black,
                      padding: const EdgeInsets.symmetric(vertical: 13),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12)),
                    ),
                    child: Text('Avisame',
                        style: AppTypography.headline(
                            size: 13,
                            weight: FontWeight.w700,
                            color: Colors.black)),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
