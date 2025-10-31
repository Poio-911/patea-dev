
export type FormationSlot = {
  name: string; // e.g., 'POR', 'DFC', 'MC', 'DEL'
  x: number; // percentage from left (0-100)
  y: number; // percentage from top (0-100)
};

export type Formation = {
  name: string;
  slots: FormationSlot[];
};

export const formationsByMatchSize: Record<number, Record<string, Formation>> = {
  // F5 (10 players total)
  10: {
    '1-2-1': {
      name: '1-2-1',
      slots: [
        { name: 'POR', x: 50, y: 90 },
        { name: 'DEF', x: 50, y: 70 },
        { name: 'MED_I', x: 30, y: 50 },
        { name: 'MED_D', x: 70, y: 50 },
        { name: 'DEL', x: 50, y: 30 },
      ],
    },
    '2-1-1': {
        name: '2-1-1',
        slots: [
            { name: 'POR', x: 50, y: 90 },
            { name: 'DEF_I', x: 30, y: 70 },
            { name: 'DEF_D', x: 70, y: 70 },
            { name: 'MED', x: 50, y: 50 },
            { name: 'DEL', x: 50, y: 30 },
        ],
    },
  },
  // F7 (14 players total)
  14: {
    '2-3-1': {
      name: '2-3-1',
      slots: [
        { name: 'POR', x: 50, y: 90 },
        { name: 'DFC_I', x: 35, y: 75 },
        { name: 'DFC_D', x: 65, y: 75 },
        { name: 'MC_I', x: 25, y: 50 },
        { name: 'MC', x: 50, y: 45 },
        { name: 'MC_D', x: 75, y: 50 },
        { name: 'DEL', x: 50, y: 25 },
      ],
    },
    '3-2-1': {
        name: '3-2-1',
        slots: [
            { name: 'POR', x: 50, y: 90 },
            { name: 'DFC_I', x: 25, y: 75 },
            { name: 'DFC', x: 50, y: 78 },
            { name: 'DFC_D', x: 75, y: 75 },
            { name: 'MC_I', x: 35, y: 50 },
            { name: 'MC_D', x: 65, y: 50 },
            { name: 'DEL', x: 50, y: 25 },
        ],
    },
  },
  // F11 (22 players total)
  22: {
    '4-4-2': {
      name: '4-4-2',
      slots: [
        { name: 'POR', x: 50, y: 92 },
        { name: 'LTD', x: 85, y: 75 },
        { name: 'DFC_D', x: 65, y: 80 },
        { name: 'DFC_I', x: 35, y: 80 },
        { name: 'LTI', x: 15, y: 75 },
        { name: 'VOL_D', x: 80, y: 50 },
        { name: 'MC_D', x: 60, y: 55 },
        { name: 'MC_I', x: 40, y: 55 },
        { name: 'VOL_I', x: 20, y: 50 },
        { name: 'DEL_D', x: 60, y: 25 },
        { name: 'DEL_I', x: 40, y: 25 },
      ],
    },
    '4-3-3': {
        name: '4-3-3',
        slots: [
            { name: 'POR', x: 50, y: 92 },
            { name: 'LTD', x: 85, y: 75 },
            { name: 'DFC_D', x: 65, y: 80 },
            { name: 'DFC_I', x: 35, y: 80 },
            { name: 'LTI', x: 15, y: 75 },
            { name: 'MC_D', x: 70, y: 55 },
            { name: 'MC', x: 50, y: 60 },
            { name: 'MC_I', x: 30, y: 55 },
            { name: 'EXT_D', x: 80, y: 25 },
            { name: 'DEL', x: 50, y: 20 },
            { name: 'EXT_I', x: 20, y: 25 },
        ],
    },
  },
};
