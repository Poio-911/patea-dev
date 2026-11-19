import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/models/match_model.dart';
import '../../core/services/auth_service.dart';
import '../../core/services/firestore_service.dart';
import '../../core/services/match_chat_service.dart';
import '../../core/theme/app_radii.dart';
import '../../core/theme/app_typography.dart';
import '../../core/theme/patea_colors.dart';
import '../../core/widgets/patea_avatar.dart';
import '../../core/widgets/patea_button_progress.dart';
import '../../core/widgets/patea_states.dart';

class MatchChatScreen extends ConsumerStatefulWidget {
  final MatchModel match;
  const MatchChatScreen({super.key, required this.match});
  @override
  ConsumerState<MatchChatScreen> createState() => _MatchChatScreenState();
}

class _MatchChatScreenState extends ConsumerState<MatchChatScreen> {
  final _controller = TextEditingController();
  final _scroll = ScrollController();
  bool _sending = false;
  bool _hasNewMessages = false;
  String? _error, _pendingId, _pendingDraft, _latestId;
  int _limit = 60;
  List<MatchChatMessage>? _previous;

  @override
  void initState() {
    super.initState();
    _controller.addListener(_draftChanged);
  }

  void _draftChanged() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    _controller.removeListener(_draftChanged);
    _controller.dispose();
    _scroll.dispose();
    super.dispose();
  }

  void _toLatest() {
    if (!_scroll.hasClients) return;
    if (MediaQuery.disableAnimationsOf(context)) {
      _scroll.jumpTo(0);
    } else {
      _scroll.animateTo(
        0,
        duration: const Duration(milliseconds: 180),
        curve: Curves.easeOut,
      );
    }
    setState(() => _hasNewMessages = false);
  }

  Future<void> _send() async {
    if (_sending) return;
    final draft = _controller.text;
    final text = draft.trim();
    final user = ref.read(authStateProvider).asData?.value;
    final match =
        ref.read(singleMatchStreamProvider(widget.match.id)).asData?.value ??
        widget.match;
    if (text.isEmpty ||
        user == null ||
        !(match.isManagedBy(user.uid) || match.playerUids.contains(user.uid))) {
      return;
    }
    final profile = ref
        .read(singlePlayerStreamProvider(user.uid))
        .asData
        ?.value;
    final service = ref.read(matchChatServiceProvider);
    if (_pendingDraft != draft || _pendingId == null) {
      _pendingId = service.newMessageId(match.id);
      _pendingDraft = draft;
    }
    setState(() {
      _sending = true;
      _error = null;
    });
    try {
      await service.send(
        matchId: match.id,
        messageId: _pendingId!,
        text: text,
        senderId: user.uid,
        senderName: profile?.name ?? user.displayName ?? 'Jugador',
        senderPhotoUrl: profile?.photoUrl ?? user.photoURL ?? '',
      );
      if (!mounted) return;
      if (_controller.text == draft) _controller.clear();
      _pendingId = null;
      _pendingDraft = null;
      _toLatest();
    } catch (_) {
      if (mounted) {
        setState(() => _error = 'No se pudo enviar. Tu mensaje sigue acá.');
      }
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final userAsync = ref.watch(authStateProvider);
    final user = userAsync.asData?.value;
    final match =
        ref.watch(singleMatchStreamProvider(widget.match.id)).asData?.value ??
        widget.match;
    final allowed =
        user != null &&
        (match.isManagedBy(user.uid) || match.playerUids.contains(user.uid));
    if (user != null) ref.watch(singlePlayerStreamProvider(user.uid));
    return Scaffold(
      backgroundColor: context.c.background,
      appBar: AppBar(
        backgroundColor: context.c.card,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              match.title,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppTypography.headline(size: 17, weight: FontWeight.w700),
            ),
            Text(
              'Chat del partido',
              style: AppTypography.body(
                size: 12,
                color: context.c.textSecondary,
              ),
            ),
          ],
        ),
      ),
      body: userAsync.isLoading && user == null
          ? const Center(child: PateaLoading())
          : !allowed
          ? Center(
              child: Padding(
                padding: const EdgeInsets.all(28),
                child: Text(
                  'El chat es para los participantes y el organizador del partido.',
                  textAlign: TextAlign.center,
                  style: AppTypography.body(
                    size: 15,
                    color: context.c.textSecondary,
                  ),
                ),
              ),
            )
          : Column(
              children: [
                Expanded(child: _messages(user.uid)),
                if (_error != null)
                  Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 6,
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          child: Text(
                            _error!,
                            style: AppTypography.body(
                              size: 13,
                              color: context.c.destructive,
                            ),
                          ),
                        ),
                        TextButton(
                          onPressed: _sending ? null : _send,
                          child: const Text('Reintentar'),
                        ),
                      ],
                    ),
                  ),
                _composer(),
              ],
            ),
    );
  }

  Widget _messages(String uid) {
    final query = (matchId: widget.match.id, limit: _limit);
    final messagesAsync = ref.watch(matchChatMessagesProvider(query));
    final messages = messagesAsync.asData?.value ?? _previous;
    if (messagesAsync.asData != null) _previous = messages;
    if (messagesAsync.hasError) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                Icons.wifi_off_rounded,
                size: 32,
                color: context.c.textSecondary,
              ),
              const SizedBox(height: 12),
              Text(
                'No pudimos cargar la conversación.',
                style: AppTypography.body(size: 15),
              ),
              TextButton(
                onPressed: () =>
                    ref.invalidate(matchChatMessagesProvider(query)),
                child: const Text('Reintentar'),
              ),
            ],
          ),
        ),
      );
    }
    if (messages == null) return const Center(child: PateaLoading());
    if (messages.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.forum_outlined, size: 42, color: context.c.primary),
              const SizedBox(height: 18),
              Text(
                'La previa empieza acá',
                textAlign: TextAlign.center,
                style: AppTypography.headline(
                  size: 24,
                  weight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 10),
              Text(
                'Coordiná la llegada, avisá si llevás pelota o mandá un saludo al equipo.',
                textAlign: TextAlign.center,
                style: AppTypography.body(
                  size: 14,
                  height: 1.5,
                  color: context.c.textSecondary,
                ),
              ),
            ],
          ),
        ),
      );
    }
    final newest = messages.first.id;
    if (_latestId != newest) {
      final shouldFollow =
          _latestId == null || !_scroll.hasClients || _scroll.offset < 100;
      _latestId = newest;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        if (shouldFollow) {
          _toLatest();
        } else {
          setState(() => _hasNewMessages = true);
        }
      });
    }
    return Stack(
      children: [
        ListView.builder(
          key: const ValueKey('match-chat-messages'),
          controller: _scroll,
          reverse: true,
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 16),
          itemCount: messages.length + (messages.length >= _limit ? 1 : 0),
          itemBuilder: (context, index) {
            if (index == messages.length) {
              return TextButton(
                onPressed: messagesAsync.isLoading
                    ? null
                    : () => setState(() => _limit += 60),
                child: const Text('Cargar mensajes anteriores'),
              );
            }
            final message = messages[index];
            final older = index + 1 < messages.length
                ? messages[index + 1]
                : null;
            final date = message.createdAt?.toLocal();
            final olderDate = older?.createdAt?.toLocal();
            final showDate =
                date != null &&
                (olderDate == null ||
                    date.year != olderDate.year ||
                    date.month != olderDate.month ||
                    date.day != olderDate.day);
            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (showDate)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    child: Text(
                      '${date.day}/${date.month}/${date.year}',
                      textAlign: TextAlign.center,
                      style: AppTypography.body(
                        size: 12,
                        color: context.c.textSecondary,
                      ),
                    ),
                  ),
                _MessageBubble(message: message, mine: message.senderId == uid),
              ],
            );
          },
        ),
        if (_hasNewMessages)
          Positioned(
            right: 16,
            bottom: 12,
            child: FilledButton.icon(
              onPressed: _toLatest,
              icon: const Icon(Icons.arrow_downward_rounded, size: 18),
              label: const Text('Mensajes nuevos'),
            ),
          ),
      ],
    );
  }

  Widget _composer() => Container(
    decoration: BoxDecoration(
      color: context.c.card,
      border: Border(top: BorderSide(color: context.c.border)),
    ),
    child: SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Expanded(
              child: TextField(
                controller: _controller,
                readOnly: _sending,
                minLines: 1,
                maxLines: 4,
                maxLength: 2000,
                textCapitalization: TextCapitalization.sentences,
                textInputAction: TextInputAction.newline,
                style: AppTypography.body(
                  size: 15,
                  color: context.c.textPrimary,
                ),
                buildCounter:
                    (
                      _, {
                      required currentLength,
                      required isFocused,
                      maxLength,
                    }) => null,
                decoration: const InputDecoration(
                  hintText: 'Mensaje al equipo…',
                  contentPadding: EdgeInsets.symmetric(
                    horizontal: 14,
                    vertical: 12,
                  ),
                ),
              ),
            ),
            const SizedBox(width: 8),
            IconButton.filled(
              tooltip: 'Enviar mensaje',
              onPressed: _sending || _controller.text.trim().isEmpty
                  ? null
                  : _send,
              icon: _sending
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: PateaButtonProgress(),
                    )
                  : const Icon(Icons.arrow_upward_rounded),
            ),
          ],
        ),
      ),
    ),
  );
}

