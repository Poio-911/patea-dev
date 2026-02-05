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
  if (uvIndex <= 2) return { label: 'Bajo' };
  if (uvIndex <= 5) return { label: 'Moderado' };
  if (uvIndex <= 7) return { label: 'Alto' };
  if (uvIndex <= 10) return { label: 'Muy Alto' };
  return { label: 'Extremo' };
};

const getPrecipitationLevel = (precipitation: number) => {
  if (precipitation < 20) return { label: 'Baja' };
  if (precipitation < 50) return { label: 'Media' };
  if (precipitation < 70) return { label: 'Alta' };
  return { label: 'Muy Alta' };
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

  const WeatherIcon = (icon && iconMap[icon]) || Cloud;
  const uvLevel = uvIndex !== undefined ? getUVLevel(uvIndex) : null;
  const precipLevel = precipitation !== undefined ? getPrecipitationLevel(precipitation) : null;

  // Versión compacta (para cards de partido) - hereda color del padre para contraste
  if (compact) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <WeatherIcon className="w-4 h-4 opacity-80" />
        <span className="font-medium">{temperature}°C</span>
        <span className="opacity-80">{description}</span>
        {precipitation !== undefined && precipitation > 30 && (
          <Badge variant="outline" className="text-xs border-current/30 bg-current/10">
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
        <div className="flex items-center justify-between p-4 bg-card rounded-lg border border-border">
          <div>
            <p className="text-sm text-muted-foreground">Temperatura</p>
            <p className="text-4xl font-bold">{temperature}°C</p>
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
          </div>
          <WeatherIcon className="w-16 h-16 text-foreground" />
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
                <Droplets className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Humedad</span>
              </div>
              <p className="text-lg font-semibold">{humidity}%</p>
            </div>
          )}

          {windSpeed !== undefined && (
            <div className="p-3 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <Wind className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Viento</span>
              </div>
              <p className="text-lg font-semibold">{windSpeed} km/h</p>
            </div>
          )}

          {precipitation !== undefined && (
            <div className="p-3 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <CloudRain className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Precipitación</span>
              </div>
              <p className="text-lg font-semibold">{precipitation}%</p>
              {precipLevel && (
                <Badge variant="outline" className={cn('text-xs mt-1 text-foreground border-border')}>
                  {precipLevel.label}
                </Badge>
              )}
            </div>
          )}

          {uvIndex !== undefined && (
            <div className="p-3 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <Sun className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Índice UV</span>
              </div>
              <p className="text-lg font-semibold">{uvIndex}</p>
              {uvLevel && (
                <Badge variant="outline" className={cn('text-xs mt-1 text-foreground border-border')}>
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
          <div className="p-3 bg-muted border border-border rounded-lg">
            <div className="flex items-center gap-2 text-foreground">
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
