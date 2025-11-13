
'use client';

import { useState, useEffect, useTransition, useRef, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, MapPin, Trash2, PlusCircle, Loader2 } from 'lucide-react';
import { GroupTeam, TeamAvailabilityPost } from '@/lib/types';
import { JerseyPreview } from './team-builder/jersey-preview';
import { TeamAvailabilityDialog } from './team-availability-dialog';
import { deleteTeamAvailabilityPostAction } from '@/lib/actions/server-actions';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from './ui/alert';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';

interface MyTeamsAvailabilityProps {
  teams: GroupTeam[];
  userId: string;
  isActive?: boolean;
}

export function MyTeamsAvailability({ teams, userId, isActive = true }: MyTeamsAvailabilityProps) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const firestore = useFirestore();
  const hasLoadedRef = useRef(false);

  // Actualizar ref cuando el tab se activa
  useEffect(() => {
    if (isActive && !hasLoadedRef.current) {
      hasLoadedRef.current = true;
    }
  }, [isActive]);

  // Query de Firestore para obtener postulaciones del usuario
  const postsQuery = useMemo(() => {
    if (!firestore || !userId || !isActive) return null;
    return query(
      collection(firestore, 'teamAvailabilityPosts'),
      where('createdBy', '==', userId),
      orderBy('date', 'asc')
    );
  }, [firestore, userId, isActive]);

  const { data: postsData, loading } = useCollection<TeamAvailabilityPost>(postsQuery);
  const posts = postsData || []; // Asegurar que siempre sea un array

  // Función vacía para onSuccess - useCollection se actualiza automáticamente
  const loadPosts = () => {
    // No hace nada - useCollection se actualiza automáticamente
  };

  const handleDeletePost = (postId: string) => {
    startTransition(async () => {
      const result = await deleteTeamAvailabilityPostAction(postId, userId);
      if ('success' in result && result.success) {
        toast({
          title: 'Postulación eliminada',
          description: 'Tu postulación ha sido eliminada correctamente.',
        });
        // No necesitamos recargar - useCollection se actualiza automáticamente
      } else {
        const errorMessage = ('error' in result && result.error) ? result.error : 'No se pudo eliminar la postulación.';
        toast({
          title: 'Error',
          description: String(errorMessage),
          variant: 'destructive',
        });
      }
    });
  };

  const myTeams = teams.filter(team => team.createdBy === userId);

  if (myTeams.length === 0) {
    return (
      <Alert>
        <AlertDescription>
          No tenés equipos creados. Andá a la sección de Grupos para crear un equipo.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Mis Equipos</h3>
          <p className="text-sm text-muted-foreground">
            Gestioná las postulaciones de tus equipos
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {myTeams.map((team) => {
            const teamPosts = posts.filter(post => post.teamId === team.id);
            const hasActivePosts = teamPosts.length > 0;

            return (
              <Card key={team.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12">
                        <JerseyPreview jersey={team.jersey} size="sm" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{team.name}</CardTitle>
                        <CardDescription className="text-xs">
                          {team.members.length} jugadores
                        </CardDescription>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Active Posts */}
                  {hasActivePosts ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Badge variant="secondary" className="text-xs">
                          {teamPosts.length} {teamPosts.length === 1 ? 'postulación activa' : 'postulaciones activas'}
                        </Badge>
                      </div>
                      {teamPosts.map((post) => (
                        <div
                          key={post.id}
                          className="rounded-lg border bg-muted/50 p-3 space-y-2 text-sm"
                        >
                          <div className="flex items-center gap-2 text-xs">
                            <Calendar className="h-3 w-3 text-muted-foreground" />
                            <span>
                              {format(new Date(post.date), 'PPP', { locale: es })} - {post.time}
                            </span>
                          </div>
                          <div className="flex items-start gap-2 text-xs">
                            <MapPin className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
                            <span className="line-clamp-2">{post.location.address}</span>
                          </div>
                          {post.description && (
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {post.description}
                            </p>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full text-xs h-7"
                            onClick={() => handleDeletePost(post.id)}
                            disabled={isPending}
                          >
                            <Trash2 className="h-3 w-3 mr-1" />
                            Eliminar postulación
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-2">
                      No hay postulaciones activas
                    </p>
                  )}

                  {/* Create Post Button */}
                  <TeamAvailabilityDialog
                    team={team}
                    userId={userId}
                    onSuccess={loadPosts}
                    trigger={
                      <Button variant="outline" className="w-full" size="sm">
                        <PlusCircle className="h-4 w-4 mr-2" />
                        Nueva Postulación
                      </Button>
                    }
                  />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
