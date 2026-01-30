'use client';

import { useMemo, useState } from 'react';
import type { Match, AvailablePlayer } from '@/lib/types';
import { useCollection, useFirestore } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { InvitePlayerDialog } from './invite-player-dialog';
import { FindBestFitDialog } from './find-best-fit-dialog';
import { Sparkles, Search, Send, UserPlus, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import { cn } from '@/lib/utils';

interface AvailablePlayersSectionProps {
  match: Match;
  isOwner: boolean;
}

export function AvailablePlayersSection({ match, isOwner }: AvailablePlayersSectionProps) {
  const firestore = useFirestore();
  const [searchTerm, setSearchTerm] = useState('');
  const [positionFilter, setPositionFilter] = useState<string>('all');
  const [isOpen, setIsOpen] = useState(false);

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
      if (playerUidsInMatch.has(player.uid)) return false;
      if (searchTerm && !player.displayName.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }
      if (positionFilter !== 'all' && player.position !== positionFilter) {
        return false;
      }
      return true;
    });
  }, [allAvailablePlayers, match.playerUids, searchTerm, positionFilter]);

  const spotsLeft = match.matchSize - (match.players?.length || 0);

  if (!isOwner) return null;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors rounded-t-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <UserPlus className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base">Invitar Jugadores</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Faltan {spotsLeft} para completar
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="shrink-0">
                {isOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
              </Button>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0 space-y-4">
            {/* AI Assistant CTA */}
            <FindBestFitDialog
              userMatches={[match]}
              availablePlayers={allAvailablePlayers || []}
              selectedMatchId={match.id}
            >
              <button className="w-full flex items-center gap-3 p-3 rounded-lg bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20 hover:from-primary/10 hover:to-primary/15 transition-colors text-left">
                <div className="h-9 w-9 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                  <Sparkles className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">Asistente IA</p>
                  <p className="text-xs text-muted-foreground">Encontra el jugador ideal</p>
                </div>
              </button>
            </FindBestFitDialog>

            {/* Search & Filter */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
              <Select value={positionFilter} onValueChange={setPositionFilter}>
                <SelectTrigger className="w-24 h-9">
                  <SelectValue placeholder="Pos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="POR">POR</SelectItem>
                  <SelectItem value="DEF">DEF</SelectItem>
                  <SelectItem value="MED">MED</SelectItem>
                  <SelectItem value="DEL">DEL</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Player List */}
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredPlayers.length > 0 ? (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {filteredPlayers.map(player => (
                  <div
                    key={player.uid}
                    className="flex items-center gap-3 p-2 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={player.photoUrl} alt={player.displayName} />
                      <AvatarFallback>{player.displayName.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{player.displayName}</p>
                      <div className="flex items-center gap-2 text-xs">
                        <span className={cn(
                          "font-bold uppercase",
                          player.position === 'DEL' && "text-pos-del",
                          player.position === 'MED' && "text-pos-med",
                          player.position === 'DEF' && "text-pos-def",
                          player.position === 'POR' && "text-pos-por",
                        )}>
                          {player.position}
                        </span>
                        <span className="text-muted-foreground">{player.ovr}</span>
                      </div>
                    </div>
                    <InvitePlayerDialog
                      playerToInvite={player}
                      userMatches={[match]}
                      match={match}
                    >
                      <Button size="sm" variant="ghost" className="h-8 px-2">
                        <Send className="h-4 w-4" />
                      </Button>
                    </InvitePlayerDialog>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <UserPlus className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">
                  {searchTerm || positionFilter !== 'all'
                    ? 'Sin resultados'
                    : 'No hay jugadores disponibles'}
                </p>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
