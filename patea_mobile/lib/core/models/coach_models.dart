import 'package:flutter/foundation.dart';

@immutable
class AnalysisItem {
  final String title;
  final String detail;
  const AnalysisItem(this.title, this.detail);

  factory AnalysisItem.fromMap(Map<String, dynamic> map) =>
      AnalysisItem(map['title'] as String? ?? '', map['detail'] as String? ?? '');
}

/// Análisis del jugador que arma el servidor con sus datos reales.
@immutable
class PlayerAnalysis {
  final String headline;
  final String summary;
  final List<AnalysisItem> strengths;
  final List<AnalysisItem> improvements;
  final List<String> patterns;
  final List<String> plan;

  const PlayerAnalysis({
    required this.headline,
    required this.summary,
    required this.strengths,
    required this.improvements,
    required this.patterns,
    required this.plan,
  });

  factory PlayerAnalysis.fromMap(Map<String, dynamic> map) {
    List<AnalysisItem> items(Object? raw) => [
      for (final i in (raw as List? ?? const []))
        AnalysisItem.fromMap(Map<String, dynamic>.from(i as Map)),
    ];
    List<String> lines(Object? raw) => [
      for (final l in (raw as List? ?? const [])) '$l',
    ];
    return PlayerAnalysis(
      headline: map['headline'] as String? ?? '',
      summary: map['summary'] as String? ?? '',
      strengths: items(map['strengths']),
      improvements: items(map['improvements']),
      patterns: lines(map['patterns']),
      plan: lines(map['plan']),
    );
  }
}

/// Resultado de pedir el análisis: o hay uno, o todavía faltan partidos.
@immutable
class AnalysisResult {
  final PlayerAnalysis? analysis;
  const AnalysisResult(this.analysis);

  bool get notEnoughData => analysis == null;

  factory AnalysisResult.fromMap(Map<String, dynamic> map) {
    if (map['status'] != 'ok' || map['analysis'] is! Map) {
      return const AnalysisResult(null);
    }
    return AnalysisResult(
      PlayerAnalysis.fromMap(Map<String, dynamic>.from(map['analysis'] as Map)),
    );
  }
}

enum ChatRole { user, coach }

@immutable
class ChatMessage {
  final ChatRole role;
  final String text;
  const ChatMessage(this.role, this.text);

  /// Como lo espera el servidor para armar el historial.
  Map<String, String> toWire() => {
    'role': role == ChatRole.user ? 'user' : 'coach',
    'content': text,
  };
}

/// Un refuerzo que sugiere el DT para un partido, con su motivo.
@immutable
class RecruitRecommendation {
  final String playerId;
  final String reason;
  const RecruitRecommendation(this.playerId, this.reason);

  factory RecruitRecommendation.fromMap(Map<String, dynamic> map) =>
      RecruitRecommendation(
        map['playerId'] as String? ?? '',
        map['reason'] as String? ?? '',
      );
}

@immutable
class CoachReply {
  final String reply;
  final List<String> suggestions;
  const CoachReply(this.reply, this.suggestions);

  factory CoachReply.fromMap(Map<String, dynamic> map) => CoachReply(
    map['reply'] as String? ?? '',
    [for (final s in (map['suggestions'] as List? ?? const [])) '$s'],
  );
}
