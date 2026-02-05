"use client";

import React, { useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Check, ChevronsUpDown, Target, AlertTriangle, RotateCcw, Megaphone } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { 
  Match, 
  MatchEvent, 
  MatchEventType, 
  GoalType, 
  BodyPart, 
  CardType, 
  CardReason,
  SubstitutionReason 
} from '@/lib/types';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';

type EventLoggerProps = {
  isOpen: boolean;
  onClose: () => void;
  eventType: MatchEventType;
  match: Match;
  currentMinute: number;
  onEventLogged: (event: MatchEvent) => void;
};

export function EventLogger({
  isOpen,
  onClose,
  eventType,
  match,
  currentMinute,
  onEventLogged
}: EventLoggerProps) {
  const firestore = useFirestore();
  const [selectedPlayer, setSelectedPlayer] = useState('');
  const [selectedPlayerName, setSelectedPlayerName] = useState('');
  const [selectedTeam, setSelectedTeam] = useState('');
  const [minute, setMinute] = useState(currentMinute.toString());
  const [description, setDescription] = useState('');
  
  // Goal-specific fields
  const [assistPlayer, setAssistPlayer] = useState('');
  const [assistPlayerName, setAssistPlayerName] = useState('');
  const [goalType, setGoalType] = useState<GoalType>('regular');
  const [bodyPart, setBodyPart] = useState<BodyPart>('right_foot');
  
  // Card-specific fields
  const [cardType, setCardType] = useState<CardType>('yellow');
  const [cardReason, setCardReason] = useState<CardReason>('foul');
  // Substitution-specific fields
  const [playerOut, setPlayerOut] = useState('');
  const [playerOutName, setPlayerOutName] = useState('');
  const [playerIn, setPlayerIn] = useState('');
  const [playerInName, setPlayerInName] = useState('');
  const [substitutionReason, setSubstitutionReason] = useState<SubstitutionReason>('tactical');
  
  const [openPlayerSelect, setOpenPlayerSelect] = useState(false);
  const [openAssistSelect, setOpenAssistSelect] = useState(false);
  
  // Team roster fallback for league/cup: load group teams and players
  const teamIds = useMemo(() => match.participantTeamIds?.filter(Boolean) || [], [match.participantTeamIds]);
  const teamsQuery = useMemo(() => {
    if (!firestore || teamIds.length === 0) return null;
    return query(collection(firestore, 'teams'), where('__name__', 'in', teamIds.slice(0, 10)));
  }, [firestore, teamIds]);
  const { data: groupTeams } = useCollection<any>(teamsQuery);

  const playersQuery = useMemo(() => {
    if (!firestore || !match.groupId) return null;
    return query(collection(firestore, 'players'), where('groupId', '==', match.groupId));
  }, [firestore, match.groupId]);
  const { data: allGroupPlayers } = useCollection<any>(playersQuery);

  const fallbackPlayers = useMemo(() => {
    if (!groupTeams || !allGroupPlayers) return [] as Array<any>;
    const playersById = new Map(allGroupPlayers.map((p: any) => [p.id, p]));
    const items: Array<any> = [];
    for (const team of groupTeams) {
      for (const member of (team.members || [])) {
        const p = playersById.get(member.playerId);
        if (!p) continue;
        items.push({
          uid: p.id, // use player document id for stats updates
          displayName: p.name,
          position: p.position,
          ovr: p.ovr,
          teamId: team.id || '',
          teamName: team.name || 'Equipo',
          number: member.number,
          status: member.status,
        });
      }
    }
    return items;
  }, [groupTeams, allGroupPlayers]);

  // Prefer match team players if available; else fallback to group team members
  const teamPlayersFromMatch = useMemo(() => {
    return (match.teams || []).flatMap((team, idx) =>
      (team.players || []).map(player => ({
        ...player,
        teamId: team.id || `team${idx + 1}`,
        teamName: team.name,
        number: (player as any).number,
        status: (player as any).status,
      }))
    );
  }, [match.teams]);

  const allPlayers = teamPlayersFromMatch.length > 0 ? teamPlayersFromMatch : fallbackPlayers;

  // Teams for UI selection
  const teamsForUI = useMemo(() => {
    // Prefer group teams when available to keep IDs consistent with fallbackPlayers
    if (groupTeams && groupTeams.length > 0) {
      return groupTeams.map((t: any) => ({ id: t.id, name: t.name }));
    }
    if (match.teams && match.teams.length > 0) {
      return match.teams.map((t, idx) => ({ id: t.id || `team${idx + 1}`, name: t.name }));
    }
    return [] as Array<{ id: string; name: string }>;
  }, [match.teams, groupTeams]);

  // Filter by selected team and sort by status/number/name
  const rosterSorted = (players: any[]) => {
    const rank = (s?: string) => s === 'titular' ? 0 : 1;
    return players.slice().sort((a, b) => {
      const r1 = rank(a.status) - rank(b.status);
      if (r1 !== 0) return r1;
      if (a.number != null && b.number != null) return a.number - b.number;
      return (a.displayName || '').localeCompare(b.displayName || '');
    });
  };
  const filteredPlayers = useMemo(() => rosterSorted(allPlayers.filter(p => !selectedTeam || p.teamId === selectedTeam)), [allPlayers, selectedTeam]);
  const filteredAssistPlayers = useMemo(() => rosterSorted(allPlayers.filter(p => p.teamId === selectedTeam && p.uid !== selectedPlayer)), [allPlayers, selectedTeam, selectedPlayer]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedPlayer || !selectedPlayerName) {
      alert('Por favor selecciona un jugador');
      return;
    }

    const baseEvent: Omit<MatchEvent, 'id'> = {
      type: eventType,
      minute: parseInt(minute) || currentMinute,
      playerId: selectedPlayer,
      playerName: selectedPlayerName,
      teamId: selectedTeam,
      description,
      timestamp: new Date().toISOString(),
    };

    let eventData: Omit<MatchEvent, 'id'> = { ...baseEvent };

    // Add type-specific data
    switch (eventType) {
      case 'goal':
        eventData = {
          ...eventData,
          assistId: assistPlayer || undefined,
          assistName: assistPlayerName || undefined,
          goalType,
          bodyPart,
        };
        break;
      
      case 'card':
        eventData = {
          ...eventData,
          cardType,
          cardReason,
        };
        break;
      
      case 'substitution':
        if (!playerOut || !playerIn) {
          alert('Por favor selecciona ambos jugadores para el cambio');
          return;
        }
        eventData = {
          ...eventData,
          playerOutId: playerOut,
          playerOutName: playerOutName,
          playerInId: playerIn,
          playerInName: playerInName,
          substitutionReason,
        };
        break;
    }

    const event: MatchEvent = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...eventData,
    };

    onEventLogged(event);
    onClose();
  };

  const getEventTitle = () => {
    switch (eventType) {
      case 'goal': return 'Registrar Gol';
      case 'card': return 'Registrar Tarjeta';
      case 'substitution': return 'Registrar Cambio';
      default: return 'Registrar Evento';
    }
  };

  const getEventIcon = () => {
    switch (eventType) {
      case 'goal': return <Target className="h-5 w-5" />;
      case 'card': return <AlertTriangle className="h-5 w-5" />;
      case 'substitution': return <RotateCcw className="h-5 w-5" />;
      case 'foul': return <Megaphone className="h-5 w-5" />;
      default: return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getEventIcon()}
            {getEventTitle()}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Minute */}
          <div className="space-y-2">
            <Label htmlFor="minute">Minuto</Label>
            <Input
              id="minute"
              type="number"
              value={minute}
              onChange={(e) => setMinute(e.target.value)}
              min="0"
              max="120"
              required
            />
          </div>

          {/* Team Selection (required for goals/cards/fouls) */}
          {eventType !== 'substitution' && (
            <div className="space-y-2">
              <Label>Equipo</Label>
              <Select value={selectedTeam} onValueChange={(v) => { setSelectedTeam(v); setSelectedPlayer(''); setSelectedPlayerName(''); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar equipo" />
                </SelectTrigger>
                <SelectContent>
                  {teamsForUI.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Player Selection (filtered by team) */}
          {eventType !== 'substitution' && (
            <div className="space-y-2">
              <Label>Jugador</Label>
              <Popover open={openPlayerSelect} onOpenChange={setOpenPlayerSelect}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={openPlayerSelect}
                    className="w-full justify-between"
                    disabled={!selectedTeam}
                  >
                    {selectedPlayerName || (selectedTeam ? "Seleccionar jugador..." : "Primero seleccioná el equipo")}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0">
                  <Command>
                    <CommandInput placeholder="Buscar jugador..." />
                    <CommandEmpty>No se encontró ningún jugador.</CommandEmpty>
                    <CommandGroup>
                      {filteredPlayers.map((player) => (
                        <CommandItem
                          key={player.uid}
                          onSelect={() => {
                            setSelectedPlayer(player.uid);
                            setSelectedPlayerName(player.displayName);
                            setOpenPlayerSelect(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedPlayer === player.uid ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <div className="flex items-center gap-2">
                            <span>{player.displayName}</span>
                            {player.number != null && (
                              <Badge variant="outline" className="text-xs">#{player.number}</Badge>
                            )}
                            {player.status && (
                              <Badge variant="secondary" className="text-xs">{player.status}</Badge>
                            )}
                            <Badge variant="outline" className="text-xs">
                              {player.position}
                            </Badge>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          )}

          {/* Goal-specific fields */}
          {eventType === 'goal' && (
            <>
              <div className="space-y-2">
                <Label>Asistencia (Opcional)</Label>
                <Popover open={openAssistSelect} onOpenChange={setOpenAssistSelect}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={openAssistSelect}
                      className="w-full justify-between"
                      disabled={!selectedTeam}
                    >
                      {assistPlayerName || "Sin asistencia..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0">
                    <Command>
                      <CommandInput placeholder="Buscar jugador..." />
                      <CommandEmpty>No se encontró ningún jugador.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          onSelect={() => {
                            setAssistPlayer('');
                            setAssistPlayerName('');
                            setOpenAssistSelect(false);
                          }}
                        >
                          <span>Sin asistencia</span>
                        </CommandItem>
                        {filteredAssistPlayers.map((player) => (
                          <CommandItem
                            key={player.uid}
                            onSelect={() => {
                              setAssistPlayer(player.uid);
                              setAssistPlayerName(player.displayName);
                              setOpenAssistSelect(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                assistPlayer === player.uid ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <div className="flex items-center gap-2">
                              <span>{player.displayName}</span>
                              {player.number != null && (
                                <Badge variant="outline" className="text-xs">#{player.number}</Badge>
                              )}
                              {player.status && (
                                <Badge variant="secondary" className="text-xs">{player.status}</Badge>
                              )}
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo de Gol</Label>
                  <Select value={goalType} onValueChange={(value: GoalType) => setGoalType(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="regular">Regular</SelectItem>
                      <SelectItem value="penalty">Penal</SelectItem>
                      <SelectItem value="free_kick">Tiro Libre</SelectItem>
                      <SelectItem value="header">Cabezazo</SelectItem>
                      <SelectItem value="own_goal">Autogol</SelectItem>
                      <SelectItem value="volley">Volea</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Parte del Cuerpo</Label>
                  <Select value={bodyPart} onValueChange={(value: BodyPart) => setBodyPart(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="right_foot">Pie Derecho</SelectItem>
                      <SelectItem value="left_foot">Pie Izquierdo</SelectItem>
                      <SelectItem value="head">Cabeza</SelectItem>
                      <SelectItem value="chest">Pecho</SelectItem>
                      <SelectItem value="other">Otro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          )}

          {/* Card-specific fields */}
          {eventType === 'card' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo de Tarjeta</Label>
                <Select value={cardType} onValueChange={(value: CardType) => setCardType(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yellow">Amarilla</SelectItem>
                    <SelectItem value="red">Roja</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Motivo</Label>
                <Select value={cardReason} onValueChange={(value: CardReason) => setCardReason(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="foul">Falta</SelectItem>
                    <SelectItem value="unsporting_behavior">Conducta Antideportiva</SelectItem>
                    <SelectItem value="dissent">Protestas</SelectItem>
                    <SelectItem value="persistent_fouling">Faltas Reiteradas</SelectItem>
                    <SelectItem value="delaying_game">Pérdida de Tiempo</SelectItem>
                    <SelectItem value="other">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Descripción (Opcional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detalles adicionales del evento..."
              rows={3}
            />
          </div>

          {/* Submit buttons */}
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit">
              Registrar Evento
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}