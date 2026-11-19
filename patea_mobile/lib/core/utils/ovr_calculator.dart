import '../constants/performance_tags.dart';
import '../models/evaluation_models.dart';
import '../models/player_model.dart';

/// Resultado previsualizado de una evaluación sobre los atributos y OVR de un
/// jugador. Espejo 1:1 del motor del servidor (`functions/src/lib/ovr-progression.ts`).
class EvaluationImpactPreview {
  final int oldOvr;
  final int newOvr;
  final Map<String, int> updatedAttributes;
  final Map<String, int> attributeDeltas;
  final double equivalentRating;

  const EvaluationImpactPreview({
    required this.oldOvr,
    required this.newOvr,
    required this.updatedAttributes,
    required this.attributeDeltas,
    required this.equivalentRating,
  });

  int get ovrDelta => newOvr - oldOvr;

  /// Atributos que efectivamente cambian, ordenados por impacto descendente
  /// (positivos primero ante empate de magnitud).
  List<MapEntry<String, int>> get nonZeroDeltas {
    final entries = attributeDeltas.entries.where((e) => e.value != 0).toList();
    entries.sort((a, b) {
      final mag = b.value.abs().compareTo(a.value.abs());
      if (mag != 0) return mag;
      if (a.value > 0 && b.value < 0) return -1;
      if (a.value < 0 && b.value > 0) return 1;
      return OvrCalculator.attrs
          .indexOf(a.key)
          .compareTo(OvrCalculator.attrs.indexOf(b.key));
    });
    return entries;
  }
}

class OvrCalculator {
  // Estas constantes y fórmulas coinciden 1:1 con el motor del servidor:
  // `functions/src/lib/ovr-progression.ts`.
  // Este archivo existe para previsualizar el impacto real en la UI antes de
  // que el servidor confirme al cerrar el partido.
  static const int minOvr = 40;
  static const int maxOvr = 99;
  static const int minAttribute = 20;
  static const int maxAttribute = 99;
  static const double maxStep = 1.5;
  static const double baselineRating = 5.0;
  static const double maxEvalPositive = 5.0;
  static const double maxEvalNegative = 4.0;
  static const double maxEvalL1 = 5.0;
  static const int maxAttrDelta = 4;
  static const double aiUnitScale = 0.6;
  static const double _eps = 1e-9;

  static const List<String> attrs = ['pac', 'sho', 'pas', 'dri', 'def', 'phy'];

  /// Distribución de puntos a los 6 atributos según la posición.
  static const Map<String, Map<String, double>> positionWeights = {
    'DEL': {
      'pac': 0.25,
      'sho': 0.35,
      'pas': 0.15,
      'dri': 0.15,
      'def': 0.05,
      'phy': 0.05,
    },
    'MED': {
      'pac': 0.15,
      'sho': 0.15,
      'pas': 0.30,
      'dri': 0.20,
      'def': 0.10,
      'phy': 0.10,
    },
    'DEF': {
      'pac': 0.15,
      'sho': 0.05,
      'pas': 0.15,
      'dri': 0.05,
      'def': 0.40,
      'phy': 0.20,
    },
    'POR': {
      'pac': 0.10,
      'sho': 0.05,
      'pas': 0.10,
      'dri': 0.05,
      'def': 0.50,
      'phy': 0.20,
    },
  };

  static const Map<String, double> defaultWeights = {
    'pac': 1 / 6,
    'sho': 1 / 6,
    'pas': 1 / 6,
    'dri': 1 / 6,
    'def': 1 / 6,
    'phy': 1 / 6,
  };

  static Map<String, double> zeroVector() => {
    for (final attr in attrs) attr: 0.0,
  };

  static double ovrTierScale(int currentOvr) {
    if (currentOvr < 50) return 0.50;
    if (currentOvr < 60) return 0.40;
    if (currentOvr < 70) return 0.30;
    if (currentOvr < 80) return 0.20;
    if (currentOvr < 90) return 0.10;
    return 0.05;
  }

