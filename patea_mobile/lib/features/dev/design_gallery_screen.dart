import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../core/theme/app_radii.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/app_typography.dart';
import '../../core/theme/patea_colors.dart';

/// La galería del sistema de diseño. Sólo en debug.
///
/// Existe por un problema concreto: la Fase 1 cambia el color de 309 sitios y
/// no hay forma honesta de aprobar eso recorriendo la app pantalla por
/// pantalla. Acá están todos los tokens y todos los componentes en una sola
/// vista, y el interruptor de arriba muestra los dos esquemas — que es también
/// la única manera de ver el tema claro antes de que exista la Fase 5.
///
/// El contraste se calcula en vivo con la fórmula de WCAG y se marca en rojo lo
/// que no llega a 4,5:1. Un número acá vale más que una opinión: el defecto que
/// originó todo este trabajo —`textMuted` a 3,48:1— habría saltado a la vista
/// el primer día.
///
/// Ver `docs/technical/AUDITORIA_DE_ESTILOS_Y_MODO_CLARO.md`.
class DesignGalleryScreen extends StatefulWidget {
  const DesignGalleryScreen({super.key});

  @override
  State<DesignGalleryScreen> createState() => _DesignGalleryScreenState();
}

class _DesignGalleryScreenState extends State<DesignGalleryScreen> {
  bool _game = true;

