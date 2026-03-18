'use client';

import * as React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { JerseyPreview } from '@/components/team-builder/jersey-preview';
import { getAllJerseyTemplates, POPULAR_TEAM_COLORS } from '@/lib/jersey-templates';
import { cn } from '@/lib/utils';
import { Check, Palette, Users, Plus, AlertCircle } from 'lucide-react';
import type { Jersey, JerseyType } from '@/lib/types';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface AddTeamDialogImprovedProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (teamName: string, jersey: Jersey) => void;
  onBulkSave?: (teams: Array<{ name: string; jersey: Jersey }>) => void;
  initialName?: string;
  initialJersey?: Jersey;
  title?: string;
  description?: string;
  saveButtonText?: string;
}

export function AddTeamDialogImproved({
  open,
  onOpenChange,
  onSave,
  onBulkSave,
  initialName = '',
  initialJersey,
  title = 'Agregar Equipo',
  description = 'Creá un nuevo equipo para la competición.',
  saveButtonText = 'Agregar Equipo',
}: AddTeamDialogImprovedProps) {
  const [teamName, setTeamName] = React.useState(initialName);
  const [teamJersey, setTeamJersey] = React.useState<Jersey>(
    initialJersey || {
      primaryColor: '#FF0000',
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
          primaryColor: '#FF0000',
          secondaryColor: '#FFFFFF',
          type: 'solid',
        }
      );
      setBulkNames('');
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

    // Parsear nombres separados por líneas
    const names = bulkNames
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    if (names.length === 0) return;

    // Crear array de equipos con colores random
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

  const parsedTeamsCount = bulkNames
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="single" className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="single" className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Un Equipo
            </TabsTrigger>
            {onBulkSave && (
              <TabsTrigger value="bulk" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Múltiples Equipos
              </TabsTrigger>
            )}
          </TabsList>

          {/* Single Team Tab */}
          <TabsContent value="single" className="flex-1 overflow-auto mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column - Jersey Designer */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="teamName" className="text-base font-semibold">
                    Nombre del Equipo
                  </Label>
                  <Input
                    id="teamName"
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    placeholder="Ej: River Plate"
                    maxLength={30}
                    className="text-base"
                  />
                </div>

                {/* Jersey Preview */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Palette className="h-4 w-4" />
                    Vista Previa
                  </Label>
                  <Card className="p-6 bg-muted/30 flex justify-center">
                    <JerseyPreview jersey={teamJersey} size="lg" />
                  </Card>
                </div>
              </div>

              {/* Right Column - Customization */}
              <div className="space-y-4">
                {/* Jersey Type Selection */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Diseño de Camiseta</Label>
                  <div className="grid grid-cols-5 gap-2">
                    {templates.map((template) => {
                      const isSelected = teamJersey.type === template.type;
                      return (
                        <div
                          key={template.type}
                          onClick={() => handleTypeChange(template.type)}
                          className={cn(
                            'relative flex aspect-square items-center justify-center rounded-lg border-2 cursor-pointer transition-all hover:border-primary/50 hover:scale-105',
                            isSelected ? 'border-primary ring-2 ring-primary/50' : 'border-border'
                          )}
                        >
                          {isSelected && (
                            <div className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                              <Check className="h-3 w-3" />
                            </div>
                          )}
                          <JerseyPreview
                            jersey={{ type: template.type, primaryColor: '#9CA3AF', secondaryColor: '#E5E7EB' }}
                            size="sm"
                            className="p-1"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Color Selection */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Colores</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant={activeColorSelection === 'primary' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setActiveColorSelection('primary')}
                      className="h-9"
                    >
                      Primario
                    </Button>
                    <Button
                      type="button"
                      variant={activeColorSelection === 'secondary' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setActiveColorSelection('secondary')}
                      className="h-9"
                    >
                      Secundario
                    </Button>
                  </div>

                  {/* Color Palette */}
                  <div className="grid grid-cols-8 gap-2">
                    {POPULAR_TEAM_COLORS.slice(0, 16).map((color) => (
                      <button
                        key={color.hex}
                        type="button"
                        onClick={() => handleColorChange(color.hex)}
                        className={cn(
                          'h-8 w-8 rounded-full border-2 transition-all hover:scale-110',
                          activeColorValue.toUpperCase() === color.hex.toUpperCase()
                            ? 'border-primary ring-2 ring-primary/50'
                            : 'border-border'
                        )}
                        style={{ backgroundColor: color.hex }}
                        title={color.name}
                      />
                    ))}
                  </div>

                  {/* Custom Color Picker */}
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      id="custom-color"
                      type="color"
                      value={activeColorValue}
                      onChange={(e) => handleColorChange(e.target.value)}
                      className="h-8 w-12 rounded border cursor-pointer"
                    />
                    <Label htmlFor="custom-color" className="text-xs text-muted-foreground font-mono">
                      {activeColorValue.toUpperCase()}
                    </Label>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="mt-6">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={!teamName.trim()}>
                {saveButtonText}
              </Button>
            </DialogFooter>
          </TabsContent>

          {/* Bulk Teams Tab */}
          {onBulkSave && (
            <TabsContent value="bulk" className="flex-1 overflow-auto mt-4">
              <div className="space-y-4">
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Agregá múltiples equipos a la vez.</strong> Pegá los nombres de los equipos, uno por línea.
                    Los colores y diseños se asignarán automáticamente.
                  </AlertDescription>
                </Alert>

                <div className="space-y-2">
                  <Label htmlFor="bulkNames" className="text-base font-semibold">
                    Nombres de Equipos
                  </Label>
                  <Textarea
                    id="bulkNames"
                    value={bulkNames}
                    onChange={(e) => setBulkNames(e.target.value)}
                    placeholder="River Plate&#10;Boca Juniors&#10;Racing Club&#10;Independiente&#10;San Lorenzo"
                    className="min-h-[300px] font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    {parsedTeamsCount > 0 ? (
                      <span className="font-medium text-primary">
                        {parsedTeamsCount} equipo{parsedTeamsCount !== 1 ? 's' : ''} detectado{parsedTeamsCount !== 1 ? 's' : ''}
                      </span>
                    ) : (
                      'Escribí o pegá un nombre de equipo por línea'
                    )}
                  </p>
                </div>

                {parsedTeamsCount > 0 && (
                  <Card className="p-4 bg-muted/50">
                    <p className="text-sm text-muted-foreground">
                      <strong>Vista previa:</strong> Se crearán {parsedTeamsCount} equipos con colores y diseños aleatorios.
                      Podés editarlos individualmente después de crearlos.
                    </p>
                  </Card>
                )}
              </div>

              <DialogFooter className="mt-6">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleBulkSave} disabled={parsedTeamsCount === 0}>
                  Crear {parsedTeamsCount} Equipo{parsedTeamsCount !== 1 ? 's' : ''}
                </Button>
              </DialogFooter>
            </TabsContent>
          )}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
