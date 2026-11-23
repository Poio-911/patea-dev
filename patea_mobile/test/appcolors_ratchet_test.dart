import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

/// El trinquete de la migración al tema.
///
/// La idea original era medir el avance con el contador de `flutter analyze`,
/// marcando `AppColors` como `@Deprecated`. **No funciona**: en Dart 3.11 el
/// analizador no reporta el uso de algo deprecado dentro del mismo paquete, ni
/// con la clase anotada, ni con cada miembro, ni habilitando
/// `deprecated_member_use_from_same_package` — se verificó con un archivo que
/// usaba `AppColors.background` y no salió ni un aviso.
///
/// Así que el contador es este test, y de paso hace algo que el analizador no
/// haría: **falla si el número sube**.
///
/// **Qué cuenta, y por qué no sólo `AppColors`.** La primera versión contaba
/// nada más los usos de `AppColors`, y falló apenas la Fase 1 reemplazó 36
/// literales sueltos por tokens: cambiar `Color(0xFF141A24)` por
/// `AppColors.card` es un avance, pero sumaba uno al contador. Lo que hay que
/// medir no es "cuántas veces se nombra AppColors" sino **cuántos colores no
/// salen del tema**, que es la suma de las tres formas de esquivarlo:
///
///   1. `AppColors.<token>`  — constantes, no cambian de tema
///   2. `Color(0x...)`       — literales sueltos
///   3. `Colors.white/black` — absolutos, no sobreviven al tema claro
///
/// `app_colors.dart` ya no existe: los 1.402 usos migraron a `context.c` y la
/// clase se borró. Lo que este test cuida ahora es que no vuelvan.
void main() {
  // Fixed artwork colors are independent of the UI theme: avatar duotones,
  // custom jersey/crest materials, approved OVR tiers and jersey photo inputs.
  // Each file has its own cap; every other UI file keeps a zero allowance.
  const artworkBudgets = {
    'lib/core/widgets/player_avatar_fallback.dart': 40,
    // 23 -> 34: el rediseño del escudo (`18deb80c`) dibuja bordes, esmaltes y
    // metales con colores fijos —un escudo dorado es dorado en los dos
    // temas—. Ya estaba por encima del tope cuando se hizo ese commit; se
    // sube a lo medido en vez de dejar el trinquete en rojo, y de acá no debe
    // seguir creciendo.
    'lib/core/widgets/jersey_painter.dart': 34,
    'lib/core/widgets/ovr_accent.dart': 15,
    'lib/features/players/portrait_studio_screen.dart': 2,
    // El botón «Continuar con Apple»: Apple fija sus colores (blanco sobre
    // fondo oscuro, negro sobre claro) y no se pueden tomar del tema.
    'lib/features/auth/login_screen.dart': 4,
  };
  final presupuesto = artworkBudgets.values.reduce((a, b) => a + b);

  test('los colores fuera del tema sólo pueden bajar', () {
    final patrones = <String, RegExp>{
      'AppColors': RegExp(r'AppColors\.[a-zA-Z]'),
      'literales': RegExp(r'Color\(0x'),
      'absolutos': RegExp(r'Colors\.(white|black)'),
    };
    final totales = {for (final k in patrones.keys) k: 0};
    final porArchivo = <String, int>{};

    for (final f in Directory(
      'lib',
    ).listSync(recursive: true).whereType<File>()) {
      final path = f.path.replaceAll(r'\', '/');
      if (!path.endsWith('.dart')) continue;
      // `core/theme/` es justamente donde los colores tienen que estar.
      if (path.contains('lib/core/theme/')) continue;

      final src = f.readAsStringSync();
      var n = 0;
      patrones.forEach((nombre, re) {
        final c = re.allMatches(src).length;
        totales[nombre] = totales[nombre]! + c;
        n += c;
      });
      if (n > 0) porArchivo[path] = n;
    }

    final total = totales.values.reduce((a, b) => a + b);
    for (final entry in porArchivo.entries) {
      expect(
        entry.value,
        lessThanOrEqualTo(artworkBudgets[entry.key] ?? 0),
        reason:
            '${entry.key} agrega colores fuera del tema sin una excepción de arte aprobada.',
      );
    }
    final top = porArchivo.entries.toList()
      ..sort((a, b) => b.value.compareTo(a.value));

    // ignore: avoid_print
    print(
      'Colores fuera del tema: $total / $presupuesto\n'
      '  ${totales.entries.map((e) => '${e.key} ${e.value}').join(' · ')}\n'
      '${top.take(8).map((e) => '  ${e.value}  ${e.key}').join('\n')}',
    );

    expect(
      total,
      lessThanOrEqualTo(presupuesto),
      reason:
          'Hay $total colores fuera del tema y el presupuesto es '
          '$presupuesto.\nUn archivo nuevo debería tomarlos de `context.c`. '
          'Si el aumento es a propósito,\nsubí el presupuesto y dejá dicho por '
          'qué.',
    );
  });
}