  @override
  Widget build(BuildContext context) {
    final theme = _game ? _dark : _light;
    final c = theme.extension<PateaColors>()!;

    return Theme(
      data: theme,
      child: Scaffold(
        backgroundColor: c.background,
        appBar: AppBar(
          title: const Text('Sistema de diseño'),
          actions: [
            Padding(
              padding: const EdgeInsets.only(right: 12),
              child: SegmentedButton<bool>(
                showSelectedIcon: false,
                segments: const [
                  ButtonSegment(value: true, label: Text('game')),
                  ButtonSegment(value: false, label: Text('claro')),
                ],
                selected: {_game},
                onSelectionChanged: (s) => setState(() => _game = s.first),
              ),
            ),
          ],
        ),
        body: ListView(
          padding: EdgeInsets.fromLTRB(
              16, 16, 16, MediaQuery.paddingOf(context).bottom + 32),
          children: [
            _Section('Superficies', [
              _Swatch('background', c.background),
              _Swatch('card', c.card),
              _Swatch('cardSurface', c.cardSurface),
              _Swatch('popover', c.popover),
              _Swatch('border', c.border),
              _Swatch('input', c.input),
            ]),
            _Section('Marca y acción', [
              _Swatch('primary', c.primary),
              _Swatch('onPrimary', c.onPrimary),
              _Swatch('accent', c.accent),
              _Swatch('brandVolt', c.brandVolt),
            ]),
            _Section('Semánticos', [
              _Swatch('destructive', c.destructive),
              _Swatch('success', c.success),
              _Swatch('warning', c.warning),
              _Swatch('info', c.info),
            ]),
            _Section('Posiciones', [
              _Swatch('posDel', c.posDel),
              _Swatch('posMed', c.posMed),
              _Swatch('posDef', c.posDef),
              _Swatch('posPor', c.posPor),
            ]),
            _Section('Tiers de OVR', [
              _Swatch('elite', c.eliteBorder),
              _Swatch('gold', c.goldBorder),
              _Swatch('silver', c.silverBorder),
              _Swatch('bronze', c.bronzeBorder),
            ]),

            _Title('Contraste del texto'),
            _Note('WCAG AA pide 4,5:1 para texto normal. Lo que no llega va en '
                'rojo. Este panel es el que habría hecho evidente el defecto '
                'que originó todo esto.'),
            _ContrastBlock(c: c, on: c.background, label: 'sobre background'),
            const SizedBox(height: 10),
            _ContrastBlock(c: c, on: c.card, label: 'sobre card'),
            const SizedBox(height: 10),
            _ContrastBlock(c: c, on: c.cardSurface, label: 'sobre cardSurface'),

            _Title('Veladuras'),
            _Note('Sobre una superficie oscura son blancas; en claro invierten '
                'a negro. Adentro de la isla oscura (tarjetas de partido) '
                'tienen que seguir siendo blancas: eso es la Fase 2.'),
            _Overlays(c: c),

            _Title('Tipografía'),
            _Specimen('headline 20/w700', AppTypography.headline()),
            _Specimen('body 14/w400', AppTypography.body()),
            _Specimen('sportNumber 28/w800', AppTypography.sportNumber()),
            _Specimen('code 12/w500', AppTypography.code()),
            _Specimen('jersey 28 (Anton)', AppTypography.jersey(size: 28)),
            _Specimen('condensed 16 (Barlow)',
                AppTypography.condensed(size: 16)),
            _Specimen('editorial 15 (Lora)', AppTypography.editorial(size: 15)),
            const SizedBox(height: 10),
            // Sin `style:` a propósito: si esto sale en Roboto, el textTheme
            // se rompió.
            const Text('Text sin style — tiene que ser Outfit, no Roboto.'),

            _Title('Componentes'),
            Wrap(spacing: 10, runSpacing: 10, children: [
              ElevatedButton(onPressed: () {}, child: const Text('Elevated')),
              FilledButton(onPressed: () {}, child: const Text('Filled')),
              OutlinedButton(onPressed: () {}, child: const Text('Outlined')),
              TextButton(onPressed: () {}, child: const Text('Text')),
              ElevatedButton(onPressed: null, child: const Text('Deshabilitado')),
            ]),
            const SizedBox(height: 14),
            const TextField(
              decoration: InputDecoration(
                hintText: 'Campo de texto',
                labelText: 'Etiqueta',
              ),
            ),
            const SizedBox(height: 14),
            Wrap(spacing: 10, runSpacing: 10, children: [
              const Chip(label: Text('Chip')),
              FilterChip(
                  label: const Text('Elegido'),
                  selected: true,
                  onSelected: (_) {}),
              Switch(value: true, onChanged: (_) {}),
              Switch(value: false, onChanged: (_) {}),
              Checkbox(value: true, onChanged: (_) {}),
              Checkbox(value: false, onChanged: (_) {}),
            ]),
            Slider(value: 0.6, onChanged: (_) {}),
            const Divider(),
            ListTile(
              leading: Icon(Icons.sports_soccer, color: c.primary),
              title: const Text('ListTile con título'),
              subtitle: const Text('y su subtítulo'),
              trailing: const Icon(Icons.chevron_right),
            ),
            const Divider(),
            const SizedBox(height: 10),
            Row(children: [
              const SizedBox(
                  width: 24, height: 24, child: CircularProgressIndicator()),
              const SizedBox(width: 16),
              const Expanded(child: LinearProgressIndicator(value: 0.45)),
            ]),
            const SizedBox(height: 20),
            Row(children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () => ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Así se ve un SnackBar')),
                  ),
                  child: const Text('SnackBar'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: OutlinedButton(
                  onPressed: () => showDialog<void>(
                    context: context,
                    builder: (_) => Theme(
                      data: theme,
                      child: AlertDialog(
                        title: const Text('Un diálogo'),
                        content: const Text(
                            'Antes esto salía con los valores de Material.'),
                        actions: [
                          TextButton(
                            onPressed: () => Navigator.pop(context),
                            child: const Text('Cerrar'),
                          ),
                        ],
                      ),
                    ),
                  ),
                  child: const Text('Diálogo'),
                ),
              ),
            ]),
          ],
        ),
      ),
    );
  }
}

// Se arman una sola vez y no en cada `build`, que corre en cada toque del
// interruptor.
final _dark = AppTheme.darkTheme;
final _light = AppTheme.lightTheme;

// ── Piezas de la galería ───────────────────────────────────────────────────

class _Title extends StatelessWidget {
  final String text;
  const _Title(this.text);

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(top: 28, bottom: 8),
        child: Text(text.toUpperCase(),
            style: AppTypography.headline(
                size: 13,
                weight: FontWeight.w800,
                letterSpacing: 1.4,
                color: context.c.primary)),
      );
}

class _Note extends StatelessWidget {
  final String text;
  const _Note(this.text);

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: Text(text,
            style: AppTypography.body(
                size: 12, height: 1.4, color: context.c.textSecondary)),
      );
}

class _Section extends StatelessWidget {
  final String title;
  final List<Widget> swatches;
  const _Section(this.title, this.swatches);

