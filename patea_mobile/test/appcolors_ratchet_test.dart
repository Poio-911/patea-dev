import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

/// El trinquete de la migración de `AppColors` a `PateaColors`.
///
/// La idea original era medir el avance con el contador de `flutter analyze`,
/// marcando `AppColors` como `@Deprecated`. **No funciona**: en esta versión
/// del SDK (Dart 3.11) el analizador no reporta el uso de algo deprecado
/// dentro del mismo paquete, ni con la clase ni con cada miembro anotados, ni
/// habilitando `deprecated_member_use_from_same_package` — se verificó con un
/// archivo de prueba que usaba `AppColors.background` y no salió ni un aviso.
///
/// Así que el contador es este test, y de paso hace algo que el analizador no
/// haría: **falla si el número sube**. Un archivo nuevo no puede volver a
/// tomar colores de las constantes.
///
/// Cómo se usa: cada vez que se migra un archivo, baja [_presupuesto] al
/// número que imprime el test. Cuando llegue a 0 se borra `app_colors.dart` y
/// este archivo con él.
void main() {
  // Al cerrar la Fase 0.
  const presupuesto = 1229;

  test('los usos de AppColors sólo pueden bajar', () {
    final lib = Directory('lib');
    final usos = <String, int>{};
    var total = 0;

    for (final f in lib.listSync(recursive: true).whereType<File>()) {
      if (!f.path.endsWith('.dart')) continue;
      if (f.path.endsWith('app_colors.dart')) continue;
      final n = RegExp(r'AppColors\.[a-zA-Z]')
          .allMatches(f.readAsStringSync())
          .length;
      if (n > 0) {
        usos[f.path] = n;
        total += n;
      }
    }

    final top = usos.entries.toList()
      ..sort((a, b) => b.value.compareTo(a.value));
    final detalle = top.take(10).map((e) => '  ${e.value}  ${e.key}').join('\n');

    // ignore: avoid_print
    print('AppColors: $total usos en ${usos.length} archivos '
        '(presupuesto $presupuesto)\n$detalle');

    expect(
      total,
      lessThanOrEqualTo(presupuesto),
      reason: 'Hay $total usos de AppColors y el presupuesto es $presupuesto.\n'
          'Un archivo nuevo no debería tomar colores de las constantes: usá\n'
          '`context.c`. Si el aumento es a propósito, subí el presupuesto y\n'
          'dejá dicho por qué.',
    );
  });
}
