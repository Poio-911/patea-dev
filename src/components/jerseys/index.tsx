
'use client';

import React from 'react';
import type { JerseyType, Jersey } from '@/lib/types';
import { SolidJersey } from './SolidJersey';
import { StripesJersey } from './StripesJersey';
import { SashJersey } from './SashJersey';
import { HalvesJersey } from './HalvesJersey';
import { HoopsJersey } from './HoopsJersey';
import { CheckeredJersey } from './CheckeredJersey';

export type JerseyProps = {
  primaryColor?: string;
  secondaryColor?: string;
  className?: string;
};

const jerseyComponents: Record<JerseyType, React.FC<JerseyProps>> = {
  plain: SolidJersey,
  vertical: StripesJersey,
  band: HoopsJersey,
  chevron: SashJersey,
  thirds: HalvesJersey,
  solid: SolidJersey,
  stripes: StripesJersey,
  sash: SashJersey,
  halves: HalvesJersey,
  hoops: HoopsJersey,
  checkered: CheckeredJersey,
};

interface JerseyIconProps extends JerseyProps {
  style?: JerseyType;
}

export function JerseyIcon({ style = 'solid', ...props }: JerseyIconProps) {
  const JerseyComponent = jerseyComponents[style] || SolidJersey;
  return <JerseyComponent {...props} />;
}