  @override
  Widget build(BuildContext context) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _Title(title),
          Wrap(spacing: 8, runSpacing: 8, children: swatches),
        ],
      );
}

class _Swatch extends StatelessWidget {
  final String name;
  final Color color;
  const _Swatch(this.name, this.color);

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return SizedBox(
      width: 104,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            height: 46,
            decoration: BoxDecoration(
              color: color,
              borderRadius: AppRadii.chipAll,
              border: Border.all(color: c.border),
            ),
          ),
          const SizedBox(height: 4),
          Text(name,
              style: AppTypography.code(size: 10, color: c.textPrimary),
              maxLines: 1,
              overflow: TextOverflow.ellipsis),
          Text(_hex(color),
              style: AppTypography.code(size: 9, color: c.textSecondary)),
        ],
      ),
    );
  }
}

class _ContrastBlock extends StatelessWidget {
  final PateaColors c;
  final Color on;
  final String label;
  const _ContrastBlock({required this.c, required this.on, required this.label});

  @override
  Widget build(BuildContext context) {
    Widget row(String name, Color fg) {
      final ratio = _contrast(fg, on);
      final ok = ratio >= 4.5;
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 3),
        child: Row(
          children: [
            Expanded(
              child: Text('$name — el zaguero la tiró afuera',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTypography.body(size: 14, color: fg)),
            ),
            const SizedBox(width: 8),
            Text('${ratio.toStringAsFixed(2)}:1',
                style: AppTypography.code(
                    size: 11,
                    weight: FontWeight.w700,
                    color: ok ? c.success : c.destructive)),
            const SizedBox(width: 4),
            Icon(ok ? Icons.check_circle : Icons.error,
                size: 13, color: ok ? c.success : c.destructive),
          ],
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
      decoration: BoxDecoration(
        color: on,
        borderRadius: AppRadii.cardAll,
        border: Border.all(color: c.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label.toUpperCase(),
              style: AppTypography.code(size: 9, color: c.textSecondary)),
          const SizedBox(height: 6),
          row('textPrimary', c.textPrimary),
          row('textSecondary', c.textSecondary),
          row('primary', c.primary),
        ],
      ),
    );
  }
}

class _Overlays extends StatelessWidget {
  final PateaColors c;
  const _Overlays({required this.c});

  @override
  Widget build(BuildContext context) {
    Widget box(String name, Color overlay) => Expanded(
          child: Container(
            height: 62,
            margin: const EdgeInsets.only(right: 8),
            decoration: BoxDecoration(
              color: overlay,
              borderRadius: AppRadii.chipAll,
              border: Border.all(color: c.overlayLine),
            ),
            alignment: Alignment.center,
            child: Text(name,
                style: AppTypography.code(size: 9, color: c.textSecondary)),
          ),
        );

    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: c.card,
        borderRadius: AppRadii.cardAll,
        border: Border.all(color: c.border),
      ),
      child: Row(children: [
        box('subtle', c.overlaySubtle),
        box('line', c.overlayLine),
        box('strong', c.overlayStrong),
      ]),
    );
  }
}

class _Specimen extends StatelessWidget {
  final String label;
  final TextStyle style;
  const _Specimen(this.label, this.style);

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 5),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label,
                style:
                    AppTypography.code(size: 9, color: context.c.textSecondary)),
            Text('Pateá 3-6 · El Vestuario', style: style),
          ],
        ),
      );
}

// ── Cálculos ───────────────────────────────────────────────────────────────

String _hex(Color c) {
  int ch(double v) => (v * 255).round();
  return '#${ch(c.r).toRadixString(16).padLeft(2, '0')}'
          '${ch(c.g).toRadixString(16).padLeft(2, '0')}'
          '${ch(c.b).toRadixString(16).padLeft(2, '0')}'
      .toUpperCase();
}

double _luminance(Color c) {
  double ch(double v) =>
      v <= 0.03928 ? v / 12.92 : math.pow((v + 0.055) / 1.055, 2.4).toDouble();
  return 0.2126 * ch(c.r) + 0.7152 * ch(c.g) + 0.0722 * ch(c.b);
}

/// Contraste de WCAG 2.1 entre dos colores opacos.
double _contrast(Color a, Color b) {
  final la = _luminance(a), lb = _luminance(b);
  final hi = math.max(la, lb), lo = math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}
