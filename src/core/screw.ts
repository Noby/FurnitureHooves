import { SIDE_BOSS_MARGIN, SIDE_SCREW_MIN_MATERIAL } from './defaults';
import type { BootParams } from './params';
import { innerProfile, outerProfile, profileSize, taperOffset } from './profile';

/**
 * Depth of the 90° countersink for the wood screw head [mm].
 * Depends on the head diameter only (¼ of it – the cone narrows from the head
 * diameter to half of it, like common wood screws 3/6, 4/8, 5/10 mm), so changing
 * the screw diameter never changes the recess or the side collar.
 */
export function screwRecessDepth(p: BootParams): number {
  if (!p.screwEnabled) return 0;
  if (p.screwHead === 'countersunk') return countersinkDepth(p.screwHeadDiameter);
  return 0;
}

/** 90° countersink depth for a head of the given diameter. */
export function countersinkDepth(headDiameter: number): number {
  return headDiameter / 4;
}

/** Radius the screw occupies on the outer surface (head if recessed, else hole). */
export function screwOuterRadius(p: BootParams): number {
  return p.screwHead === 'none'
    ? p.screwHoleDiameter / 2
    : Math.max(p.screwHeadDiameter, p.screwHoleDiameter) / 2;
}

/**
 * Layout of a side screw. The hole runs horizontally along −X through the wall,
 * the head recess is on the outside. When the wall is too thin for the recess plus
 * SIDE_SCREW_MIN_MATERIAL, a collar ("boss") is added on the outside around the
 * hole only. Its underside runs into the wall at 45°, so it prints without supports.
 */
export interface SideScrewLayout {
  /** distance of the inner wall surface from the centre (at y = 0) */
  innerHalf: number;
  /** distance of the original outer wall surface from the centre */
  outerFace: number;
  /** distance of the final outer face (incl. boss) from the centre */
  face: number;
  /** extra thickness added by the boss (0 = no boss) */
  extra: number;
  /** total material needed at the screw */
  required: number;
  /** Z of the hole axis */
  zc: number;
  /** radius of the boss (half its width) */
  bossRadius: number;
  /** usable width of the wall face for the head (inner size along Y) */
  faceWidth: number;
}

export function sideScrewLayout(p: BootParams): SideScrewLayout {
  const inner = profileSize(innerProfile(p));
  const outer = profileSize(outerProfile(p));
  const zc = p.lift + p.screwSideHeight;
  // tapered leg: the wall at the screw height is further out
  const innerHalf = inner.x / 2 + taperOffset(p, zc);
  const outerFace = innerHalf + p.wallThickness;
  const required = screwRecessDepth({ ...p, screwEnabled: true }) + SIDE_SCREW_MIN_MATERIAL;
  const extra = Math.max(0, Math.round((required - p.wallThickness) * 1000) / 1000);
  return {
    innerHalf,
    outerFace,
    face: outerFace + extra,
    extra,
    required,
    zc,
    bossRadius: Math.min(screwOuterRadius(p) + SIDE_BOSS_MARGIN, outer.y / 2),
    faceWidth: inner.y + 2 * taperOffset(p, zc),
  };
}

/** True when the side screw needs a reinforcement pad. */
export function sideScrewNeedsBoss(p: BootParams): boolean {
  return p.screwEnabled && p.screwPosition === 'side' && sideScrewLayout(p).extra > 0;
}
