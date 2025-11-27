'use client';

import { useUser } from '@/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { LinkGoogleFitButton } from '@/components/health/link-google-fit-button';
import { User, Settings as SettingsIcon } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { NotificationSettings } from '@/components/notifications/notification-permission-prompt';

export default function SettingsPage() {
  const { user, loading } = useUser();

  if (loading) {
    return (
      <div className="container max-w-4xl py-8 space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-96" />
        </div>
        <Separator />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container max-w-4xl py-8">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              Debes iniciar sesión para ver la configuración.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl py-8 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <SettingsIcon className="h-6 w-6" />
          <h1 className="text-3xl font-bold">Configuración</h1>
        </div>
        <p className="text-muted-foreground">
          Gestioná tu perfil y preferencias de la aplicación
        </p>
      </div>

      <Separator />

      {/* Profile Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <User className="h-5 w-5 text-primary" />
            <div>
              <CardTitle>Perfil de Usuario</CardTitle>
              <CardDescription>
                Tu información básica de la cuenta
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={user.photoURL || undefined} alt={user.displayName || 'Usuario'} />
              <AvatarFallback>
                {user.displayName?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="space-y-1">
              <p className="text-lg font-medium">{user.displayName || 'Usuario'}</p>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Health & Fitness Integration */}
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold mb-1">Salud y Fitness</h2>
          <p className="text-sm text-muted-foreground">
            Conectá dispositivos y apps para vincular tus métricas físicas
          </p>
        </div>
        <LinkGoogleFitButton />
      </div>

      {/* Notifications Section */}
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold mb-1">Notificaciones</h2>
          <p className="text-sm text-muted-foreground">
            Gestioná cómo querés recibir notificaciones sobre partidos y eventos
          </p>
        </div>
        <NotificationSettings />
      </div>

      {/* Future Sections Placeholder */}
      <Card className="border-dashed">
        <CardContent className="pt-6">
          <p className="text-center text-sm text-muted-foreground">
            Más opciones de configuración próximamente
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
