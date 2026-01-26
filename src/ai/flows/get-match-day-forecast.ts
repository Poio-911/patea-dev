'use server';

import { z } from 'zod';

const GetMatchDayForecastInputSchema = z.object({
  location: z.string(),
  date: z.string(),
  lat: z.number().optional(),
  lng: z.number().optional(),
});
export type GetMatchDayForecastInput = z.infer<typeof GetMatchDayForecastInputSchema>;

const GetMatchDayForecastOutputSchema = z.object({
  description: z.string(),
  icon: z.enum(['Sun', 'Cloud', 'Cloudy', 'CloudRain', 'CloudSnow', 'Wind', 'Zap']),
  temperature: z.number(),
  humidity: z.number(),
  windSpeed: z.number(),
  precipitation: z.number(),
  uvIndex: z.number(),
  feelsLike: z.number(),
  conditions: z.string(),
  recommendation: z.string(),
});
export type GetMatchDayForecastOutput = z.infer<typeof GetMatchDayForecastOutputSchema>;

// Mapeo de códigos WMO a iconos
const wmoToIcon: Record<number, GetMatchDayForecastOutput['icon']> = {
  0: 'Sun', 1: 'Sun', 2: 'Cloud', 3: 'Cloudy',
  45: 'Cloudy', 48: 'Cloudy',
  51: 'CloudRain', 53: 'CloudRain', 55: 'CloudRain',
  61: 'CloudRain', 63: 'CloudRain', 65: 'CloudRain',
  71: 'CloudSnow', 73: 'CloudSnow', 75: 'CloudSnow',
  80: 'CloudRain', 81: 'CloudRain', 82: 'CloudRain',
  85: 'CloudSnow', 86: 'CloudSnow',
  95: 'Zap', 96: 'Zap', 99: 'Zap',
};

const wmoToDescription: Record<number, string> = {
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

function getRecommendation(temp: number, precip: number, wind: number): string {
  if (precip > 70) return 'Alta probabilidad de lluvia. Considerá reprogramar.';
  if (precip > 40) return 'Posible lluvia. Llevá ropa impermeable.';
  if (temp > 30) return 'Mucho calor. Hidratate bien y descansá seguido.';
  if (temp < 10) return 'Hace frío. Abrigate bien para el calentamiento.';
  if (wind > 30) return 'Viento fuerte. El balón puede comportarse raro.';
  return 'Condiciones ideales para jugar.';
}

export async function getMatchDayForecast(
  input: GetMatchDayForecastInput
): Promise<GetMatchDayForecastOutput> {
  const { lat, lng, date } = input;

  if (!lat || !lng) {
    throw new Error('Se requieren coordenadas para obtener el clima');
  }

  const matchDate = new Date(date);
  const dateStr = matchDate.toISOString().split('T')[0];
  const hour = matchDate.getHours();

  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&hourly=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation_probability,weather_code,wind_speed_10m,uv_index&timezone=auto&start_date=${dateStr}&end_date=${dateStr}`;

  const response = await fetch(url, {
    cache: 'no-store',
    headers: { 'Cache-Control': 'max-age=3600' }
  });
  if (!response.ok) {
    throw new Error('Error al obtener datos del clima');
  }

  const data = await response.json();
  const hourly = data.hourly;

  if (!hourly || !hourly.time || hourly.time.length === 0) {
    throw new Error('No hay datos de clima disponibles para esta fecha');
  }

  const idx = Math.min(hour, hourly.time.length - 1);

  const weatherCode = hourly.weather_code?.[idx] ?? 0;
  const temp = Math.round(hourly.temperature_2m?.[idx] ?? 20);
  const humidity = Math.round(hourly.relative_humidity_2m?.[idx] ?? 50);
  const feelsLike = Math.round(hourly.apparent_temperature?.[idx] ?? temp);
  const precipitation = Math.round(hourly.precipitation_probability?.[idx] ?? 0);
  const windSpeed = Math.round(hourly.wind_speed_10m?.[idx] ?? 0);
  const uvIndex = Math.round(hourly.uv_index?.[idx] ?? 0);

  const description = wmoToDescription[weatherCode] ?? 'Parcialmente nublado';
  const icon = wmoToIcon[weatherCode] ?? 'Cloud';

  return {
    description,
    icon,
    temperature: temp,
    humidity,
    windSpeed,
    precipitation,
    uvIndex,
    feelsLike,
    conditions: `${description}. Temperatura ${temp}°C, sensación térmica ${feelsLike}°C.`,
    recommendation: getRecommendation(temp, precipitation, windSpeed),
  };
}
