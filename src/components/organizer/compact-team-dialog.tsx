'use client';

import * as React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { JerseyPreview } from '@/components/team-builder/jersey-preview';
import { getAllJerseyTemplates, POPULAR_TEAM_COLORS } from '@/lib/jersey-templates';
import { cn } from '@/lib/utils';
import { Check, Users, Plus, Info } from 'lucide-react';
import type { Jersey, JerseyType } from '@/lib/types';

interface CompactTeamDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (teamName: string, jersey: Jersey) => void;
  onBulkSave?: (teams: Array<{ name: string; jersey: Jersey }>) => void;
  initialName?: string;
  initialJersey?: Jersey;
  title?: string;
  saveButtonText?: string;
}

export function CompactTeamDialog({
  open,
  onOpenChange,
  onSave,
  onBulkSave,
  initialName = '',
  initialJersey,
  title = 'Agregar Equipo',
  saveButtonText = 'Confirmar',
}: CompactTeamDialogProps) {
  const [teamName, setTeamName] = React.useState(initialName);
  const [teamJersey, setTeamJersey] = React.useState<Jersey>(
    initialJersey || {
      primaryColor: '#DC2626',
      secondaryColor: '#FFFFFF',
      type: 'solid',
    }
  );
  const [bulkNames, setBulkNames] = React.useState('');
  const [activeColorSelection, setActiveColorSelection] = React.useState<'primary' | 'secondary'>('primary');

  const templates = getAllJerseyTemplates();

  React.useEffect(() => {
    if (open) {
      setTeamName(initialName);
      setTeamJersey(
        initialJersey || {
          primaryColor: '#DC2626',
          secondaryColor: '#FFFFFF',
          type: 'solid',
        }
      );
      setBulkNames('');
      setActiveColorSelection('primary');
    }
  }, [open, initialName, initialJersey]);

  const handleTypeChange = (type: JerseyType) => {
    setTeamJersey({ ...teamJersey, type });
  };

  const handleColorChange = (color: string) => {
    if (activeColorSelection === 'primary') {
      setTeamJersey({ ...teamJersey, primaryColor: color });
    } else {
      setTeamJersey({ ...teamJersey, secondaryColor: color });
    }
  };

  const handleSave = () => {
    if (!teamName.trim()) return;
    onSave(teamName.trim(), teamJersey);
    onOpenChange(false);
  };

  const handleBulkSave = () => {
    if (!bulkNames.trim() || !onBulkSave) return;

    const names = bulkNames
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    if (names.length === 0) return;

    const teams = names.map((name, index) => {
      const colorIndex = index % POPULAR_TEAM_COLORS.length;
      const secondaryColorIndex = (index + 8) % POPULAR_TEAM_COLORS.length;

      return {
        name,
        jersey: {
          primaryColor: POPULAR_TEAM_COLORS[colorIndex].hex,
          secondaryColor: POPULAR_TEAM_COLORS[secondaryColorIndex].hex,
          type: templates[index % templates.length].type,
        } as Jersey,
      };
    });

    onBulkSave(teams);
    onOpenChange(false);
  };

  const activeColorValue = activeColorSelection === 'primary' ? teamJersey.primaryColor : teamJersey.secondaryColor;
  const parsedTeamsCount = bulkNames.split('\n').filter(line => line.trim().length > 0).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 space-y-1">
          <DialogTitle className="text-xl font-black uppercase tracking-tight flex items-center gap-2">
            🛡️ {title}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Ponele nombre y diseñá la camiseta del equipo. Sin usuarios necesarios.
          </p>
        </DialogHeader>

        <Tabs defaultValue="single" className="flex-1">
          <div className="px-6">
            <TabsList className="grid w-full grid-cols-2 h-9">
              <TabsTrigger value="single" className="text-xs">
                <Plus className="h-3 w-3 mr-1.5" />
                Un Equipo
              </TabsTrigger>
              {onBulkSave && (
                <TabsTrigger value="bulk" className="text-xs">
                  <Users className="h-3 w-3 mr-1.5" />
                  Múltiples Equipos
                </TabsTrigger>
              )}
            </TabsList>
          </div>

          {/* Single Team Tab */}
          <TabsContent value="single" className="mt-0 p-6 pt-4 space-y-4">
            {/* Nombre Input */}
            <div>
              <Label htmlFor="teamName" className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                Nombre del Club
              </Label>
              <Input
                id="teamName"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="Ej: River Plate FC"
                maxLength={30}
                className="h-10 bg-background/50 border-white/10"
              />
            </div>

            {/* Compact 3-Column Layout */}
            <div className="grid grid-cols-[180px_1fr_1fr] gap-4">
              {/* Column 1: Preview */}
              <div>
                <Label className="text-xs font-medium mb-2 block text-muted-foreground">Vista Previa</Label>
                <Card className="p-4 bg-muted/20 border-white/5 flex items-center justify-center aspect-square">
                  <div className="scale-110">
                    <JerseyPreview jersey={teamJersey} size="lg" />
                  </div>
                </Card>
                <p className="text-center font-black mt-2 text-xs uppercase tracking-widest">
                  {teamName || 'TU EQUIPO'}
                </p>
              </div>

              {/* Column 2: Diseños */}
              <div>
                <Label className="text-xs font-medium mb-2 block flex items-center gap-1 text-muted-foreground">
                  👕 Diseño
                </Label>
                <div className="grid grid-cols-3 gap-2">
                  {templates.map((template) => {
                    const isSelected = teamJersey.type === template.type;
                    return (
                      <button
                        key={template.type}
                        type="button"
                        onClick={() => handleTypeChange(template.type)}
                        className={cn(
                          'relative aspect-square flex items-center justify-center rounded-lg border-2 transition-all hover:border-primary/50',
                          isSelected ? 'border-primary bg-primary/10' : 'border-white/10'
                        )}
                      >
                        {isSelected && (
                          <div className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-black">
                            <Check className="h-2.5 w-2.5" />
                          </div>
                        )}
                        <JerseyPreview
                          jersey={{ type: template.type, primaryColor: '#6B7280', secondaryColor: '#D1D5DB' }}
                          size="sm"
                        />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Column 3: Colores */}
              <div>
                <Label className="text-xs font-medium mb-2 block text-muted-foreground">Colores</Label>

                {/* Toggles */}
                <div className="grid grid-cols-2 gap-1.5 mb-3">
                  <Button
                    type="button"
                    variant={activeColorSelection === 'primary' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setActiveColorSelection('primary')}
                    className="h-7 text-xs"
                  >
                    Color Primario
                  </Button>
                  <Button
                    type="button"
                    variant={activeColorSelection === 'secondary' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setActiveColorSelection('secondary')}
                    className="h-7 text-xs"
                  >
                    Color Secundario
                  </Button>
                </div>

                {/* Color Grid - 4x3 = 12 colors */}
                <div className="grid grid-cols-4 gap-1.5 mb-2">
                  {POPULAR_TEAM_COLORS.slice(0, 12).map((color) => (
                    <button
                      key={color.hex}
                      type="button"
                      onClick={() => handleColorChange(color.hex)}
                      className={cn(
                        'h-8 w-full rounded-md border-2 transition-all hover:scale-105',
                        activeColorValue.toUpperCase() === color.hex.toUpperCase()
                          ? 'border-primary ring-2 ring-primary/50'
                          : 'border-white/10'
                      )}
                      style={{ backgroundColor: color.hex }}
                      title={color.name}
                    />
                  ))}
                </div>

                {/* Custom Picker */}
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="color"
                    value={activeColorValue}
                    onChange={(e) => handleColorChange(e.target.value)}
                    className="h-7 w-10 rounded border cursor-pointer bg-background"
                  />
                  <span className="text-[10px] font-mono text-muted-foreground">
                    {activeColorValue.toUpperCase()}
                  </span>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Bulk Tab */}
          {onBulkSave && (
            <TabsContent value="bulk" className="mt-0 p-6 pt-4">
              <div className="space-y-3">
                <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                  <Info className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />
                  <div className="text-xs text-blue-200">
                    <strong>Agregá múltiples equipos.</strong> Pegá nombres desde Excel/Word, uno por línea. Los colores se asignan automáticamente.
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                    Nombres de Equipos
                  </Label>
                  <Textarea
                    value={bulkNames}
                    onChange={(e) => setBulkNames(e.target.value)}
                    placeholder="River Plate&#10;Boca Juniors&#10;Racing Club&#10;Independiente"
                    className="h-48 font-mono text-xs bg-background/50 border-white/10"
                  />
                  <p className="text-xs text-muted-foreground mt-1.5">
                    {parsedTeamsCount > 0 ? (
                      <span className="font-bold text-primary">
                        ✓ {parsedTeamsCount} equipo{parsedTeamsCount !== 1 ? 's' : ''} detectado{parsedTeamsCount !== 1 ? 's' : ''}
                      </span>
                    ) : (
                      'Escribí o pegá un nombre de equipo por línea'
                    )}
                  </p>
                </div>
              </div>
            </TabsContent>
          )}
        </Tabs>

        <DialogFooter className="px-6 py-4 border-t border-white/5 flex items-center justify-between bg-muted/20">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="text-muted-foreground hover:text-foreground"
          >
            ← Cancelar
          </Button>
          <Button
            onClick={parsedTeamsCount > 0 && bulkNames.trim() ? handleBulkSave : handleSave}
            disabled={parsedTeamsCount > 0 ? false : !teamName.trim()}
            className="bg-primary hover:bg-primary/90 text-black font-bold min-w-[140px]"
          >
            {parsedTeamsCount > 0
              ? `Crear ${parsedTeamsCount} Equipo${parsedTeamsCount !== 1 ? 's' : ''} →`
              : `${saveButtonText} →`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