  /// Calcula el cambio de OVR según el rating promedio (1-10) con escala anti-inflación.
  static double calculateOvrChange(int currentOvr, double avgRating) {
    if (avgRating == baselineRating) return 0.0;
    final double ratingDelta = avgRating - baselineRating;
    final double rawDelta = ratingDelta * ovrTierScale(currentOvr);
    return rawDelta.clamp(-maxStep, maxStep);
  }

  static int roundHalfAwayFromZero(double value) {
    if (!value.isFinite || value.abs() < _eps) return 0;
    return value > 0
        ? (value + 0.5 + _eps).floor()
        : -((-value) + 0.5 + _eps).floor();
  }

  static Map<String, double> normalizeEvalVector(Map<String, double> raw) {
    final vec = {for (final a in attrs) a: raw[a] ?? 0.0};

    final l1 = attrs.fold<double>(0.0, (sum, a) => sum + vec[a]!.abs());
    if (l1 > maxEvalL1) {
      final factor = maxEvalL1 / l1;
      for (final a in attrs) {
        vec[a] = vec[a]! * factor;
      }
    }

    final net = attrs.fold<double>(0.0, (sum, a) => sum + vec[a]!);
    if (net < -maxEvalNegative) {
      final posSum = attrs.fold<double>(
        0.0,
        (s, a) => s + (vec[a]! > 0 ? vec[a]! : 0.0),
      );
      final negSum = attrs.fold<double>(
        0.0,
        (s, a) => s + (vec[a]! < 0 ? -vec[a]! : 0.0),
      );
      if (negSum > _eps) {
        final factor = (posSum + maxEvalNegative) / negSum;
        for (final a in attrs) {
          if (vec[a]! < 0) vec[a] = vec[a]! * factor;
        }
      }
    } else if (net > maxEvalPositive) {
      final posSum = attrs.fold<double>(
        0.0,
        (s, a) => s + (vec[a]! > 0 ? vec[a]! : 0.0),
      );
      final negSum = attrs.fold<double>(
        0.0,
        (s, a) => s + (vec[a]! < 0 ? -vec[a]! : 0.0),
      );
      if (posSum > _eps) {
        final factor = (negSum + maxEvalPositive) / posSum;
        for (final a in attrs) {
          if (vec[a]! > 0) vec[a] = vec[a]! * factor;
        }
      }
    }

    return vec;
  }

  static Map<String, double> vectorFromPoints(double rating, String position) {
    if (!rating.isFinite) return zeroVector();
    final clamped = rating.clamp(1.0, 10.0);
    final ratingDelta = clamped - baselineRating;
    if (ratingDelta.abs() < _eps) return zeroVector();
    final weights = positionWeights[position.toUpperCase()] ?? defaultWeights;
    final vec = zeroVector();
    for (final attr in attrs) {
      vec[attr] = ratingDelta * (weights[attr] ?? (1 / 6));
    }
    return normalizeEvalVector(vec);
  }

  static Map<String, double> vectorFromTags(List<PerformanceTagItem> tags) {
    final vec = zeroVector();
    for (final tag in tags) {
      final valid = tag.effects.entries
          .where((e) => attrs.contains(e.key) && e.value != 0)
          .toList();
      final magnitude = valid.fold<double>(
        0.0,
        (sum, e) => sum + e.value.abs(),
      );
      if (magnitude <= _eps) continue;
      for (final e in valid) {
        vec[e.key] = vec[e.key]! + (e.value / magnitude);
      }
    }
    return normalizeEvalVector(vec);
  }

  static Map<String, double> vectorFromAI(
    List<TextPerformanceChange> aiChanges,
  ) {
    final vec = zeroVector();
    for (final item in aiChanges) {
      final attr = item.attribute.toLowerCase();
      if (!attrs.contains(attr) || item.change == 0) continue;
      final clamped = item.change.clamp(-3, 3);
      vec[attr] = vec[attr]! + clamped * aiUnitScale;
    }
    return normalizeEvalVector(vec);
  }

