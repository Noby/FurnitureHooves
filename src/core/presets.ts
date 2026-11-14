import { DEFAULT_PARAMS } from './defaults';
import type { BootParams } from './params';

export interface Preset {
  id: string;
  /** i18n key of the label */
  labelKey: string;
  params: Partial<BootParams>;
}

export const PRESETS: Preset[] = [
  { id: 'original50', labelKey: 'preset.original50', params: {} },
  { id: 'sq40', labelKey: 'preset.sq40', params: { legWidth: 40, legDepth: 40 } },
  { id: 'sq45', labelKey: 'preset.sq45', params: { legWidth: 45, legDepth: 45 } },
  { id: 'sq30', labelKey: 'preset.sq30', params: { legWidth: 30, legDepth: 30 } },
  {
    id: 'rect60x40',
    labelKey: 'preset.rect60x40',
    params: { legWidth: 60, legDepth: 40 },
  },
  {
    id: 'round35',
    labelKey: 'preset.round35',
    params: { legShape: 'round', legWidth: 35, legDepth: 35 },
  },
  {
    id: 'cone35',
    labelKey: 'preset.cone35',
    params: { legShape: 'round', legWidth: 35, legDepth: 35, legTaper: 3 },
  },
  {
    id: 'round50',
    labelKey: 'preset.round50',
    params: { legShape: 'round', legWidth: 50, legDepth: 50 },
  },
];

/** Presets describe the furniture leg only. */
export const LEG_KEYS = [
  'legShape',
  'legWidth',
  'legDepth',
  'legCornerRadius',
  'legTaper',
] as const satisfies readonly (keyof BootParams)[];

function legPart(preset: Preset): Pick<BootParams, (typeof LEG_KEYS)[number]> {
  const out = {} as Pick<BootParams, (typeof LEG_KEYS)[number]>;
  for (const k of LEG_KEYS) {
    (out as Record<string, unknown>)[k] = preset.params[k] ?? DEFAULT_PARAMS[k];
  }
  return out;
}

/**
 * Apply a preset on top of the current settings: only the leg (shape, size,
 * corner radius, taper) changes – boot and screw settings are kept.
 */
export function applyPreset(preset: Preset, current: BootParams = DEFAULT_PARAMS): BootParams {
  return { ...current, ...legPart(preset) };
}

/** True when the current leg matches the preset (boot/screw settings are ignored). */
export function matchesPreset(preset: Preset, params: BootParams): boolean {
  const leg = legPart(preset);
  return LEG_KEYS.every((k) => leg[k] === params[k]);
}