class _MessageBubble extends StatelessWidget {
  final MatchChatMessage message;
  final bool mine;
  const _MessageBubble({required this.message, required this.mine});
  @override
  Widget build(BuildContext context) {
    final date = message.createdAt?.toLocal();
    final time = date == null
        ? ''
        : '${date.hour.toString().padLeft(2, '0')}:${date.minute.toString().padLeft(2, '0')}';
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        mainAxisAlignment: mine
            ? MainAxisAlignment.end
            : MainAxisAlignment.start,
        children: [
          if (!mine) ...[
            PateaAvatar(
              photoUrl: message.senderPhotoUrl,
              seed: message.senderId,
              size: 32,
            ),
            const SizedBox(width: 8),
          ],
          Flexible(
            child: Container(
              constraints: BoxConstraints(
                maxWidth: MediaQuery.sizeOf(context).width * .78,
              ),
              padding: const EdgeInsets.fromLTRB(13, 10, 13, 8),
              decoration: BoxDecoration(
                color: mine
                    ? Color.alphaBlend(
                        context.c.primary.withValues(alpha: .12),
                        context.c.card,
                      )
                    : context.c.cardSurface,
                borderRadius: AppRadii.cardAll,
                border: Border.all(
                  color: mine
                      ? context.c.primary.withValues(alpha: .28)
                      : context.c.border,
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (!mine)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 5),
                      child: Text(
                        message.senderName,
                        style: AppTypography.body(
                          size: 12,
                          weight: FontWeight.w700,
                          color: context.c.textPrimary,
                        ),
                      ),
                    ),
                  SelectableText(
                    message.text,
                    style: AppTypography.body(
                      size: 15,
                      height: 1.45,
                      color: context.c.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 5),
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (message.pending) ...[
                        Icon(
                          Icons.schedule_rounded,
                          size: 12,
                          color: context.c.textSecondary,
                        ),
                        const SizedBox(width: 4),
                      ],
                      Text(
                        message.pending ? 'Enviando…' : time,
                        style: AppTypography.body(
                          size: 12,
                          color: context.c.textSecondary,
                        ),
                      ),
                    ],
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
