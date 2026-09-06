/// Qué tema está eligiendo el usuario, y que se acuerde.
///
/// **Dos opciones, no tres, y sin "seguir al sistema".** La web ofrece `light`
/// y `game` (`themes={['light','game']}` en `client-providers.tsx`), y `game`
/// no es "el modo oscuro": es una identidad de marca con volt neón, foto de
/// cancha y scanlines. Atarla al ajuste de oscuro del teléfono le pondría esa
/// estética a alguien que no la pidió — y al revés, alguien con el teléfono en
/// claro no debería perder la identidad del producto sin decidirlo.
///
/// Ver `docs/technical/AUDITORIA_DE_ESTILOS_Y_MODO_CLARO.md`.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Los dos temas de Pateá, con los nombres que usa la web.
enum PateaTheme {
  /// Volt, carbón y foto de cancha.
  game,

  /// El que en la web viene por defecto.
  light;

  ThemeMode get modo => this == PateaTheme.game ? ThemeMode.dark : ThemeMode.light;

  String get etiqueta => this == PateaTheme.game ? 'Cancha' : 'Claro';
}

const _clave = 'pateaTheme';

final themeControllerProvider =
    NotifierProvider<ThemeController, PateaTheme>(ThemeController.new);

class ThemeController extends Notifier<PateaTheme> {
  @override
  PateaTheme build() {
    // Arranca en `game` y corrige apenas se lee el disco. Leer las
    // preferencias es asincrónico y el primer frame no puede esperar: si
    // arrancara en claro, quien tiene elegido `game` vería un parpadeo blanco
    // en cada arranque.
    _cargar();
    return PateaTheme.game;
  }

  Future<void> _cargar() async {
    final prefs = await SharedPreferences.getInstance();
    final guardado = prefs.getString(_clave);
    if (guardado == null) return;
    final tema = PateaTheme.values
        .where((t) => t.name == guardado)
        .firstOrNull;
    if (tema != null && tema != state) state = tema;
  }

  Future<void> elegir(PateaTheme tema) async {
    if (tema == state) return;
    state = tema;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_clave, tema.name);
  }
}
