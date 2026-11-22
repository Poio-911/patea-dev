import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/services/social_service.dart';
import '../../core/theme/app_typography.dart';
import '../../core/theme/patea_colors.dart';
import '../../core/widgets/patea_snack.dart';

/// Denunciar y bloquear (guideline 1.2 de la App Store: el contenido de otras
/// personas tiene que poder denunciarse y su autor bloquearse).
///
/// Las denuncias quedan en `reports/` para revisarlas desde la consola.
const _reasons = <(String, String)>[
  ('spam', 'Spam o publicidad'),
  ('acoso', 'Acoso o amenazas'),
  ('ofensivo', 'Contenido ofensivo o discriminatorio'),
  ('sexual', 'Contenido sexual'),
  ('violencia', 'Violencia'),
  ('otro', 'Otro motivo'),
];

/// Pregunta el motivo y envía la denuncia. [type] es `post`, `comment` o `user`.
Future<void> reportFlow(
  BuildContext context,
  WidgetRef ref, {
  required String type,
  required String targetId,
  String? activityId,
}) async {
  final reason = await showModalBottomSheet<String>(
    context: context,
    backgroundColor: context.c.popover,
    showDragHandle: true,
    builder: (sheetContext) => SafeArea(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 8),
            child: Text(
              '¿Por qué lo denunciás?',
              style: AppTypography.headline(size: 18, weight: FontWeight.w800),
            ),
          ),
          for (final (value, label) in _reasons)
            ListTile(
              title: Text(label),
              onTap: () => Navigator.pop(sheetContext, value),
            ),
        ],
      ),
    ),
  );
  if (reason == null || !context.mounted) return;

  try {
    await ref
        .read(socialServiceProvider)
        .reportContent(
          type: type,
          targetId: targetId,
          activityId: activityId,
          reason: reason,
        );
    if (context.mounted) {
      PateaSnack.ok(
        context,
        'Gracias, lo vamos a revisar. Si querés, también podés bloquear a esta persona.',
      );
    }
  } catch (_) {
    if (context.mounted) {
      PateaSnack.error(
        context,
        'No se pudo enviar la denuncia. Probá de nuevo.',
      );
    }
  }
}

/// Pide confirmación y bloquea a [uid]. Quien bloquea deja de ver sus
/// publicaciones y comentarios.
Future<void> blockFlow(
  BuildContext context,
  WidgetRef ref, {
  required String uid,
  required String name,
}) async {
  final confirmed = await showDialog<bool>(
    context: context,
    builder: (dialogContext) => AlertDialog(
      title: Text('¿Bloquear a $name?'),
      content: const Text(
        'Dejarás de ver sus publicaciones y comentarios, y se corta el seguimiento entre ustedes. Podés desbloquearla más tarde.',
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(dialogContext, false),
          child: const Text('Cancelar'),
        ),
        TextButton(
          onPressed: () => Navigator.pop(dialogContext, true),
          child: const Text('Bloquear'),
        ),
      ],
    ),
  );
  if (confirmed != true || !context.mounted) return;

  try {
    final blocked = await ref.read(socialServiceProvider).toggleBlock(uid);
    if (context.mounted) {
      PateaSnack.ok(
        context,
        blocked ? '$name quedó bloqueado' : '$name ya no está bloqueado',
      );
    }
  } catch (_) {
    if (context.mounted) {
      PateaSnack.error(context, 'No se pudo bloquear. Probá de nuevo.');
    }
  }
}
