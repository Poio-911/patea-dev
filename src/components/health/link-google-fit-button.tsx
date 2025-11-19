'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, Loader2, CheckCircle2, AlertCircle, Unlink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { generateGoogleFitAuthUrlAction, disconnectGoogleFitAction } from '@/lib/actions/server-actions';
import { useUser, useFirestore } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { useDoc } from '@/firebase/firestore/use-doc';
import type { HealthConnection } from '@/lib/types';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export function LinkGoogleFitButton() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  // Check for connection status
  const connectionRef = user && firestore
    ? doc(firestore, 'users', user.uid, 'healthConnections', 'google_fit')
    : null;
  const { data: connection, loading: connectionLoading } = useDoc<HealthConnection>(connectionRef);

  // Check URL parameters for tokens/success/error messages
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokensParam = params.get('google_fit_tokens');
    const userId = params.get('user_id');
    const error = params.get('google_fit_error');

    // Handle tokens - save to Firestore using client SDK
    if (tokensParam && userId && user && firestore) {
      (async () => {
        try {
          const tokensData = JSON.parse(Buffer.from(tokensParam, 'base64').toString());

          const connectionDoc = doc(firestore, 'users', userId, 'healthConnections', 'google_fit');
          await setDoc(connectionDoc, {
            provider: 'google_fit',
            userId,
            ...tokensData,
          });

          toast({
            title: '¡Google Fit Conectado!',
            description: 'Ahora podés vincular tus actividades físicas a los partidos.',
          });
        } catch (saveError) {
          console.error('Error saving Google Fit connection:', saveError);
          toast({
            variant: 'destructive',
            title: 'Error al Guardar',
            description: 'No se pudo guardar la conexión. Intentá de nuevo.',
          });
        }
        // Clean URL
        window.history.replaceState({}, '', '/settings');
      })();
    }

    if (error) {
      const errorMessages: Record<string, string> = {
        access_denied: 'Acceso denegado. Necesitás autorizar los permisos para conectar Google Fit.',
        invalid_callback: 'Error en la respuesta de Google. Intentá de nuevo.',
        connection_failed: 'No se pudo establecer la conexión. Verificá tu configuración.',
        server_error: 'Error del servidor. Intentá de nuevo más tarde.',
      };

      toast({
        variant: 'destructive',
        title: 'Error al Conectar',
        description: errorMessages[error] || error,
      });
      // Clean URL
      window.history.replaceState({}, '', '/settings');
    }
  }, [toast, user, firestore]);

  const handleConnect = async () => {
    if (!user) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Debes iniciar sesión para conectar Google Fit.',
      });
      return;
    }

    setIsConnecting(true);
    try {
      const result = await generateGoogleFitAuthUrlAction(user.uid);

      if (result.success && result.authUrl) {
        // Redirect to Google OAuth
        window.location.href = result.authUrl;
      } else {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: result.error || 'No se pudo generar la URL de autorización.',
        });
        setIsConnecting(false);
      }
    } catch (error) {
      console.error('Error connecting Google Fit:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Error al iniciar la conexión con Google Fit.',
      });
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!user) return;

    setIsDisconnecting(true);
    try {
      const result = await disconnectGoogleFitAction(user.uid);

      if (result.success) {
        toast({
          title: 'Google Fit Desconectado',
          description: 'Tu cuenta de Google Fit ha sido desvinculada.',
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: result.error || 'No se pudo desconectar Google Fit.',
        });
      }
    } catch (error) {
      console.error('Error disconnecting Google Fit:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Error al desconectar Google Fit.',
      });
    } finally {
      setIsDisconnecting(false);
    }
  };

  const isConnected = connection && connection.isActive;
  const isExpired = connection && new Date(connection.expiresAt) < new Date();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Activity className="h-6 w-6 text-primary" />
            <div>
              <CardTitle>Google Fit</CardTitle>
              <CardDescription>
                Vinculá tus datos de actividad física para obtener bonus en tus atributos
              </CardDescription>
            </div>
          </div>
          {isConnected && !isExpired && (
            <Badge variant="outline" className="border-green-500 text-green-600">
              <CheckCircle2 className="mr-1 h-3 w-3" />
              Conectado
            </Badge>
          )}
          {isExpired && (
            <Badge variant="outline" className="border-yellow-500 text-yellow-600">
              <AlertCircle className="mr-1 h-3 w-3" />
              Expirado
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Info about the feature */}
        <div className="text-sm text-muted-foreground space-y-2">
          <p>
            Al conectar Google Fit, podrás vincular tus actividades físicas (distancia, ritmo cardíaco, pasos)
            a tus partidos y recibir <strong>pequeños bonus</strong> en tus atributos PAC y PHY.
          </p>
          <div className="bg-muted/50 p-3 rounded-md">
            <p className="text-xs font-medium mb-1">💡 Beneficios:</p>
            <ul className="text-xs space-y-1 ml-4">
              <li>• Bonus por distancia recorrida (hasta +1 PAC)</li>
              <li>• Bonus por rendimiento físico (hasta +1 PHY)</li>
              <li>• Completamente opcional - no es necesario para competir</li>
              <li>• También podés ingresar métricas manualmente</li>
            </ul>
          </div>
        </div>

        {/* Connection details */}
        {isConnected && !isExpired && connection && (
          <div className="text-xs text-muted-foreground space-y-1 bg-green-50 dark:bg-green-900/20 p-3 rounded-md">
            <p><strong>Conectado desde:</strong> {format(new Date(connection.connectedAt), "d 'de' MMMM 'de' yyyy", { locale: es })}</p>
            {connection.lastSyncAt && (
              <p><strong>Última sincronización:</strong> {format(new Date(connection.lastSyncAt), "d 'de' MMMM, HH:mm'hs'", { locale: es })}</p>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          {!isConnected || isExpired ? (
            <Button
              onClick={handleConnect}
              disabled={isConnecting || connectionLoading}
              className="w-full"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Conectando...
                </>
              ) : (
                <>
                  <Activity className="mr-2 h-4 w-4" />
                  {isExpired ? 'Reconectar Google Fit' : 'Conectar Google Fit'}
                </>
              )}
            </Button>
          ) : (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  disabled={isDisconnecting}
                  className="w-full"
                >
                  {isDisconnecting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Desconectando...
                    </>
                  ) : (
                    <>
                      <Unlink className="mr-2 h-4 w-4" />
                      Desconectar Google Fit
                    </>
                  )}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Desconectar Google Fit?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Ya no podrás importar actividades desde Google Fit. Tus actividades ya vinculadas no se verán afectadas.
                    Podés reconectar en cualquier momento.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDisconnect}>
                    Desconectar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
