import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/widgets/soccer_runner_icon.dart';

/// Pantalla de arranque, mientras Firebase Auth resuelve si hay sesión.
///
/// Antes era un `CircularProgressIndicator` pelado sobre el fondo oscuro: no
/// decía de qué app era, y encima venía después de un fogonazo blanco, porque
/// el launch screen nativo de Android seguía en el default de Flutter.
///
/// El truco para que el pase se vea como una sola pantalla y no como dos: el
/// drawable nativo (`res/drawable/logo_patea.xml`) dibuja **el mismo logo, del
/// mismo tamaño, sobre el mismo fondo** que esta pantalla. Cuando Flutter toma
/// el control el logo ya está ahí y no se mueve ni un pixel — por eso el logo
/// va anclado al centro exacto y el texto cuelga debajo, en vez de armar una
/// columna centrada que lo correría hacia arriba.
///
/// La animación es la del landing de la web (`src/app/page.tsx`): el logo
/// flota y respira con un halo, en un ciclo de 5 segundos, mientras el
/// nombre y la bajada entran escalonados.
class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> with TickerProviderStateMixin {
  /// Tamaño del logo. Tiene que ser el mismo que el `android:width` del
  /// VectorDrawable del launch screen, o el logo salta al arrancar Flutter.
  static const double _logoSize = 96;

  late final AnimationController _entrance;
  late final AnimationController _ambient;

  bool _reducedMotion = false;

  /// La primera pasada por [didChangeDependencies] tiene que arrancar los
  /// controladores sí o sí. Sin esta bandera, el atajo de "no cambió nada"
  /// comparaba `false == false` y se iba antes de llamar a `forward()`: la
  /// pantalla quedaba con el logo quieto y el texto en opacidad 0.
  bool _started = false;

  @override
  void initState() {
    super.initState();
    _entrance = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    );
    // Los mismos 5 segundos del landing.
    _ambient = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 5000),
    );
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // `disableAnimations` sale del MediaQuery, así que no se puede leer en
    // initState.
    final reduced = MediaQuery.disableAnimationsOf(context);
    if (_started && reduced == _reducedMotion) return;

    _started = true;
    _reducedMotion = reduced;
    if (reduced) {
      _entrance.value = 1;
      _ambient.stop();
      _ambient.value = 0;
    } else {
      _entrance.forward();
      _ambient.repeat();
    }
  }

  @override
  void dispose() {
    _entrance.dispose();
    _ambient.dispose();
    super.dispose();
  }

  double _interval(double begin, double end, Curve curve) {
    return CurvedAnimation(
      parent: _entrance,
      curve: Interval(begin, end, curve: curve),
    ).value;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: Center(
        child: SizedBox(
          height: _logoSize,
          width: double.infinity,
          child: Stack(
            clipBehavior: Clip.none,
            alignment: Alignment.center,
            children: [
              // El logo, clavado en el centro de la pantalla.
              AnimatedBuilder(
                animation: _ambient,
                builder: (context, child) {
                  // 0 -> 1 -> 0, suave en las dos puntas. El landing anima
                  // y: [0,-12,0] y scale: [1,1.05,1] con el mismo ritmo.
                  final p = (1 - math.cos(2 * math.pi * _ambient.value)) / 2;

                  return Transform.translate(
                    offset: Offset(0, -12 * p),
                    child: Transform.scale(
                      scale: 1 + 0.05 * p,
                      child: SizedBox(
                        width: _logoSize * 2.2,
                        height: _logoSize * 2.2,
                        child: Stack(
                          alignment: Alignment.center,
                          children: [
                            // El halo. En la web es un `drop-shadow` que va de
                            // 0.2 a 0.5 de opacidad; acá es un degradado
                            // radial, que es lo que rinde bien en Android.
                            DecoratedBox(
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                gradient: RadialGradient(
                                  colors: [
                                    AppColors.voltNeon.withValues(alpha: 0.16 + 0.16 * p),
                                    AppColors.voltNeon.withValues(alpha: 0.05 + 0.05 * p),
                                    Colors.transparent,
                                  ],
                                  stops: const [0.0, 0.45, 1.0],
                                ),
                              ),
                              child: const SizedBox.expand(),
                            ),
                            child!,
                          ],
                        ),
                      ),
                    ),
                  );
                },
                child: const SoccerRunnerIcon(size: _logoSize),
              ),

              // Nombre y bajada, colgando del logo. Se salen del SizedBox a
              // propósito (`Clip.none`) para no correr el logo del centro.
              Positioned(
                top: _logoSize + 26,
                left: 0,
                right: 0,
                child: AnimatedBuilder(
                  animation: _entrance,
                  builder: (context, _) {
                    final name = _interval(0.10, 0.60, Curves.easeOutCubic);
                    final tag = _interval(0.35, 0.95, Curves.easeOutCubic);

                    return Column(
                      children: [
                        Opacity(
                          opacity: name,
                          child: Transform.translate(
                            offset: Offset(0, 16 * (1 - name)),
                            child: Text(
                              'PATEÁ',
                              style: AppTypography.headline(
                                size: 46,
                                weight: FontWeight.w900,
                                letterSpacing: -2,
                              ).copyWith(height: 1),
                            ),
                          ),
                        ),
                        const SizedBox(height: 10),
                        Opacity(
                          opacity: tag * 0.8,
                          child: Text(
                            'TU FÚTBOL, UNIFICADO.',
                            style: AppTypography.headline(
                              size: 10,
                              weight: FontWeight.w700,
                              color: AppColors.voltNeon,
                              // El landing usa `tracking-[0.5em]`: medio em de
                              // separación, o sea 5px a 10px de cuerpo. Entra
                              // abriéndose.
                              letterSpacing: 2.5 + 2.5 * tag,
                            ),
                          ),
                        ),
                      ],
                    );
                  },
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
