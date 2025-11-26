'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Activity, Calendar, Clock, TrendingUp, Heart, MapPin, Footprints, Flame, Watch, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { addManualPerformanceAction } from '@/lib/actions/server-actions';
import { fetchGoogleFitActivitiesAction, linkActivityToMatchAction } from '@/lib/actions/google-fit-actions';
import { useUser, useFirestore } from '@/firebase';
import { doc } from 'firebase/firestore';
import { useDoc } from '@/firebase/firestore/use-doc';
import type { HealthConnection, GoogleFitActivity } from '@/lib/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

interface ImportActivityDialogProps {
  matchId: string;
  playerId: string;
  matchDate: Date;
  children?: React.ReactNode;
}

export function ImportActivityDialog({ matchId, playerId, matchDate, children }: ImportActivityDialogProps) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [activities, setActivities] = useState<GoogleFitActivity[]>([]);
  const [activeTab, setActiveTab] = useState<'google_fit' | 'manual'>('google_fit');

  // Manual entry state
  const [manualDistance, setManualDistance] = useState('');
  const [manualDuration, setManualDuration] = useState('');

  // Check for Google Fit connection
  const connectionRef = user && firestore
    ? doc(firestore, 'users', user.uid, 'healthConnections', 'google_fit')
    : null;
  const { data: connection, loading: connectionLoading } = useDoc<HealthConnection>(connectionRef);

  const isConnected = connection && connection.isActive;
  const isExpired = connection && new Date(connection.expiresAt) < new Date();

  // Fetch activities when dialog opens and Google Fit is connected
  useEffect(() => {
    if (open && isConnected && !isExpired && user) {
      fetchActivities();
    }
  }, [open, isConnected, isExpired, user]);

  const fetchActivities = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      // Search activities within 24 hours of match date
      const startTime = new Date(matchDate);
      startTime.setHours(0, 0, 0, 0);
      const endTime = new Date(matchDate);
      endTime.setHours(23, 59, 59, 999);

      const result = await fetchGoogleFitActivitiesAction(
        user.uid,
        startTime.toISOString(),
        endTime.toISOString()
      );

      if (result.success && result.sessions) {
        setActivities(result.sessions);
      } else {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: result.error || 'No se pudieron cargar las actividades.',
        });
      }
    } catch (error) {
      console.error('Error fetching activities:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Error al cargar actividades de Google Fit.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLinkActivity = async (activity: GoogleFitActivity) => {
    if (!user) return;

    setIsLinking(true);
    try {
      const result = await linkActivityToMatchAction(
        user.uid,
        playerId,
        matchId,
        {
          distance: activity.distance,
          avgHeartRate: activity.avgHeartRate,
          maxHeartRate: activity.maxHeartRate,
          steps: activity.steps,
          calories: activity.calories,
          duration: activity.duration,
          activityStartTime: activity.startTime,
          activityEndTime: activity.endTime,
          source: 'google_fit',
          rawData: activity,
        }
      );

      if (result.success) {
        toast({
          title: 'Actividad Vinculada',
          description: 'Tus métricas físicas han sido aplicadas al partido.',
        });
        setOpen(false);
      } else {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: result.error || 'No se pudo vincular la actividad.',
        });
      }
    } catch (error) {
      console.error('Error linking activity:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Error al vincular la actividad.',
      });
    } finally {
      setIsLinking(false);
    }
  };

  const handleManualEntry = async () => {
    if (!user) return;

    const distance = parseFloat(manualDistance);
    const duration = parseInt(manualDuration);

    if (isNaN(distance) || distance <= 0 || distance > 20) {
      toast({
        variant: 'destructive',
        title: 'Distancia Inválida',
        description: 'La distancia debe estar entre 0 y 20 km.',
      });
      return;
    }

    if (isNaN(duration) || duration <= 0 || duration > 180) {
      toast({
        variant: 'destructive',
        title: 'Duración Inválida',
        description: 'La duración debe estar entre 0 y 180 minutos.',
      });
      return;
    }

    setIsLinking(true);
    try {
      const result = await addManualPerformanceAction(
        user.uid,
        playerId,
        matchId,
        {
          distance,
          duration,
        }
      );

      if (result.success) {
        toast({
          title: 'Métricas Registradas',
          description: 'Tus métricas manuales han sido aplicadas al partido.',
        });
        setOpen(false);
        setManualDistance('');
        setManualDuration('');
      } else {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: result.error || 'No se pudieron registrar las métricas.',
        });
      }
    } catch (error) {
      console.error('Error adding manual performance:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Error al registrar las métricas.',
      });
    } finally {
      setIsLinking(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline" size="sm">
            <Activity className="mr-2 h-4 w-4" />
            Vincular Actividad Física
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Vincular Actividad Física</DialogTitle>
          <DialogDescription>
            Importá datos de Google Fit o ingresá tus métricas manualmente para recibir pequeños bonus en PAC y PHY.
            <br />
            <span className="text-xs text-muted-foreground">
              💡 Los bonus son opcionales y limitados. Las evaluaciones normales son tu forma principal de progresar.
            </span>
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'google_fit' | 'manual')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="google_fit">
              <Watch className="mr-2 h-4 w-4" />
              Google Fit
            </TabsTrigger>
            <TabsTrigger value="manual">
              <Plus className="mr-2 h-4 w-4" />
              Entrada Manual
            </TabsTrigger>
          </TabsList>

          {/* Google Fit Tab */}
          <TabsContent value="google_fit" className="space-y-4">
            {connectionLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : !isConnected || isExpired ? (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center space-y-4">
                    <Activity className="h-12 w-12 mx-auto text-muted-foreground" />
                    <div>
                      <p className="font-medium mb-2">Google Fit No Conectado</p>
                      <p className="text-sm text-muted-foreground mb-4">
                        {isExpired
                          ? 'Tu conexión con Google Fit expiró. Reconectá para importar actividades.'
                          : 'Conectá Google Fit para importar tus actividades automáticamente.'}
                      </p>
                      <Button variant="outline" onClick={() => window.location.href = '/settings'}>
                        Ir a Configuración
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <span className="ml-2">Buscando actividades...</span>
              </div>
            ) : activities.length === 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center space-y-4">
                    <Calendar className="h-12 w-12 mx-auto text-muted-foreground" />
                    <div>
                      <p className="font-medium mb-2">No se encontraron actividades</p>
                      <p className="text-sm text-muted-foreground">
                        No hay actividades registradas en Google Fit para la fecha del partido
                        ({format(matchDate, "d 'de' MMMM 'de' yyyy", { locale: es })}).
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        Podés usar la pestaña "Entrada Manual" para ingresar tus métricas.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Se encontraron {activities.length} actividad(es) el {format(matchDate, "d 'de' MMMM", { locale: es })}
                </p>
                {activities.map((activity, index) => (
                  <Card key={index} className="hover:border-primary/50 transition-colors">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-base">{activity.name || 'Actividad'}</CardTitle>
                          <CardDescription className="flex items-center gap-2 mt-1">
                            <Clock className="h-3 w-3" />
                            {format(new Date(activity.startTime), "HH:mm", { locale: es })} - {format(new Date(activity.endTime), "HH:mm", { locale: es })}
                            <Badge variant="outline" className="ml-2">
                              {activity.activityType || 'Ejercicio'}
                            </Badge>
                          </CardDescription>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleLinkActivity(activity)}
                          disabled={isLinking}
                        >
                          {isLinking ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            'Vincular'
                          )}
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        {activity.distance && (
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="text-xs text-muted-foreground">Distancia</p>
                              <p className="font-medium">{(activity.distance / 1000).toFixed(2)} km</p>
                            </div>
                          </div>
                        )}
                        {activity.duration && (
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="text-xs text-muted-foreground">Duración</p>
                              <p className="font-medium">{Math.round(activity.duration / 60)} min</p>
                            </div>
                          </div>
                        )}
                        {activity.avgHeartRate && (
                          <div className="flex items-center gap-2">
                            <Heart className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="text-xs text-muted-foreground">FC Promedio</p>
                              <p className="font-medium">{Math.round(activity.avgHeartRate)} bpm</p>
                            </div>
                          </div>
                        )}
                        {activity.calories && (
                          <div className="flex items-center gap-2">
                            <Flame className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="text-xs text-muted-foreground">Calorías</p>
                              <p className="font-medium">{Math.round(activity.calories)} kcal</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Manual Entry Tab */}
          <TabsContent value="manual" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Ingresá Tus Métricas</CardTitle>
                <CardDescription>
                  Si no tenés smartwatch, podés ingresar manualmente la distancia recorrida y duración del partido.
                  El sistema estimará tus métricas y aplicará los mismos bonus.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="distance">Distancia Recorrida (km)</Label>
                  <Input
                    id="distance"
                    type="number"
                    step="0.1"
                    min="0"
                    max="20"
                    placeholder="Ej: 8.5"
                    value={manualDistance}
                    onChange={(e) => setManualDistance(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Estimá la distancia que recorriste durante el partido (0-20 km)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="duration">Duración del Partido (minutos)</Label>
                  <Input
                    id="duration"
                    type="number"
                    step="1"
                    min="0"
                    max="180"
                    placeholder="Ej: 90"
                    value={manualDuration}
                    onChange={(e) => setManualDuration(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Duración total del partido (0-180 minutos)
                  </p>
                </div>

                <Separator />

                <div className="bg-muted/50 p-3 rounded-md space-y-2">
                  <p className="text-xs font-medium">💡 Consejos:</p>
                  <ul className="text-xs space-y-1 ml-4 text-muted-foreground">
                    <li>• Un partido típico de fútbol 11: 90 min, 8-10 km</li>
                    <li>• Fútbol 7: 60-70 min, 5-7 km</li>
                    <li>• Fútbol 5: 50-60 min, 3-5 km</li>
                    <li>• Los bonus son los mismos que con smartwatch</li>
                  </ul>
                </div>

                <Button
                  className="w-full"
                  onClick={handleManualEntry}
                  disabled={isLinking || !manualDistance || !manualDuration}
                >
                  {isLinking ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Registrando...
                    </>
                  ) : (
                    <>
                      <TrendingUp className="mr-2 h-4 w-4" />
                      Registrar Métricas
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
