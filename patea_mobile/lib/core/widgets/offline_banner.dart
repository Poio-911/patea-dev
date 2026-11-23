import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../services/connectivity_service.dart';
import '../theme/app_typography.dart';
import '../theme/patea_colors.dart';

/// Aviso fijo arriba de todo cuando no hay conexión; al volver, «Conexión
/// restaurada» unos segundos. Mientras está caída la app sigue mostrando lo
/// último que guardó.
class OfflineBanner extends ConsumerStatefulWidget {
  const OfflineBanner({super.key});

  @override
  ConsumerState<OfflineBanner> createState() => _OfflineBannerState();
}

class _OfflineBannerState extends ConsumerState<OfflineBanner> {
  bool _wasOffline = false;
  bool _showRestored = false;
  Timer? _hideTimer;

  @override
  void dispose() {
    _hideTimer?.cancel();
    super.dispose();
  }

  void _onChange(bool online) {
    if (!online) {
      _hideTimer?.cancel();
      setState(() {
        _wasOffline = true;
        _showRestored = false;
      });
    } else if (_wasOffline) {
      setState(() {
        _wasOffline = false;
        _showRestored = true;
      });
      _hideTimer?.cancel();
      _hideTimer = Timer(const Duration(seconds: 3), () {
        if (mounted) setState(() => _showRestored = false);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<AsyncValue<bool>>(onlineProvider, (_, next) {
      final online = next.asData?.value;
      if (online != null) _onChange(online);
    });
    return Positioned(
      top: 0,
      left: 0,
      right: 0,
      child: OfflineBannerView(offline: _wasOffline, restored: _showRestored),
    );
  }
}

/// Solo el dibujo, para poder probarlo sin red.
class OfflineBannerView extends StatelessWidget {
  final bool offline;
  final bool restored;

  const OfflineBannerView({
    super.key,
    required this.offline,
    required this.restored,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final visible = offline || restored;
    return AnimatedSwitcher(
      duration: const Duration(milliseconds: 250),
      child: !visible
          ? const SizedBox.shrink(key: ValueKey('hidden'))
          : Material(
              key: ValueKey(offline ? 'offline' : 'restored'),
              color: offline ? c.destructive : c.success,
              child: SafeArea(
                bottom: false,
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 6,
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        offline ? Icons.wifi_off_rounded : Icons.wifi_rounded,
                        size: 16,
                        color: Colors.white,
                      ),
                      const SizedBox(width: 8),
                      Flexible(
                        child: Text(
                          offline
                              ? 'Sin conexión: mostrando lo último guardado'
                              : 'Conexión restaurada',
                          style: AppTypography.body(
                            size: 13,
                            weight: FontWeight.w700,
                            color: Colors.white,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
    );
  }
}
