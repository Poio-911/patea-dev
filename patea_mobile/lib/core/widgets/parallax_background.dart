import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';

/// Fondo con parallax: la imagen se desplaza dentro de la tarjeta según dónde
/// está la tarjeta en la pantalla.
///
/// Es la receta oficial de Flutter para listas con parallax. Necesita la
/// posición de scroll cuadro a cuadro, así que no se puede aproximar con CSS:
/// en la web el fondo de cada tarjeta queda quieto.
class ParallaxBackground extends StatelessWidget {
  final String asset;
  final double opacity;

  /// Cuánto se mueve la imagen respecto de la tarjeta. 0 = quieta.
  final double amount;

  const ParallaxBackground({
    super.key,
    required this.asset,
    this.opacity = 0.22,
    this.amount = 1.0,
  });

  @override
  Widget build(BuildContext context) {
    final backgroundKey = GlobalKey();
    return Opacity(
      opacity: opacity,
      child: _Parallax(
        backgroundKey: backgroundKey,
        amount: amount,
        child: Image.asset(
          asset,
          key: backgroundKey,
          fit: BoxFit.cover,
          // Se dibuja más alta que la tarjeta para que al desplazarse no
          // aparezcan bordes vacíos.
          alignment: Alignment.center,
        ),
      ),
    );
  }
}

class _Parallax extends SingleChildRenderObjectWidget {
  final GlobalKey backgroundKey;
  final double amount;

  const _Parallax({
    required Widget super.child,
    required this.backgroundKey,
    required this.amount,
  });

  @override
  RenderObject createRenderObject(BuildContext context) {
    return _RenderParallax(
      scrollable: Scrollable.of(context),
      listItemContext: context,
      backgroundImageKey: backgroundKey,
      amount: amount,
    );
  }

  @override
  void updateRenderObject(BuildContext context, _RenderParallax renderObject) {
    renderObject
      ..scrollable = Scrollable.of(context)
      ..listItemContext = context
      ..backgroundImageKey = backgroundKey
      ..amount = amount;
  }
}

class _ParallaxParentData extends ContainerBoxParentData<RenderBox> {}

class _RenderParallax extends RenderBox
    with RenderObjectWithChildMixin<RenderBox>, RenderProxyBoxMixin {
  _RenderParallax({
    required ScrollableState scrollable,
    required this.listItemContext,
    required this.backgroundImageKey,
    required this.amount,
  }) : _scrollable = scrollable;

  ScrollableState _scrollable;
  BuildContext listItemContext;
  GlobalKey backgroundImageKey;
  double amount;

  ScrollableState get scrollable => _scrollable;
  set scrollable(ScrollableState value) {
    if (value == _scrollable) return;
    if (attached) _scrollable.position.removeListener(markNeedsLayout);
    _scrollable = value;
    if (attached) _scrollable.position.addListener(markNeedsLayout);
  }

  @override
  void attach(PipelineOwner owner) {
    super.attach(owner);
    _scrollable.position.addListener(markNeedsLayout);
  }

  @override
  void detach() {
    _scrollable.position.removeListener(markNeedsLayout);
    super.detach();
  }

  @override
  void setupParentData(RenderObject child) {
    if (child.parentData is! _ParallaxParentData) {
      child.parentData = _ParallaxParentData();
    }
  }

  @override
  void performLayout() {
    size = constraints.biggest;

    // La imagen se dibuja más alta que la tarjeta: ese sobrante es el
    // recorrido disponible para desplazarla.
    final background = child!;
    final backgroundConstraints = BoxConstraints.tightFor(
      width: size.width,
      height: size.height + 60 * amount,
    );
    background.layout(backgroundConstraints, parentUsesSize: true);
    (background.parentData as _ParallaxParentData).offset = Offset.zero;
  }

  @override
  void paint(PaintingContext context, Offset offset) {
    final scrollableBox = scrollable.context.findRenderObject() as RenderBox?;
    final listItemBox = listItemContext.findRenderObject() as RenderBox?;
    if (scrollableBox == null || listItemBox == null || !listItemBox.attached) {
      return;
    }

    // Dónde está el centro de la tarjeta dentro del viewport, de 0 a 1.
    final listItemOffset = listItemBox.localToGlobal(
      listItemBox.size.centerLeft(Offset.zero),
      ancestor: scrollableBox,
    );
    final viewportHeight = scrollableBox.size.height;
    final fraction = (listItemOffset.dy / viewportHeight).clamp(0.0, 1.0);

    final background = child!;
    final travel = background.size.height - size.height;
    final childOffset = Offset(0, -fraction * travel);

    context.pushClipRect(
      needsCompositing,
      offset,
      Offset.zero & size,
      (context, offset) => context.paintChild(background, offset + childOffset),
    );
  }
}
