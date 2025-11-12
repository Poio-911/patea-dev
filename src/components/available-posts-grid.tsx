'use client';

import { useState, useEffect, useTransition, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, MapPin, Loader2, Swords } from 'lucide-react';
import { GroupTeam, TeamAvailabilityPost } from '@/lib/types';
import { JerseyPreview } from './team-builder/jersey-preview';
import { getAvailableTeamPostsAction, challengeTeamPostAction } from '@/lib/actions/server-actions';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from './ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './ui/dialog';
import { celebrationConfetti } from '@/lib/animations';

interface AvailablePostsGridProps {
  userId: string;
  userTeams: GroupTeam[];
  isActive?: boolean;
}

export function AvailablePostsGrid({ userId, userTeams, isActive = true }: AvailablePostsGridProps) {
  const [posts, setPosts] = useState<TeamAvailabilityPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [selectedPost, setSelectedPost] = useState<TeamAvailabilityPost | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const { toast } = useToast();
  const hasLoadedRef = useRef(false);

  const loadPosts = async () => {
    setLoading(true);
    const result = await getAvailableTeamPostsAction(userId);
    if (result.success) {
      setPosts(result.posts);
    }
    setLoading(false);
  };

  useEffect(() => {
    // Only load when active and hasn't loaded before
    if (isActive && !hasLoadedRef.current) {
      hasLoadedRef.current = true;
      loadPosts();
    }
  }, [isActive, userId]);

  const handleChallengePost = () => {
    if (!selectedPost || !selectedTeamId) return;

    startTransition(async () => {
      const result = await challengeTeamPostAction(selectedPost.id, selectedTeamId, userId);
      if (result.success) {
        celebrationConfetti();
        toast({
          title: '¡Desafío enviado!',
          description: `Has aceptado la postulación de "${selectedPost.teamName}". Esperá la confirmación.`,
        });
        setSelectedPost(null);
        setSelectedTeamId(null);
        loadPosts();
      } else {
        toast({
          title: 'Error',
          description: result.error || 'No se pudo enviar el desafío.',
          variant: 'destructive',
        });
      }
    });
  };

  const myTeams = userTeams.filter(team => team.createdBy === userId);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <Alert>
        <AlertDescription>
          No hay equipos disponibles en este momento. Volvé más tarde o creá tu propia postulación.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {posts.map((post) => (
          <Card key={post.id} className="hover:border-primary transition-colors">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="h-16 w-16 shrink-0">
                  <JerseyPreview jersey={post.jersey} size="sm" />
                </div>
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-lg truncate">{post.teamName}</CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="font-medium">
                    {format(new Date(post.date), 'PPP', { locale: es })}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span>{post.time} hs</span>
                </div>
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <span className="line-clamp-2">{post.location.address}</span>
                </div>
              </div>

              {post.description && (
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {post.description}
                  </p>
                </div>
              )}

              <Button
                className="w-full"
                onClick={() => setSelectedPost(post)}
                disabled={myTeams.length === 0}
              >
                <Swords className="h-4 w-4 mr-2" />
                Aceptar Desafío
              </Button>

              {myTeams.length === 0 && (
                <p className="text-xs text-center text-muted-foreground">
                  Necesitás crear un equipo para aceptar desafíos
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Team Selection Dialog */}
      <Dialog open={selectedPost !== null} onOpenChange={() => setSelectedPost(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Seleccioná tu equipo</DialogTitle>
            <DialogDescription>
              ¿Con qué equipo querés aceptar el desafío de "{selectedPost?.teamName}"?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {myTeams.map((team) => (
              <Card
                key={team.id}
                className={`cursor-pointer transition-colors ${
                  selectedTeamId === team.id
                    ? 'border-primary bg-primary/5'
                    : 'hover:border-primary/50'
                }`}
                onClick={() => setSelectedTeamId(team.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12">
                      <JerseyPreview jersey={team.jersey} size="sm" />
                    </div>
                    <div>
                      <h4 className="font-semibold">{team.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {team.members.length} jugadores
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setSelectedPost(null);
                setSelectedTeamId(null);
              }}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleChallengePost}
              disabled={!selectedTeamId || isPending}
            >
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar Desafío
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
