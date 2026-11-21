import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/models/match_model.dart';
import '../../core/models/player_message_model.dart';
import '../../core/services/auth_service.dart';
import '../../core/services/firestore_service.dart';
import '../../core/services/messages_service.dart';
import '../../core/theme/app_radii.dart';
import '../../core/theme/app_typography.dart';
import '../../core/theme/patea_colors.dart';
import '../../core/utils/dates.dart';
import '../../core/widgets/patea_avatar.dart';
import '../../core/widgets/patea_button_progress.dart';
import '../../core/widgets/patea_card.dart';
import '../../core/widgets/patea_snack.dart';
import '../../core/widgets/patea_states.dart';

/// Diálogo reutilizable para escribirle un mensaje a otro jugador (de tu grupo
/// o de otro grupo), con opción de adjuntar un partido próximo ("Anotate acá").
Future<bool> showSendPlayerMessageDialog({
  required BuildContext context,
  required WidgetRef ref,
  required String toUid,
  required String toName,
  String? initialMatchId,
}) async {
  final controller = TextEditingController();
  final uid = ref.read(authStateProvider).value?.uid;
  final upcoming = uid == null
      ? const <MatchModel>[]
      : (ref.read(activeGroupMatchesProvider).value ?? const <MatchModel>[])
            .where((m) => m.status == 'upcoming' && m.ownerUid == uid)
            .toList();
  String? selectedMatchId = initialMatchId;
  bool sending = false;
  bool sent = false;

  await showDialog<void>(
    context: context,
    builder: (ctx) => StatefulBuilder(
      builder: (ctx, setDialogState) => AlertDialog(
        backgroundColor: ctx.c.card,
        title: Text(
          'Mensaje para $toName',
          style: AppTypography.headline(size: 16),
        ),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              TextField(
                controller: controller,
                maxLines: 3,
                maxLength: 500,
                textCapitalization: TextCapitalization.sentences,
                decoration: const InputDecoration(
                  labelText: 'Tu mensaje',
                  hintText: 'Ej: Nos falta 1 hoy a las 21, ¿te sumás?',
                ),
              ),
              if (upcoming.isNotEmpty) ...[
                const SizedBox(height: 8),
                DropdownButtonFormField<String?>(
                  value: selectedMatchId,
                  isExpanded: true,
                  decoration: const InputDecoration(
                    labelText: 'Adjuntar partido (opcional)',
                  ),
                  items: [
                    const DropdownMenuItem<String?>(
                      value: null,
                      child: Text('Solo mensaje'),
                    ),
                    ...upcoming.map(
                      (m) => DropdownMenuItem<String?>(
                        value: m.id,
                        child: Text(
                          '${m.title} · ${fmtDate(m.date)}',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ),
                  ],
                  onChanged: sending
                      ? null
                      : (v) => setDialogState(() => selectedMatchId = v),
                ),
              ],
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: sending ? null : () => Navigator.pop(ctx),
            child: const Text('Cancelar'),
          ),
          FilledButton.icon(
            onPressed: sending
                ? null
                : () async {
                    final text = controller.text.trim();
                    if (text.isEmpty) {
                      PateaSnack.error(ctx, 'Escribí un mensaje.');
                      return;
                    }
                    setDialogState(() => sending = true);
                    try {
                      await ref.read(messagesServiceProvider).sendMessage(
                            toUid: toUid,
                            text: text,
                            matchId: selectedMatchId,
                          );
                      sent = true;
                      if (ctx.mounted) Navigator.pop(ctx);
                    } catch (e) {
                      if (ctx.mounted) {
                        PateaSnack.error(ctx, '$e');
                        setDialogState(() => sending = false);
                      }
                    }
                  },
            icon: sending
                ? const SizedBox(
                    width: 15,
                    height: 15,
                    child: PateaButtonProgress(),
                  )
                : const Icon(Icons.send_rounded, size: 16),
            label: const Text('Enviar'),
          ),
        ],
      ),
    ),
  );

  controller.dispose();
  return sent;
}

