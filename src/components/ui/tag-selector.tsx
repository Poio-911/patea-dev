'use client';

import { Plus, Minus } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import type { PerformanceTag } from '@/lib/performance-tags';

interface TagSelectorProps {
  tags: PerformanceTag[];
  selectedTagIds: string[];
  onSelectionChange: (tagIds: string[]) => void;
  minTags?: number;
  maxTags?: number;
}

export function TagSelector({
  tags,
  selectedTagIds,
  onSelectionChange,
  minTags = 0,
  maxTags = Infinity,
}: TagSelectorProps) {
  const handleToggle = (tagId: string, checked: boolean) => {
    if (checked) {
      if (selectedTagIds.length < maxTags) {
        onSelectionChange([...selectedTagIds, tagId]);
      }
    } else {
      onSelectionChange(selectedTagIds.filter((id) => id !== tagId));
    }
  };

  const positiveTags = tags.filter((t) => t.impact === 'positive');
  const negativeTags = tags.filter((t) => t.impact === 'negative');

  return (
    <div className="space-y-4">
      {positiveTags.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-green-700">Positivas</p>
          <div className="space-y-2">
            {positiveTags.map((tag) => (
              <TagCheckboxItem
                key={tag.id}
                tag={tag}
                isChecked={selectedTagIds.includes(tag.id)}
                onCheckedChange={(checked) => handleToggle(tag.id, checked)}
                disabled={!selectedTagIds.includes(tag.id) && selectedTagIds.length >= maxTags}
              />
            ))}
          </div>
        </div>
      )}

      {negativeTags.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-red-700">Negativas</p>
          <div className="space-y-2">
            {negativeTags.map((tag) => (
              <TagCheckboxItem
                key={tag.id}
                tag={tag}
                isChecked={selectedTagIds.includes(tag.id)}
                onCheckedChange={(checked) => handleToggle(tag.id, checked)}
                disabled={!selectedTagIds.includes(tag.id) && selectedTagIds.length >= maxTags}
              />
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {selectedTagIds.length} seleccionadas
        {minTags > 0 && ` (mínimo ${minTags})`}
        {maxTags < Infinity && ` (máximo ${maxTags})`}
      </p>
    </div>
  );
}

function TagCheckboxItem({
  tag,
  isChecked,
  onCheckedChange,
  disabled,
}: {
  tag: PerformanceTag;
  isChecked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  const positiveEffects = tag.effects.filter((e) => e.change > 0);
  const negativeEffects = tag.effects.filter((e) => e.change < 0);
  const uniqueId = `tag-selector-${tag.id}`;

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-lg border p-3 transition-colors',
        isChecked ? 'bg-primary/10 border-primary' : 'hover:bg-accent/50',
        disabled && !isChecked && 'opacity-50 cursor-not-allowed'
      )}
    >
      <Checkbox
        checked={isChecked}
        onCheckedChange={(checked) => onCheckedChange(checked === true)}
        id={uniqueId}
        className="mt-1"
        disabled={disabled}
      />
      <label
        htmlFor={uniqueId}
        className={cn('w-full space-y-2', disabled && !isChecked ? 'cursor-not-allowed' : 'cursor-pointer')}
      >
        <div>
          <p className="font-semibold">{tag.name}</p>
          <p className="text-xs text-muted-foreground">{tag.description}</p>
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {positiveEffects.map((effect) => (
            <div key={effect.attribute} className="flex items-center gap-1 text-xs font-medium text-green-600">
              <Plus size={12} /> {effect.attribute.toUpperCase()}: +{effect.change}
            </div>
          ))}
          {negativeEffects.map((effect) => (
            <div key={effect.attribute} className="flex items-center gap-1 text-xs font-medium text-red-600">
              <Minus size={12} /> {effect.attribute.toUpperCase()}: {effect.change}
            </div>
          ))}
        </div>
      </label>
    </div>
  );
}
