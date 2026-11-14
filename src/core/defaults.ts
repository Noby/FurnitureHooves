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
  baseFlare: 0,
  reinforce: false,
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
/** Reinforcement pillars: void diameter, grid spacing, solid skin kept at bottom/top [mm]. */
export const PILLAR_VOID_DIAMETER = 1;
export const PILLAR_SPACING = 6;
export const PILLAR_SKIN = 1.2;
/** Minimal lift for pillars to fit (2 × skin + some height) [mm]. */
export const PILLAR_MIN_LIFT = 4;
/** Max number of pillars (CSG cost); spacing grows for big legs. */
export const PILLAR_MAX_COUNT = 400;

export const MATERIALS = {
  PLA: 1.24,
  PETG: 1.27,
} as const;
export type Material = keyof typeof MATERIALS;
