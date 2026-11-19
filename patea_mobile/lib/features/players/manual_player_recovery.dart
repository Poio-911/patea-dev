import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/services/auth_service.dart';
import '../../core/services/callable_functions.dart';
import '../../core/theme/app_typography.dart';
import '../../core/theme/patea_colors.dart';
import '../../core/widgets/patea_snack.dart';

Future<void> showManualPlayerRecovery(BuildContext context) =>
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) => const ManualPlayerRecovery(),
    );

/// Rechecks verified contacts after sign-in and after returning from the email
/// verification link. Declining is respected for the remainder of the session.
class ManualClaimGate extends ConsumerStatefulWidget {
  const ManualClaimGate({super.key, required this.child});
  final Widget child;
  @override
  ConsumerState<ManualClaimGate> createState() => _ManualClaimGateState();
}

class _ManualClaimGateState extends ConsumerState<ManualClaimGate>
    with WidgetsBindingObserver {
  String? _checked;
  bool _busy = false;
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) _check();
  }

  Future<void> _check() async {
    if (_busy) return;
    final user = ref.read(authServiceProvider).currentUser;
    if (user == null) {
      _checked = null;
      return;
    }
    _busy = true;
    try {
      await user.reload();
      final fresh = FirebaseAuth.instance.currentUser;
      if (fresh == null || (!fresh.emailVerified && fresh.phoneNumber == null))
        return;
      final key = '${fresh.uid}:${fresh.emailVerified}:${fresh.phoneNumber}';
      if (_checked == key) return;
      final data = await callFunction('findManualPlayerClaims', {});
      if (!mounted) return;
      _checked = key;
      if ((data['candidates'] as List? ?? []).isNotEmpty)
        await showManualPlayerRecovery(context);
    } catch (_) {
      // A network failure must never block navigation; manual retry is in profile.
    } finally {
      _busy = false;
    }
  }

  @override
  Widget build(BuildContext context) {
    ref.listen(authStateProvider, (_, next) {
      if (next.value == null) _checked = null;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _check();
      });
    });
    if (_checked == null && !_busy)
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _check();
      });
    return widget.child;
  }
}

class ManualPlayerRecovery extends StatefulWidget {
  const ManualPlayerRecovery({super.key});
  @override
  State<ManualPlayerRecovery> createState() => _ManualPlayerRecoveryState();
}

class _ManualPlayerRecoveryState extends State<ManualPlayerRecovery> {
  bool _loading = true;
  bool _claiming = false;
  bool _verified = false;
  String? _error;
  List<Map<String, dynamic>> _candidates = [];
  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await FirebaseAuth.instance.currentUser?.reload();
      final user = FirebaseAuth.instance.currentUser;
      _verified =
          user != null && (user.emailVerified || user.phoneNumber != null);
      if (_verified) {
        final data = await callFunction('findManualPlayerClaims', {});
        _candidates = (data['candidates'] as List? ?? [])
            .map((e) => Map<String, dynamic>.from(e as Map))
            .toList();
      }
    } catch (e) {
      _error = 'No pudimos buscar tu historial. Volvé a intentar.';
    }
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _claim(Map<String, dynamic> candidate) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('¿Sos ${candidate['name']}?'),
        content: Text(
          'Vas a ocupar su lugar en ${candidate['groupName']} y conservar sus partidos, evaluaciones y nivel. El creador dejará de poder editar este perfil.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('No soy yo'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Sí, soy yo'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    setState(() => _claiming = true);
    try {
      await callFunction('claimManualPlayer', {
        'playerId': candidate['id'],
        'confirmed': true,
      }, timeout: const Duration(seconds: 120));
      if (!mounted) return;
      PateaSnack.ok(context, 'Recuperaste tu lugar y tu historial');
      Navigator.pop(context);
    } catch (e) {
      if (mounted) PateaSnack.error(context, 'No se pudo recuperar: $e');
    } finally {
      if (mounted) setState(() => _claiming = false);
    }
  }

  Future<void> _verify() async {
    try {
      await FirebaseAuth.instance.currentUser?.sendEmailVerification();
      if (mounted)
        PateaSnack.ok(
          context,
          'Revisá tu correo y después tocá “Ya verifiqué”',
        );
    } catch (_) {
      if (mounted)
        PateaSnack.error(
          context,
          'No pudimos enviar el correo. Intentá de nuevo más tarde.',
        );
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return SafeArea(
      top: false,
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(24, 22, 24, 28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    'Tu lugar en el equipo',
                    style: AppTypography.headline(
                      size: 22,
                      weight: FontWeight.w700,
                    ),
                  ),
                ),
                IconButton(
                  onPressed: _claiming ? null : () => Navigator.pop(context),
                  tooltip: 'Cerrar',
                  icon: const Icon(Icons.close),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              '¿Ya jugabas con un perfil sin cuenta? Podés recuperar su historial si el creador guardó tu correo o teléfono.',
              style: AppTypography.body(size: 13, color: c.textSecondary),
            ),
            const SizedBox(height: 24),
            if (_loading || _claiming)
              const Center(child: CircularProgressIndicator())
            else if (_error != null) ...[
              Text(_error!),
              TextButton(onPressed: _load, child: const Text('Reintentar')),
            ] else if (!_verified) ...[
              const Text(
                'Primero verificá el correo de tu cuenta. Usamos ese dato para comprobar que el perfil te corresponde.',
              ),
              const SizedBox(height: 16),
              FilledButton(
                onPressed: _verify,
                child: const Text('Enviar correo de verificación'),
              ),
              TextButton(
                onPressed: _load,
                child: const Text('Ya verifiqué · buscar historial'),
              ),
            ] else if (_candidates.isEmpty) ...[
              const Text(
                'No encontramos un perfil con tu contacto verificado. Pedile a quien lo creó que revise el correo o teléfono guardado.',
              ),
              TextButton(
                onPressed: _load,
                child: const Text('Volver a buscar'),
              ),
            ] else ...[
              Text(
                'Encontramos ${_candidates.length == 1 ? 'un perfil que podría ser tuyo' : 'estos perfiles'}. Confirmá sólo el tuyo.',
                style: AppTypography.body(size: 14),
              ),
              const SizedBox(height: 12),
              for (final p in _candidates)
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: Icon(Icons.person_outline_rounded, color: c.primary),
                  title: Text('${p['name']}'),
                  subtitle: Text(
                    '${p['groupName']} · ${p['matchesPlayed']} partidos',
                  ),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => _claim(p),
                ),
              TextButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('Ahora no'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