/// Bandeja de mensajes recibidos de otros jugadores (invitaciones con mensaje
/// y mensajes directos de jugadores de tu grupo o de otros grupos).
class MessagesScreen extends ConsumerWidget {
  const MessagesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final uid = ref.watch(authStateProvider).value?.uid;
    final messagesAsync = ref.watch(playerMessagesStreamProvider);

    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        title: Text(
          'Mensajes',
          style: AppTypography.headline(size: 20, weight: FontWeight.w700),
        ),
      ),
      body: messagesAsync.when(
        data: (messages) {
          if (messages.isEmpty) {
            return const PateaEmpty(
              icon: Icons.mark_chat_unread_outlined,
              title: 'Sin mensajes todavía',
              hint:
                  'Cuando otro jugador te invite con un mensaje o te escriba para sumarte a un partido, va a aparecer acá.',
            );
          }

          return ListView.separated(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
            itemCount: messages.length,
            separatorBuilder: (_, _) => const SizedBox(height: 10),
            itemBuilder: (context, index) {
              final msg = messages[index];
              return _MessageCard(
                message: msg,
                onTapRead: () {
                  if (!msg.isRead && uid != null) {
                    ref.read(messagesServiceProvider).markAsRead(
                          uid: uid,
                          messageId: msg.id,
                        );
                  }
                },
                onOpenMatch: msg.hasMatch
                    ? () {
                        if (!msg.isRead && uid != null) {
                          ref.read(messagesServiceProvider).markAsRead(
                                uid: uid,
                                messageId: msg.id,
                              );
                        }
                        context.push('/matches/${msg.matchId}');
                      }
                    : null,
                onReply: () async {
                  if (!msg.isRead && uid != null) {
                    ref.read(messagesServiceProvider).markAsRead(
                          uid: uid,
                          messageId: msg.id,
                        );
                  }
                  final ok = await showSendPlayerMessageDialog(
                    context: context,
                    ref: ref,
                    toUid: msg.fromUid,
                    toName: msg.fromName,
                  );
                  if (ok && context.mounted) {
                    PateaSnack.ok(context, 'Respuesta enviada a ${msg.fromName}');
                  }
                },
              );
            },
          );
        },
        loading: () => const PateaLoading(),
        error: (e, _) => PateaError(error: e),
      ),
    );
  }
}

class _MessageCard extends StatelessWidget {
  final PlayerMessageModel message;
  final VoidCallback onTapRead;
  final VoidCallback? onOpenMatch;
  final VoidCallback onReply;

  const _MessageCard({
    required this.message,
    required this.onTapRead,
    required this.onOpenMatch,
    required this.onReply,
  });

  @override
  Widget build(BuildContext context) {
    final unread = !message.isRead;

    return GestureDetector(
      onTap: onTapRead,
      child: PateaCard(
        color: unread
            ? context.c.primary.withValues(alpha: 0.08)
            : context.c.card,
        radius: AppRadii.cardAll,
        borderColor: unread
            ? context.c.primary.withValues(alpha: 0.5)
            : context.c.border.withValues(alpha: 0.35),
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                PateaAvatar(
                  photoUrl: message.fromPhotoUrl,
                  seed: message.fromName,
                  size: 38,
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              message.fromName,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: AppTypography.headline(
                                size: 14,
                                weight: FontWeight.w700,
                              ),
                            ),
                          ),
                          if (unread)
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 7,
                                vertical: 2,
                              ),
                              decoration: BoxDecoration(
                                color: context.c.primary,
                                borderRadius: AppRadii.pillAll,
                              ),
                              child: Text(
                                'Nuevo',
                                style: AppTypography.body(
                                  size: 10,
                                  weight: FontWeight.w700,
                                  color: context.c.onPrimary,
                                ),
                              ),
                            ),
                        ],
                      ),
                      if (message.createdAt.isNotEmpty)
                        Text(
                          fmtDate(message.createdAt),
                          style: AppTypography.body(
                            size: 11,
                            color: context.c.textSecondary,
                          ),
                        ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Text(
              message.text,
              style: AppTypography.body(
                size: 13,
                color: context.c.textPrimary,
              ),
            ),
            if (message.hasMatch) ...[
              const SizedBox(height: 10),
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: context.c.cardSurface,
                  borderRadius: AppRadii.chipAll,
                  border: Border.all(color: context.c.border),
                ),
                child: Row(
                  children: [
                    Icon(
                      Icons.sports_soccer,
                      size: 18,
                      color: context.c.primary,
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            message.matchTitle?.isNotEmpty == true
                                ? message.matchTitle!
                                : 'Partido',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: AppTypography.body(
                              size: 13,
                              weight: FontWeight.w700,
                              color: context.c.textPrimary,
                            ),
                          ),
                          if ((message.matchDate ?? '').isNotEmpty ||
                              (message.matchLocation ?? '').isNotEmpty)
                            Text(
                              [
                                if ((message.matchDate ?? '').isNotEmpty)
                                  fmtDate(message.matchDate!),
                                if ((message.matchTime ?? '').isNotEmpty)
                                  message.matchTime!,
                                if ((message.matchLocation ?? '').isNotEmpty)
                                  message.matchLocation!,
                              ].join(' · '),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: AppTypography.body(
                                size: 11,
                                color: context.c.textSecondary,
                              ),
                            ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 8),
                    FilledButton(
                      onPressed: onOpenMatch,
                      style: FilledButton.styleFrom(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 6,
                        ),
                        minimumSize: Size.zero,
                      ),
                      child: const Text('Anotate acá'),
                    ),
                  ],
                ),
              ),
            ],
            const SizedBox(height: 8),
            Align(
              alignment: Alignment.centerRight,
              child: TextButton.icon(
                onPressed: onReply,
                icon: const Icon(Icons.reply_rounded, size: 16),
                label: const Text('Responder'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
