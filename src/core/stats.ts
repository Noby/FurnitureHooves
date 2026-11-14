import { MATERIALS, type Material } from './defaults';
import type { BootParams } from './params';
import { growProfile, innerProfile, outerProfile, profileSize, taperOffset } from './profile';

export interface BootDimensions {
  inner: { x: number; y: number };
  outer: { x: number; y: number };
  /** sizes at the top of the sleeve (differ only for tapered legs) */
  innerTop: { x: number; y: number };
  outerTop: { x: number; y: number };
  tapered: boolean;
  totalHeight: number;
  lift: number;
  round: boolean;
}

/** Nominal dimensions straight from parameters (no geometry needed). */
export function bootDimensions(p: BootParams): BootDimensions {
  return {
    inner: profileSize(innerProfile(p)),
    outer: profileSize(outerProfile(p)),
    innerTop: profileSize(growProfile(innerProfile(p), taperOffset(p, p.lift + p.sleeveHeight))),
    outerTop: profileSize(growProfile(outerProfile(p), taperOffset(p, p.lift + p.sleeveHeight))),
    tapered: p.legTaper > 0,
    totalHeight: p.lift + p.sleeveHeight,
    lift: p.lift,
    round: p.legShape === 'round',
  };
}

/** Mass in grams of a solid (100 % infill) part. volume in mm³. */
export function massGrams(volumeMm3: number, material: Material): number {
  return (volumeMm3 / 1000) * MATERIALS[material];
}

const fmt = (n: number) => String(Math.round(n * 10) / 10).replace('.', '-');

/** File name containing the main parameters, e.g. boot_50x50_lift8. */
export function fileBaseName(p: BootParams, count = 1): string {
  const size =
    p.legShape === 'round' ? `d${fmt(p.legWidth)}` : `${fmt(p.legWidth)}x${fmt(p.legDepth)}`;
  return `boot_${size}_lift${fmt(p.lift)}${count > 1 ? `_${count}pcs` : ''}`;
}