  static Map<String, double> selfReportMicroBonusVector(
    int goals,
    int assists,
  ) {
    final g = goals < 0 ? 0 : goals;
    final a = assists < 0 ? 0 : assists;
    final total = g + a;
    if (total <= 0) return zeroVector();
    final bonusUnits = total == 1 ? 0.4 : (total == 2 ? 0.7 : 1.0);
    final goalShare = bonusUnits * (g / total);
    final assistShare = bonusUnits * (a / total);
    return {
      'pac': goalShare * 0.3,
      'sho': goalShare * 0.7,
      'pas': assistShare * 0.7,
      'dri': assistShare * 0.3,
      'def': 0.0,
      'phy': 0.0,
    };
  }

  static double equivalentRatingFromVector(Map<String, double> vec) {
    final net = attrs.fold<double>(0.0, (sum, a) => sum + (vec[a] ?? 0.0));
    final raw = baselineRating + net;
    return ((raw * 10).round() / 10).clamp(1.0, 10.0);
  }

  static Map<String, int> _allocateHamilton(
    List<({String attr, double value})> magnitudes,
  ) {
    final result = {for (final a in attrs) a: 0};
    final total = magnitudes.fold<double>(0.0, (sum, item) => sum + item.value);
    final budget = roundHalfAwayFromZero(total);
    if (budget <= 0) return result;

    var assigned = 0;
    final remainders = <({String attr, double rem, double mag, int order})>[];
    for (final item in magnitudes) {
      final base = (item.value + _eps).floor();
      result[item.attr] = base;
      assigned += base;
      remainders.add((
        attr: item.attr,
        rem: (item.value - base) > 0 ? (item.value - base) : 0.0,
        mag: item.value,
        order: attrs.indexOf(item.attr),
      ));
    }

    final left = budget - assigned;
    if (left > 0) {
      remainders.sort((a, b) {
        if ((b.rem - a.rem).abs() > _eps) return b.rem.compareTo(a.rem);
        if ((b.mag - a.mag).abs() > _eps) return b.mag.compareTo(a.mag);
        return a.order.compareTo(b.order);
      });
      for (var i = 0; i < left && i < remainders.length; i++) {
        final attr = remainders[i].attr;
        result[attr] = result[attr]! + 1;
      }
    }
    return result;
  }

  static EvaluationImpactPreview applyRatingVector({
    required Map<String, int> currentAttributes,
    required int currentOvr,
    required Map<String, double> totalVector,
    Map<String, double>? peerVectorForRating,
  }) {
    final scale = ovrTierScale(currentOvr);
    final ovrVec = {
      for (final attr in attrs) attr: (totalVector[attr] ?? 0.0) * scale,
    };

    final l1Ovr = attrs.fold<double>(0.0, (sum, a) => sum + ovrVec[a]!.abs());
    if (l1Ovr > maxStep) {
      final factor = maxStep / l1Ovr;
      for (final attr in attrs) {
        ovrVec[attr] = ovrVec[attr]! * factor;
      }
    }

    final posItems = <({String attr, double value})>[];
    final negItems = <({String attr, double value})>[];
    for (final attr in attrs) {
      final targetPts = ovrVec[attr]! * attrs.length;
      if (targetPts > _eps) {
        posItems.add((attr: attr, value: targetPts));
      } else if (targetPts < -_eps) {
        negItems.add((attr: attr, value: -targetPts));
      }
    }

    final posInts = _allocateHamilton(posItems);
    final negInts = _allocateHamilton(negItems);

    final updated = <String, int>{};
    final deltas = <String, int>{};
    for (final attr in attrs) {
      final initial = currentAttributes[attr] ?? currentOvr;
      final rawDelta = posInts[attr]! - negInts[attr]!;
      final cappedDelta = rawDelta.clamp(-maxAttrDelta, maxAttrDelta);
      final nextVal = (initial + cappedDelta).clamp(minAttribute, maxAttribute);
      updated[attr] = nextVal;
      deltas[attr] = nextVal - initial;
    }

    final baseAvgOvr = (attrs.fold<int>(
              0,
              (sum, attr) => sum + (currentAttributes[attr] ?? currentOvr),
            ) /
            attrs.length)
        .round();
    final nextAvgOvr = (attrs.fold<int>(
              0,
              (sum, attr) => sum + updated[attr]!,
            ) /
            attrs.length)
        .round();
    final newOvr = (currentOvr + (nextAvgOvr - baseAvgOvr)).clamp(
      minOvr,
      maxOvr,
    );
    return EvaluationImpactPreview(
      oldOvr: currentOvr,
      newOvr: newOvr,
      updatedAttributes: updated,
      attributeDeltas: deltas,
      equivalentRating: equivalentRatingFromVector(
        peerVectorForRating ?? totalVector,
      ),
    );
  }

