import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/models/coach_models.dart';
import '../../core/services/ai_assist_service.dart';
import '../../core/services/coach_service.dart';
import '../../core/theme/app_radii.dart';
import '../../core/theme/app_typography.dart';
import '../../core/theme/patea_colors.dart';

/// Cómo manda un mensaje al servidor: recibe lo que se escribió y los turnos
/// anteriores, y devuelve la respuesta con sugerencias de preguntas.
typedef AiChatSender =
    Future<CoachReply> Function(
      WidgetRef ref,
      String message,
      List<ChatMessage> history,
    );

/// Charla con una IA: la misma pantalla sirve para el DT y para el asistente de
/// la app. La conversación vive mientras la pantalla está abierta; el servidor
/// se queda con los últimos turnos.
class AiChatScreen extends ConsumerStatefulWidget {
  final String title;
  final IconData icon;
  final String introTitle;
  final String introText;
  final String hint;
  final List<String> starters;
  final AiChatSender send;

  const AiChatScreen({
    super.key,
    required this.title,
    required this.icon,
    required this.introTitle,
    required this.introText,
    required this.hint,
    required this.starters,
    required this.send,
  });

  /// Charla con el DT sobre tu juego, con tus datos reales de fondo.
  factory AiChatScreen.coach() => AiChatScreen(
    title: 'El DT',
    icon: Icons.sports_rounded,
    introTitle: 'Charlá con tu DT',
    introText:
        'Conoce tus números, tus notas y tus etiquetas. Preguntale lo que quieras sobre tu juego.',
    hint: 'Preguntale al DT…',
    starters: const [
      '¿Cómo vengo jugando?',
      '¿Qué trabajo esta semana?',
      'Vengo bajando, ¿qué hago?',
    ],
    send: (ref, message, history) =>
        ref.read(coachServiceProvider).chat(message, history),
  );

  /// Asistente que explica cómo usar Pateá.
  factory AiChatScreen.help() => AiChatScreen(
    title: 'Ayuda',
    icon: Icons.help_outline_rounded,
    introTitle: '¿Cómo te ayudo?',
    introText:
        'Preguntame cómo se usa Pateá: armar partidos, evaluar, grupos, competiciones y más.',
    hint: 'Escribí tu pregunta…',
    starters: const [
      '¿Cómo armo un partido?',
      '¿Cuándo sube mi OVR?',
      '¿Cómo entro a un grupo?',
    ],
    send: (ref, message, history) =>
        ref.read(aiAssistServiceProvider).askHelp(message, history),
  );

  @override
  ConsumerState<AiChatScreen> createState() => _AiChatScreenState();
}

class _AiChatScreenState extends ConsumerState<AiChatScreen> {
  final _messages = <ChatMessage>[];
  final _input = TextEditingController();
  final _scroll = ScrollController();
  List<String> _suggestions = const [];
  bool _sending = false;
  String? _error;

  @override
  void dispose() {
    _input.dispose();
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _send(String raw) async {
    final text = raw.trim();
    if (text.isEmpty || _sending) return;
    final history = List<ChatMessage>.of(_messages);
    setState(() {
      _messages.add(ChatMessage(ChatRole.user, text));
      _suggestions = const [];
      _sending = true;
      _error = null;
      _input.clear();
    });
    _toBottom();
    try {
      final reply = await widget.send(ref, text, history);
      if (!mounted) return;
      setState(() {
        _messages.add(ChatMessage(ChatRole.coach, reply.reply));
        _suggestions = reply.suggestions;
      });
    } catch (e) {
      if (!mounted) return;
      // El mensaje no llegó: se saca de la charla y vuelve al campo para reenviar.
      setState(() {
        _messages.removeLast();
        _input.text = text;
        _error = coachErrorMessage(e);
      });
    } finally {
      if (mounted) setState(() => _sending = false);
      _toBottom();
    }
  }

  void _toBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_scroll.hasClients) return;
      _scroll.animateTo(
        _scroll.position.maxScrollExtent,
        duration: const Duration(milliseconds: 250),
        curve: Curves.easeOut,
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        title: Text(
          widget.title,
          style: AppTypography.headline(size: 20, weight: FontWeight.w700),
        ),
      ),
      body: Column(
        children: [
          Expanded(
            child: _messages.isEmpty
                ? _Intro(
                    icon: widget.icon,
                    title: widget.introTitle,
                    text: widget.introText,
                    starters: widget.starters,
                    onPick: _send,
                  )
                : ListView(
                    controller: _scroll,
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
                    children: [
                      for (final m in _messages) _Bubble(message: m),
                      if (_sending) const _Typing(),
                    ],
                  ),
          ),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
              child: Text(
                _error!,
                style: AppTypography.body(size: 13, color: c.destructive),
              ),
            ),
          if (_suggestions.isNotEmpty && !_sending)
            SizedBox(
              height: 44,
              child: ListView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 16),
                children: [
                  for (final s in _suggestions)
                    Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: ActionChip(
                        label: Text(s),
                        onPressed: () => _send(s),
                      ),
                    ),
                ],
              ),
            ),
          SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 6, 12, 10),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Expanded(
                    child: TextField(
                      controller: _input,
                      minLines: 1,
                      maxLines: 4,
                      maxLength: 500,
                      textCapitalization: TextCapitalization.sentences,
                      textInputAction: TextInputAction.send,
                      onSubmitted: _send,
                      decoration: InputDecoration(
                        hintText: widget.hint,
                        counterText: '',
                      ),
                    ),
                  ),
                  const SizedBox(width: 6),
                  IconButton.filled(
                    onPressed: _sending ? null : () => _send(_input.text),
                    icon: const Icon(Icons.arrow_upward_rounded),
                    tooltip: 'Enviar',
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

class _Intro extends StatelessWidget {
  final IconData icon;
  final String title;
  final String text;
  final List<String> starters;
  final ValueChanged<String> onPick;
  const _Intro({
    required this.icon,
    required this.title,
    required this.text,
    required this.starters,
    required this.onPick,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 12),
      children: [
        Icon(icon, size: 44, color: c.primary),
        const SizedBox(height: 14),
        Text(
          title,
          style: AppTypography.headline(size: 22, weight: FontWeight.w800),
        ),
        const SizedBox(height: 6),
        Text(
          text,
          style: AppTypography.body(size: 14, color: c.textSecondary),
        ),
        const SizedBox(height: 20),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final s in starters)
              ActionChip(label: Text(s), onPressed: () => onPick(s)),
          ],
        ),
      ],
    );
  }
}

class _Bubble extends StatelessWidget {
  final ChatMessage message;
  const _Bubble({required this.message});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final mine = message.role == ChatRole.user;
    return Align(
      alignment: mine ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        constraints: BoxConstraints(
          maxWidth: MediaQuery.of(context).size.width * 0.82,
        ),
        decoration: BoxDecoration(
          color: mine ? c.primary : c.card,
          borderRadius: AppRadii.cardAll,
          border: mine
              ? null
              : Border.all(color: c.border.withValues(alpha: 0.5)),
        ),
        child: Text(
          message.text,
          style: AppTypography.body(
            size: 14.5,
            color: mine ? c.onPrimary : null,
          ),
        ),
      ),
    );
  }
}

class _Typing extends StatelessWidget {
  const _Typing();

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 10, left: 4),
    child: Text(
      'Escribiendo…',
      style: AppTypography.body(size: 13, color: context.c.textSecondary),
    ),
  );
}
