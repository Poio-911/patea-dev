import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../theme/patea_colors.dart';

String ovrCategory(int ovr) => ovr >= 90
    ? 'ELITE+'
    : ovr >= 80
    ? 'ELITE'
    : ovr >= 70
    ? 'PRO'
    : '';

Color ovrAccentColor(PateaColors colors, int ovr) {
  final dark = colors.isDarkSurface;
  if (ovr >= 90 && !dark) return const Color(0xFFA42D51);
  if (ovr >= 95) return const Color(0xFFEE9AF2);
  if (ovr >= 90) return const Color(0xFFF2C230);
  if (ovr >= 80)
    return dark ? const Color(0xFFD3A3FF) : const Color(0xFF7632AD);
  if (ovr >= 70)
    return dark ? const Color(0xFF76DFFF) : const Color(0xFF175AA2);
  if (ovr >= 65)
    return dark ? const Color(0xFFBDCFE3) : const Color(0xFF526176);
  if (ovr >= 55)
    return dark ? const Color(0xFFE3AD7D) : const Color(0xFF804720);
  return colors.textSecondary;
}

Duration ovrPrismPause(int ovr) => Duration(
  milliseconds: (12000 - ((ovr.clamp(71, 99) - 71) / 28) * 7000).round(),
);

/// Solid score at rest; a temporary prism reflection only above OVR 70.
class OvrPrismNumber extends StatefulWidget {
  final int ovr;
  final String seed;
  final TextStyle style;
  const OvrPrismNumber({
    super.key,
    required this.ovr,
    required this.seed,
    required this.style,
  });
  @override
  State<OvrPrismNumber> createState() => _OvrPrismNumberState();
}

class _OvrPrismNumberState extends State<OvrPrismNumber>
    with SingleTickerProviderStateMixin, WidgetsBindingObserver {
  late final AnimationController _controller;
  Timer? _timer;
  bool _enabled = false;
  bool _foreground = true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1300),
    );
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _configure();
  }

  @override
  void didUpdateWidget(covariant OvrPrismNumber oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.ovr != widget.ovr || oldWidget.seed != widget.seed)
      _configure();
  }

  void _configure() {
    _timer?.cancel();
    _controller.stop();
    _controller.value = 0;
    _enabled =
        widget.ovr > 70 &&
        TickerMode.valuesOf(context).enabled &&
        !MediaQuery.disableAnimationsOf(context) &&
        !MediaQuery.accessibleNavigationOf(context);
    if (_enabled && _foreground) _schedule(initial: true);
  }

  bool get _visible {
    final box = context.findRenderObject();
    if (box is! RenderBox || !box.attached || !box.hasSize) return false;
    final origin = box.localToGlobal(Offset.zero);
    final screen = MediaQuery.sizeOf(context);
    return (origin & box.size).overlaps(Offset.zero & screen);
  }

  void _schedule({bool initial = false}) {
    if (!_enabled || !_foreground) return;
    final offset =
        widget.seed.codeUnits.fold<int>(
          0,
          (v, c) => (v * 31 + c) & 0x7fffffff,
        ) %
        2000;
    final delay = initial
        ? Duration(milliseconds: 900 + offset)
        : ovrPrismPause(widget.ovr) + Duration(milliseconds: offset);
    _timer = Timer(delay, () async {
      if (!mounted || !_enabled || !_foreground) return;
      if (_visible) {
        try {
          await _controller.forward(from: 0).orCancel;
        } on TickerCanceled {
          return;
        }
      }
      if (mounted) _schedule();
    });
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    _foreground = state == AppLifecycleState.resumed;
    if (_foreground) {
      _configure();
    } else {
      _timer?.cancel();
      _controller.stop();
      _controller.value = 0;
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _timer?.cancel();
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: _controller,
    child: Text('${widget.ovr}', style: widget.style),
    builder: (context, child) {
      final t = _controller.value;
      final active = _enabled && t > 0 && t < 1;
      final power = .7 + ((widget.ovr.clamp(71, 99) - 71) / 28) * .3;
      return Stack(
        clipBehavior: Clip.none,
        children: [
          child!,
          if (active)
            Positioned.fill(
              child: ExcludeSemantics(
                child: IgnorePointer(
                  child: Opacity(
                    opacity: (math.sin(t * math.pi) * power).clamp(0, 1),
                    child: ShaderMask(
                      blendMode: BlendMode.srcIn,
                      shaderCallback: (rect) {
                        final x = -3 + t * 6;
                        return LinearGradient(
                          begin: Alignment(x - 1.2, -1),
                          end: Alignment(x + 1.2, 1),
                          colors: const [
                            Colors.transparent,
                            Color(0xFFA8F9FF),
                            Colors.white,
                            Color(0xFFF4AAFF),
                            Colors.transparent,
                          ],
                          stops: const [0, .3, .5, .7, 1],
                        ).createShader(rect);
                      },
                      child: Text(
                        '${widget.ovr}',
                        style: widget.style.copyWith(color: Colors.white),
                      ),
                    ),
                  ),
                ),
              ),
            ),
        ],
      );
    },
  );
}
