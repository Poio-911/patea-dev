"use client";

import React, { useState } from 'react';
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

  // Get all players from both teams
  const allPlayers = match.teams.flatMap(team => 
    team.players.map(player => ({
      ...player,
      teamId: team.id || '',
      teamName: team.name
    }))
  );

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
      case 'foul': return 'Registrar Falta';
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

          {/* Player Selection */}
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
                  >
                    {selectedPlayerName || "Seleccionar jugador..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0">
                  <Command>
                    <CommandInput placeholder="Buscar jugador..." />
                    <CommandEmpty>No se encontró ningún jugador.</CommandEmpty>
                    <CommandGroup>
                      {allPlayers.map((player) => (
                        <CommandItem
                          key={player.uid}
                          onSelect={() => {
                            setSelectedPlayer(player.uid);
                            setSelectedPlayerName(player.displayName);
                            setSelectedTeam(player.teamId);
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
                            <Badge variant="secondary" className="text-xs">
                              {player.teamName}
                            </Badge>
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
                        {allPlayers
                          .filter(p => p.uid !== selectedPlayer)
                          .map((player) => (
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
                                <Badge variant="secondary" className="text-xs">
                                  {player.teamName}
                                </Badge>
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