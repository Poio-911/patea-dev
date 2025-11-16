'use client';

import { useMemo, useState } from 'react';
import type { Match, AvailablePlayer } from '@/lib/types';
import { useCollection, useFirestore } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Badge } from './ui/badge';
import { InvitePlayerDialog } from './invite-player-dialog';
import { FindBestFitDialog } from './find-best-fit-dialog';
import { Sparkles, Search, Send, Users, Loader2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Label } from './ui/label';

interface AvailablePlayersSectionProps {
  match: Match;
  isOwner: boolean;
}

export function AvailablePlayersSection({ match, isOwner }: AvailablePlayersSectionProps) {
  const firestore = useFirestore();
  const [searchTerm, setSearchTerm] = useState('');
  const [positionFilter, setPositionFilter] = useState<string>('all');

  // Query all available players
  const availablePlayersQuery = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'availablePlayers'));
  }, [firestore]);

  const { data: allAvailablePlayers, loading } = useCollection<AvailablePlayer>(availablePlayersQuery);

  // Filter out players already in the match
  const filteredPlayers = useMemo(() => {
    if (!allAvailablePlayers) return [];

    const playerUidsInMatch = new Set(match.playerUids || []);

    return allAvailablePlayers.filter(player => {
      // Exclude players already in the match
      if (playerUidsInMatch.has(player.uid)) return false;

      // Filter by search term
      if (searchTerm && !player.displayName.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }

      // Filter by position
      if (positionFilter !== 'all' && player.position !== positionFilter) {
        return false;
      }

      return true;
    });
  }, [allAvailablePlayers, match.playerUids, searchTerm, positionFilter]);

  const spotsLeft = match.matchSize - (match.players?.length || 0);

  if (!isOwner) return null;

  return (
    <Card className="border-amber-500/50 bg-gradient-to-br from-amber-50/50 to-transparent dark:from-amber-950/20">
      <CardHeader>
        <Alert className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
          <Users className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          <AlertTitle className="text-amber-900 dark:text-amber-100">
            Partido Incompleto
          </AlertTitle>
          <AlertDescription className="text-amber-800 dark:text-amber-200">
            Faltan <strong>{spotsLeft}</strong> jugador{spotsLeft !== 1 ? 'es' : ''} para completar el partido.
          </AlertDescription>
        </Alert>
      </CardHeader>

      <CardContent>
        <Tabs defaultValue="manual" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="manual" className="gap-2">
              <Search className="h-4 w-4" />
              Búsqueda Manual
            </TabsTrigger>
            <TabsTrigger value="ai" className="gap-2">
              <Sparkles className="h-4 w-4 text-amber-500" />
              Asistente IA
            </TabsTrigger>
          </TabsList>

          <TabsContent value="manual" className="space-y-4">
            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="search">Buscar por nombre</Label>
                <Input
                  id="search"
                  placeholder="Nombre del jugador..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="position">Posición</Label>
                <Select value={positionFilter} onValueChange={setPositionFilter}>
                  <SelectTrigger id="position">
                    <SelectValue placeholder="Todas las posiciones" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="Portero">Portero</SelectItem>
                    <SelectItem value="Defensor">Defensor</SelectItem>
                    <SelectItem value="Mediocampista">Mediocampista</SelectItem>
                    <SelectItem value="Delantero">Delantero</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Player List */}
            {loading ? (
              <div className="flex justify-center items-center h-40">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredPlayers.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                {filteredPlayers.map(player => (
                  <Card key={player.uid} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={player.photoUrl} alt={player.displayName} />
                          <AvatarFallback>{player.displayName.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold truncate">{player.displayName}</h4>
                          <div className="flex gap-2 mt-1">
                            <Badge variant="secondary" className="text-xs">
                              {player.ovr}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {player.position}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <InvitePlayerDialog
                        playerToInvite={player}
                        userMatches={[match]}
                        match={match}
                      >
                        <Button size="sm" className="w-full">
                          <Send className="mr-2 h-4 w-4" />
                          Invitar
                        </Button>
                      </InvitePlayerDialog>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">
                  {searchTerm || positionFilter !== 'all'
                    ? 'No se encontraron jugadores con estos filtros.'
                    : 'No hay jugadores disponibles en este momento.'}
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="ai" className="space-y-4">
            <div className="flex flex-col items-center justify-center py-12 gap-6 text-center border-2 border-dashed rounded-lg">
              <Sparkles className="h-16 w-16 text-amber-500" />
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">Asistente de Fichajes con IA</h3>
                <p className="text-sm text-muted-foreground max-w-md">
                  Deja que la IA analice tu partido y te recomiende los mejores jugadores disponibles según las necesidades de tu equipo.
                </p>
              </div>
              <FindBestFitDialog
                userMatches={[match]}
                availablePlayers={allAvailablePlayers || []}
                selectedMatchId={match.id}
              />
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
