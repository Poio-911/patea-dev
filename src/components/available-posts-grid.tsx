'use client';

import { useState, useEffect, useTransition, useRef, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Calendar, MapPin, Loader2, Swords, CheckCircle2, Search, Filter, X } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GroupTeam, TeamAvailabilityPost, Invitation } from '@/lib/types';
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
import { useCollection, useFirestore } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';

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
  const firestore = useFirestore();

  // ✅ FASE 2.4: Filtros de búsqueda
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');

  // ✅ Query all invitations for user's teams to check which posts are already challenged
  // Force recompile
  const myTeams = userTeams.filter(team => team.createdBy === userId);
  const myTeamIds = myTeams.map(team => team.id);

  const invitationsQuery = useMemo(() => {
    if (!firestore || myTeamIds.length === 0) return null;
    // Query invitations where user's teams are the challenger
    return query(
      collection(firestore, 'invitations'),
      where('type', '==', 'team_challenge'),
      where('fromTeamId', 'in', myTeamIds.slice(0, 10)), // Firestore limit
      where('status', '==', 'pending')
    );
  }, [firestore, myTeamIds.join(',')]);

  const { data: sentInvitations } = useCollection<Invitation>(invitationsQuery);

  // Create a Set of postIds that have been challenged
  const challengedPostIds = useMemo(() => {
    if (!sentInvitations) return new Set<string>();
    return new Set(sentInvitations.map(inv => inv.postId).filter(Boolean));
  }, [sentInvitations]);

  // ✅ FASE 2.4: Filter posts based on search term and date
  const filteredPosts = useMemo(() => {
    let filtered = posts;

    // Filter by search term (team name or location)
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        post =>
          post.teamName.toLowerCase().includes(term) ||
          post.location.address.toLowerCase().includes(term) ||
          post.location.name.toLowerCase().includes(term)
      );
    }

    // Filter by date range
    if (dateFilter !== 'all') {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      filtered = filtered.filter(post => {
        const postDate = new Date(post.date);

        switch (dateFilter) {
          case 'today':
            return postDate.toDateString() === today.toDateString();
          case 'week':
            const weekFromNow = new Date(today);
            weekFromNow.setDate(weekFromNow.getDate() + 7);
            return postDate >= today && postDate <= weekFromNow;
          case 'month':
            const monthFromNow = new Date(today);
            monthFromNow.setMonth(monthFromNow.getMonth() + 1);
            return postDate >= today && postDate <= monthFromNow;
          default:
            return true;
        }
      });
    }

    return filtered;
  }, [posts, searchTerm, dateFilter]);

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
          title: '¡Desafío enviado! 🎉',
          description: `Has aceptado jugar con "${selectedPost.teamName}". El partido se creará cuando el otro equipo confirme. Mientras tanto: 1) Asegurate de tener la cancha, 2) Confirmá disponibilidad del equipo, 3) Preparate para coordinar detalles finales.`,
          duration: 8000, // 8 segundos para leer todos los pasos
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
      {/* ✅ FASE 2.4: Filtros de búsqueda */}
      <div className="space-y-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por equipo o ubicación..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-10"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
          <Tabs value={dateFilter} onValueChange={(v) => setDateFilter(v as typeof dateFilter)} className="flex-1">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="all">Todos</TabsTrigger>
              <TabsTrigger value="today">Hoy</TabsTrigger>
              <TabsTrigger value="week">Esta Semana</TabsTrigger>
              <TabsTrigger value="month">Este Mes</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {(searchTerm || dateFilter !== 'all') && (
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {filteredPosts.length} {filteredPosts.length === 1 ? 'resultado' : 'resultados'}
            </span>
            {(searchTerm || dateFilter !== 'all') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchTerm('');
                  setDateFilter('all');
                }}
              >
                <X className="h-4 w-4 mr-2" />
                Limpiar filtros
              </Button>
            )}
          </div>
        )}
      </div>

      {filteredPosts.length === 0 ? (
        <Alert>
          <AlertDescription>
            No se encontraron equipos con los filtros aplicados. Intentá con otros criterios de búsqueda.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredPosts.map((post) => {
            const isAlreadyChallenged = challengedPostIds.has(post.id);

          return (
            <Card key={post.id} className={`transition-colors ${
              isAlreadyChallenged ? 'border-muted-foreground/30 opacity-75' : 'hover:border-primary'
            }`}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="h-16 w-16 shrink-0">
                      <JerseyPreview jersey={post.jersey} size="sm" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg truncate">{post.teamName}</CardTitle>
                    </div>
                  </div>
                  {isAlreadyChallenged && (
                    <Badge variant="secondary" className="shrink-0 gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Desafiado
                    </Badge>
                  )}
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
                  disabled={myTeams.length === 0 || isAlreadyChallenged}
                  variant={isAlreadyChallenged ? 'secondary' : 'default'}
                >
                  {isAlreadyChallenged ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Ya Desafiaste
                    </>
                  ) : (
                    <>
                      <Swords className="h-4 w-4 mr-2" />
                      Aceptar Desafío
                    </>
                  )}
                </Button>

                {myTeams.length === 0 ? (
                  <p className="text-xs text-center text-muted-foreground">
                    Necesitás crear un equipo para aceptar desafíos
                  </p>
                ) : isAlreadyChallenged ? (
                  <p className="text-xs text-center text-muted-foreground">
                    Esperando confirmación del otro equipo
                  </p>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
        </div>
      )}

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
