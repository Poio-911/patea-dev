
'use client';

import React from 'react';
import type { Jersey } from '@/lib/types';
import { cn } from '@/lib/utils';
import { getJerseyComponent } from '@/lib/jersey-templates';
import { SolidJersey } from '../jerseys/SolidJersey';

interface JerseyPreviewProps {
  jersey?: Jersey;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const DEFAULT_JERSEY: Jersey = {
  type: 'plain',
  primaryColor: '#cccccc',
  secondaryColor: '#aaaaaa',
};

const SIZE_CLASSES = {
  sm: 'h-12 w-12',
  md: 'h-20 w-20',
  lg: 'h-32 w-32',
  xl: 'h-48 w-48',
};

export function JerseyPreview({ jersey: jerseyProp, size = 'md', className }: JerseyPreviewProps) {
  const jersey = jerseyProp || DEFAULT_JERSEY;

  const JerseyComponent = getJerseyComponent(jersey.type) || SolidJersey;

  return (
    <div
      className={cn(
        'flex items-center justify-center overflow-hidden',
        SIZE_CLASSES[size],
        className
      )}
    >
      <JerseyComponent
        primaryColor={jersey.primaryColor}
        secondaryColor={jersey.secondaryColor}
        className="h-full w-full object-contain"
      />
    </div>
  );
}
