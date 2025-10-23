'use client';

import { JerseyType, Jersey } from './types';

interface JerseyTemplate {
  type: JerseyType;
  label: string;
  svgPath: string; // Path to the SVG file in the public folder
  primaryColorClass: string;
  secondaryColorClass?: string;
}

export const POPULAR_TEAM_COLORS = [
  { name: 'Red', hex: '#DC2626' },
  { name: 'Blue', hex: '#2563EB' },
  { name: 'Green', hex: '#16A34A' },
  { name: 'Yellow', hex: '#FBBF24' },
  { name: 'White', hex: '#FFFFFF' },
  { name: 'Black', hex: '#111827' },
  { name: 'Orange', hex: '#F97316' },
  { name: 'Purple', hex: '#9333EA' },
  { name: 'Sky Blue', hex: '#38BDF8' },
  { name: 'Maroon', hex: '#800000' },
  { name: 'Gold', hex: '#FFD700' },
  { name: 'Navy', hex: '#000080' },
];

const jerseyTemplates: JerseyTemplate[] = [
  { type: 'plain', label: 'Liso', svgPath: '/jerseys/plain.svg', primaryColorClass: 'primary-fill' },
  { type: 'vertical', label: 'Rayas Verticales', svgPath: '/jerseys/vertical.svg', primaryColorClass: 'primary-fill', secondaryColorClass: 'secondary-fill' },
  { type: 'hoops', label: 'Franjas Horizontales', svgPath: '/jerseys/hoops.svg', primaryColorClass: 'primary-fill', secondaryColorClass: 'secondary-fill' },
  { type: 'sash', label: 'Banda Diagonal', svgPath: '/jerseys/sash.svg', primaryColorClass: 'primary-fill', secondaryColorClass: 'secondary-fill' },
  { type: 'checkered', label: 'Ajedrez', svgPath: '/jerseys/checkered.svg', primaryColorClass: 'primary-fill', secondaryColorClass: 'secondary-fill' },
  { type: 'halves', label: 'Mitad y Mitad', svgPath: '/jerseys/halves.svg', primaryColorClass: 'primary-fill', secondaryColorClass: 'secondary-fill' },
];

export function getAllJerseyTemplates() {
  return jerseyTemplates;
}

export function getJerseyTemplate(type: JerseyType): JerseyTemplate {
    return jerseyTemplates.find(t => t.type === type) || jerseyTemplates[0];
}

export function applyColorsToSvg(svgText: string, template: JerseyTemplate, primaryColor: string, secondaryColor: string): string {
    let result = svgText;
    
    // Replace placeholder classes with actual fill colors
    result = result.replace(new RegExp(`class="${template.primaryColorClass}"`, 'g'), `fill="${primaryColor}"`);

    if (template.secondaryColorClass && secondaryColor) {
        result = result.replace(new RegExp(`class="${template.secondaryColorClass}"`, 'g'), `fill="${secondaryColor}"`);
    } else if (template.secondaryColorClass) {
        // Fallback if secondary color is missing, use a contrast color
        result = result.replace(new RegExp(`class="${template.secondaryColorClass}"`, 'g'), `fill="#FFFFFF"`);
    }

    return result;
}
