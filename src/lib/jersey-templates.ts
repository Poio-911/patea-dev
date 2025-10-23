
import { JerseyType } from './types';

export type JerseyTemplate = {
  type: JerseyType;
  label: string;
  description: string;
  svgPath: string;
  // Mapeo de qué partes del SVG corresponden a qué color
  colorMapping: {
    primary: string[]; // Array de colores que deben reemplazarse por el color primario
    secondary: string[]; // Array de colores que deben reemplazarse por el color secundario
  };
};

export const JERSEY_TEMPLATES: Record<JerseyType, JerseyTemplate> = {
  plain: {
    type: 'plain',
    label: 'Lisa',
    description: 'Camiseta de un solo color',
    svgPath: '/jerseys/plain-pink-football-shirt-svgrepo-com.svg',
    colorMapping: {
      primary: ['#fbb'],
      secondary: [],
    },
  },
  vertical: {
    type: 'vertical',
    label: 'Franjas Verticales',
    description: 'Camiseta con franjas verticales',
    svgPath: '/jerseys/vertical-blue-yellow-football-shirt-svgrepo-com.svg',
    colorMapping: {
      primary: ['#fe0'], 
      secondary: ['#33f'],
    },
  },
  band: {
    type: 'band',
    label: 'Franja Horizontal',
    description: 'Camiseta con franja horizontal',
    svgPath: '/jerseys/band-red-white-football-shirt-svgrepo-com.svg',
    colorMapping: {
      primary: ['#d00'],
      secondary: ['#ffffff'],
    },
  },
  chevron: {
    type: 'chevron',
    label: 'Chevron (V)',
    description: 'Camiseta con diseño en V',
    svgPath: '/jerseys/chevron-blue-white-football-shirt-svgrepo-com.svg',
    colorMapping: {
      primary: ['#33f'],
      secondary: ['#ffffff'],
    },
  },
  thirds: {
    type: 'thirds',
    label: 'Tercios',
    description: 'Camiseta dividida en tercios',
    svgPath: '/jerseys/thirds-red-white-football-shirt-svgrepo-com.svg',
    colorMapping: {
      primary: ['#d00'],
      secondary: ['#ffffff'],
    },
  },
  lines: {
    type: 'lines',
    label: 'Lineas',
    description: 'Camiseta con lineas rojas',
    svgPath: '/jerseys/opcion-7.svg',
    colorMapping: {
      primary: ['#f41616'],
      secondary: ['#ffffff'],
    },
  },
};

/**
 * Obtiene el template de una camiseta por su tipo
 */
export function getJerseyTemplate(type: JerseyType): JerseyTemplate {
  return JERSEY_TEMPLATES[type];
}

/**
 * Obtiene todos los templates disponibles como array
 */
export function getAllJerseyTemplates(): JerseyTemplate[] {
  return Object.values(JERSEY_TEMPLATES);
}

/**
 * Reemplaza los colores en un SVG según el template y los colores elegidos
 */
export function applyColorsToSvg(
  svgContent: string,
  template: JerseyTemplate,
  primaryColor: string,
  secondaryColor: string
): string {
  let result = svgContent;

  const replaceColor = (content: string, oldColors: string[], newColor: string) => {
    let modifiedContent = content;
    oldColors.forEach(oldColor => {
      // Usar una expresión regular para reemplazar el color, ignorando mayúsculas/minúsculas.
      const regex = new RegExp(`(fill|stroke)="${oldColor}"`, 'gi');
      modifiedContent = modifiedContent.replace(regex, `$1="${newColor}"`);
    });
    return modifiedContent;
  };

  result = replaceColor(result, template.colorMapping.primary, primaryColor);
  result = replaceColor(result, template.colorMapping.secondary, secondaryColor);

  return result;
}


/**
 * Colores predefinidos populares para equipos de fútbol
 */
export const POPULAR_TEAM_COLORS = [
  { name: 'Rojo', hex: '#DC2626' },
  { name: 'Azul', hex: '#2563EB' },
  { name: 'Verde', hex: '#16A34A' },
  { name: 'Amarillo', hex: '#EAB308' },
  { name: 'Negro', hex: '#171717' },
  { name: 'Blanco', hex: '#FFFFFF' },
  { name: 'Naranja', hex: '#EA580C' },
  { name: 'Violeta', hex: '#7C3AED' },
  { name: 'Celeste', hex: '#0EA5E9' },
  { name: 'Rosa', hex: '#EC4899' },
  { name: 'Gris', hex: '#6B7280' },
  { name: 'Bordo', hex: '#991B1B' },
];
