import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/services/firestore_service.dart';
import '../../core/theme/app_typography.dart';
import '../../core/theme/patea_colors.dart';
import '../../core/utils/feed_grouping.dart';
import '../../core/widgets/patea_avatar.dart';
import '../../core/widgets/patea_card.dart';

/// Lo que dejó la evaluación de un partido, en una sola tarjeta: quiénes más
/// subieron, un resumen de cómo le fue al resto y «Ver todo».
class OvrRoundCard extends ConsumerWidget {
  final OvrRound round;
  const OvrRoundCard({super.key, required this.round});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.c;
    final title =
        ref.watch(singleMatchStreamProvider(round.matchId)).asData?.value?.title;
    final top = round.top();
    final rest = round.changes.length - top.length;

    final summary = [
      if (round.risers > 0)
        '${round.risers} ${round.risers == 1 ? 'subió' : 'subieron'}',
      if (round.steady > 0)
        '${round.steady} ${round.steady == 1 ? 'se mantuvo' : 'se mantuvieron'}',
      if (round.fallers > 0)
        '${round.fallers} ${round.fallers == 1 ? 'bajó' : 'bajaron'}',
    ].join(' · ');

    return PateaCard(
      color: c.card,
      borderColor: c.border.withValues(alpha: 0.55),
      padding: const EdgeInsets.fromLTRB(14, 12, 6, 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(right: 8),
            child: Row(
              children: [
                Icon(Icons.trending_up_rounded, size: 20, color: c.primary),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    title == null || title.isEmpty
                        ? 'Se evaluó un partido'
                        : 'Se evaluó «$title»',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppTypography.headline(
                      size: 15,
                      weight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 2),
          Padding(
            padding: const EdgeInsets.only(left: 28, right: 8),
            child: Text(
              summary,
              style: AppTypography.body(size: 12.5, color: c.textSecondary),
            ),
          ),
          if (top.isNotEmpty) ...[
            const SizedBox(height: 10),
            for (final change in top)
              Padding(
                padding: const EdgeInsets.only(right: 8, bottom: 6),
                child: _ChangeRow(change: change),
              ),
          ],
          Align(
            alignment: Alignment.centerLeft,
            child: TextButton(
              onPressed: () => showOvrRoundSheet(context, round, title),
              child: Text(
                rest > 0 ? 'Ver todo (+$rest más)' : 'Ver todo',
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ChangeRow extends StatelessWidget {
  final OvrChange change;
  const _ChangeRow({required this.change});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final delta = change.change;
    final color = delta > 0
        ? c.success
        : delta < 0
        ? c.destructive
        : c.textSecondary;
    return InkWell(
      onTap: change.playerId.isEmpty
          ? null
          : () => context.push('/players/${change.playerId}'),
      borderRadius: BorderRadius.circular(10),
      child: Row(
        children: [
          PateaAvatar(
            photoUrl: change.photoUrl,
            seed: change.playerId.isEmpty ? change.name : change.playerId,
            size: 32,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              change.name,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppTypography.body(size: 14, weight: FontWeight.w600),
            ),
          ),
          Text(
            'OVR ${change.newOvr}',
            style: AppTypography.body(size: 13, color: c.textSecondary),
          ),
          SizedBox(
            width: 38,
            child: Text(
              delta > 0 ? '+$delta' : '$delta',
              textAlign: TextAlign.end,
              style: AppTypography.body(
                size: 13,
                weight: FontWeight.w800,
                color: color,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// La lista completa de la ronda, de quien más subió a quien más bajó.
Future<void> showOvrRoundSheet(
  BuildContext context,
  OvrRound round,
  String? title,
) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (_) => DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.7,
      maxChildSize: 0.92,
      builder: (context, controller) {
        final c = context.c;
        return PateaCard(
          color: c.popover,
          radius: const BorderRadius.vertical(top: Radius.circular(24)),
          padding: EdgeInsets.zero,
          child: ListView(
            controller: controller,
            padding: EdgeInsets.fromLTRB(
              20,
              18,
              14,
              18 + MediaQuery.paddingOf(context).bottom,
            ),
            children: [
              Text(
                title == null || title.isEmpty
                    ? 'Cómo quedó el plantel'
                    : title,
                style: AppTypography.headline(size: 20, weight: FontWeight.w800),
              ),
              const SizedBox(height: 2),
              Text(
                'Cambios de OVR tras la evaluación',
                style: AppTypography.body(size: 13, color: c.textSecondary),
              ),
              const SizedBox(height: 14),
              for (final change in round.changes)
                Padding(
                  padding: const EdgeInsets.only(right: 6, bottom: 10),
                  child: _ChangeRow(change: change),
                ),
            ],
          ),
        );
      },
    ),
  );
}
