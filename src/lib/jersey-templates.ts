
import { JerseyStyle } from "./types";

export interface JerseyTemplate {
    type: JerseyStyle;
    label: string;
    description: string;
    svgPath: string; // Path relative to /public
    primaryColorTarget: string; // Selector for the primary color path/shape in the SVG
    secondaryColorTarget?: string; // Selector for the secondary color path/shape
}

const templates: JerseyTemplate[] = [
    {
        type: 'solid',
        label: 'Liso',
        description: 'Un color sólido clásico.',
        svgPath: '/jerseys/solid.svg',
        primaryColorTarget: '#primary'
    },
    {
        type: 'stripes',
        label: 'Rayas Verticales',
        description: 'Rayas verticales tradicionales.',
        svgPath: '/jerseys/stripes.svg',
        primaryColorTarget: '#primary',
        secondaryColorTarget: '#secondary'
    },
    {
        type: 'sash',
        label: 'Banda Cruzada',
        description: 'Una banda diagonal elegante.',
        svgPath: '/jerseys/sash.svg',
        primaryColorTarget: '#primary',
        secondaryColorTarget: '#secondary'
    },
    {
        type: 'halves',
        label: 'Mitad y Mitad',
        description: 'Dos mitades, doble identidad.',
        svgPath: '/jerseys/halves.svg',
        primaryColorTarget: '#primary',
        secondaryColorTarget: '#secondary'
    },
    {
        type: 'hoops',
        label: 'Rayas Horizontales',
        description: 'Rayas horizontales anchas.',
        svgPath: '/jerseys/hoops.svg',
        primaryColorTarget: '#primary',
        secondaryColorTarget: '#secondary'
    },
    {
        type: 'checkered',
        label: 'Ajedrez',
        description: 'Un patrón a cuadros audaz.',
        svgPath: '/jerseys/checkered.svg',
        primaryColorTarget: '#primary',
        secondaryColorTarget: '#secondary'
    },
];

export const getAllJerseyTemplates = (): JerseyTemplate[] => {
    return templates;
}

export const getJerseyTemplate = (type: JerseyStyle): JerseyTemplate => {
    return templates.find(t => t.type === type) || templates[0];
}

export const applyColorsToSvg = (
    svgText: string,
    template: JerseyTemplate,
    primaryColor: string,
    secondaryColor: string
): string => {
    let coloredSvg = svgText.replace(
        new RegExp(`fill="${template.primaryColorTarget}"`, 'g'),
        `fill="${primaryColor}"`
    );
    if (template.secondaryColorTarget && secondaryColor) {
        coloredSvg = coloredSvg.replace(
            new RegExp(`fill="${template.secondaryColorTarget}"`, 'g'),
            `fill="${secondaryColor}"`
        );
    }
    return coloredSvg;
}


export const POPULAR_TEAM_COLORS: { name: string, hex: string }[] = [
    { name: "Rojo", hex: "#d32f2f" },
    { name: "Azul", hex: "#1976d2" },
    { name: "Blanco", hex: "#FFFFFF" },
    { name: "Negro", hex: "#212121" },
    { name: "Amarillo", hex: "#FBC02D" },
    { name: "Verde", hex: "#388E3C" },
    { name: "Celeste", hex: "#03A9F4" },
    { name: "Naranja", hex: "#F57C00" },
    { name: "Violeta", hex: "#7B1FA2" },
    { name: "Gris", hex: "#616161" },
    { name: "Bordó", hex: "#880E4F" },
    { name: "Rosado", hex: "#E91E63" },
];
