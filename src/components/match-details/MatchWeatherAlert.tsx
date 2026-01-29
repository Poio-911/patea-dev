'use client';

import React from 'react';
import type { Match } from '@/lib/types';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Cloud, Sun, Wind, Droplets } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MatchWeatherAlertProps {
  match: Match;
  className?: string;
}

/**
 * Componente que muestra advertencias climáticas importantes de forma no invasiva
 * Solo aparece cuando hay condiciones problemáticas (lluvia, calor intenso, etc)
 */
export function MatchWeatherAlert({ match, className }: MatchWeatherAlertProps) {
  if (!match.weather) {
    // Para development: mostrar advertencia de ejemplo si no hay clima
    return (
      <Alert variant="default" className={cn("border-l-4 py-3 mb-4", className)}>
        <div className="flex items-center gap-2">
          <Sun className="h-4 w-4" />
          <AlertDescription className="text-sm font-medium">
            No hay datos climáticos disponibles para este partido
          </AlertDescription>
        </div>
      </Alert>
    );
  }

  const { temperature, humidity, uvIndex, windSpeed, precipitation, description } = match.weather;
  
  // Determinar si hay condiciones problemáticas
  const hasRainWarning = (precipitation ?? 0) > 40; // Reducido de 70% a 40%
  const hasHeatWarning = temperature > 28; // Reducido de 30°C a 28°C
  const hasUvWarning = uvIndex && uvIndex > 6; // Reducido de 8 a 6
  const hasWindWarning = windSpeed && windSpeed > 20; // Reducido de 25 a 20 km/h
  
  // Si no hay advertencias, no mostrar nada
  if (!hasRainWarning && !hasHeatWarning && !hasUvWarning && !hasWindWarning) {
    return null;
  }

  // Determinar el tipo de advertencia principal y su ícono
  let alertVariant: 'destructive' | 'default' = 'default';
  let icon: React.ReactNode;
  let message: string;

  if (hasRainWarning) {
    alertVariant = 'destructive';
    icon = <Droplets className="h-4 w-4" />;
    message = `Lluvia probable (${precipitation ?? 0}%) - Considera llevar paraguas`;
  } else if (hasHeatWarning) {
    alertVariant = 'default';
    icon = <Sun className="h-4 w-4" />;
    message = `Calor intenso (${temperature}°C) - Hidratate bien y usa protección solar`;
  } else if (hasUvWarning) {
    alertVariant = 'default';
    icon = <Sun className="h-4 w-4" />;
    message = `UV muy alto (${uvIndex}) - Usa protector solar`;
  } else if (hasWindWarning) {
    alertVariant = 'default';
    icon = <Wind className="h-4 w-4" />;
    message = `Viento fuerte (${windSpeed} km/h) - Cuidado con pelotas altas`;
  } else {
    return null;
  }

  return (
    <Alert 
      variant={alertVariant} 
      className={cn("border-l-4 py-3 mb-4", className)}
    >
      <div className="flex items-center gap-2">
        {icon}
        <AlertDescription className="text-sm font-medium">
          {message}
        </AlertDescription>
      </div>
    </Alert>
  );
}