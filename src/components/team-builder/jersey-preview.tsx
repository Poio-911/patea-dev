'use client';

import { useEffect, useState } from 'react';
import { Jersey } from '@/lib/types';
import { getJerseyTemplate, applyColorsToSvg } from '@/lib/jersey-templates';
import { cn } from '@/lib/utils';

interface JerseyPreviewProps {
  jersey?: Jersey;
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

export function JerseyPreview({ jersey: jerseyProp, size = 'md', className }: JerseyPreviewProps) {
  const [svgContent, setSvgContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const jersey = jerseyProp || DEFAULT_JERSEY;

  useEffect(() => {
    const loadAndApplyColors = async () => {
      setLoading(true);
      setError(false);

      try {
        const template = getJerseyTemplate(jersey.type);
        if (!template) {
            throw new Error(`Template not found for type: ${jersey.type}`);
        }

        // Fetch the SVG content from the public folder
        const response = await fetch(template.svgPath);
        if (!response.ok) {
          throw new Error(`Failed to load SVG from ${template.svgPath}`);
        }

        const svgText = await response.text();

        // Apply the custom colors
        const coloredSvg = applyColorsToSvg(
          svgText,
          template,
          jersey.primaryColor,
          jersey.secondaryColor
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
          'flex items-center justify-center bg-muted rounded-lg animate-pulse',
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
          'flex items-center justify-center bg-muted rounded-lg text-muted-foreground text-xs text-center p-1',
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
        className={cn(
          "w-full h-full [&>svg]:w-full [&>svg]:h-full [&>svg]:object-contain",
          // ✅ AÑADIDO: Efecto de contorno blanco solo en dark mode
          "[&>svg]:[filter:drop-shadow(0px_0px_1px_rgba(0,0,0,0.12))]"
        )}
        dangerouslySetInnerHTML={{ __html: svgContent }}
      />
    </div>
  );
}
