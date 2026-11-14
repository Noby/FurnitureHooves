import { z } from 'zod';

/**
 * Single source of truth for all boot parameters.
 * Keys, ranges and defaults are reused by the UI, validation, URL sharing
 * and the (future) Autodesk Fusion add-in via docs/params.schema.json.
 * All dimensions are in millimetres.
 */
export const LEG_SHAPES = ['rectangle', 'round'] as const;
export const SCREW_HEADS = ['none', 'countersunk'] as const;
export const SCREW_POSITIONS = ['bottom', 'side'] as const;

export type LegShape = (typeof LEG_SHAPES)[number];
export type ScrewHead = (typeof SCREW_HEADS)[number];
export type ScrewPosition = (typeof SCREW_POSITIONS)[number];

/** Numeric ranges – shared by zod schema and UI sliders. */
export const RANGES = {
  legWidth: { min: 10, max: 200, step: 0.5 },
  legDepth: { min: 10, max: 200, step: 0.5 },
  legCornerRadius: { min: 0, max: 100, step: 0.5 },
  legTaper: { min: 0, max: 10, step: 0.5 },
  tolerance: { min: 0, max: 6, step: 0.1 },
  lift: { min: 1, max: 100, step: 0.5 },
  wallThickness: { min: 0.8, max: 10, step: 0.4 },
  sleeveHeight: { min: 3, max: 150, step: 1 },
  outerCornerRadius: { min: 0, max: 100, step: 0.5 },
  bottomChamfer: { min: 0, max: 3, step: 0.1 },
  topChamfer: { min: 0, max: 2, step: 0.1 },
  topOuterChamfer: { min: 0, max: 3, step: 0.1 },
  screwHoleDiameter: { min: 1, max: 12, step: 0.1 },
  screwHeadDiameter: { min: 2, max: 25, step: 0.1 },
  screwSideHeight: { min: 1, max: 150, step: 0.5 },
} as const;

export type NumericKey = keyof typeof RANGES;

const num = (k: NumericKey) => z.number().finite().min(RANGES[k].min).max(RANGES[k].max);

export const bootParamsSchema = z.object({
  legShape: z.enum(LEG_SHAPES).describe('Leg cross-section: rectangle/square or round'),
  legWidth: num('legWidth').describe('Leg width (diameter for round legs) [mm]'),
  legDepth: num('legDepth').describe('Leg depth, rectangle only [mm]'),
  legCornerRadius: num('legCornerRadius').describe('Corner radius of the leg [mm]'),
  legTaper: num('legTaper').describe(
    'Leg taper per side in degrees (0 = straight; round → cone, rectangle → truncated pyramid). Leg size is measured at its bottom, it widens upwards.',
  ),
  tolerance: num('tolerance').describe('Total clearance: inner size = leg + tolerance [mm]'),
  lift: num('lift').describe('Floor thickness = how much the furniture is raised [mm]'),
  wallThickness: num('wallThickness').describe('Sleeve wall thickness [mm]'),
  sleeveHeight: num('sleeveHeight').describe('Height of the sleeve around the leg [mm]'),
  outerCornerRadius: num('outerCornerRadius').describe('Outer vertical edge radius [mm]'),
  bottomChamfer: num('bottomChamfer').describe('Chamfer of the outer bottom edge [mm]'),
  topChamfer: num('topChamfer').describe('Inner lead-in chamfer at the top of the sleeve [mm]'),
  topOuterChamfer: num('topOuterChamfer').describe(
    'Chamfer of the outer top edge of the sleeve [mm]',
  ),
  screwEnabled: z.boolean().describe('Hole for a small wood screw holding the boot on the leg'),
  screwPosition: z
    .enum(SCREW_POSITIONS)
    .describe(
      'bottom = vertical hole in the floor centre, side = horizontal hole through the -X wall',
    ),
  screwHoleDiameter: num('screwHoleDiameter').describe('Wood screw (hole) diameter [mm]'),
  screwHead: z
    .enum(SCREW_HEADS)
    .describe('countersunk = 90° cone for a wood screw head on the outer side'),
  screwHeadDiameter: num('screwHeadDiameter').describe('Wood screw head diameter [mm]'),
  screwSideHeight: num('screwSideHeight').describe(
    'Side screw only: height of the hole axis above the cavity floor [mm]',
  ),
});

export type BootParams = z.infer<typeof bootParamsSchema>;
export type ParamKey = keyof BootParams;
