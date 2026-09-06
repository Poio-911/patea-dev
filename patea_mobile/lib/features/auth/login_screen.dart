import 'package:flutter/material.dart';
import '../../core/widgets/patea_card.dart';
import '../../core/theme/app_radii.dart';
import '../../core/widgets/patea_snack.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/theme/patea_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/services/auth_service.dart';
import '../../core/widgets/patea_background.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _nameController = TextEditingController();
  bool _isRegister = false;

  /// Puesto con el que arranca el jugador. La web lo pide en el registro
  /// porque de ahí salen las stats base; el móvil no lo pedía y por eso no
  /// se podía crear el jugador.
  String _position = 'MED';
  bool _isLoading = false;
  bool _obscurePassword = true;

  Future<void> _submit() async {
    final email = _emailController.text.trim();
    final password = _passwordController.text.trim();

    if (email.isEmpty || password.isEmpty) {
      PateaSnack.info(context, 'Por favor completa todos los campos.');
      return;
    }

    setState(() => _isLoading = true);

    try {
      if (_isRegister) {
        final name = _nameController.text.trim();
        await ref.read(authServiceProvider).registerWithEmail(
          email,
          password,
          displayName: name.isNotEmpty ? name : 'Jugador',
          position: _position,
        );
      } else {
        await ref.read(authServiceProvider).signInWithEmail(email, password);
        // Repara cuentas creadas antes de que el registro completara el
        // perfil. Es idempotente y no bloquea el ingreso si falla.
        await ref.read(authServiceProvider).ensureProfile();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              _isRegister ? 'Error al registrar usuario: $e' : 'Las credenciales no son correctas.',
            ),
            backgroundColor: context.c.destructive,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _handleGoogleSignIn() async {
    setState(() => _isLoading = true);
    try {
      await ref.read(authServiceProvider).signInWithGoogle();
    } catch (e) {
      if (mounted) {
        PateaSnack.error(context, 'Error al iniciar con Google: $e');
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: PateaBackground(
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 16.0),
              child: Container(
                constraints: const BoxConstraints(maxWidth: 420),
                padding: const EdgeInsets.all(28.0),
                decoration: BoxDecoration(
                  color: context.c.card.withValues(alpha: 0.85),
                  borderRadius: AppRadii.surfaceAll,
                  border: Border.all(
                    color: context.c.border.withValues(alpha: 0.5),
                    width: 1.2,
                  ),
                  boxShadow: [
                    BoxShadow(
                      // Una sombra es negra en los dos temas.
color: Colors.black.withValues(alpha: 0.4),
                      blurRadius: 30,
                      offset: const Offset(0, 10),
                    ),
                  ],
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Icono de Pelota con Resplandor
                    Center(
                      child: Container(
                        height: 64,
                        width: 64,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: context.c.brandVolt.withValues(alpha: 0.12),
                          border: Border.all(color: context.c.primary, width: 2),
                          boxShadow: [
                            BoxShadow(
                              color: context.c.brandVolt.withValues(alpha: 0.25),
                              blurRadius: 18,
                              spreadRadius: 2,
                            ),
                          ],
                        ),
                        child: Icon(
                          Icons.sports_soccer,
                          color: context.c.primary,
                          size: 34,
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),

                    // Título Pateá y Subtítulo
                    Text(
                      'Pateá',
                      style: AppTypography.headline(
                        size: 32,
                        weight: FontWeight.w900,
                        color: context.c.textPrimary,
                      ),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 6),
                    Text(
                      _isRegister
                          ? 'Crea tu perfil y comenzá a profesionalizar tu carrera amateur.'
                          : 'Inicia sesión para organizar los partidos con tus amigos.',
                      style: AppTypography.body(
                        size: 13,
                        color: context.c.textSecondary,
                      ),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 28),

                    // Campo Nombre (solo en registro)
                    if (_isRegister) ...[
                      Text(
                        'Nombre / Apodo',
                        style: AppTypography.headline(size: 12, weight: FontWeight.w600, color: context.c.textSecondary),
                      ),
                      const SizedBox(height: 6),
                      TextField(
                        controller: _nameController,
                        style: AppTypography.body(color: context.c.textSecondary),
                        decoration: InputDecoration(
                          hintText: 'Tu nombre en la cancha',
                          prefixIcon: Icon(Icons.person_outline, size: 18, color: context.c.textSecondary),
                        ),
                      ),
                      const SizedBox(height: 16),
                      Text(
                        'Tu puesto',
                        style: AppTypography.headline(
                            size: 12, weight: FontWeight.w600, color: context.c.textSecondary),
                      ),
                      const SizedBox(height: 6),
                      Row(
                        children: [
                          for (final pos in const ['POR', 'DEF', 'MED', 'DEL'])
                            Expanded(
                              child: Padding(
                                padding: const EdgeInsets.only(right: 6),
                                child: _PositionChip(
                                  label: pos,
                                  selected: _position == pos,
                                  onTap: () => setState(() => _position = pos),
                                ),
                              ),
                            ),
                        ],
                      ),
                      const SizedBox(height: 16),
                    ],

                    // Campo Correo Electrónico
                    Text(
                      'Correo Electrónico',
                      style: AppTypography.headline(size: 12, weight: FontWeight.w600, color: context.c.textSecondary),
                    ),
                    const SizedBox(height: 6),
                    TextField(
                      controller: _emailController,
                      keyboardType: TextInputType.emailAddress,
                      style: AppTypography.body(color: context.c.textSecondary),
                      decoration: InputDecoration(
                        hintText: 'tu@email.com',
                        prefixIcon: Icon(Icons.mail_outline, size: 18, color: context.c.textSecondary),
                      ),
                    ),
                    const SizedBox(height: 16),

                    // Campo Contraseña
                    Text(
                      'Contraseña',
                      style: AppTypography.headline(size: 12, weight: FontWeight.w600, color: context.c.textSecondary),
                    ),
                    const SizedBox(height: 6),
                    TextField(
                      controller: _passwordController,
                      obscureText: _obscurePassword,
                      style: AppTypography.body(color: context.c.textSecondary),
                      decoration: InputDecoration(
                        hintText: '••••••••',
                        prefixIcon: Icon(Icons.lock_outline, size: 18, color: context.c.textSecondary),
                        suffixIcon: IconButton(
                          icon: Icon(
                            _obscurePassword ? Icons.visibility_outlined : Icons.visibility_off_outlined,
                            size: 18,
                            color: context.c.textSecondary,
                          ),
                          onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
                        ),
                      ),
                    ),
                    const SizedBox(height: 22),

                    // Botón Principal
                    ElevatedButton(
                      onPressed: _isLoading ? null : _submit,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: context.c.primary,
                        foregroundColor: context.c.onPrimary,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(
                          borderRadius: AppRadii.cardAll,
                        ),
                        elevation: 4,
                        shadowColor: context.c.brandVolt.withValues(alpha: 0.4),
                      ),
                      child: _isLoading
                          ? SizedBox(
                              height: 20,
                              width: 20,
                              child: CircularProgressIndicator(color: context.c.onPrimary, strokeWidth: 2),
                            )
                          : Text(
                              _isRegister ? 'CREAR CUENTA' : 'INICIAR SESIÓN',
                              style: AppTypography.headline(
                                size: 14,
                                weight: FontWeight.w800,
                                color: context.c.onPrimary,
                              ),
                            ),
                    ),

                    // Link Olvidaste tu contraseña
                    if (!_isRegister) ...[
                      const SizedBox(height: 12),
                      Center(
                        child: TextButton(
                          onPressed: () {},
                          child: Text(
                            '¿Olvidaste tu contraseña?',
                            style: AppTypography.headline(
                              size: 12,
                              color: context.c.primary,
                              weight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ),
                    ],

                    // Separador
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 14.0),
                      child: Row(
                        children: [
                          Expanded(child: Divider(color: context.c.border)),
                          Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 10.0),
                            child: Text(
                              'o',
                              style: AppTypography.code(size: 11, color: context.c.textSecondary),
                            ),
                          ),
                          Expanded(child: Divider(color: context.c.border)),
                        ],
                      ),
                    ),

                    // Botón Continuar con Google
                    OutlinedButton.icon(
                      onPressed: _isLoading ? null : _handleGoogleSignIn,
                      style: OutlinedButton.styleFrom(
                        backgroundColor: context.c.cardSurface.withValues(alpha: 0.5),
                        side: BorderSide(color: context.c.border),
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        shape: RoundedRectangleBorder(
                          borderRadius: AppRadii.cardAll,
                        ),
                      ),
                      icon: Icon(Icons.g_mobiledata, size: 28, color: context.c.textPrimary),
                      label: Text(
                        'Continuar con Google',
                        style: AppTypography.headline(
                          size: 13,
                          weight: FontWeight.w600,
                          color: context.c.textPrimary,
                        ),
                      ),
                    ),
                    const SizedBox(height: 20),

                    // Toggle entre Login y Registro
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          _isRegister ? '¿Ya tienes una cuenta? ' : '¿No tienes una cuenta? ',
                          style: AppTypography.body(size: 13, color: context.c.textSecondary),
                        ),
                        GestureDetector(
                          onTap: () => setState(() => _isRegister = !_isRegister),
                          child: Text(
                            _isRegister ? 'Inicia sesión' : 'Regístrate',
                            style: AppTypography.headline(
                              size: 13,
                              weight: FontWeight.w700,
                              color: context.c.primary,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Un puesto para elegir en el registro.
class _PositionChip extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;

  const _PositionChip({required this.label, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: AppRadii.cardAll,
      child: PateaCard(
               color: selected ? context.c.primary : Colors.transparent,
               radius: AppRadii.cardAll,
               borderColor: selected ? context.c.primary : context.c.overlayStrong,
               padding: const EdgeInsets.symmetric(vertical: 11),
               alignment: Alignment.center,
               child: Text(
          label,
          style: AppTypography.headline(
            size: 12,
            weight: FontWeight.w800,
            color: selected ? context.c.onPrimary : context.c.textSecondary,
          ),
        ),
             ),
    );
  }
}
