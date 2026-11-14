import type { Manifold, ManifoldToplevel } from 'manifold-3d';
import { getManifold } from './manifold';
import type { BootParams } from './params';
import {
  circleSegments,
  innerProfile,
  offsetProfile,
  outerProfile,
  profilePoints,
  profileSize,
  growProfile,
  taperOffset,
  type Profile,
} from './profile';
import { countersinkDepth, sideScrewLayout } from './screw';

/** Plain indexed triangle mesh – transferable, no three.js dependency. */
export interface BootMesh {
  /** xyz per vertex */
  positions: Float32Array;
  /** 3 vertex indices per triangle, counter-clockwise = outward */
  indices: Uint32Array;
  /** mm³ */
  volume: number;
  /** mm² */
  surfaceArea: number;
  bbox: { min: [number, number, number]; max: [number, number, number] };
}

/** Small overlap used so that cutting tools never share a face with the body. */
const EPS = 0.5;

type Vec3 = [number, number, number];

function ring(p: Profile, z: number): Vec3[] {
  return profilePoints(p).map(([x, y]) => [x, y, z]);
}

/*
 * NOTE on hulls: a convex hull of stacked profile rings is exact only when the side
 * profile bulges outwards (e.g. bottom chamfer → vertical). Where it bends inwards
 * (vertical → flaring: tapered sleeve above a straight floor, cavity → lead-in
 * chamfer) the hull would bridge the corner. Those shapes are therefore built from
 * two convex pieces each.
 */

/** Outer solid incl. bottom chamfer; tapered legs: straight floor block + flared sleeve. */
function buildBody(m: ManifoldToplevel, params: BootParams): Manifold {
  const outer = outerProfile(params);
  const height = params.lift + params.sleeveHeight;
  const c = Math.min(params.bottomChamfer, params.lift - 0.01);
  const tapered = params.legTaper > 0;
  // straight block (whole body when not tapered)
  const block: Vec3[] = [];
  if (c > 0.001) {
    block.push(...ring(offsetProfile(outer, -c), 0), ...ring(outer, c));
  } else {
    block.push(...ring(outer, 0));
  }
  // top outer chamfer (45°, inwards) – keeps the hull convex
  const co = Math.min(params.topOuterChamfer, params.sleeveHeight - 0.2);
  const topRings = (p: Profile): Vec3[] =>
    co > 0.001
      ? [...ring(p, height - co), ...ring(offsetProfile(p, -co), height)]
      : ring(p, height);
  // with taper the block ends just above the floor, inside the (wider) sleeve
  if (tapered) block.push(...ring(outer, params.lift + 0.1));
  else block.push(...topRings(outer));
  const base = m.Manifold.hull(block);
  if (!tapered) return base;

  // frustum following the leg taper (constant wall); starts 1 mm lower along the
  // same slope so it crosses the block's vertical side exactly at z = lift
  const tan = Math.tan((params.legTaper * Math.PI) / 180);
  const sleeve = m.Manifold.hull([
    ...ring(growProfile(outer, -tan), params.lift - 1),
    ...(co > 0.001
      ? [
          ...ring(growProfile(outer, taperOffset(params, height - co)), height - co),
          ...ring(offsetProfile(growProfile(outer, taperOffset(params, height)), -co), height),
        ]
      : ring(growProfile(outer, taperOffset(params, height)), height)),
  ]);
  const body = m.Manifold.union(base, sleeve);
  base.delete();
  sleeve.delete();
  return body;
}

