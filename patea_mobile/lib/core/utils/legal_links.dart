import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../widgets/patea_snack.dart';

/// Páginas legales públicas (las sirve la web de Pateá). Apple pide que la
/// política de privacidad sea accesible desde la app y desde la ficha de la
/// tienda.
abstract final class LegalLinks {
  static final privacy = Uri.parse('https://mil-disculpis.web.app/privacidad');
  static final terms = Uri.parse('https://mil-disculpis.web.app/terminos');

  static Future<void> open(BuildContext context, Uri url) async {
    final ok = await launchUrl(url, mode: LaunchMode.externalApplication);
    if (!ok && context.mounted) {
      PateaSnack.error(context, 'No se pudo abrir la página');
    }
  }
}
