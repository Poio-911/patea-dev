
'use client';

import React from 'react';
import { JerseyType } from './types';
import { SolidJersey } from '@/components/jerseys/SolidJersey';
import { StripesJersey } from '@/components/jerseys/StripesJersey';
import { HoopsJersey } from '@/components/jerseys/HoopsJersey';
import { HalvesJersey } from '@/components/jerseys/HalvesJersey';
import { SashJersey } from '@/components/jerseys/SashJersey';
import { CheckeredJersey } from '@/components/jerseys/CheckeredJersey';

export const POPULAR_TEAM_COLORS = [
  { name: 'Red', hex: '#DC2626' },
  { name: 'Blue', hex: '#2563EB' },
  { name: 'Green', hex: '#16A34A' },
  { name: 'Yellow', hex: '#FBBF24' },
  { name: 'White', hex: '#FFFFFF' },
  { name: 'Black', hex: '#000000' },
  { name: 'Orange', hex: '#F97316' },
  { name: 'Purple', hex: '#9333EA' },
  { name: 'Sky Blue', hex: '#38BDF8' },
  { name: 'Maroon', hex: '#8B0000' },
  { name: 'Gold', hex: '#FFD700' },
  { name: 'Navy', hex: '#000080' },
];

export const jerseyTemplates: { type: JerseyType; label: string; component: React.FC<any> }[] = [
  { type: 'plain', label: 'Liso', component: SolidJersey },
  { type: 'vertical', label: 'Rayas Verticales', component: StripesJersey },
  { type: 'hoops', label: 'Franjas Horizontales', component: HoopsJersey },
  { type: 'thirds', label: 'Mitad y Mitad', component: HalvesJersey },
  { type: 'sash', label: 'Banda Diagonal', component: SashJersey },
  { type: 'checkered', label: 'Ajedrez', component: CheckeredJersey },
];

export function getAllJerseyTemplates() {
  return jerseyTemplates;
}

export function getJerseyComponent(type: JerseyType): React.FC<any> {
    const template = jerseyTemplates.find(t => t.type === type);
    return template ? template.component : SolidJersey;
}
