
'use client';

import { useState } from 'react';
import { Jersey, JerseyType } from '@/lib/types';
import { getAllJerseyTemplates, POPULAR_TEAM_COLORS } from '@/lib/jersey-templates';
import { JerseyPreview } from './jersey-preview';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { ShirtIcon } from '../icons/shirt-icon';
import { Button } from '@/components/ui/button';

interface JerseyDesignerProps {
  value: Jersey;
  onChange: (jersey: Jersey) => void;
}

export function JerseyDesigner({ value, onChange }: JerseyDesignerProps) {
  const templates = getAllJerseyTemplates();
  const [activeColorSelection, setActiveColorSelection] = useState<'primary' | 'secondary'>('primary');

  const handleTypeChange = (type: JerseyType) => {
    onChange({ ...value, type });
  };

  const handleColorChange = (color: string) => {
    if (activeColorSelection === 'primary') {
      onChange({ ...value, primaryColor: color });
    } else {
      onChange({ ...value, secondaryColor: color });
    }
  };
  
  const activeColorValue = activeColorSelection === 'primary' ? value.primaryColor : value.secondaryColor;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Columna izquierda: Controles */}
      <div className="space-y-6 order-2 md:order-1">
        {/* Selección del tipo de camiseta */}
        <div className="space-y-3">
          <Label className="flex items-center gap-2">
            <ShirtIcon className="h-4 w-4" />
            Diseño de la Camiseta
          </Label>
           <RadioGroup value={value.type} onValueChange={handleTypeChange}>
            <div className="grid grid-cols-3 gap-2">
              {templates.map(template => (
                <label
                  key={template.type}
                  className={cn(
                    'relative flex aspect-square items-center justify-center rounded-lg border-2 cursor-pointer transition-all hover:border-primary/50',
                    value.type === template.type ? 'border-primary bg-primary/5' : 'border-border'
                  )}
                >
                  <RadioGroupItem
                    value={template.type}
                    className="sr-only"
                  />
                  <JerseyPreview 
                    jersey={{ type: template.type, primaryColor: '#9CA3AF', secondaryColor: '#E5E7EB' }} 
                    size="md"
                    className="p-1"
                  />
                </label>
              ))}
            </div>
          </RadioGroup>
        </div>

        {/* Selección de color */}
        <div className="space-y-3">
            <Label>Colores del Equipo</Label>
            <div className="grid grid-cols-2 gap-2">
                <Button
                    type="button"
                    variant={activeColorSelection === 'primary' ? 'default' : 'outline'}
                    onClick={() => setActiveColorSelection('primary')}
                >
                    Color 1 (Primario)
                </Button>
                <Button
                    type="button"
                    variant={activeColorSelection === 'secondary' ? 'default' : 'outline'}
                    onClick={() => setActiveColorSelection('secondary')}
                >
                    Color 2 (Secundario)
                </Button>
            </div>
            <div className="grid grid-cols-6 gap-2 pt-2">
              {POPULAR_TEAM_COLORS.slice(0, 12).map(color => (
                <button
                  key={color.hex}
                  type="button"
                  onClick={() => handleColorChange(color.hex)}
                  className={cn(
                    'h-10 w-full rounded-full border-2 transition-all hover:scale-110',
                    activeColorValue.toUpperCase() === color.hex.toUpperCase()
                      ? 'border-primary ring-2 ring-primary/50'
                      : 'border-border'
                  )}
                  style={{ backgroundColor: color.hex }}
                  title={color.name}
                />
              ))}
            </div>
             <div className="flex items-center gap-2 pt-2">
              <Label htmlFor="custom-color-input" className="text-xs">Personalizado:</Label>
              <input
                id="custom-color-input"
                type="color"
                value={activeColorValue}
                onChange={e => handleColorChange(e.target.value)}
                className="h-10 w-20 rounded border cursor-pointer bg-transparent"
              />
              <span className="text-xs text-muted-foreground font-mono">
                {activeColorValue.toUpperCase()}
              </span>
            </div>
        </div>
      </div>

      {/* Columna derecha: Vista previa */}
      <div className="order-1 md:order-2">
        <div className="md:sticky md:top-4">
          <Card className="p-6 bg-muted/30">
            <div className="flex flex-col items-center justify-center gap-4">
              <Label className="text-base">Vista Previa</Label>
              <div className="relative bg-background rounded-lg p-6 w-full max-w-[200px]">
                <JerseyPreview jersey={value} size="lg" className="mx-auto" />
              </div>
              <div className="text-center space-y-1">
                <p className="text-sm font-medium">{templates.find(t => t.type === value.type)?.label}</p>
                <div className="flex gap-2 items-center justify-center">
                  <div className="flex items-center gap-1">
                    <div className="h-4 w-4 rounded border" style={{ backgroundColor: value.primaryColor }} />
                    <span className="text-xs text-muted-foreground">Primario</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="h-4 w-4 rounded border" style={{ backgroundColor: value.secondaryColor }} />
                    <span className="text-xs text-muted-foreground">Secundario</span>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
