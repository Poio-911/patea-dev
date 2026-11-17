import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'weather_service.dart';

typedef MatchWeatherQuery = ({double lat, double lng, DateTime kickoff});

class MatchWeatherSnapshot {
  final WeatherForecast forecast;
  final DateTime updatedAt;
  const MatchWeatherSnapshot(this.forecast, this.updatedAt);
}

final weatherServiceProvider = Provider<WeatherService>(
  (ref) => WeatherService(),
);

/// Includes venue and kickoff so rescheduling cannot reuse old weather.
/// Successful responses are retained briefly. No writes to matches.
final matchWeatherProvider = FutureProvider.autoDispose
    .family<MatchWeatherSnapshot, MatchWeatherQuery>((ref, query) async {
      var disposed = false;
      ref.onDispose(() => disposed = true);
      final forecast = await ref
          .watch(weatherServiceProvider)
          .getForecast(lat: query.lat, lng: query.lng, dateTime: query.kickoff);
      if (!disposed) {
        final link = ref.keepAlive();
        final expiry = Timer(const Duration(minutes: 15), link.close);
        ref.onDispose(expiry.cancel);
      }
      return MatchWeatherSnapshot(forecast, DateTime.now());
    });
