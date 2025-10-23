
'use client';

import { useState } from 'react';
import { Jersey, JerseyType } from '@/lib/types';
import { getAllJerseyTemplates, POPULAR_TEAM_COLORS } from '@/lib/jersey-templates';
import { JerseyPreview } from './jersey-preview';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { ShirtIcon, Check } from 'lucide-react';
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
    <div className="space-y-6">
        {/* Vista Previa */}
        <div className="space-y-2">
            <Label className="text-sm font-medium">Vista Previa</Label>
            <Card className="p-4 bg-muted/30">
                <div className="flex flex-col items-center justify-center gap-2">
                    <div className="relative bg-background/50 rounded-lg w-full max-w-[150px]">
                        <JerseyPreview jersey={value} size="lg" className="mx-auto" />
                    </div>
                </div>
            </Card>
        </div>

        {/* Selección del tipo de camiseta */}
        <div className="space-y-3">
            <Label className="flex items-center gap-2 text-sm font-medium">
                <ShirtIcon className="h-4 w-4" />
                Diseño
            </Label>
             <div className="grid grid-cols-5 gap-2">
              {templates.map(template => {
                const isSelected = value.type === template.type;
                return (
                    <div
                        key={template.type}
                        onClick={() => handleTypeChange(template.type)}
                        className={cn(
                            'relative flex aspect-square items-center justify-center rounded-lg border-2 cursor-pointer transition-all hover:border-primary/50',
                            isSelected ? 'border-primary ring-2 ring-primary/50' : 'border-border'
                        )}
                    >
                         {isSelected && (
                            <div className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                                <Check className="h-3 w-3" />
                            </div>
                         )}
                        <JerseyPreview 
                            jersey={{ type: template.type, primaryColor: '#9CA3AF', secondaryColor: '#E5E7EB' }} 
                            size="md"
                            className="p-1"
                        />
                    </div>
                )
              })}
            </div>
        </div>

        {/* Selección de color */}
        <div className="space-y-3">
            <Label className="text-sm font-medium">Colores</Label>
            <div className="grid grid-cols-2 gap-2">
                <Button
                    type="button"
                    variant={activeColorSelection === 'primary' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setActiveColorSelection('primary')}
                >
                    Color Primario
                </Button>
                <Button
                    type="button"
                    variant={activeColorSelection === 'secondary' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setActiveColorSelection('secondary')}
                >
                    Color Secundario
                </Button>
            </div>
            <div className="grid grid-cols-8 gap-2 pt-2">
              {POPULAR_TEAM_COLORS.slice(0, 16).map(color => (
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
             <div className="flex items-center gap-2 pt-2">
              <input
                id="custom-color-input"
                type="color"
                value={activeColorValue}
                onChange={e => handleColorChange(e.target.value)}
                className="h-8 w-12 rounded border cursor-pointer bg-transparent"
              />
              <Label htmlFor="custom-color-input" className="text-xs text-muted-foreground font-mono">
                {activeColorValue.toUpperCase()}
              </Label>
            </div>
        </div>
    </div>
  );
}
