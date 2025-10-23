
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
  hoops: HoopsJersey,
  sash: SashJersey,
  checkered: CheckeredJersey,
  stripes: StripesJersey,
};

interface JerseyIconProps extends JerseyProps {
  style?: JerseyType;
}

export function JerseyIcon({ style = 'plain', ...props }: JerseyIconProps) {
  const JerseyComponent = jerseyComponents[style] || SolidJersey;
  return <JerseyComponent {...props} />;
}
