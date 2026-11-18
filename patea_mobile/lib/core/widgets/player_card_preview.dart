import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../models/match_model.dart';
import '../models/player_model.dart';
import '../services/firestore_service.dart';
import '../theme/app_typography.dart';
import '../theme/patea_colors.dart';
import 'player_card_widget.dart';

/// The card is the surface; no menu sheet or secondary frame surrounds it.
Future<void> showPlayerCardPreview(
  BuildContext context,
  MatchPlayerEntry entry, {
  String? photo,
}) async {
  final openProfile = await showDialog<bool>(
    context: context,
    barrierColor: context.c.photoFallback.withValues(alpha: .88),
    builder: (_) => _PlayerCardPreview(entry: entry, photo: photo),
  );
  if (openProfile == true && context.mounted && entry.uid.isNotEmpty) {
    context.push('/players/${entry.uid}');
  }
}

class _PlayerCardPreview extends ConsumerWidget {
  final MatchPlayerEntry entry;
  final String? photo;
  const _PlayerCardPreview({required this.entry, this.photo});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final fullPlayer = entry.uid.isEmpty
        ? null
        : ref.watch(singlePlayerStreamProvider(entry.uid)).valueOrNull;
    final player =
        fullPlayer ??
        Player(
          id: entry.uid,
          name: entry.displayName,
          position: entry.position.isEmpty ? 'MED' : entry.position,
          ovr: entry.ovr > 0 ? entry.ovr : 60,
          pac: entry.ovr > 0 ? entry.ovr : 60,
          sho: entry.ovr > 0 ? entry.ovr : 60,
          pas: entry.ovr > 0 ? entry.ovr : 60,
          dri: entry.ovr > 0 ? entry.ovr : 60,
          def: entry.ovr > 0 ? entry.ovr : 60,
          phy: entry.ovr > 0 ? entry.ovr : 60,
          photoUrl: photo ?? entry.photoURL,
        );
    return Dialog(
      backgroundColor: Colors.transparent,
      surfaceTintColor: Colors.transparent,
      shadowColor: Colors.transparent,
      elevation: 0,
      insetPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 20),
      child: SafeArea(
        child: LayoutBuilder(
          builder: (context, constraints) {
            final actionHeight = entry.uid.isEmpty
                ? 0.0
                : math.max(
                    48.0,
                    MediaQuery.textScalerOf(context).scale(15) * 2.5 + 16,
                  );
            final width = math.min(
              340.0,
              math.min(
                constraints.maxWidth,
                math.max(
                  240.0,
                  (constraints.maxHeight - 64 - actionHeight) / 1.5,
                ),
              ),
            );
            return Center(
              child: SizedBox(
                width: width,
                child: SingleChildScrollView(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Align(
                        alignment: Alignment.centerRight,
                        child: IconButton(
                          tooltip: 'Cerrar ficha',
                          onPressed: () => Navigator.of(context).pop(false),
                          icon: Icon(
                            Icons.close_rounded,
                            color: context.c.onPhoto,
                          ),
                          constraints: const BoxConstraints(
                            minWidth: 48,
                            minHeight: 48,
                          ),
                        ),
                      ),
                      const SizedBox(height: 8),
                      SizedBox(
                        key: const ValueKey('player-card-preview'),
                        width: width,
                        child: PlayerCardWidget(
                          player: player,
                          photoStyle: CardPhotoStyle.halfTop,
                        ),
                      ),
                      if (entry.uid.isNotEmpty) ...[
                        const SizedBox(height: 8),
                        TextButton(
                          onPressed: () => Navigator.of(context).pop(true),
                          style: TextButton.styleFrom(
                            foregroundColor: context.c.onPhoto,
                            minimumSize: const Size(48, 48),
                          ),
                          child: Text(
                            'Ver perfil completo',
                            textAlign: TextAlign.center,
                            style: AppTypography.action(
                              size: 15,
                              color: context.c.onPhoto,
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            );
          },
        ),
      ),
    );
  }
}
