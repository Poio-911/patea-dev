'use client';

import { Jersey } from '@/lib/types';
import { JerseyPreview } from '@/components/team-builder/jersey-preview';
import { cn } from '@/lib/utils';

interface JerseyWatermarkProps {
  jersey?: Jersey;
  className?: string;
  opacity?: number;
  position?: 'center' | 'bottom-right' | 'top-left';
}

const POSITION_CLASSES = {
  center: 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
  'bottom-right': 'bottom-0 right-0 translate-x-1/4 translate-y-1/4',
  'top-left': 'top-0 left-0 -translate-x-1/4 -translate-y-1/4',
};

export function JerseyWatermark({
  jersey,
  className,
  opacity = 0.08,
  position = 'bottom-right',
}: JerseyWatermarkProps) {
  if (!jersey) return null;

  return (
    <div
      className={cn(
        'absolute z-0 pointer-events-none',
        POSITION_CLASSES[position],
        className
      )}
      style={{
        opacity,
        filter: 'blur(1px)',
        transform: `${POSITION_CLASSES[position].includes('translate') ? '' : 'translate(-50%, -50%) '}rotate(-15deg) scale(2.5)`,
      }}
    >
      <JerseyPreview jersey={jersey} size="xl" />
    </div>
  );
}

export function JerseySilhouette({ className }: { className?: string }) {
  return (
    <svg
      className={cn('absolute z-0 pointer-events-none', className)}
      viewBox="0 0 24 24"
      fill="none"
      style={{ opacity: 0.05 }}
    >
      <path
        d="M16 2l3 3v4l-2 1v12H7V10l-2-1V5l3-3h8z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="0.5"
      />
    </svg>
  );
}
