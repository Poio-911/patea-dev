import React from 'react';
import type { JerseyStyle } from '@/lib/types';
import { SolidJersey } from './SolidJersey';
import { StripesJersey } from './StripesJersey';
import { SashJersey } from './SashJersey';
import { HalvesJersey } from './HalvesJersey';

export type JerseyProps = {
  primaryColor: string;
  secondaryColor: string;
  className?: string;
  number?: number;
};

const jerseyComponents: Record<JerseyStyle, React.FC<JerseyProps>> = {
  solid: SolidJersey,
  stripes: StripesJersey,
  sash: SashJersey,
  halves: HalvesJersey,
};

interface JerseyIconProps extends JerseyProps {
  style: JerseyStyle;
}

export function JerseyIcon({ style, ...props }: JerseyIconProps) {
  const JerseyComponent = jerseyComponents[style] || SolidJersey;
  return <JerseyComponent {...props} />;
}
