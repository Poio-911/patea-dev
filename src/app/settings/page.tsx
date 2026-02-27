'use client';

import { useUser, useFirestore } from '@/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { LinkGoogleFitButton } from '@/components/health/link-google-fit-button';
import { User, Settings as SettingsIcon } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { NotificationSettings } from '@/components/notifications/notification-permission-prompt';
import { EditProfileDialog } from '@/components/settings/edit-profile-dialog';
import { doc, getDoc } from 'firebase/firestore';
import type { Player, UserProfile } from '@/lib/types';
import { useEffect, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { getAuth } from 'firebase/auth';

const ADMIN_EMAILS = ['lopeztoma.santiago@gmail.com', 'admin@patea.app'];

export default function SettingsPage() {
  const { user, loading } = useUser();
  const firestore = useFirestore();
  const [player, setPlayer] = useState<Player | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [playerLoading, setPlayerLoading] = useState(true);

  useEffect(() => {
    async function fetchPlayer() {
      if (!user || !firestore) {
        setPlayerLoading(false);
        return;
      }
      try {
        const [playerSnap, userSnap] = await Promise.all([
          getDoc(doc(firestore, 'players', user.uid)),
          getDoc(doc(firestore, 'users', user.uid)),
        ]);
        if (playerSnap.exists()) {
          setPlayer(playerSnap.data() as Player);
        }
        if (userSnap.exists()) {
          setUserProfile(userSnap.data() as UserProfile);
        }
      } catch (err) {
        console.error('Error fetching player in settings:', err);
      } finally {
        setPlayerLoading(false);
      }
    }
    fetchPlayer();
  }, [user, firestore]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
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
      <div className="max-w-4xl mx-auto">
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
    <div className="max-w-4xl mx-auto space-y-6">
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
          <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-4">
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
                {player?.position && (
                  <p className="text-xs font-medium text-primary bg-primary/10 inline-block px-2 py-0.5 rounded">
                    Posición: {player.position}
                  </p>
                )}
              </div>
            </div>

            {/* Edit Profile Button */}
            {!playerLoading && (
              <EditProfileDialog user={user as any} playerData={player || null} userProfile={userProfile} />
            )}
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

      {/* Super Admin Section */}
      {(
        (user.email && ADMIN_EMAILS.includes(user.email.toLowerCase())) ||
        (getAuth().currentUser?.email && ADMIN_EMAILS.includes(getAuth().currentUser!.email!.toLowerCase()))
      ) && (
          <div className="space-y-4 pt-4">
            <div>
              <h2 className="text-xl font-semibold mb-1 flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-destructive" />
                Administración
              </h2>
              <p className="text-sm text-muted-foreground">
                Herramientas globales y métricas de la plataforma
              </p>
            </div>
            <Card className="border-destructive/30 bg-destructive/5">
              <CardHeader>
                <CardTitle className="text-destructive">Panel Super Admin</CardTitle>
                <CardDescription>Acceso restringido a administradores del sistema</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="destructive" className="w-full sm:w-auto">
                  <Link href="/admin">
                    Ingresar al Dashboard de Control
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

      {/* Future Sections Placeholder */}
      <Card className="border-dashed">
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground text-sm">
            Más opciones de configuración estarán disponibles pronto.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
