import '../services/weather_service.dart';

enum WeatherAdvisoryLevel { information, caution, danger }

class WeatherAdvisory {
  final String code;
  final String title;
  final String message;
  final WeatherAdvisoryLevel level;
  const WeatherAdvisory(this.code, this.title, this.message, this.level);
}

/// Kickoff guidance, not an official alert. Rain probability is not lightning.
List<WeatherAdvisory> weatherAdvisories(WeatherForecast weather) {
  final result = <WeatherAdvisory>[];
  if ({95, 96, 99}.contains(weather.weatherCode) || weather.icon == 'Zap') {
    result.add(
      const WeatherAdvisory(
        'storm',
        'Tormenta prevista',
        'Revisen si corresponde reprogramar. Si escuchan truenos, interrumpan el juego y busquen refugio cerrado.',
        WeatherAdvisoryLevel.danger,
      ),
    );
  }
  final uv = weather.uvIndexExact ?? weather.uvIndex.toDouble();
  if (weather.hasData('uv_index') && uv >= 3) {
    result.add(
      WeatherAdvisory(
        'uv',
        uv >= 11
            ? 'UV extremo'
            : uv >= 8
            ? 'UV muy alto'
            : uv >= 6
            ? 'UV alto'
            : 'Protección solar',
        uv >= 8
            ? 'UV ${uv.toStringAsFixed(1)}. Evitá la exposición del mediodía y buscá sombra; usá protección solar.'
            : 'UV ${uv.toStringAsFixed(1)}. Usá protección solar y buscá sombra en las pausas.',
        uv >= 8
            ? WeatherAdvisoryLevel.caution
            : WeatherAdvisoryLevel.information,
      ),
    );
  }
  if ((weather.hasData('temperature_2m') && weather.temperature >= 30) ||
      (weather.hasData('apparent_temperature') && weather.feelsLike >= 32)) {
    result.add(
      const WeatherAdvisory(
        'heat',
        'Calor para tener en cuenta',
        'Prevean agua y pausas. Revisen el horario si las condiciones resultan demasiado exigentes.',
        WeatherAdvisoryLevel.caution,
      ),
    );
  }
  if (weather.hasData('wind_speed_10m') && weather.windSpeed >= 30) {
    result.add(
      WeatherAdvisory(
        'wind',
        'Viento intenso',
        '${weather.windSpeed} km/h previstos. Revisen las condiciones de la cancha antes de jugar.',
        WeatherAdvisoryLevel.caution,
      ),
    );
  }
  if (weather.hasData('precipitation_probability') &&
      weather.precipitation >= 60) {
    result.add(
      WeatherAdvisory(
        'rain',
        'Lluvia probable',
        '${weather.precipitation}% de probabilidad. Revisen el estado del piso y confirmen la cancha.',
        WeatherAdvisoryLevel.information,
      ),
    );
  }
  return [
    for (final level in [
      WeatherAdvisoryLevel.danger,
      WeatherAdvisoryLevel.caution,
      WeatherAdvisoryLevel.information,
    ])
      ...result.where((item) => item.level == level),
  ];
}