  static EvaluationImpactPreview previewFromPoints({
    required Map<String, int> currentAttributes,
    required int currentOvr,
    required String position,
    required double rating,
  }) {
    final vec = vectorFromPoints(rating, position);
    return applyRatingVector(
      currentAttributes: currentAttributes,
      currentOvr: currentOvr,
      totalVector: vec,
    );
  }

  static EvaluationImpactPreview previewFromTags({
    required Map<String, int> currentAttributes,
    required int currentOvr,
    required List<PerformanceTagItem> tags,
  }) {
    final vec = vectorFromTags(tags);
    return applyRatingVector(
      currentAttributes: currentAttributes,
      currentOvr: currentOvr,
      totalVector: vec,
    );
  }

  static EvaluationImpactPreview previewFromAI({
    required Map<String, int> currentAttributes,
    required int currentOvr,
    required List<TextPerformanceChange> aiChanges,
  }) {
    final vec = vectorFromAI(aiChanges);
    return applyRatingVector(
      currentAttributes: currentAttributes,
      currentOvr: currentOvr,
      totalVector: vec,
    );
  }

  /// Helper de compatibilidad: aplica un cambio por Nota usando el motor unificado.
  static Map<String, int> calculateAttributeChangesFromPoints({
    required PlayerModel player,
    required double ovrChange,
  }) {
    final currentMap = {
      'pac': player.pac,
      'sho': player.sho,
      'pas': player.pas,
      'dri': player.dri,
      'def': player.def,
      'phy': player.phy,
    };
    if (ovrChange == 0) return currentMap;
    final scale = ovrTierScale(player.ovr);
    final ratingDelta = (ovrChange / scale).clamp(-maxEvalNegative, maxEvalPositive);
    final rating = (baselineRating + ratingDelta).clamp(1.0, 10.0);
    return previewFromPoints(
      currentAttributes: currentMap,
      currentOvr: player.ovr,
      position: player.position,
      rating: rating,
    ).updatedAttributes;
  }

  /// Helper de compatibilidad: aplica etiquetas usando el motor unificado.
  static Map<String, int> calculateAttributeChangesFromTags({
    required Map<String, int> currentAttributes,
    required List<PerformanceTagItem> tags,
    int? currentOvr,
  }) {
    final ovr = currentOvr ?? computeOvr(currentAttributes);
    return previewFromTags(
      currentAttributes: currentAttributes,
      currentOvr: ovr,
      tags: tags,
    ).updatedAttributes;
  }

  /// Media simple usada por finalizeMatchEvaluation. La posición sólo afecta
  /// la distribución de puntos, no el cálculo final de OVR.
  static int computeOvr(Map<String, int> attrsMap, [String position = 'MED']) {
    final total = attrs.fold<int>(
      0,
      (sum, attr) => sum + (attrsMap[attr] ?? 50),
    );
    return (total / attrs.length).round().clamp(minOvr, maxOvr);
  }
}
