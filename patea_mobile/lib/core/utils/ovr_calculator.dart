import '../models/player_model.dart';
import '../constants/performance_tags.dart';

class OvrCalculator {
  static const int minOvr = 40;
  static const int maxOvr = 99;
  static const int minAttribute = 30;
  static const int maxAttribute = 99;
  static const double maxStep = 1.5;

  /// Calcula el cambio de OVR según el rating promedio (1-10) con escala anti-inflación
  static double calculateOvrChange(int currentOvr, double avgRating) {
    final double ratingDelta = avgRating - 5.0; // 5.0 es neutro
    double scale = 0.50;

    if (currentOvr < 50) {
      scale = 0.50;
    } else if (currentOvr < 60) {
      scale = 0.40;
    } else if (currentOvr < 70) {
      scale = 0.30;
    } else if (currentOvr < 80) {
      scale = 0.20;
    } else if (currentOvr < 90) {
      scale = 0.10;
    } else {
      scale = 0.05; // Grind leyenda
    }

    final double rawDelta = ratingDelta * scale;
    return rawDelta.clamp(-maxStep, maxStep);
  }

  /// Distribución de puntos a los 6 atributos según la posición
  static const Map<String, Map<String, double>> positionWeights = {
    'DEL': {'pac': 0.25, 'sho': 0.35, 'pas': 0.15, 'dri': 0.15, 'def': 0.05, 'phy': 0.05},
    'MED': {'pac': 0.15, 'sho': 0.15, 'pas': 0.30, 'dri': 0.20, 'def': 0.10, 'phy': 0.10},
    'DEF': {'pac': 0.15, 'sho': 0.05, 'pas': 0.15, 'dri': 0.05, 'def': 0.40, 'phy': 0.20},
    'POR': {'pac': 0.10, 'sho': 0.05, 'pas': 0.10, 'dri': 0.05, 'def': 0.50, 'phy': 0.20},
  };

  static const Map<String, double> defaultWeights = {
    'pac': 0.166,
    'sho': 0.166,
    'pas': 0.166,
    'dri': 0.166,
    'def': 0.166,
    'phy': 0.166,
  };

  static Map<String, int> calculateAttributeChangesFromPoints({
    required PlayerModel player,
    required double ovrChange,
  }) {
    if (ovrChange == 0) {
      return {
        'pac': player.pac,
        'sho': player.sho,
        'pas': player.pas,
        'dri': player.dri,
        'def': player.def,
        'phy': player.phy,
      };
    }

    final weights = positionWeights[player.position.toUpperCase()] ?? defaultWeights;
    final double totalPointsToAdd = ovrChange * 6.0;
    double accumulatedError = 0.0;

    final currentMap = {
      'pac': player.pac,
      'sho': player.sho,
      'pas': player.pas,
      'dri': player.dri,
      'def': player.def,
      'phy': player.phy,
    };

    final resultMap = <String, int>{};

    for (final attr in ['pac', 'sho', 'pas', 'dri', 'def', 'phy']) {
      final currentVal = currentMap[attr]!;
      final targetShare = totalPointsToAdd * (weights[attr] ?? 0.166);

      double multiplier = 1.0;
      if (currentVal >= 92) {
        multiplier = 0.1;
      } else if (currentVal >= 85) {
        multiplier = 0.2;
      } else if (currentVal >= 75) {
        multiplier = 0.4;
      } else if (currentVal >= 60) {
        multiplier = 0.7;
      }

      final effectiveShare = targetShare > 0 ? targetShare * multiplier : targetShare;
      final pointWithDecimal = effectiveShare + accumulatedError;
      final int pointRounded = effectiveShare > 0 ? pointWithDecimal.ceil() : pointWithDecimal.floor();
      accumulatedError = pointWithDecimal - pointRounded;

      final newVal = (currentVal + pointRounded).clamp(minAttribute, maxAttribute);
      resultMap[attr] = newVal;
    }

    return resultMap;
  }

  /// Aplica los efectos directos de los tags de rendimiento seleccionados
  static Map<String, int> calculateAttributeChangesFromTags({
    required Map<String, int> currentAttributes,
    required List<PerformanceTagItem> tags,
  }) {
    final updated = Map<String, int>.from(currentAttributes);

    for (final tag in tags) {
      tag.effects.forEach((attr, change) {
        final currentVal = updated[attr] ?? 50;
        double multiplier = 1.0;
        if (currentVal >= 92) {
          multiplier = 0.1;
        } else if (currentVal >= 85) {
          multiplier = 0.2;
        } else if (currentVal >= 75) {
          multiplier = 0.4;
        } else if (currentVal >= 60) {
          multiplier = 0.7;
        }

        final double rawChange = change * multiplier;
        final int integerChange = rawChange > 0 ? rawChange.ceil() : rawChange.floor();
        final newVal = (currentVal + integerChange).clamp(minAttribute, maxAttribute);
        updated[attr] = newVal;
      });
    }

    return updated;
  }

  /// Calcula el OVR final a partir de los 6 atributos
  static int computeOvr(Map<String, int> attrs) {
    final sum = (attrs['pac'] ?? 50) +
        (attrs['sho'] ?? 50) +
        (attrs['pas'] ?? 50) +
        (attrs['dri'] ?? 50) +
        (attrs['def'] ?? 50) +
        (attrs['phy'] ?? 50);
    return (sum / 6.0).round().clamp(minOvr, maxOvr);
  }
}