/** Cavity for the leg (+ separate lead-in chamfer tool). Extends EPS above the top. */
function buildCavity(m: ManifoldToplevel, params: BootParams): Manifold[] {
  const inner = innerProfile(params);
  const top = params.lift + params.sleeveHeight;
  const tc = Math.min(params.topChamfer, params.sleeveHeight - 0.01);
  const at = (z: number) => growProfile(inner, taperOffset(params, z));
  const tools = [m.Manifold.hull([...ring(inner, params.lift), ...ring(at(top + EPS), top + EPS)])];
  if (tc > 0.001) {
    // 45° lead-in: frustum from the cavity outline at top − tc to + (tc + EPS) at top + EPS
    tools.push(
      m.Manifold.hull([
        ...ring(at(top - tc), top - tc),
        ...ring(offsetProfile(at(top + EPS), tc + EPS, true), top + EPS),
      ]),
    );
  }
  return tools;
}

/**
 * Collar around a side screw on a thin wall (null when not needed): a truncated
 * cone – flat face with radius R around the countersink, widening at 45° all the
 * way round until it meets the wall. No overhang steeper than 45° → no supports.
 * Works for flat, round and tapered (slanted) walls: for every direction around the
 * axis the 45° cone line is intersected with the real outer wall surface.
 */
function buildSideBoss(m: ManifoldToplevel, params: BootParams): Manifold | null {
  if (!params.screwEnabled || params.screwPosition !== 'side') return null;
  const L = sideScrewLayout(params);
  if (L.extra <= 0) return null;
  const top = params.lift + params.sleeveHeight;
  const R = L.bossRadius;
  const round = params.legShape === 'round';
  const outer = outerProfile(params);
  const outerAtLift = profileSize(outer).x / 2;
  // |x| of the outer wall surface at (y, z) – everything closer to the centre is
  // inside the body, everything further out is visible
  const wallX = (y: number, z: number) => {
    const half = outerAtLift + taperOffset(params, Math.max(z, params.lift));
    return round ? Math.sqrt(Math.max(0, half * half - y * y)) : half;
  };
  const yLimit = round
    ? Infinity
    : profileSize(outer).y / 2 - params.outerCornerRadius * (1 - Math.SQRT1_2);
  const zMax = top - params.topOuterChamfer;
  const clampZ = (z: number) => Math.min(zMax, Math.max(0, z));
  const clampY = (y: number) => Math.max(-yLimit, Math.min(yLimit, y));

  const pts: Vec3[] = [];
  const n = circleSegments(R + L.extra);
  let lowest = Infinity;
  for (let i = 0; i < n; i++) {
    const a = (2 * Math.PI * i) / n;
    const [ca, sa] = [Math.cos(a), Math.sin(a)];
    // flat face
    pts.push([-L.face, clampY(R * ca), clampZ(L.zc + R * sa)]);
    // 45° cone: |x| = face − s, radius = R + s → find s where it touches the wall
    let lo = 0;
    let hi = L.face;
    for (let k = 0; k < 50; k++) {
      const s = (lo + hi) / 2;
      const r = R + s;
      if (L.face - s > wallX(r * ca, L.zc + r * sa)) lo = s;
      else hi = s;
    }
    const r = R + hi;
    const x = L.face - hi;
    const y = clampY(r * ca);
    const z = L.zc + r * sa;
    lowest = Math.min(lowest, z);
    pts.push([-x, y, clampZ(z)]);
    // anchor inside the wall (the cavity cut removes whatever pokes inside)
    pts.push([-Math.max(0, x - params.wallThickness - 0.1), y, clampZ(z)]);
  }
  // screw so low that the cone would hit the plate → let it stand on the plate
  if (lowest < 0) {
    const xw = wallX(0, 0);
    pts.push([-L.face, clampY(R), 0], [-L.face, clampY(-R), 0]);
    pts.push([-xw, clampY(R + L.extra), 0], [-xw, clampY(-R - L.extra), 0]);
  }
  return m.Manifold.hull(pts);
}

