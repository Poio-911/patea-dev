import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';

import 'package:patea_mobile/core/theme/app_radii.dart';
import 'package:patea_mobile/core/theme/app_theme.dart';
import 'package:patea_mobile/core/theme/app_typography.dart';
import 'package:patea_mobile/core/theme/patea_colors.dart';
import 'package:patea_mobile/core/widgets/patea_avatar.dart';
import 'package:patea_mobile/core/widgets/patea_states.dart';
import 'package:patea_mobile/core/widgets/patea_tabs.dart';
import 'package:patea_mobile/core/widgets/player_position_badge.dart';

/// Los goldens del sistema de diseño.
///
/// **Por qué no hay uno por pantalla.** Cada pantalla de la app cuelga de
/// Riverpod y de Firestore: para renderizarla en un test habría que sobrescribir
/// todos sus providers, y eso es un arnés por pantalla. Lo que este trabajo
/// tocó no son las pantallas sino la capa que las pinta, y eso sí entra en una
/// vista: los tokens, la tipografía y los componentes compartidos.
///
/// Se corren en los **dos esquemas** y a **1,3× de escala de texto**, que es lo
/// que encuentra los `height:` fijos que recortan cuando alguien agranda la
/// letra del sistema — el pendiente 0.7 de la Fase 0.
///
/// **Dos límites, dichos de frente.** Los íconos de Material salen como
/// cuadraditos: su fuente no se carga en un test de widgets, y no se arregla
/// desde acá. Y el 1,3× cubre los componentes compartidos, no las 545 alturas
/// fijas repartidas por las pantallas — para eso harían falta goldens de
/// pantalla, que necesitan un arnés de providers por cada una.
///
/// Aun así atrapan lo que este trabajo tocó: si alguien cambia un token, una
/// fuente, un radio o un espaciado del sistema, estas cuatro imágenes cambian.
///
/// Para regenerarlos después de un cambio a propósito:
/// `flutter test --update-goldens test/goldens`
///
/// Ver `docs/technical/AUDITORIA_DE_ESTILOS_Y_MODO_CLARO.md`.
void main() {
  // Los estilos se construyen al declarar el muestrario, antes de que corra
  // cualquier test, y `google_fonts` necesita el binding para leer el asset.
  TestWidgetsFlutterBinding.ensureInitialized();

  setUpAll(() {
    // Las fuentes están empaquetadas; esto impide que un test sin red las
    // busque igual y termine comparando un golden dibujado en Roboto.
    GoogleFonts.config.allowRuntimeFetching = false;
  });

  for (final (tema, nombre) in [
    (AppTheme.darkTheme, 'game'),
    (AppTheme.lightTheme, 'claro'),
  ]) {
    for (final escala in [1.0, 1.3]) {
      final sufijo = escala == 1.0 ? nombre : '${nombre}_130';

      testWidgets('sistema de diseño · $sufijo', (tester) async {
        tester.view.physicalSize = const Size(1080, 3000);
        tester.view.devicePixelRatio = 2.0;
        addTearDown(tester.view.reset);

        await tester.pumpWidget(
          MediaQuery(
            data: MediaQueryData(textScaler: TextScaler.linear(escala)),
            child: MaterialApp(
              theme: tema,
              debugShowCheckedModeBanner: false,
              home: const _Muestrario(),
            ),
          ),
        );
        // `pumpAndSettle` no sirve: el muestrario tiene un spinner infinito
        // y la espera nunca termina.
        await tester.pump();
        await tester.pump(const Duration(milliseconds: 80));

        // Un desborde de layout llega acá como excepción, así que la escala
        // de 1,3× falla antes de llegar a comparar la imagen.
        expect(tester.takeException(), isNull);

        await expectLater(
          find.byType(_Muestrario),
          matchesGoldenFile('sistema_$sufijo.png'),
        );
      });
    }
  }
}

/// Todo lo compartido, en una vista.
class _Muestrario extends StatelessWidget {
  const _Muestrario();

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Scaffold(
      backgroundColor: c.background,
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _Titulo('Superficies y texto'),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: c.card,
                borderRadius: AppRadii.cardAll,
                border: Border.all(color: c.border),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('El zaguero la tiró afuera',
                      style: AppTypography.headline(color: c.textPrimary)),
                  Text('Y el arquero no la vio pasar',
                      style: AppTypography.body(color: c.textSecondary)),
                ],
              ),
            ),

            _Titulo('Tipografía'),
            Text('Pateá 3-6', style: AppTypography.jersey(size: 30)),
            Text('Barlow Condensed 16', style: AppTypography.condensed(size: 16)),
            Text('Lora editorial 15', style: AppTypography.editorial(size: 15)),
            Text('Source Code Pro 12', style: AppTypography.code(size: 12)),
            const Text('Text sin style — tiene que heredar Outfit'),

            _Titulo('Botones'),
            Wrap(spacing: 8, runSpacing: 8, children: [
              ElevatedButton(onPressed: () {}, child: const Text('Elevated')),
              FilledButton(onPressed: () {}, child: const Text('Filled')),
              OutlinedButton(onPressed: () {}, child: const Text('Outlined')),
              TextButton(onPressed: () {}, child: const Text('Text')),
              const ElevatedButton(onPressed: null, child: Text('Off')),
            ]),

            _Titulo('Pestañas'),
            PateaTabs(
              tabs: const [
                PateaTab('Próximos', count: 3),
                PateaTab('Semana'),
                PateaTab('Historial'),
              ],
              active: 0,
              onChanged: (_) {},
            ),

            _Titulo('Puestos'),
            Wrap(spacing: 8, runSpacing: 8, children: [
              for (final p in ['DEL', 'MED', 'DEF', 'POR'])
                PlayerPositionBadge(position: p),
              for (final p in ['DEL', 'MED'])
                PlayerPositionBadge(position: p, dense: true),
            ]),

            _Titulo('Avatares'),
            Row(children: [
              for (final s in ['uno', 'dos', 'tres', 'cuatro'])
                Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: PateaAvatar(photoUrl: null, seed: s, size: 44),
                ),
            ]),

            _Titulo('Campo y chips'),
            const TextField(
              decoration: InputDecoration(
                labelText: 'Etiqueta',
                hintText: 'Un campo de texto',
              ),
            ),
            const SizedBox(height: 10),
            Wrap(spacing: 8, children: [
              const Chip(label: Text('Chip')),
              FilterChip(
                  label: const Text('Elegido'),
                  selected: true,
                  onSelected: (_) {}),
              Switch(value: true, onChanged: (_) {}),
              Checkbox(value: true, onChanged: (_) {}),
            ]),

            _Titulo('Estados'),
            const PateaLoading(height: 60),
            const PateaEmpty(
              icon: Icons.inbox_outlined,
              title: 'No hay partidos',
              hint: 'Armá uno y aparecen acá.',
              compact: true,
            ),
            const PateaError(compact: true),
          ],
        ),
      ),
    );
  }
}

class _Titulo extends StatelessWidget {
  final String texto;
  const _Titulo(this.texto);

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(top: 20, bottom: 8),
        child: Text(
          texto.toUpperCase(),
          style: AppTypography.headline(
            size: 12,
            weight: FontWeight.w800,
            letterSpacing: 1.3,
            color: context.c.primary,
          ),
        ),
      );
}
