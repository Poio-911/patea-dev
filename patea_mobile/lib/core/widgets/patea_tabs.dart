import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../theme/patea_colors.dart';
import '../theme/app_typography.dart';

/// Las pestañas de una sección.
///
/// Es el lenguaje que ya usaban Panel ("Mi Resumen / Mi Grupo") y Partidos
/// ("Próximos / Semana / Historial"): fila de etiquetas con una barra neón
/// abajo de la activa y un contador opcional al costado. Estaba escrito dos
/// veces y Explorar tenía inventado un tercer estilo —cajitas con ícono,
/// tipo control segmentado de iOS—, así que la misma app cambiaba de idioma
/// al pasar de una sección a otra.
///
/// El contador aparece sólo si hay algo que contar: un "0" al lado de una
/// pestaña no informa, decora.
///
/// **Una sola forma, sin perillas.** Había cuatro barras de pestañas en la
/// app: esta, una copia literal en Partidos, una propia en el Panel —mayúsculas,
/// otra fuente, activa en blanco en vez de volt, subrayado con glow y ancho
/// completo— y el `TabBar` de Material sin tocar en Competiciones. La forma de
/// no volver ahí no es agregarle un parámetro por cada caso: es que haya una.
/// El único detalle que se rescató del Panel es la háptica, porque no cambia
/// cómo se ve y sí cómo se siente.
class PateaTab {
  final String label;
  final int count;

  const PateaTab(this.label, {this.count = 0});
}

class PateaTabs extends StatefulWidget {
  final List<PateaTab> tabs;
  final int active;
  final ValueChanged<int> onChanged;

  const PateaTabs({
    super.key,
    required this.tabs,
    required this.active,
    required this.onChanged,
  });

  @override
  State<PateaTabs> createState() => _PateaTabsState();
}

class _PateaTabsState extends State<PateaTabs> {
  final ScrollController _scroll = ScrollController();
  bool _showRightFade = false;

  @override
  void initState() {
    super.initState();
    _scroll.addListener(_syncFade);
    WidgetsBinding.instance.addPostFrameCallback((_) => _syncFade());
  }

  @override
  void didUpdateWidget(covariant PateaTabs oldWidget) {
    super.didUpdateWidget(oldWidget);
    WidgetsBinding.instance.addPostFrameCallback((_) => _syncFade());
  }

  void _syncFade() {
    if (!mounted || !_scroll.hasClients) return;
    final pos = _scroll.position;
    final next = pos.maxScrollExtent > 2 && pos.pixels < pos.maxScrollExtent - 2;
    if (next != _showRightFade) setState(() => _showRightFade = next);
  }

  @override
  void dispose() {
    _scroll
      ..removeListener(_syncFade)
      ..dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final scrollView = SingleChildScrollView(
      controller: _scroll,
      scrollDirection: Axis.horizontal,
      physics: const ClampingScrollPhysics(),
      child: Row(
        children: [
          for (var i = 0; i < widget.tabs.length; i++)
            Padding(
              padding: const EdgeInsets.only(right: 4),
              child: _Tab(
                tab: widget.tabs[i],
                active: i == widget.active,
                onTap: () => widget.onChanged(i),
              ),
            ),
        ],
      ),
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Se desplaza en horizontal en vez de recortar; cuando desborda hacia
        // la derecha se insinúa con un desvanecimiento suave de máscara alfa.
        NotificationListener<ScrollMetricsNotification>(
          onNotification: (_) {
            _syncFade();
            return false;
          },
          child: _showRightFade
              ? ShaderMask(
                  blendMode: BlendMode.dstIn,
                  shaderCallback: (bounds) => LinearGradient(
                    begin: Alignment.centerLeft,
                    end: Alignment.centerRight,
                    stops: const [0.0, 0.88, 1.0],
                    colors: [
                      c.textPrimary,
                      c.textPrimary,
                      c.textPrimary.withValues(alpha: 0),
                    ],
                  ).createShader(bounds),
                  child: scrollView,
                )
              : scrollView,
        ),
        Container(height: 1, color: c.border.withValues(alpha: 0.3)),
      ],
    );
  }
}

class _Tab extends StatelessWidget {
  final PateaTab tab;
  final bool active;
  final VoidCallback onTap;

  const _Tab({required this.tab, required this.active, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: () {
        HapticFeedback.selectionClick();
        onTap();
      },
      child: ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 44),
        child: Container(
          alignment: Alignment.center,
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(
            border: Border(
              bottom: BorderSide(
                color: active ? context.c.primary : Colors.transparent,
                width: 2,
              ),
            ),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                tab.label,
                style: AppTypography.body(
                  size: 14,
                  weight: FontWeight.w700,
                  color: active ? context.c.primary : context.c.textSecondary,
                ),
              ),
              if (tab.count > 0) ...[
                const SizedBox(width: 6),
                Text(
                  '${tab.count}',
                  style: AppTypography.body(
                    size: 12,
                    weight: FontWeight.w600,
                    color: active ? context.c.primary : context.c.textSecondary,
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