/** Hole + head recess on the bottom side (the screw goes up into the leg). */
function buildBottomScrew(m: ManifoldToplevel, params: BootParams): Manifold[] {
  const r = params.screwHoleDiameter / 2;
  const rh = params.screwHeadDiameter / 2;
  const parts: Manifold[] = [
    m.Manifold.cylinder(params.lift + 2 * EPS, r, r, circleSegments(r)).translate([0, 0, -EPS]),
  ];
  if (params.screwHead === 'countersunk' && rh > r) {
    const depth = countersinkDepth(params.screwHeadDiameter); // 90° cone, head-only
    parts.push(
      m.Manifold.cylinder(depth + EPS, rh + EPS, rh - depth, circleSegments(rh)).translate([
        0,
        0,
        -EPS,
      ]),
    );
  }
  return parts;
}

/** Horizontal hole through the −X wall (incl. boss), head recess on the outside. */
function buildSideScrew(m: ManifoldToplevel, params: BootParams): Manifold[] {
  const L = sideScrewLayout(params);
  const r = params.screwHoleDiameter / 2;
  const rh = params.screwHeadDiameter / 2;
  const start = L.innerHalf * 0.5; // inside the cavity
  const outside = L.face + EPS;
  // cylinder along +Z rotated: [0,-90,0] → points to −X, [0,90,0] → points to +X
  const parts: Manifold[] = [
    m.Manifold.cylinder(outside - start, r, r, circleSegments(r))
      .rotate([0, -90, 0])
      .translate([-start, 0, L.zc]),
  ];
  if (params.screwHead === 'countersunk' && rh > r) {
    parts.push(
      m.Manifold.cylinder(
        countersinkDepth(params.screwHeadDiameter) + EPS,
        rh + EPS,
        rh - countersinkDepth(params.screwHeadDiameter),
        circleSegments(rh),
      )
        .rotate([0, 90, 0])
        .translate([-outside, 0, L.zc]),
    );
  }
  return parts;
}

function buildScrew(m: ManifoldToplevel, params: BootParams): Manifold | null {
  if (!params.screwEnabled) return null;
  const parts =
    params.screwPosition === 'side' ? buildSideScrew(m, params) : buildBottomScrew(m, params);
  const u = m.Manifold.union(parts);
  parts.forEach((p) => p.delete());
  return u;
}

/** Build the boot as a manifold-3d solid. Caller owns the result (call .delete()). */
export function buildBootManifold(
  params: BootParams,
  m: ManifoldToplevel = getManifold(),
): Manifold {
  let body = buildBody(m, params);
  const boss = buildSideBoss(m, params);
  if (boss) {
    const merged = m.Manifold.union(body, boss);
    body.delete();
    boss.delete();
    body = merged;
  }
  const cavity = buildCavity(m, params);
  const screw = buildScrew(m, params);
  const tools = screw ? [...cavity, screw] : cavity;
  const result = m.Manifold.difference([body, ...tools]);
  body.delete();
  tools.forEach((t) => t.delete());
  return result;
}

/**
 * Pure function: parameters → watertight triangle mesh, print-oriented
 * (bottom on Z = 0, opening upwards). Requires initManifold() beforehand.
 */
export function generateBoot(params: BootParams, m: ManifoldToplevel = getManifold()): BootMesh {
  const solid = buildBootManifold(params, m);
  try {
    const mesh = solid.getMesh();
    const numProp = mesh.numProp;
    const nv = mesh.vertProperties.length / numProp;
    const positions = new Float32Array(nv * 3);
    for (let i = 0; i < nv; i++) {
      positions[i * 3] = mesh.vertProperties[i * numProp];
      positions[i * 3 + 1] = mesh.vertProperties[i * numProp + 1];
      positions[i * 3 + 2] = mesh.vertProperties[i * numProp + 2];
    }
    const props = solid.getProperties();
    const box = solid.boundingBox();
    return {
      positions,
      indices: new Uint32Array(mesh.triVerts),
      volume: props.volume,
      surfaceArea: props.surfaceArea,
      bbox: { min: [...box.min] as Vec3, max: [...box.max] as Vec3 },
    };
  } finally {
    solid.delete();
  }
}
