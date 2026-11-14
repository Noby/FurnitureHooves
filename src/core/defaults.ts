import type { BootParams } from './params';

/**
 * Default values – match the original Printables model
 * "Practical Furniture Riser Boot – 50x50".
 * Check values: inner 51 × 51 mm, outer 57 × 57 mm, total height 28 mm.
 */
export const DEFAULT_PARAMS: BootParams = {
  legShape: 'rectangle',
  legWidth: 50,
  legDepth: 50,
  legCornerRadius: 0,
  legTaper: 0,
  tolerance: 1,
  lift: 8,
  wallThickness: 3,
  sleeveHeight: 20,
  outerCornerRadius: 1,
  bottomChamfer: 0.6,
  topChamfer: 0.4,
  topOuterChamfer: 0,
  screwEnabled: false,
  screwPosition: 'bottom',
  screwHoleDiameter: 3,
  screwHead: 'countersunk',
  screwHeadDiameter: 6,
  screwSideHeight: 10,
};

/** Minimal printable wall thickness [mm]. */
export const MIN_WALL = 0.8;
/** Below this wall thickness a soft warning is shown [mm]. */
export const THIN_WALL_WARNING = 1.2;
/** Above this lift a "consider lightening" warning is shown [mm]. */
export const LARGE_LIFT_WARNING = 30;
/** Material kept between a side screw head recess and the cavity [mm] (≈ 3 perimeters). */
export const SIDE_SCREW_MIN_MATERIAL = 1.2;
/** Margin of the side-screw reinforcement pad around the head [mm]. */
export const SIDE_BOSS_MARGIN = 2.5;

export const MATERIALS = {
  PLA: 1.24,
  PETG: 1.27,
} as const;
export type Material = keyof typeof MATERIALS;
