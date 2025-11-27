'use client';

import { useState } from 'react';
import { Bell, BellOff, X, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useNotifications } from '@/hooks/use-notifications';
import { cn } from '@/lib/utils';

interface NotificationPermissionPromptProps {
  className?: string;
  onClose?: () => void;
  variant?: 'card' | 'banner';
}

export function NotificationPermissionPrompt({
  className,
  onClose,
  variant = 'card',
}: NotificationPermissionPromptProps) {
  const { permission, isLoading, error, isSupported, requestPermission } = useNotifications();
  const [isDismissed, setIsDismissed] = useState(false);

  const handleRequest = async () => {
    const success = await requestPermission();
    if (success && onClose) {
      onClose();
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    if (onClose) onClose();
  };

  // Don't show if already granted, denied, unsupported, or dismissed
  if (
    permission === 'granted' ||
    permission === 'denied' ||
    !isSupported ||
    isDismissed
  ) {
    return null;
  }

  if (variant === 'banner') {
    return (
      <div
        className={cn(
          'relative bg-gradient-to-r from-primary/10 to-primary/5 border-b border-primary/20',
          className
        )}
      >
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Bell className="h-5 w-5 text-primary" />
              <div className="flex-1">
                <p className="text-sm font-medium">
                  ¡Activá las notificaciones!
                </p>
                <p className="text-xs text-muted-foreground">
                  Te avisaremos sobre partidos, cambios de equipo y más
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                onClick={handleRequest}
                size="sm"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Activando...
                  </>
                ) : (
                  <>
                    <Bell className="mr-2 h-4 w-4" />
                    Activar
                  </>
                )}
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleDismiss}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {error && (
            <Alert variant="destructive" className="mt-3">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>
      </div>
    );
  }

  // Card variant
  return (
    <Card className={cn('relative', className)}>
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2"
        onClick={handleDismiss}
      >
        <X className="h-4 w-4" />
      </Button>

      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Bell className="h-6 w-6 text-primary" />
          </div>
          <div>
            <CardTitle>Activá las Notificaciones</CardTitle>
            <CardDescription>
              Mantente al día con tus partidos y equipos
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-2 text-sm text-muted-foreground">
          <div className="flex items-start gap-2">
            <Bell className="h-4 w-4 mt-0.5 text-primary" />
            <p>Te avisamos cuando te agregan a un partido</p>
          </div>
          <div className="flex items-start gap-2">
            <Bell className="h-4 w-4 mt-0.5 text-primary" />
            <p>Recordatorios antes de cada partido</p>
          </div>
          <div className="flex items-start gap-2">
            <Bell className="h-4 w-4 mt-0.5 text-primary" />
            <p>Notificaciones de cambios en equipos</p>
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex gap-2">
          <Button
            onClick={handleRequest}
            className="flex-1"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Activando...
              </>
            ) : (
              <>
                <Bell className="mr-2 h-4 w-4" />
                Activar Notificaciones
              </>
            )}
          </Button>

          <Button variant="outline" onClick={handleDismiss}>
            Más tarde
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Settings component for managing notification preferences
 */
export function NotificationSettings() {
  const { permission, isSupported, requestPermission, revokePermission, isLoading } =
    useNotifications();

  if (!isSupported) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BellOff className="h-5 w-5" />
            Notificaciones No Disponibles
          </CardTitle>
          <CardDescription>
            Tu navegador no soporta notificaciones push
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Notificaciones Push
        </CardTitle>
        <CardDescription>
          Configurá cómo querés recibir notificaciones
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">
              Estado de Notificaciones
            </p>
            <p className="text-xs text-muted-foreground">
              {permission === 'granted' && 'Las notificaciones están activas'}
              {permission === 'denied' && 'Has bloqueado las notificaciones'}
              {permission === 'default' && 'No has activado las notificaciones'}
            </p>
          </div>

          {permission === 'granted' ? (
            <Button
              variant="outline"
              onClick={revokePermission}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <BellOff className="mr-2 h-4 w-4" />
                  Desactivar
                </>
              )}
            </Button>
          ) : permission === 'default' ? (
            <Button onClick={requestPermission} disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Bell className="mr-2 h-4 w-4" />
                  Activar
                </>
              )}
            </Button>
          ) : (
            <Alert variant="destructive" className="mt-2">
              <AlertDescription className="text-xs">
                Has bloqueado las notificaciones. Para activarlas, debes cambiar la
                configuración en tu navegador.
              </AlertDescription>
            </Alert>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
