'use client';

import { useEffect, useState } from 'react';
import { Jersey } from '@/lib/types';
import { getJerseyTemplate, applyColorsToSvg } from '@/lib/jersey-templates';
import { cn } from '@/lib/utils';

interface JerseyPreviewProps {
  jersey?: Jersey; // Make jersey optional
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const SIZE_CLASSES = {
  sm: 'h-12 w-12',
  md: 'h-20 w-20',
  lg: 'h-32 w-32',
  xl: 'h-48 w-48',
};

const DEFAULT_JERSEY: Jersey = {
  type: 'plain',
  primaryColor: '#cccccc',
  secondaryColor: '#aaaaaa',
};

export function JerseyPreview({ jersey = DEFAULT_JERSEY, size = 'md', className }: JerseyPreviewProps) {
  const [svgContent, setSvgContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const loadAndApplyColors = async () => {
      setLoading(true);
      setError(false);
      
      const currentJersey = jersey || DEFAULT_JERSEY;

      try {
        const template = getJerseyTemplate(currentJersey.type);

        // Fetch the SVG content
        const response = await fetch(template.svgPath);
        if (!response.ok) {
          throw new Error('Failed to load SVG');
        }

        const svgText = await response.text();

        // Apply the custom colors
        const coloredSvg = applyColorsToSvg(
          svgText,
          template,
          currentJersey.primaryColor,
          currentJersey.secondaryColor
        );

        setSvgContent(coloredSvg);
      } catch (err) {
        console.error('Error loading jersey SVG:', err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    loadAndApplyColors();
  }, [jersey]);

  if (loading) {
    return (
      <div
        className={cn(
          'flex items-center justify-center bg-muted rounded animate-pulse',
          SIZE_CLASSES[size],
          className
        )}
      >
        <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={cn(
          'flex items-center justify-center bg-muted rounded text-muted-foreground text-xs',
          SIZE_CLASSES[size],
          className
        )}
      >
        Error
      </div>
    );
  }

  return (
    <div
      className={cn(SIZE_CLASSES[size], 'flex items-center justify-center overflow-hidden', className)}
    >
      <div
        className="w-full h-full [&>svg]:w-full [&>svg]:h-full [&>svg]:object-contain"
        dangerouslySetInnerHTML={{ __html: svgContent }}
      />
    </div>
  );
}
