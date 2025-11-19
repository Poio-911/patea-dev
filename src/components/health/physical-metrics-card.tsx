'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Heart, Clock, Footprints, Flame, TrendingUp, Activity, Watch, UserCircle } from 'lucide-react';
import type { PlayerPerformance } from '@/lib/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface PhysicalMetricsCardProps {
  performance: PlayerPerformance;
  compact?: boolean;
}

export function PhysicalMetricsCard({ performance, compact = false }: PhysicalMetricsCardProps) {
  const hasMetrics = performance.distance || performance.avgHeartRate || performance.steps || performance.calories;

  if (!hasMetrics) {
    return null;
  }

  const sourceLabel = {
    google_fit: 'Google Fit',
    apple_health: 'Apple Health',
    manual: 'Manual',
  }[performance.source];

  const sourceIcon = {
    google_fit: Watch,
    apple_health: Watch,
    manual: UserCircle,
  }[performance.source];

  const SourceIcon = sourceIcon;

  if (compact) {
    return (
      <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-900/10 dark:border-blue-800">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 flex-1">
              <Activity className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
              <div className="space-y-2 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-sm">Métricas Físicas</p>
                  <Badge variant="outline" className="text-xs">
                    <SourceIcon className="h-3 w-3 mr-1" />
                    {sourceLabel}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  {performance.distance && (
                    <div className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-medium">{(performance.distance / 1000).toFixed(1)} km</span>
                    </div>
                  )}
                  {performance.duration && (
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-medium">{Math.round(performance.duration)} min</span>
                    </div>
                  )}
                  {performance.avgHeartRate && (
                    <div className="flex items-center gap-1.5">
                      <Heart className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-medium">{Math.round(performance.avgHeartRate)} bpm</span>
                    </div>
                  )}
                  {performance.calories && (
                    <div className="flex items-center gap-1.5">
                      <Flame className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-medium">{Math.round(performance.calories)} kcal</span>
                    </div>
                  )}
                </div>

                {performance.impactOnAttributes && (
                  <div className="flex items-center gap-2 pt-1">
                    <TrendingUp className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                    <div className="flex items-center gap-2 text-xs">
                      {performance.impactOnAttributes.pac && (
                        <span className="text-green-600 dark:text-green-400 font-medium">
                          PAC +{performance.impactOnAttributes.pac.toFixed(1)}
                        </span>
                      )}
                      {performance.impactOnAttributes.phy && (
                        <span className="text-green-600 dark:text-green-400 font-medium">
                          PHY +{performance.impactOnAttributes.phy.toFixed(1)}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-900/10 dark:border-blue-800">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Activity className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <div>
              <CardTitle className="text-base">Métricas Físicas</CardTitle>
              <CardDescription>
                Datos de actividad física vinculados al partido
              </CardDescription>
            </div>
          </div>
          <Badge variant="outline" className="border-blue-500 text-blue-600 dark:text-blue-400">
            <SourceIcon className="h-3 w-3 mr-1" />
            {sourceLabel}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Main Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {performance.distance && (
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span className="text-xs font-medium">Distancia</span>
              </div>
              <p className="text-2xl font-bold">{(performance.distance / 1000).toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">kilómetros</p>
            </div>
          )}

          {performance.duration && (
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span className="text-xs font-medium">Duración</span>
              </div>
              <p className="text-2xl font-bold">{Math.round(performance.duration)}</p>
              <p className="text-xs text-muted-foreground">minutos</p>
            </div>
          )}

          {performance.avgHeartRate && (
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Heart className="h-4 w-4" />
                <span className="text-xs font-medium">FC Promedio</span>
              </div>
              <p className="text-2xl font-bold">{Math.round(performance.avgHeartRate)}</p>
              <p className="text-xs text-muted-foreground">bpm</p>
            </div>
          )}

          {performance.maxHeartRate && (
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Heart className="h-4 w-4" />
                <span className="text-xs font-medium">FC Máxima</span>
              </div>
              <p className="text-2xl font-bold">{Math.round(performance.maxHeartRate)}</p>
              <p className="text-xs text-muted-foreground">bpm</p>
            </div>
          )}

          {performance.steps && (
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Footprints className="h-4 w-4" />
                <span className="text-xs font-medium">Pasos</span>
              </div>
              <p className="text-2xl font-bold">{performance.steps.toLocaleString('es-AR')}</p>
              <p className="text-xs text-muted-foreground">pasos</p>
            </div>
          )}

          {performance.calories && (
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Flame className="h-4 w-4" />
                <span className="text-xs font-medium">Calorías</span>
              </div>
              <p className="text-2xl font-bold">{Math.round(performance.calories)}</p>
              <p className="text-xs text-muted-foreground">kcal</p>
            </div>
          )}
        </div>

        {/* Attribute Impact */}
        {performance.impactOnAttributes && (
          <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg space-y-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
              <p className="text-sm font-medium text-green-900 dark:text-green-100">
                Bonus de Atributos Aplicados
              </p>
            </div>
            <div className="flex items-center gap-4 text-sm">
              {performance.impactOnAttributes.pac && (
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="border-green-500 text-green-600 dark:text-green-400">
                    PAC
                  </Badge>
                  <span className="font-bold text-green-600 dark:text-green-400">
                    +{performance.impactOnAttributes.pac.toFixed(1)}
                  </span>
                </div>
              )}
              {performance.impactOnAttributes.phy && (
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="border-green-500 text-green-600 dark:text-green-400">
                    PHY
                  </Badge>
                  <span className="font-bold text-green-600 dark:text-green-400">
                    +{performance.impactOnAttributes.phy.toFixed(1)}
                  </span>
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Estos bonus se suman a tu evaluación del partido. Las evaluaciones normales siguen siendo la forma principal de progresar.
            </p>
          </div>
        )}

        {/* Activity Time Info */}
        <div className="text-xs text-muted-foreground space-y-1">
          <p>
            <strong>Actividad registrada:</strong>{' '}
            {format(new Date(performance.activityStartTime), "d 'de' MMMM, HH:mm", { locale: es })} -{' '}
            {format(new Date(performance.activityEndTime), "HH:mm'hs'", { locale: es })}
          </p>
          <p>
            <strong>Vinculada:</strong>{' '}
            {format(new Date(performance.linkedAt), "d 'de' MMMM 'de' yyyy, HH:mm'hs'", { locale: es })}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
