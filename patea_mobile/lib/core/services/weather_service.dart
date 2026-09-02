import 'dart:convert';
import 'package:http/http.dart' as http;

/// Port 1:1 de src/ai/flows/get-match-day-forecast.ts (web). A pesar de
/// vivir en 'ai/flows/' en la web, NO es un flow de Genkit/IA: es un fetch
/// directo a Open-Meteo (gratis, sin API key), así que se llama igual desde
/// Flutter sin necesitar una Cloud Function.
class WeatherForecast {
  final String description;
  final String icon; // Sun, Cloud, Cloudy, CloudRain, CloudSnow, Wind, Zap
  final int temperature;
  final int humidity;
  final int windSpeed;
  final int precipitation;
  final int uvIndex;
  final int feelsLike;
  final String conditions;
  final String recommendation;

  WeatherForecast({
    required this.description,
    required this.icon,
    required this.temperature,
    required this.humidity,
    required this.windSpeed,
    required this.precipitation,
    required this.uvIndex,
    required this.feelsLike,
    required this.conditions,
    required this.recommendation,
  });
}

const Map<int, String> _wmoToIcon = {
  0: 'Sun', 1: 'Sun', 2: 'Cloud', 3: 'Cloudy',
  45: 'Cloudy', 48: 'Cloudy',
  51: 'CloudRain', 53: 'CloudRain', 55: 'CloudRain',
  61: 'CloudRain', 63: 'CloudRain', 65: 'CloudRain',
  71: 'CloudSnow', 73: 'CloudSnow', 75: 'CloudSnow',
  80: 'CloudRain', 81: 'CloudRain', 82: 'CloudRain',
  85: 'CloudSnow', 86: 'CloudSnow',
  95: 'Zap', 96: 'Zap', 99: 'Zap',
};

const Map<int, String> _wmoToDescription = {
  0: 'Despejado',
  1: 'Mayormente despejado',
  2: 'Parcialmente nublado',
  3: 'Nublado',
  45: 'Niebla',
  48: 'Niebla helada',
  51: 'Llovizna leve',
  53: 'Llovizna',
  55: 'Llovizna intensa',
  61: 'Lluvia leve',
  63: 'Lluvia moderada',
  65: 'Lluvia intensa',
  71: 'Nieve leve',
  73: 'Nieve moderada',
  75: 'Nieve intensa',
  80: 'Chubascos leves',
  81: 'Chubascos',
  82: 'Chubascos intensos',
  85: 'Nevada leve',
  86: 'Nevada intensa',
  95: 'Tormenta',
  96: 'Tormenta con granizo',
  99: 'Tormenta severa',
};

String _getRecommendation(int temp, int precip, int wind) {
  if (precip > 70) return 'Alta probabilidad de lluvia. Considerá reprogramar.';
  if (precip > 40) return 'Posible lluvia. Llevá ropa impermeable.';
  if (temp > 30) return 'Mucho calor. Hidratate bien y descansá seguido.';
  if (temp < 10) return 'Hace frío. Abrigate bien para el calentamiento.';
  if (wind > 30) return 'Viento fuerte. El balón puede comportarse raro.';
  return 'Condiciones ideales para jugar.';
}

class WeatherService {
  Future<WeatherForecast> getForecast({
    required double lat,
    required double lng,
    required DateTime dateTime,
  }) async {
    final dateStr =
        '${dateTime.year.toString().padLeft(4, '0')}-${dateTime.month.toString().padLeft(2, '0')}-${dateTime.day.toString().padLeft(2, '0')}';
    final hour = dateTime.hour;

    final uri = Uri.parse(
      'https://api.open-meteo.com/v1/forecast'
      '?latitude=$lat&longitude=$lng'
      '&hourly=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation_probability,weather_code,wind_speed_10m,uv_index'
      '&timezone=auto&start_date=$dateStr&end_date=$dateStr',
    );

    final response = await http.get(uri).timeout(const Duration(seconds: 10));
    if (response.statusCode != 200) {
      throw Exception('Error al obtener datos del clima');
    }

    final data = jsonDecode(response.body) as Map<String, dynamic>;
    final hourly = data['hourly'] as Map<String, dynamic>?;
    final times = hourly?['time'] as List<dynamic>?;
    if (hourly == null || times == null || times.isEmpty) {
      throw Exception('No hay datos de clima disponibles para esta fecha');
    }

    final idx = hour < times.length ? hour : times.length - 1;
    num at(String key, num fallback) {
      final list = hourly[key] as List<dynamic>?;
      if (list == null || idx >= list.length || list[idx] == null) return fallback;
      return list[idx] as num;
    }

    final weatherCode = at('weather_code', 0).toInt();
    final temp = at('temperature_2m', 20).round();
    final humidity = at('relative_humidity_2m', 50).round();
    final feelsLike = at('apparent_temperature', temp).round();
    final precipitation = at('precipitation_probability', 0).round();
    final windSpeed = at('wind_speed_10m', 0).round();
    final uvIndex = at('uv_index', 0).round();

    final description = _wmoToDescription[weatherCode] ?? 'Parcialmente nublado';
    final icon = _wmoToIcon[weatherCode] ?? 'Cloud';

    return WeatherForecast(
      description: description,
      icon: icon,
      temperature: temp,
      humidity: humidity,
      windSpeed: windSpeed,
      precipitation: precipitation,
      uvIndex: uvIndex,
      feelsLike: feelsLike,
      conditions: '$description. Temperatura $temp°C, sensación térmica $feelsLike°C.',
      recommendation: _getRecommendation(temp, precipitation, windSpeed),
    );
  }
}
