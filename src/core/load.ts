import type { BootParams } from './params';
import { growProfile, legProfile, outerProfile, profilePoints, type Profile } from './profile';

/**
 * Load & print advisor – pure functions, no geometry kernel needed.
 * Turns "how heavy / how tall is the furniture" into print settings and
 * geometry recommendations (reinforcement pillars, wider base).
 */

export interface LoadInput {
  /** furniture incl. contents [kg] */
  weightKg: number;
  /** number of legs carrying the weight */
  legs: number;
  /** furniture height [mm] (stability hints) */
  furnitureHeight: number;
}

export const DEFAULT_LOAD: LoadInput = { weightKg: 60, legs: 4, furnitureHeight: 800 };

export const LOAD_RANGES = {
  weightKg: { min: 1, max: 1000, step: 5 },
  legs: { min: 1, max: 12, step: 1 },
  furnitureHeight: { min: 100, max: 3000, step: 50 },
} as const;
export type LoadKey = keyof typeof LOAD_RANGES;

/** Uneven floors, one leg briefly carrying more, moving furniture … */
export const SAFETY_FACTOR = 2;
const G = 9.81;

/** Lift at which the boot floor is "tall" (pillars recommended) [mm]. */
export const TALL_FLOOR = 20;
/** Furniture this tall should be anchored to the wall [mm]. */
export const TALL_FURNITURE = 1200;

export type LoadTier = 'light' | 'medium' | 'heavy' | 'extreme';

export interface PrintSettings {
  /** infill [%] */
  infill: number;
  perimeters: number;
  /** solid top and bottom layers */
  solidLayers: number;
  material: 'PLA' | 'PETG';
}

export interface LoadAdvice {
  /** force per leg incl. safety factor [N] */
  forceN: number;
  /** load per leg without safety factor [kg] */
  perLegKg: number;
  /** pressure of the leg on the boot floor [MPa] */
  legPressure: number;
  /** pressure of the boot on the floor [MPa] */
  floorPressure: number;
  tier: LoadTier;
  print: PrintSettings;
  /** geometry recommendations */
  recommendReinforce: boolean;
  /** recommended base flare [mm] (0 = not needed) */
  recommendFlare: number;
  /** i18n codes of stability / load warnings */
  warnings: { code: string; vars?: Record<string, number> }[];
}

/** Polygon area of a profile [mm²]. */
export function profileArea(p: Profile): number {
  const pts = profilePoints(p);
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a) / 2;
}

/** Footprint of the boot on the floor (incl. base flare) [mm²]. */
export function footprintArea(p: BootParams): number {
  return profileArea(growProfile(outerProfile(p), p.baseFlare));
}

const TIERS: { tier: LoadTier; maxMPa: number; print: PrintSettings }[] = [
  {
    tier: 'light',
    maxMPa: 0.25,
    print: { infill: 20, perimeters: 3, solidLayers: 4, material: 'PLA' },
  },
  {
    tier: 'medium',
    maxMPa: 0.6,
    print: { infill: 35, perimeters: 4, solidLayers: 5, material: 'PLA' },
  },
  {
    tier: 'heavy',
    maxMPa: 1.5,
    print: { infill: 50, perimeters: 5, solidLayers: 6, material: 'PETG' },
  },
  {
    tier: 'extreme',
    maxMPa: Infinity,
    print: { infill: 80, perimeters: 6, solidLayers: 8, material: 'PETG' },
  },
];

export function loadAdvice(load: LoadInput, p: BootParams): LoadAdvice {
  const legs = Math.max(1, Math.round(load.legs));
  const perLegKg = Math.max(0, load.weightKg) / legs;
  const forceN = perLegKg * G * SAFETY_FACTOR;
  const legArea = profileArea(legProfile(p));
  const legPressure = forceN / Math.max(1, legArea);
  const floorPressure = forceN / Math.max(1, footprintArea(p));

  const tierDef = TIERS.find((t) => legPressure < t.maxMPa) ?? TIERS[TIERS.length - 1];
  const print = { ...tierDef.print };
  const warnings: LoadAdvice['warnings'] = [];

  // pillars: carry heavy loads without dense infill, and keep tall floors solid
  const recommendReinforce =
    tierDef.tier === 'heavy' || tierDef.tier === 'extreme' || p.lift >= TALL_FLOOR;
  if (p.reinforce && print.infill > 35) {
    // pillars carry the load along Z → infill can stay moderate
    print.infill = 35;
  }

  // wider base: tall floor on a narrow leg, or soft floors under heavy load
  const o = outerProfile(p);
  const minOuter = o.kind === 'circle' ? o.diameter : Math.min(o.width, o.depth);
  const maxFlare = Math.max(0, p.lift - p.bottomChamfer - 0.5);
  let recommendFlare = 0;
  if (p.lift > minOuter * 0.4 || floorPressure > 0.3) {
    recommendFlare = Math.min(maxFlare, 15, Math.max(2, Math.round(p.lift * 0.5)));
  }

  if (load.furnitureHeight >= TALL_FURNITURE) {
    warnings.push({
      code: p.lift >= TALL_FLOOR ? 'load.warn.tallHighLift' : 'load.warn.tall',
      vars: { height: load.furnitureHeight, lift: p.lift },
    });
  }
  if (p.lift > minOuter * 0.4) {
    warnings.push({ code: 'load.warn.slender', vars: { lift: p.lift } });
  }
  if (tierDef.tier === 'extreme') {
    warnings.push({
      code: 'load.warn.extreme',
      vars: { mpa: Math.round(legPressure * 100) / 100 },
    });
  }
  if (floorPressure > 0.3 && p.baseFlare < recommendFlare) {
    warnings.push({ code: 'load.warn.softFloor' });
  }

  return {
    forceN,
    perLegKg,
    legPressure,
    floorPressure,
    tier: tierDef.tier,
    print,
    recommendReinforce,
    recommendFlare,
    warnings,
  };
}

/** Sanitize persisted / untrusted load input. */
export function sanitizeLoad(input: unknown): LoadInput {
  const out = { ...DEFAULT_LOAD };
  if (!input || typeof input !== 'object') return out;
  for (const k of Object.keys(LOAD_RANGES) as LoadKey[]) {
    const v = (input as Record<string, unknown>)[k];
    if (typeof v === 'number' && Number.isFinite(v)) {
      out[k] = Math.min(LOAD_RANGES[k].max, Math.max(LOAD_RANGES[k].min, v));
    }
  }
  return out;
}
