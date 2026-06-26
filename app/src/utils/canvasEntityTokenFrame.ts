import type { EntityTokenFrame } from '../types/canvasTypes';

export interface EntityTokenFrameConfig {
  id: EntityTokenFrame;
  label: string;
  shortLabel: string;
  description: string;
  tokenStrokeWidth: number;
  artStrokeWidth: number;
  glowOpacity: number;
}

export const ENTITY_TOKEN_FRAME_OPTIONS: EntityTokenFrameConfig[] = [
  {
    id: 'plain',
    label: 'Простая',
    shortLabel: 'Просто',
    description: 'Минимальная рамка без декоративных слоев.',
    tokenStrokeWidth: 2,
    artStrokeWidth: 2,
    glowOpacity: 0,
  },
  {
    id: 'ring',
    label: 'Кольцо',
    shortLabel: 'Кольцо',
    description: 'Классическая VTT-фишка с внешним кольцом и мягким свечением.',
    tokenStrokeWidth: 3,
    artStrokeWidth: 3,
    glowOpacity: 0.34,
  },
  {
    id: 'badge',
    label: 'Плашка',
    shortLabel: 'Плашка',
    description: 'Фишка на компактной подложке с читабельной подписью.',
    tokenStrokeWidth: 3,
    artStrokeWidth: 3,
    glowOpacity: 0.18,
  },
  {
    id: 'hex',
    label: 'Гекс',
    shortLabel: 'Гекс',
    description: 'Угловатая рамка для тактических сцен и жетонов.',
    tokenStrokeWidth: 3,
    artStrokeWidth: 3,
    glowOpacity: 0.26,
  },
];

export function getEntityTokenFrameConfig(frame?: EntityTokenFrame): EntityTokenFrameConfig {
  return ENTITY_TOKEN_FRAME_OPTIONS.find((option) => option.id === frame) ?? ENTITY_TOKEN_FRAME_OPTIONS[1];
}
