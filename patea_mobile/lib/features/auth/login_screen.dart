import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/theme/app_colors.dart';
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
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Por favor completa todos los campos.'),
          backgroundColor: AppColors.warning,
        ),
      );
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
            backgroundColor: AppColors.destructive,
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
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error al iniciar con Google: $e'),
            backgroundColor: AppColors.destructive,
          ),
        );
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
                  color: AppColors.card.withValues(alpha: 0.85),
                  borderRadius: BorderRadius.circular(24),
                  border: Border.all(
                    color: AppColors.border.withValues(alpha: 0.5),
                    width: 1.2,
                  ),
                  boxShadow: [
                    BoxShadow(
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
                          color: AppColors.voltNeon.withValues(alpha: 0.12),
                          border: Border.all(color: AppColors.voltNeon, width: 2),
                          boxShadow: [
                            BoxShadow(
                              color: AppColors.voltNeon.withValues(alpha: 0.25),
                              blurRadius: 18,
                              spreadRadius: 2,
                            ),
                          ],
                        ),
                        child: const Icon(
                          Icons.sports_soccer,
                          color: AppColors.voltNeon,
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
                        color: AppColors.textPrimary,
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
                        color: AppColors.textSecondary,
                      ),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 28),

                    // Campo Nombre (solo en registro)
                    if (_isRegister) ...[
                      Text(
                        'Nombre / Apodo',
                        style: AppTypography.headline(size: 12, weight: FontWeight.w600, color: AppColors.textSecondary),
                      ),
                      const SizedBox(height: 6),
                      TextField(
                        controller: _nameController,
                        style: AppTypography.body(),
                        decoration: const InputDecoration(
                          hintText: 'Tu nombre en la cancha',
                          prefixIcon: Icon(Icons.person_outline, size: 18, color: AppColors.textMuted),
                        ),
                      ),
                      const SizedBox(height: 16),
                      Text(
                        'Tu puesto',
                        style: AppTypography.headline(
                            size: 12, weight: FontWeight.w600, color: AppColors.textSecondary),
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
                      style: AppTypography.headline(size: 12, weight: FontWeight.w600, color: AppColors.textSecondary),
                    ),
                    const SizedBox(height: 6),
                    TextField(
                      controller: _emailController,
                      keyboardType: TextInputType.emailAddress,
                      style: AppTypography.body(),
                      decoration: const InputDecoration(
                        hintText: 'tu@email.com',
                        prefixIcon: Icon(Icons.mail_outline, size: 18, color: AppColors.textMuted),
                      ),
                    ),
                    const SizedBox(height: 16),

                    // Campo Contraseña
                    Text(
                      'Contraseña',
                      style: AppTypography.headline(size: 12, weight: FontWeight.w600, color: AppColors.textSecondary),
                    ),
                    const SizedBox(height: 6),
                    TextField(
                      controller: _passwordController,
                      obscureText: _obscurePassword,
                      style: AppTypography.body(),
                      decoration: InputDecoration(
                        hintText: '••••••••',
                        prefixIcon: const Icon(Icons.lock_outline, size: 18, color: AppColors.textMuted),
                        suffixIcon: IconButton(
                          icon: Icon(
                            _obscurePassword ? Icons.visibility_outlined : Icons.visibility_off_outlined,
                            size: 18,
                            color: AppColors.textMuted,
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
                        backgroundColor: AppColors.voltNeon,
                        foregroundColor: Colors.black,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                        elevation: 4,
                        shadowColor: AppColors.voltNeon.withValues(alpha: 0.4),
                      ),
                      child: _isLoading
                          ? const SizedBox(
                              height: 20,
                              width: 20,
                              child: CircularProgressIndicator(color: Colors.black, strokeWidth: 2),
                            )
                          : Text(
                              _isRegister ? 'CREAR CUENTA' : 'INICIAR SESIÓN',
                              style: AppTypography.headline(
                                size: 14,
                                weight: FontWeight.w800,
                                color: Colors.black,
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
                              color: AppColors.voltNeon,
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
                          const Expanded(child: Divider(color: AppColors.border)),
                          Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 10.0),
                            child: Text(
                              'o',
                              style: AppTypography.code(size: 11, color: AppColors.textMuted),
                            ),
                          ),
                          const Expanded(child: Divider(color: AppColors.border)),
                        ],
                      ),
                    ),

                    // Botón Continuar con Google
                    OutlinedButton.icon(
                      onPressed: _isLoading ? null : _handleGoogleSignIn,
                      style: OutlinedButton.styleFrom(
                        backgroundColor: AppColors.cardSurface.withValues(alpha: 0.5),
                        side: const BorderSide(color: AppColors.border),
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      icon: const Icon(Icons.g_mobiledata, size: 28, color: AppColors.textPrimary),
                      label: Text(
                        'Continuar con Google',
                        style: AppTypography.headline(
                          size: 13,
                          weight: FontWeight.w600,
                          color: AppColors.textPrimary,
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
                          style: AppTypography.body(size: 13, color: AppColors.textSecondary),
                        ),
                        GestureDetector(
                          onTap: () => setState(() => _isRegister = !_isRegister),
                          child: Text(
                            _isRegister ? 'Inicia sesión' : 'Regístrate',
                            style: AppTypography.headline(
                              size: 13,
                              weight: FontWeight.w700,
                              color: AppColors.voltNeon,
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
      borderRadius: BorderRadius.circular(10),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 11),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: selected ? AppColors.voltNeon : Colors.transparent,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: selected ? AppColors.voltNeon : Colors.white.withValues(alpha: 0.18),
          ),
        ),
        child: Text(
          label,
          style: AppTypography.headline(
            size: 12,
            weight: FontWeight.w800,
            color: selected ? Colors.black : AppColors.textSecondary,
          ),
        ),
      ),
    );
  }
}
