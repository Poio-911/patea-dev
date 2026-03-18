'use client';

import * as React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Users, Trash2, Plus, FileSpreadsheet, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Player {
  id: string;
  name: string;
  number: number | string;
}

interface ManagePlayersDialogImprovedProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamName: string;
  players: Player[];
  onAddPlayer: (name: string, number: string) => Promise<void>;
  onAddPlayersBulk: (players: Array<{ name: string; number: string }>) => Promise<void>;
  onRemovePlayer: (playerId: string) => Promise<void>;
}

export function ManagePlayersDialogImproved({
  open,
  onOpenChange,
  teamName,
  players,
  onAddPlayer,
  onAddPlayersBulk,
  onRemovePlayer,
}: ManagePlayersDialogImprovedProps) {
  const { toast } = useToast();
  const [playerName, setPlayerName] = React.useState('');
  const [playerNumber, setPlayerNumber] = React.useState('');
  const [bulkText, setBulkText] = React.useState('');
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setPlayerName('');
      setPlayerNumber('');
      setBulkText('');
    }
  }, [open]);

  const handleAddSingle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName.trim()) return;

    setIsSaving(true);
    try {
      await onAddPlayer(playerName.trim(), playerNumber);
      setPlayerName('');
      setPlayerNumber('');
    } catch (error) {
      // Error handled by parent
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddBulk = async () => {
    if (!bulkText.trim()) return;

    const lines = bulkText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    if (lines.length === 0) return;

    const playersToAdd: Array<{ name: string; number: string }> = [];

    for (const line of lines) {
      // Parse formats:
      // "10 Lionel Messi" or "Lionel Messi 10" or "Lionel Messi" or "10	Lionel Messi" (tab-separated from Excel)
      const parts = line.split(/[\t\s]+/); // Split by tab or space

      let name = '';
      let number = '';

      // Try to find a number in the parts
      const numberIndex = parts.findIndex(part => /^\d+$/.test(part));

      if (numberIndex !== -1) {
        number = parts[numberIndex];
        name = parts.filter((_, i) => i !== numberIndex).join(' ');
      } else {
        name = parts.join(' ');
      }

      if (name) {
        playersToAdd.push({ name, number });
      }
    }

    if (playersToAdd.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudieron parsear los jugadores. Verificá el formato.',
      });
      return;
    }

    setIsSaving(true);
    try {
      await onAddPlayersBulk(playersToAdd);
      setBulkText('');
      toast({
        title: '✨ Jugadores Agregados',
        description: `Se agregaron ${playersToAdd.length} jugador${playersToAdd.length !== 1 ? 'es' : ''} al plantel.`,
      });
    } catch (error) {
      // Error handled by parent
    } finally {
      setIsSaving(false);
    }
  };

  const parsedPlayersCount = bulkText
    .split('\n')
    .filter(line => line.trim().length > 0).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 uppercase tracking-tight font-black text-xl">
            <Users className="h-5 w-5 text-primary" />
            Plantel de {teamName}
          </DialogTitle>
          <DialogDescription>
            Agregá jugadores con nombre y dorsal para poder asignarles goles y tarjetas en los partidos.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto">
          <Tabs defaultValue="single" className="w-full">
            <TabsList className="grid w-full grid-cols-2 h-9 mb-4">
              <TabsTrigger value="single" className="text-xs">
                <Plus className="h-3 w-3 mr-1.5" />
                Un Jugador
              </TabsTrigger>
              <TabsTrigger value="bulk" className="text-xs">
                <FileSpreadsheet className="h-3 w-3 mr-1.5" />
                Importar Lista
              </TabsTrigger>
            </TabsList>

            {/* Single Player Tab */}
            <TabsContent value="single" className="space-y-4">
              <form onSubmit={handleAddSingle} className="flex gap-2">
                <div className="w-24">
                  <Input
                    placeholder="Dorsal"
                    value={playerNumber}
                    onChange={(e) => setPlayerNumber(e.target.value)}
                    type="number"
                    className="h-10"
                  />
                </div>
                <Input
                  placeholder="Nombre del jugador"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  className="flex-1 h-10"
                />
                <Button type="submit" disabled={isSaving || !playerName.trim()} className="shrink-0">
                  {isSaving ? 'Agregando...' : 'Agregar'}
                </Button>
              </form>

              <div className="border rounded-lg divide-y max-h-[400px] overflow-y-auto">
                {players.length === 0 ? (
                  <div className="p-8 text-center">
                    <Users className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                    <p className="text-sm text-muted-foreground">No hay jugadores inscritos.</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      Agregá jugadores individualmente o importá una lista completa.
                    </p>
                  </div>
                ) : (
                  players.map((player) => (
                    <div
                      key={player.id}
                      className="flex justify-between items-center p-3 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-9 h-9 rounded-lg flex items-center justify-center text-xs font-black border-2",
                          player.number ? "bg-primary/10 border-primary/20 text-primary" : "bg-muted border-border"
                        )}>
                          {player.number || '—'}
                        </div>
                        <span className="font-medium">{player.name}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => onRemovePlayer(player.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                )}
              </div>

              <p className="text-xs text-muted-foreground text-center">
                {players.length} jugador{players.length !== 1 ? 'es' : ''} en el plantel
              </p>
            </TabsContent>

            {/* Bulk Import Tab */}
            <TabsContent value="bulk" className="space-y-4">
              <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <Info className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />
                <div className="text-xs text-blue-200 space-y-1">
                  <p><strong>Pegá la lista de jugadores desde Excel o Word</strong></p>
                  <p>Formatos aceptados:</p>
                  <ul className="list-disc list-inside ml-2 space-y-0.5 text-blue-300/80">
                    <li><code>10 Lionel Messi</code> (dorsal + nombre)</li>
                    <li><code>Lionel Messi 10</code> (nombre + dorsal)</li>
                    <li><code>Lionel Messi</code> (solo nombre)</li>
                    <li><code>10    Lionel Messi</code> (separado por tab desde Excel)</li>
                  </ul>
                </div>
              </div>

              <div>
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                  Lista de Jugadores
                </Label>
                <Textarea
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  placeholder="10 Lionel Messi&#10;7 Cristiano Ronaldo&#10;9 Karim Benzema&#10;Luka Modric 10"
                  className="h-64 font-mono text-xs bg-background/50 border-white/10 resize-none"
                />
                <p className="text-xs text-muted-foreground mt-1.5">
                  {parsedPlayersCount > 0 ? (
                    <span className="font-bold text-primary">
                      ✓ {parsedPlayersCount} jugador{parsedPlayersCount !== 1 ? 'es' : ''} detectado{parsedPlayersCount !== 1 ? 's' : ''}
                    </span>
                  ) : (
                    'Pegá o escribí un jugador por línea'
                  )}
                </p>
              </div>

              <Button
                onClick={handleAddBulk}
                disabled={isSaving || parsedPlayersCount === 0}
                className="w-full h-10 font-bold"
              >
                {isSaving
                  ? 'Agregando...'
                  : `Agregar ${parsedPlayersCount} Jugador${parsedPlayersCount !== 1 ? 'es' : ''}`}
              </Button>
            </TabsContent>
          </Tabs>
        </div>

        <div className="border-t pt-4 flex justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
