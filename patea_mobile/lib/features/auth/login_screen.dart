import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/services/auth_service.dart';
import '../../core/theme/app_radii.dart';
import '../../core/theme/app_typography.dart';
import '../../core/theme/patea_colors.dart';
import '../../core/widgets/patea_brand.dart';
import '../../core/widgets/patea_snack.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _nameController = TextEditingController();
  bool _isRegister = false;
  bool _isLoading = false;
  bool _obscurePassword = true;
  bool _isResetting = false;
  String _position = 'MED';
  String? _error;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    _nameController.dispose();
    super.dispose();
  }

  void _changeMode(bool register) {
    if (_isLoading || _isRegister == register) return;
    HapticFeedback.selectionClick();
    setState(() {
      _isRegister = register;
      _error = null;
      _formKey.currentState?.reset();
    });
  }

  Future<void> _submit() async {
    if (_isLoading || !_formKey.currentState!.validate()) return;
    FocusScope.of(context).unfocus();
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      final auth = ref.read(authServiceProvider);
      if (_isRegister) {
        await auth.registerWithEmail(
          _emailController.text.trim(),
          _passwordController.text,
          displayName: _nameController.text.trim(),
          position: _position,
        );
      } else {
        await auth.signInWithEmail(
          _emailController.text.trim(),
          _passwordController.text,
        );
        await auth.ensureProfile();
      }
      TextInput.finishAutofillContext();
    } on FirebaseAuthException catch (error) {
      if (mounted) {
        setState(
          () => _error = switch (error.code) {
            'email-already-in-use' =>
              'Ese correo ya tiene una cuenta. Elegí Ingresar para entrar.',
            'weak-password' => 'Elegí una contraseña de al menos 6 caracteres.',
            'network-request-failed' =>
              'No hay conexión. Revisá internet y volvé a intentar.',
            'too-many-requests' =>
              'Hubo varios intentos. Esperá un momento y probá de nuevo.',
            _ => 'Revisá tu correo y contraseña y volvé a intentar.',
          },
        );
      }
    } catch (_) {
      if (mounted) {
        setState(
          () => _error = 'No pudimos completar el ingreso. Probá de nuevo.',
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _googleSignIn() async {
    if (_isLoading) return;
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      await ref.read(authServiceProvider).signInWithGoogle();
    } catch (_) {
      if (mounted) {
        setState(
          () => _error =
              'No se pudo ingresar con Google. Podés intentarlo de nuevo o usar tu correo.',
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _resetPassword() async {
    final email = _emailController.text.trim();
    if (!RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(email)) {
      setState(
        () => _error = 'Escribí tu correo arriba para recuperar la contraseña.',
      );
      return;
    }
    setState(() {
      _isResetting = true;
      _error = null;
    });
    try {
      await FirebaseAuth.instance.sendPasswordResetEmail(email: email);
      if (mounted) {
        PateaSnack.ok(context, 'Revisá tu correo para recuperar el acceso.');
      }
    } catch (_) {
      if (mounted) {
        setState(
          () => _error =
              'No pudimos enviar el correo. Revisá la dirección e intentá otra vez.',
        );
      }
    } finally {
      if (mounted) setState(() => _isResetting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final reduced = MediaQuery.disableAnimationsOf(context);
    return Scaffold(
      backgroundColor: context.c.card,
      body: LayoutBuilder(
        builder: (context, constraints) {
          final wide = constraints.maxWidth >= 800;
          final form = _buildForm(context, reduced);
          if (wide) {
            return Row(
              children: [
                const Expanded(child: _WelcomePhoto(expanded: true)),
                Expanded(
                  child: SafeArea(
                    child: Center(
                      child: SingleChildScrollView(
                        padding: const EdgeInsets.all(40),
                        child: ConstrainedBox(
                          constraints: const BoxConstraints(maxWidth: 440),
                          child: form,
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            );
          }
          return SingleChildScrollView(
            keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const _WelcomePhoto(),
                Padding(
                  padding: EdgeInsets.fromLTRB(
                    24,
                    26,
                    24,
                    24 + MediaQuery.paddingOf(context).bottom,
                  ),
                  child: Center(
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 440),
                      child: form,
                    ),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildForm(BuildContext context, bool reduced) {
    final busy = _isLoading || _isResetting;
    return AutofillGroup(
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Expanded(
                  child: _ModeButton(
                    label: 'Ingresar',
                    selected: !_isRegister,
                    onPressed: busy ? null : () => _changeMode(false),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _ModeButton(
                    label: 'Crear cuenta',
                    selected: _isRegister,
                    onPressed: busy ? null : () => _changeMode(true),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24),
            Text(
              _isRegister ? 'Tu lugar en el cuadro.' : 'Entrá a tu cuenta.',
              style: AppTypography.headline(
                size: _isRegister ? 26 : 23,
                weight: FontWeight.w700,
                letterSpacing: -0.8,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              _isRegister
                  ? 'Armá tu perfil, sumate a tu grupo y empezá a jugar.'
                  : 'Entrá para ver quién juega y cuándo se arma el próximo.',
              style: AppTypography.body(
                size: 15,
                height: 1.4,
                color: context.c.textSecondary,
              ),
            ),
            const SizedBox(height: 24),
            AnimatedSwitcher(
              duration: reduced
                  ? Duration.zero
                  : const Duration(milliseconds: 220),
              switchInCurve: Curves.easeOutCubic,
              child: _isRegister
                  ? Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        TextFormField(
                          controller: _nameController,
                          enabled: !busy,
                          autofillHints: const [AutofillHints.name],
                          textCapitalization: TextCapitalization.words,
                          textInputAction: TextInputAction.next,
                          decoration: const InputDecoration(
                            labelText: 'Nombre o apodo',
                            hintText: 'Como te llaman en la cancha',
                          ),
                          validator: (value) => (value?.trim().length ?? 0) < 2
                              ? 'Escribí al menos 2 caracteres.'
                              : null,
                        ),
                        const SizedBox(height: 18),
                        Text(
                          '¿Dónde jugás?',
                          style: AppTypography.body(
                            size: 14,
                            weight: FontWeight.w600,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: [
                            for (final entry in const {
                              'POR': 'Golero',
                              'DEF': 'Defensa',
                              'MED': 'Medio',
                              'DEL': 'Delantero',
                            }.entries)
                              ChoiceChip(
                                label: Text(entry.value),
                                selected: _position == entry.key,
                                onSelected: busy
                                    ? null
                                    : (_) =>
                                          setState(() => _position = entry.key),
                              ),
                          ],
                        ),
                        const SizedBox(height: 20),
                      ],
                    )
                  : const SizedBox.shrink(),
            ),
            TextFormField(
              controller: _emailController,
              enabled: !busy,
              keyboardType: TextInputType.emailAddress,
              textInputAction: TextInputAction.next,
              autofillHints: const [AutofillHints.email],
              autocorrect: false,
              decoration: const InputDecoration(
                labelText: 'Correo electrónico',
                hintText: 'tu@email.com',
                prefixIcon: Icon(Icons.mail_outline),
              ),
              validator: (value) =>
                  RegExp(
                    r'^[^\s@]+@[^\s@]+\.[^\s@]+$',
                  ).hasMatch(value?.trim() ?? '')
                  ? null
                  : 'Escribí un correo válido.',
            ),
            const SizedBox(height: 18),
            TextFormField(
              controller: _passwordController,
              enabled: !busy,
              obscureText: _obscurePassword,
              autocorrect: false,
              enableSuggestions: false,
              autofillHints: [
                _isRegister
                    ? AutofillHints.newPassword
                    : AutofillHints.password,
              ],
              textInputAction: TextInputAction.done,
              onFieldSubmitted: (_) => _submit(),
              decoration: InputDecoration(
                labelText: 'Contraseña',
                helperText: _isRegister ? 'Al menos 6 caracteres.' : null,
                prefixIcon: const Icon(Icons.lock_outline),
                suffixIcon: IconButton(
                  tooltip: _obscurePassword
                      ? 'Mostrar contraseña'
                      : 'Ocultar contraseña',
                  onPressed: () =>
                      setState(() => _obscurePassword = !_obscurePassword),
                  icon: Icon(
                    _obscurePassword
                        ? Icons.visibility_outlined
                        : Icons.visibility_off_outlined,
                  ),
                ),
              ),
              validator: (value) => (value?.isEmpty ?? true)
                  ? 'Escribí tu contraseña.'
                  : _isRegister && value!.length < 6
                  ? 'Usá al menos 6 caracteres.'
                  : null,
            ),
            if (!_isRegister)
              Align(
                alignment: Alignment.centerRight,
                child: TextButton(
                  onPressed: busy ? null : _resetPassword,
                  child: Text(
                    _isResetting ? 'Enviando correo…' : 'Recuperar contraseña',
                  ),
                ),
              ),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 14),
                child: Semantics(
                  liveRegion: true,
                  child: Text(
                    _error!,
                    style: AppTypography.body(
                      size: 14,
                      height: 1.4,
                      color: context.c.destructive,
                    ),
                  ),
                ),
              ),
            const SizedBox(height: 12),
            FilledButton(
              onPressed: busy ? null : _submit,
              style: FilledButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 17),
              ),
              child: _isLoading
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : Text(
                      _isRegister ? 'Crear mi cuenta' : 'Entrar a Pateá',
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
            ),
            const SizedBox(height: 14),
            Row(
              children: [
                Expanded(child: Divider(color: context.c.border)),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 14),
                  child: Text(
                    'o',
                    style: AppTypography.body(color: context.c.textSecondary),
                  ),
                ),
                Expanded(child: Divider(color: context.c.border)),
              ],
            ),
            const SizedBox(height: 14),
            OutlinedButton(
              onPressed: busy ? null : _googleSignIn,
              style: OutlinedButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 16),
              ),
              child: const Text('Continuar con Google'),
            ),
            const SizedBox(height: 20),
            Text(
              'Los partidos se juegan entre amigos. Los recuerdos quedan acá.',
              textAlign: TextAlign.center,
              style: AppTypography.body(
                size: 12,
                height: 1.5,
                color: context.c.textSecondary,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ModeButton extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback? onPressed;
  const _ModeButton({
    required this.label,
    required this.selected,
    this.onPressed,
  });
  @override
  Widget build(BuildContext context) => Semantics(
    selected: selected,
    child: TextButton(
      onPressed: onPressed,
      style: TextButton.styleFrom(
        foregroundColor: selected
            ? context.c.textPrimary
            : context.c.textSecondary,
        padding: const EdgeInsets.symmetric(vertical: 12),
        shape: RoundedRectangleBorder(
          borderRadius: AppRadii.chipAll,
          side: BorderSide(
            color: selected ? context.c.primary : context.c.border,
          ),
        ),
        backgroundColor: selected
            ? context.c.overlaySubtle
            : Colors.transparent,
      ),
      child: Text(
        label,
        style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700),
      ),
    ),
  );
}

class _WelcomePhoto extends StatelessWidget {
  final bool expanded;
  const _WelcomePhoto({this.expanded = false});
  @override
  Widget build(BuildContext context) => SizedBox(
    height: expanded
        ? double.infinity
        : 230 +
              MediaQuery.textScalerOf(context).scale(70) +
              MediaQuery.paddingOf(context).top,
    child: Stack(
      fit: StackFit.expand,
      children: [
        Image.asset(
          'assets/brand/patea_matchday.webp',
          fit: BoxFit.cover,
          alignment: Alignment.centerRight,
          errorBuilder: (_, _, _) =>
              Image.asset('assets/backgrounds/fondo_1.jpg', fit: BoxFit.cover),
        ),
        DecoratedBox(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [
                PateaColors.game.background.withValues(alpha: 0.62),
                PateaColors.game.background.withValues(alpha: 0.18),
                PateaColors.game.background.withValues(alpha: 0.95),
              ],
              stops: const [0, 0.35, 1],
            ),
          ),
        ),
        SafeArea(
          bottom: false,
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const PateaBrand(width: 148, height: 48, onPhoto: true),
                const Spacer(),
                Text(
                  'El partido empieza\ncon tu gente.',
                  style: AppTypography.jersey(
                    size: expanded ? 52 : 35,
                    height: 1.12,
                    color: context.c.onPhoto,
                  ),
                ),
                const SizedBox(height: 10),
                Text(
                  'Armá el cuadro. Jugá. Volvé a encontrarte.',
                  style: AppTypography.body(
                    size: 14,
                    color: context.c.onPhoto,
                    height: 1.4,
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    ),
  );
}
