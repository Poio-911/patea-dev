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

/// Lista de conversaciones 1 a 1 estilo WhatsApp/Telegram entre jugadores
/// (de tu grupo o de otros grupos).
class MessagesScreen extends ConsumerWidget {
  const MessagesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final uid = ref.watch(authStateProvider).value?.uid;
    final chatsAsync = ref.watch(directChatsStreamProvider);

    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        title: Text(
          'Mensajes',
          style: AppTypography.headline(size: 20, weight: FontWeight.w700),
        ),
      ),
      body: chatsAsync.when(
        data: (chats) {
          if (chats.isEmpty) {
            return const PateaEmpty(
              icon: Icons.chat_bubble_outline_rounded,
              title: 'Sin conversaciones todavía',
              hint:
                  'Cuando invites a un jugador con un mensaje o le escribas desde Explorar, la conversación queda guardada acá.',
            );
          }

          return ListView.separated(
            padding: const EdgeInsets.fromLTRB(16, 10, 16, 32),
            itemCount: chats.length,
            separatorBuilder: (_, _) => const SizedBox(height: 8),
            itemBuilder: (context, index) {
              final chat = chats[index];
              final isMeLast = uid != null && chat.lastSenderUid == uid;
              final preview = isMeLast
                  ? 'Vos: ${chat.lastMessageText}'
                  : chat.lastMessageText;

              return InkWell(
                borderRadius: AppRadii.cardAll,
                onTap: () => context.push(
                  '/messages/chat/${chat.otherUid}?name=${Uri.encodeComponent(chat.otherName)}${chat.otherPhotoUrl != null ? '&photo=${Uri.encodeComponent(chat.otherPhotoUrl!)}' : ''}',
                ),
                child: PateaCard(
                  color: chat.unreadCount > 0
                      ? context.c.primary.withValues(alpha: 0.08)
                      : context.c.card,
                  radius: AppRadii.cardAll,
                  borderColor: chat.unreadCount > 0
                      ? context.c.primary.withValues(alpha: 0.45)
                      : context.c.border.withValues(alpha: 0.35),
                  padding: const EdgeInsets.all(12),
                  child: Row(
                    children: [
                      PateaAvatar(
                        photoUrl: chat.otherPhotoUrl,
                        seed: chat.otherName,
                        size: 46,
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Expanded(
                                  child: Text(
                                    chat.otherName,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: AppTypography.headline(
                                      size: 15,
                                      weight: FontWeight.w700,
                                    ),
                                  ),
                                ),
                                if (chat.lastMessageAt.isNotEmpty)
                                  Text(
                                    fmtDate(chat.lastMessageAt),
                                    style: AppTypography.body(
                                      size: 11,
                                      color: chat.unreadCount > 0
                                          ? context.c.primary
                                          : context.c.textSecondary,
                                    ),
                                  ),
                              ],
                            ),
                            const SizedBox(height: 4),
                            Row(
                              children: [
                                Expanded(
                                  child: Text(
                                    preview,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: AppTypography.body(
                                      size: 13,
                                      color: chat.unreadCount > 0
                                          ? context.c.textPrimary
                                          : context.c.textSecondary,
                                      weight: chat.unreadCount > 0
                                          ? FontWeight.w600
                                          : FontWeight.w400,
                                    ),
                                  ),
                                ),
                                if (chat.unreadCount > 0) ...[
                                  const SizedBox(width: 8),
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
                                      '${chat.unreadCount}',
                                      style: AppTypography.body(
                                        size: 11,
                                        weight: FontWeight.w700,
                                        color: context.c.onPrimary,
                                      ),
                                    ),
                                  ),
                                ],
                              ],
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
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

/// Hilo de chat 1 a 1 permanente entre vos y otro jugador.
class DirectChatScreen extends ConsumerStatefulWidget {
  final String otherUid;
  final String otherName;
  final String? otherPhotoUrl;

  const DirectChatScreen({
    super.key,
    required this.otherUid,
    required this.otherName,
    this.otherPhotoUrl,
  });

  @override
  ConsumerState<DirectChatScreen> createState() => _DirectChatScreenState();
}

class _DirectChatScreenState extends ConsumerState<DirectChatScreen> {
  final _textController = TextEditingController();
  bool _sending = false;
  MatchModel? _attachedMatch;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _markRead());
  }

  @override
  void dispose() {
    _textController.dispose();
    super.dispose();
  }

  void _markRead() {
    final uid = ref.read(authStateProvider).value?.uid;
    if (uid == null || widget.otherUid.isEmpty) return;
    final chatId = buildDirectChatId(uid, widget.otherUid);
    ref.read(messagesServiceProvider).markChatAsRead(chatId: chatId, uid: uid);
  }

  Future<void> _pickMatchToAttach() async {
    final uid = ref.read(authStateProvider).value?.uid;
    if (uid == null) return;
    final upcoming =
        (ref.read(activeGroupMatchesProvider).value ?? const <MatchModel>[])
            .where((m) => m.status == 'upcoming' && m.ownerUid == uid)
            .toList();
    if (upcoming.isEmpty) {
      PateaSnack.info(context, 'No tenés partidos próximos para adjuntar.');
      return;
    }
    final picked = await showModalBottomSheet<MatchModel>(
      context: context,
      backgroundColor: context.c.card,
      shape: const RoundedRectangleBorder(borderRadius: AppRadii.surfaceTop),
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: 12),
            Text(
              'Adjuntar partido',
              style: AppTypography.headline(size: 16),
            ),
            const SizedBox(height: 8),
            ...upcoming.map(
              (m) => ListTile(
                leading: Icon(Icons.sports_soccer, color: ctx.c.primary),
                title: Text(m.title),
                subtitle: Text('${fmtDate(m.date)} · ${m.time ?? 'A definir'}'),
                onTap: () => Navigator.pop(ctx, m),
              ),
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
    if (picked != null && mounted) {
      setState(() => _attachedMatch = picked);
    }
  }

  Future<void> _send() async {
    final text = _textController.text.trim();
    if (text.isEmpty || _sending) return;
    setState(() => _sending = true);
    try {
      await ref.read(messagesServiceProvider).sendMessage(
            toUid: widget.otherUid,
            text: text,
            matchId: _attachedMatch?.id,
          );
      if (mounted) {
        _textController.clear();
        setState(() {
          _attachedMatch = null;
          _sending = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _sending = false);
        PateaSnack.error(context, '$e');
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final uid = ref.watch(authStateProvider).value?.uid;
    final chatId = uid == null ? '' : buildDirectChatId(uid, widget.otherUid);
    final messagesAsync = ref.watch(directChatMessagesStreamProvider(chatId));

    ref.listen(directChatMessagesStreamProvider(chatId), (_, next) {
      if (next.hasValue) _markRead();
    });

    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        titleSpacing: 0,
        title: Row(
          children: [
            PateaAvatar(
              photoUrl: widget.otherPhotoUrl,
              seed: widget.otherName,
              size: 34,
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                widget.otherName,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AppTypography.headline(size: 17, weight: FontWeight.w700),
              ),
            ),
          ],
        ),
      ),
      body: Column(
        children: [
          Expanded(
            child: messagesAsync.when(
              data: (messages) {
                if (messages.isEmpty) {
                  return Center(
                    child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: Text(
                        'Escribile a ${widget.otherName} para coordinar o invitarlo a jugar.',
                        textAlign: TextAlign.center,
                        style: AppTypography.body(
                          size: 13,
                          color: context.c.textSecondary,
                        ),
                      ),
                    ),
                  );
                }

                return ListView.builder(
                  reverse: true,
                  padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
                  itemCount: messages.length,
                  itemBuilder: (context, index) {
                    final msg = messages[index];
                    final isMe = uid != null && msg.senderUid == uid;
                    return _ChatBubble(
                      message: msg,
                      isMe: isMe,
                      onOpenMatch: msg.hasMatch
                          ? () => context.push('/matches/${msg.matchId}')
                          : null,
                    );
                  },
                );
              },
              loading: () => const PateaLoading(),
              error: (e, _) => PateaError(error: e),
            ),
          ),
          if (_attachedMatch != null)
            Container(
              margin: const EdgeInsets.fromLTRB(12, 0, 12, 6),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: context.c.cardSurface,
                borderRadius: AppRadii.chipAll,
                border: Border.all(color: context.c.primary.withValues(alpha: 0.45)),
              ),
              child: Row(
                children: [
                  Icon(Icons.sports_soccer, size: 16, color: context.c.primary),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Adjunto: ${_attachedMatch!.title}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppTypography.body(
                        size: 12,
                        weight: FontWeight.w600,
                      ),
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close, size: 16),
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(),
                    onPressed: () => setState(() => _attachedMatch = null),
                  ),
                ],
              ),
            ),
          SafeArea(
            top: false,
            child: Container(
              padding: const EdgeInsets.fromLTRB(10, 8, 10, 10),
              decoration: BoxDecoration(
                color: context.c.card,
                border: Border(top: BorderSide(color: context.c.border.withValues(alpha: 0.4))),
              ),
              child: Row(
                children: [
                  IconButton(
                    onPressed: _sending ? null : _pickMatchToAttach,
                    tooltip: 'Adjuntar partido',
                    icon: Icon(
                      Icons.sports_soccer_outlined,
                      color: _attachedMatch != null
                          ? context.c.primary
                          : context.c.textSecondary,
                    ),
                  ),
                  Expanded(
                    child: TextField(
                      controller: _textController,
                      minLines: 1,
                      maxLines: 4,
                      textCapitalization: TextCapitalization.sentences,
                      decoration: const InputDecoration(
                        hintText: 'Escribí un mensaje...',
                        isDense: true,
                      ),
                      onSubmitted: (_) => _send(),
                    ),
                  ),
                  const SizedBox(width: 8),
                  FilledButton(
                    onPressed: _sending ? null : _send,
                    style: FilledButton.styleFrom(
                      shape: const CircleBorder(),
                      padding: const EdgeInsets.all(12),
                      minimumSize: Size.zero,
                    ),
                    child: _sending
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: PateaButtonProgress(),
                          )
                        : const Icon(Icons.send_rounded, size: 18),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ChatBubble extends StatelessWidget {
  final DirectMessageModel message;
  final bool isMe;
  final VoidCallback? onOpenMatch;

  const _ChatBubble({
    required this.message,
    required this.isMe,
    required this.onOpenMatch,
  });

  @override
  Widget build(BuildContext context) {
    final align = isMe ? CrossAxisAlignment.end : CrossAxisAlignment.start;
    final bubbleColor = isMe
        ? context.c.primary.withValues(alpha: 0.18)
        : context.c.card;
    final borderColor = isMe
        ? context.c.primary.withValues(alpha: 0.45)
        : context.c.border.withValues(alpha: 0.4);

    return Column(
      crossAxisAlignment: align,
      children: [
        Container(
          constraints: BoxConstraints(
            maxWidth: MediaQuery.sizeOf(context).width * 0.78,
          ),
          margin: const EdgeInsets.only(bottom: 8),
          padding: const EdgeInsets.fromLTRB(12, 10, 12, 8),
          decoration: BoxDecoration(
            color: bubbleColor,
            borderRadius: AppRadii.cardAll,
            border: Border.all(color: borderColor),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                message.text,
                style: AppTypography.body(
                  size: 14,
                  color: context.c.textPrimary,
                ),
              ),
              if (message.hasMatch) ...[
                const SizedBox(height: 8),
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: context.c.cardSurface,
                    borderRadius: AppRadii.chipAll,
                    border: Border.all(color: context.c.border),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        Icons.sports_soccer,
                        size: 16,
                        color: context.c.primary,
                      ),
                      const SizedBox(width: 6),
                      Flexible(
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
                                size: 12,
                                weight: FontWeight.w700,
                              ),
                            ),
                            if ((message.matchDate ?? '').isNotEmpty)
                              Text(
                                [
                                  fmtDate(message.matchDate!),
                                  if ((message.matchTime ?? '').isNotEmpty)
                                    message.matchTime!,
                                ].join(' · '),
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
              if (message.createdAt.isNotEmpty) ...[
                const SizedBox(height: 4),
                Text(
                  fmtDate(message.createdAt),
                  style: AppTypography.body(
                    size: 10,
                    color: context.c.textSecondary,
                  ),
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }
}
