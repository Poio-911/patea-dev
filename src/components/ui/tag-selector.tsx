'use client';

import { Plus, Minus, Zap, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PerformanceTag } from '@/lib/performance-tags';
import { motion, AnimatePresence } from 'framer-motion';

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
  const isPositiveImpact = tag.impact === 'positive';

  return (
    <motion.button
      type="button"
      whileHover={!disabled ? { scale: 1.02 } : {}}
      whileTap={!disabled ? { scale: 0.98 } : {}}
      onClick={() => {
        if (!disabled) onCheckedChange(!isChecked);
      }}
      className={cn(
        'relative flex w-full flex-col gap-2 rounded-xl border-2 p-4 text-left transition-all duration-300 overflow-hidden',
        isChecked
          ? isPositiveImpact
            ? 'bg-emerald-500/10 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
            : 'bg-rose-500/10 border-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.2)]'
          : 'bg-card border-border hover:border-border/80 hover:bg-accent/50',
        "game:bg-[#0b1e3b]/50 game:border-white/10",
        disabled && !isChecked && 'opacity-50 cursor-not-allowed filter grayscale'
      )}
    >
      {/* Background Glow when checked */}
      {isChecked && (
        <div className={cn(
          "absolute inset-0 opacity-20 blur-xl pointer-events-none",
          isPositiveImpact ? "bg-emerald-400" : "bg-rose-400"
        )} />
      )}

      <div className="flex items-start justify-between w-full relative z-10">
        <div>
          <p className={cn("font-bold text-base", isChecked ? (isPositiveImpact ? "text-emerald-500 dark:text-emerald-400" : "text-rose-500 dark:text-rose-400") : "text-foreground game:text-white")}>
            {tag.name}
          </p>
          <p className="text-xs text-muted-foreground game:text-slate-400 mt-0.5">{tag.description}</p>
        </div>
        <AnimatePresence>
          {isChecked && (
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} className={cn("p-1 rounded-full shrink-0", isPositiveImpact ? "bg-emerald-500/20 text-emerald-500" : "bg-rose-500/20 text-rose-500")}>
              <Zap size={14} className="fill-current" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 relative z-10 w-full pt-2 border-t border-border/50">
        {positiveEffects.map((effect) => (
          <div key={effect.attribute} className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest bg-emerald-500/10 px-1.5 py-0.5 rounded">
            + {effect.change} {effect.attribute}
          </div>
        ))}
        {negativeEffects.map((effect) => (
          <div key={effect.attribute} className="flex items-center gap-1 text-[11px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-widest bg-rose-500/10 px-1.5 py-0.5 rounded">
            {effect.change} {effect.attribute}
          </div>
        ))}
      </div>
    </motion.button>
  );
}
