import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../services/auth_service.dart';
import '../theme/app_typography.dart';
import '../theme/patea_colors.dart';

/// Confirmación para borrar la cuenta. Es irreversible, así que dice con todas
/// las letras qué se va y qué se queda, y pide la contraseña si la cuenta la
/// tiene (es la misma que se usa para volver a autenticar).
Future<void> showDeleteAccountFlow(BuildContext context) async {
  await showDialog<void>(
    context: context,
    barrierDismissible: false,
    builder: (_) => const _DeleteAccountDialog(),
  );
}

class _DeleteAccountDialog extends ConsumerStatefulWidget {
  const _DeleteAccountDialog();

  @override
  ConsumerState<_DeleteAccountDialog> createState() =>
      _DeleteAccountDialogState();
}

class _DeleteAccountDialogState extends ConsumerState<_DeleteAccountDialog> {
  final _password = TextEditingController();
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _password.dispose();
    super.dispose();
  }

  Future<void> _delete() async {
    final auth = ref.read(authServiceProvider);
    if (auth.usesPassword && _password.text.isEmpty) {
      setState(() => _error = 'Escribí tu contraseña para confirmar.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await auth.deleteAccount(password: _password.text);
      if (mounted) Navigator.of(context).pop();
    } on FirebaseAuthException catch (e) {
      final cancelled =
          e.code == 'canceled' ||
          e.code == 'web-context-canceled' ||
          e.code == 'user-cancelled';
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = cancelled
            ? null
            : switch (e.code) {
                'wrong-password' ||
                'invalid-credential' ||
                'invalid-login-credentials' => 'La contraseña no es correcta.',
                'network-request-failed' =>
                  'No hay conexión. Revisá internet y volvé a intentar.',
                _ => 'No pudimos confirmar tu identidad. Probá de nuevo.',
              };
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error =
            'No pudimos borrar la cuenta. Probá de nuevo en un momento; si falló a la mitad, volver a intentar la completa.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authServiceProvider);
    return AlertDialog(
      backgroundColor: context.c.popover,
      title: Text(
        'Eliminar mi cuenta',
        style: AppTypography.headline(size: 20, weight: FontWeight.w800),
      ),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Esto no se puede deshacer.',
              style: AppTypography.body(
                size: 14,
                weight: FontWeight.w700,
                color: context.c.destructive,
              ),
            ),
            const SizedBox(height: 10),
            Text(
              'Se borran tu perfil, tu jugador, tus publicaciones, tus '
              'comentarios, tus fotos y tus notificaciones.\n\n'
              'Los partidos y evaluaciones de otras personas se conservan, '
              'pero tu nombre y tu foto pasan a figurar como "Jugador '
              'eliminado". Si creaste un grupo y hay más integrantes, queda '
              'a cargo de otra persona del grupo.',
              style: AppTypography.body(
                size: 13,
                color: context.c.textSecondary,
              ),
            ),
            if (auth.usesPassword) ...[
              const SizedBox(height: 14),
              TextField(
                controller: _password,
                obscureText: true,
                enabled: !_busy,
                autofillHints: const [AutofillHints.password],
                decoration: const InputDecoration(labelText: 'Tu contraseña'),
              ),
            ],
            if (_error != null) ...[
              const SizedBox(height: 10),
              Text(
                _error!,
                style: AppTypography.body(
                  size: 12,
                  color: context.c.destructive,
                ),
              ),
            ],
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: _busy ? null : () => Navigator.of(context).pop(),
          child: const Text('Cancelar'),
        ),
        TextButton(
          onPressed: _busy ? null : _delete,
          style: TextButton.styleFrom(foregroundColor: context.c.destructive),
          child: _busy
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Text('Eliminar cuenta'),
        ),
      ],
    );
  }
}
