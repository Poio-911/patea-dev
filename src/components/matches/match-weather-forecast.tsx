'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Cloud,
  CloudRain,
  CloudSnow,
  Cloudy,
  Sun,
  Wind,
  Zap,
  Droplets,
  Gauge,
  Eye,
  ThermometerSun,
  AlertTriangle,
} from 'lucide-react';
import type { Match } from '@/lib/types';
import { cn } from '@/lib/utils';

type MatchWeatherForecastProps = {
  match: Match;
  compact?: boolean;
};

const iconMap: Record<string, any> = {
  Sun,
  Cloud,
  Cloudy,
  CloudRain,
  CloudSnow,
  Wind,
  Zap,
};

const getUVLevel = (uvIndex: number) => {
  if (uvIndex <= 2) return { label: 'Bajo', color: 'text-green-600' };
  if (uvIndex <= 5) return { label: 'Moderado', color: 'text-yellow-600' };
  if (uvIndex <= 7) return { label: 'Alto', color: 'text-orange-600' };
  if (uvIndex <= 10) return { label: 'Muy Alto', color: 'text-red-600' };
  return { label: 'Extremo', color: 'text-purple-600' };
};

const getPrecipitationLevel = (precipitation: number) => {
  if (precipitation < 20) return { label: 'Baja', color: 'text-green-600' };
  if (precipitation < 50) return { label: 'Media', color: 'text-yellow-600' };
  if (precipitation < 70) return { label: 'Alta', color: 'text-orange-600' };
  return { label: 'Muy Alta', color: 'text-red-600' };
};

export function MatchWeatherForecast({ match, compact = false }: MatchWeatherForecastProps) {
  if (!match.weather) {
    return null;
  }

  const {
    description,
    icon,
    temperature,
    humidity,
    windSpeed,
    precipitation,
    uvIndex,
    feelsLike,
    conditions,
    recommendation,
  } = match.weather;

  const WeatherIcon = iconMap[icon] || Cloud;
  const uvLevel = uvIndex !== undefined ? getUVLevel(uvIndex) : null;
  const precipLevel = precipitation !== undefined ? getPrecipitationLevel(precipitation) : null;

  // Versión compacta (para cards de partido)
  if (compact) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <WeatherIcon className="w-4 h-4 text-muted-foreground" />
        <span className="font-medium">{temperature}°C</span>
        <span className="text-muted-foreground">{description}</span>
        {precipitation !== undefined && precipitation > 30 && (
          <Badge variant="outline" className="text-xs">
            <Droplets className="w-3 h-3 mr-1" />
            {precipitation}%
          </Badge>
        )}
      </div>
    );
  }

  // Versión expandida (para vista detallada)
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <WeatherIcon className="w-5 h-5" />
          Pronóstico del Clima
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Temperatura principal */}
        <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-lg">
          <div>
            <p className="text-sm text-muted-foreground">Temperatura</p>
            <p className="text-4xl font-bold">{temperature}°C</p>
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
          </div>
          <WeatherIcon className="w-16 h-16 text-blue-600 dark:text-blue-400" />
        </div>

        {/* Sensación térmica */}
        {feelsLike !== undefined && (
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2">
              <ThermometerSun className="w-4 h-4 text-orange-500" />
              <span className="text-sm text-muted-foreground">Sensación térmica</span>
            </div>
            <span className="font-semibold">{feelsLike}°C</span>
          </div>
        )}

        {/* Condiciones detalladas */}
        {conditions && (
          <div className="p-3 bg-muted/50 rounded-lg">
            <p className="text-sm">{conditions}</p>
          </div>
        )}

        {/* Grid de métricas */}
        <div className="grid grid-cols-2 gap-3">
          {humidity !== undefined && (
            <div className="p-3 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <Droplets className="w-4 h-4 text-blue-500" />
                <span className="text-xs text-muted-foreground">Humedad</span>
              </div>
              <p className="text-lg font-semibold">{humidity}%</p>
            </div>
          )}

          {windSpeed !== undefined && (
            <div className="p-3 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <Wind className="w-4 h-4 text-gray-500" />
                <span className="text-xs text-muted-foreground">Viento</span>
              </div>
              <p className="text-lg font-semibold">{windSpeed} km/h</p>
            </div>
          )}

          {precipitation !== undefined && (
            <div className="p-3 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <CloudRain className="w-4 h-4 text-blue-600" />
                <span className="text-xs text-muted-foreground">Precipitación</span>
              </div>
              <p className="text-lg font-semibold">{precipitation}%</p>
              {precipLevel && (
                <Badge variant="outline" className={cn('text-xs mt-1', precipLevel.color)}>
                  {precipLevel.label}
                </Badge>
              )}
            </div>
          )}

          {uvIndex !== undefined && (
            <div className="p-3 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <Sun className="w-4 h-4 text-yellow-500" />
                <span className="text-xs text-muted-foreground">Índice UV</span>
              </div>
              <p className="text-lg font-semibold">{uvIndex}</p>
              {uvLevel && (
                <Badge variant="outline" className={cn('text-xs mt-1', uvLevel.color)}>
                  {uvLevel.label}
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* Recomendación */}
        {recommendation && (
          <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg">
            <div className="flex items-start gap-3">
              <Eye className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium mb-1">Recomendación</p>
                <p className="text-sm text-muted-foreground">{recommendation}</p>
              </div>
            </div>
          </div>
        )}

        {/* Alertas */}
        {precipitation !== undefined && precipitation > 70 && (
          <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm font-medium">
                Alta probabilidad de lluvia - Considerá reprogramar el partido
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
