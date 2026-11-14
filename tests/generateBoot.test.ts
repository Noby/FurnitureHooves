import { beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_PARAMS } from '../src/core/defaults';
import { meshTo3mf } from '../src/core/export/3mf';
import { meshToStl, parseStl } from '../src/core/export/stl';
import { buildBootManifold, generateBoot } from '../src/core/generateBoot';
import { arrangeCopies } from '../src/core/layout';
import { getManifold, initManifold } from '../src/core/manifold';
import {
  growProfile,
  innerProfile,
  outerProfile,
  profilePoints,
  profileSize,
  taperOffset,
} from '../src/core/profile';
import type { BootParams } from '../src/core/params';
import { bootDimensions, fileBaseName } from '../src/core/stats';
import { sideScrewLayout } from '../src/core/screw';
import { validateParams } from '../src/core/validate';
import { isManifold, signedVolume } from './helpers';

beforeAll(async () => {
  await initManifold();
});

const P = (over: Partial<BootParams> = {}): BootParams => ({ ...DEFAULT_PARAMS, ...over });

const CASES: Record<string, BootParams> = {
  default: P(),
  bottomScrew: P({ screwEnabled: true }),
  round: P({ legShape: 'round', legWidth: 35, screwEnabled: true }),
  bigHead: P({ screwEnabled: true, screwHoleDiameter: 4, screwHeadDiameter: 8 }),
  plainHole: P({ screwEnabled: true, screwHead: 'none' }),
  sideScrew: P({ screwEnabled: true, screwPosition: 'side' }),
  sideRound: P({ legShape: 'round', legWidth: 35, screwEnabled: true, screwPosition: 'side' }),
  rounded: P({ legCornerRadius: 5, outerCornerRadius: 8 }),
  rectangle: P({ legWidth: 80, legDepth: 30 }),
  sharp: P({ outerCornerRadius: 0, bottomChamfer: 0, topChamfer: 0 }),
  minimal: P({
    legWidth: 10,
    legDepth: 10,
    lift: 1,
    tolerance: 0,
    wallThickness: 0.8,
    sleeveHeight: 3,
    outerCornerRadius: 0,
    bottomChamfer: 0,
    topChamfer: 0,
    screwEnabled: false,
  }),
  maximal: P({
    legWidth: 200,
    legDepth: 200,
    lift: 100,
    tolerance: 6,
    wallThickness: 10,
    sleeveHeight: 150,
    outerCornerRadius: 10,
    bottomChamfer: 3,
    topChamfer: 2,
    screwEnabled: true,
    screwHoleDiameter: 8,
    screwHeadDiameter: 16,
  }),
  roundMax: P({
    legShape: 'round',
    legWidth: 200,
    lift: 100,
    sleeveHeight: 150,
    wallThickness: 10,
  }),
};

describe('generateBoot', () => {
  for (const [name, params] of Object.entries(CASES)) {
    it(`${name}: valid params, manifold, positive volume, correct bbox`, () => {
      expect(validateParams(params).errors).toEqual([]);
      const mesh = generateBoot(params);
      expect(mesh.indices.length).toBeGreaterThan(0);
      expect(isManifold(mesh)).toBe(true);
      expect(mesh.volume).toBeGreaterThan(0);
      expect(signedVolume(mesh)).toBeCloseTo(mesh.volume, 0);

      const sizeX = mesh.bbox.max[0] - mesh.bbox.min[0];
      const sizeY = mesh.bbox.max[1] - mesh.bbox.min[1];
      const sizeZ = mesh.bbox.max[2] - mesh.bbox.min[2];
      const expectX = params.legWidth + params.tolerance + 2 * params.wallThickness;
      const expectY =
        (params.legShape === 'round' ? params.legWidth : params.legDepth) +
        params.tolerance +
        2 * params.wallThickness;
      expect(Math.abs(sizeX - expectX)).toBeLessThan(0.01);
      expect(Math.abs(sizeY - expectY)).toBeLessThan(0.01);
      expect(Math.abs(sizeZ - (params.lift + params.sleeveHeight))).toBeLessThan(0.01);
      expect(Math.abs(mesh.bbox.min[2])).toBeLessThan(1e-6);
    });
  }

  it('default 50×50 matches the reference model (51 inner, 57 outer, 28 high)', () => {
    const d = bootDimensions(DEFAULT_PARAMS);
    expect(d.inner).toEqual({ x: 51, y: 51 });
    expect(d.outer).toEqual({ x: 57, y: 57 });
    expect(d.totalHeight).toBe(28);
    expect(fileBaseName(DEFAULT_PARAMS)).toBe('boot_50x50_lift8');
  });

  it('screw hole reduces volume', () => {
    const withScrew = generateBoot(P({ screwEnabled: true })).volume;
    const without = generateBoot(P({ screwEnabled: false })).volume;
    expect(withScrew).toBeLessThan(without);
  });

  it('volume roughly equals analytic volume for sharp box without screw', () => {
    const p = P({ outerCornerRadius: 0, bottomChamfer: 0, topChamfer: 0, screwEnabled: false });
    const expected = 57 * 57 * 28 - 51 * 51 * 20;
    expect(generateBoot(p).volume).toBeCloseTo(expected, 1);
  });

  it('cavity floor sits at Z = lift', () => {
    const p = P({ screwEnabled: false });
    const mesh = generateBoot(p);
    // any vertex inside the inner footprint (away from walls) must be at z=0 or z=lift
    const zs = new Set<number>();
    for (let i = 0; i < mesh.positions.length; i += 3) {
      const [x, y, z] = [mesh.positions[i], mesh.positions[i + 1], mesh.positions[i + 2]];
      if (Math.abs(x) < 25 && Math.abs(y) < 25) zs.add(Math.round(z * 1000) / 1000);
    }
    for (const z of zs) expect([0, 8, 28]).toContain(z);
  });
});

/**
 * Triangles facing down steeper than 45° (would need supports), ignoring the build
 * plate, the screw hole itself (a small horizontal hole bridges fine) and float slivers.
 * Tapered outer walls lean out by ≤ 10°, well within limits.
 */
function steepOverhangCount(p: BootParams): number {
  const mesh = generateBoot(p);
  const L = sideScrewLayout(p);
  const rh = p.screwHeadDiameter / 2 + 0.05;
  const pos = mesh.positions;
  let bad = 0;
  for (let t = 0; t < mesh.indices.length; t += 3) {
    const [a, b, c] = [0, 1, 2].map((k) => mesh.indices[t + k] * 3);
    const cy = (pos[a + 1] + pos[b + 1] + pos[c + 1]) / 3;
    const cz = (pos[a + 2] + pos[b + 2] + pos[c + 2]) / 3;
    if (cz < 0.01) continue;
    if (p.screwPosition === 'side' && Math.hypot(cy, cz - L.zc) < rh) continue;
    const u = [0, 1, 2].map((k) => pos[b + k] - pos[a + k]);
    const v = [0, 1, 2].map((k) => pos[c + k] - pos[a + k]);
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const len = Math.hypot(...n);
    if (len / 2 < 0.01) continue;
    if (n[2] / len < -0.72) bad++;
  }
  return bad;
}

describe('side screw', () => {
  const side = (over: Partial<BootParams> = {}) =>
    P({ screwEnabled: true, screwPosition: 'side', ...over });

  it('is off by default', () => {
    expect(DEFAULT_PARAMS.screwEnabled).toBe(false);
  });

  it('thick enough wall → no boss, hole removes material', () => {
    const p = side(); // countersunk 6/3 → 1.5 + 1.2 = 2.7 ≤ 3
    expect(sideScrewLayout(p).extra).toBe(0);
    expect(generateBoot(p).volume).toBeLessThan(generateBoot(P()).volume);
  });

  const steepOverhangs = steepOverhangCount;

  it('thin wall: collar only around the hole, not down to the plate, no supports', () => {
    const p = side({ wallThickness: 1.6, bottomChamfer: 0.4, topChamfer: 0.4 });
    const L = sideScrewLayout(p);
    const mesh = generateBoot(p);
    // lowest point of the protruding collar (outside the original wall)
    let lowest = Infinity;
    for (let i = 0; i < mesh.positions.length; i += 3) {
      if (mesh.positions[i] < -L.outerFace - 0.01) lowest = Math.min(lowest, mesh.positions[i + 2]);
    }
    // collar face bottom = hole axis − collar radius; the 45° ramp ends on the wall surface
    expect(lowest).toBeCloseTo(L.zc - L.bossRadius, 1);
    expect(lowest).toBeGreaterThan(5);
    expect(steepOverhangs(p)).toBe(0);
  });

  it('screw diameter does not change the collar – only the head diameter does', () => {
    const base = { wallThickness: 1.6, bottomChamfer: 0.4, topChamfer: 0.4 };
    const layouts = [2, 2.5, 3, 4].map((d) =>
      sideScrewLayout(side({ ...base, screwHoleDiameter: d })),
    );
    for (const L of layouts) {
      expect(L.extra).toBeCloseTo(layouts[0].extra, 9);
      expect(L.face).toBeCloseTo(layouts[0].face, 9);
    }
    const meshes = [2, 4].map((d) => generateBoot(side({ ...base, screwHoleDiameter: d })));
    expect(meshes[0].bbox.min[0]).toBeCloseTo(meshes[1].bbox.min[0], 6);
    // a bigger head needs more material
    const bigHead = sideScrewLayout(side({ ...base, screwHeadDiameter: 8 }));
    expect(bigHead.extra).toBeGreaterThan(layouts[0].extra);
    // 90° countersink depth = ¼ head diameter
    expect(bigHead.required).toBeCloseTo(8 / 4 + 1.2, 9);
  });

  it('collar is chamfered 45° all round (truncated cone)', () => {
    const p = side({ wallThickness: 1.6, bottomChamfer: 0.4, topChamfer: 0.4 });
    const L = sideScrewLayout(p);
    const mesh = generateBoot(p);
    // largest radius around the screw axis at a given |x|
    const radiusAt = (x: number) => {
      let r = 0;
      for (let i = 0; i < mesh.positions.length; i += 3) {
        const [px, py, pz] = [mesh.positions[i], mesh.positions[i + 1], mesh.positions[i + 2]];
        const d = Math.hypot(py, pz - L.zc);
        if (Math.abs(px + x) < 1e-3 && d < L.bossRadius + L.extra + 0.5) r = Math.max(r, d);
      }
      return r;
    };
    expect(radiusAt(L.face)).toBeCloseTo(L.bossRadius, 2); // flat face
    expect(radiusAt(L.outerFace)).toBeCloseTo(L.bossRadius + L.extra, 2); // meets the wall wider
  });

  it('round leg collar has no steep overhangs either', () => {
    expect(
      steepOverhangs(
        side({
          legShape: 'round',
          legWidth: 40,
          wallThickness: 1.2,
          bottomChamfer: 0.4,
          topChamfer: 0.2,
        }),
      ),
    ).toBe(0);
  });

  it('countersink matches a 90° wood screw head', () => {
    const p = side({ wallThickness: 4 });
    const mesh = generateBoot(p);
    const L = sideScrewLayout(p);
    // on the outer face the opening has the head diameter
    let maxR = 0;
    for (let i = 0; i < mesh.positions.length; i += 3) {
      const [x, y, z] = [mesh.positions[i], mesh.positions[i + 1], mesh.positions[i + 2]];
      if (Math.abs(x + L.face) < 1e-3) {
        const r = Math.hypot(y, z - L.zc);
        if (r < 4) maxR = Math.max(maxR, r);
      }
    }
    expect(maxR).toBeCloseTo(p.screwHeadDiameter / 2, 1);
  });

  for (const [name, over] of Object.entries({
    bigHead: { screwHoleDiameter: 4, screwHeadDiameter: 9 },
    thinWall: { wallThickness: 1.6, bottomChamfer: 0.4, topChamfer: 0.4 },
    lowScrew: { wallThickness: 1.2, bottomChamfer: 0.4, topChamfer: 0.4, screwSideHeight: 3 },
    roundThin: {
      legShape: 'round',
      legWidth: 40,
      wallThickness: 1.2,
      bottomChamfer: 0.4,
      topChamfer: 0.2,
    },
  } as Record<string, Partial<BootParams>>)) {
    it(`${name}: thin wall gets a boss on −X, still manifold and printable`, () => {
      const p = side(over);
      const v = validateParams(p);
      expect(v.errors).toEqual([]);
      expect(v.warnings.map((w) => w.code)).toContain('warn.sideBoss');
      const L = sideScrewLayout(p);
      expect(L.extra).toBeGreaterThan(0);
      const mesh = generateBoot(p);
      expect(isManifold(mesh)).toBe(true);
      // boss extends the −X side only, +X side unchanged
      expect(mesh.bbox.min[0]).toBeCloseTo(-L.face, 2);
      expect(mesh.bbox.max[0]).toBeCloseTo(L.outerFace, 2);
      expect(mesh.bbox.min[2]).toBeCloseTo(0, 5);
      expect(mesh.bbox.max[2]).toBeCloseTo(p.lift + p.sleeveHeight, 2);
      // material at the screw = required (recess + 1.2 mm)
      expect(L.face - L.innerHalf).toBeCloseTo(L.required, 5);
    });
  }

  it('side height must keep the screw inside the sleeve', () => {
    const codes = (o: Partial<BootParams>) => validateParams(side(o)).errors.map((e) => e.key);
    expect(codes({ screwSideHeight: 1 })).toContain('screwSideHeight');
    expect(codes({ screwSideHeight: 19 })).toContain('screwSideHeight');
    expect(codes({ screwSideHeight: 10 })).toEqual([]);
    // the floor-recess rule does not apply to side screws
    expect(codes({ lift: 2 })).toEqual([]);
  });
});

describe('tapered legs', () => {
  const tan = (deg: number) => Math.tan((deg * Math.PI) / 180);

  for (const [name, over] of Object.entries({
    pyramid: { legTaper: 3 },
    pyramidRounded: {
      legTaper: 5,
      legCornerRadius: 4,
      outerCornerRadius: 6,
      legWidth: 60,
      legDepth: 40,
    },
    cone: { legShape: 'round', legWidth: 35, legTaper: 3 },
    coneMax: { legShape: 'round', legWidth: 30, legTaper: 10, sleeveHeight: 40 },
    pyramidBottomScrew: { legTaper: 4, screwEnabled: true },
  } as Record<string, Partial<BootParams>>)) {
    it(`${name}: manifold, bottom = straight size, top widened by sleeve·tan(taper)`, () => {
      const p = P(over);
      expect(validateParams(p).errors).toEqual([]);
      const mesh = generateBoot(p);
      expect(isManifold(mesh)).toBe(true);
      const d = bootDimensions(p);
      const grow = 2 * p.sleeveHeight * tan(p.legTaper);
      expect(mesh.bbox.max[0] - mesh.bbox.min[0]).toBeCloseTo(d.outer.x + grow, 2);
      expect(d.outerTop.x).toBeCloseTo(d.outer.x + grow, 6);
      expect(d.innerTop.x).toBeCloseTo(d.inner.x + grow, 6);
      expect(mesh.bbox.max[2]).toBeCloseTo(p.lift + p.sleeveHeight, 4);
      // at the bottom (below the cavity floor) the boot is not wider than the straight one
      let maxBottomX = 0;
      for (let i = 0; i < mesh.positions.length; i += 3) {
        if (mesh.positions[i + 2] < p.lift - 1e-3)
          maxBottomX = Math.max(maxBottomX, mesh.positions[i]);
      }
      expect(maxBottomX).toBeCloseTo(d.outer.x / 2, 3);
    });
  }

  it('tapered boot uses less material at the bottom than at the top (cavity follows the leg)', () => {
    const straight = generateBoot(P());
    const tapered = generateBoot(P({ legTaper: 5 }));
    // constant wall thickness → the tapered boot is a little bigger overall
    expect(tapered.volume).toBeGreaterThan(straight.volume);
  });

  it('side screw collar on a slanted wall: manifold, no steep overhangs', () => {
    for (const over of [
      { legTaper: 5, wallThickness: 1.6, bottomChamfer: 0.4, topChamfer: 0.4 },
      {
        legShape: 'round',
        legWidth: 40,
        legTaper: 4,
        wallThickness: 1.2,
        bottomChamfer: 0.4,
        topChamfer: 0.2,
      },
    ] as Partial<BootParams>[]) {
      const p = P({ screwEnabled: true, screwPosition: 'side', ...over });
      expect(validateParams(p).errors).toEqual([]);
      const L = sideScrewLayout(p);
      expect(L.extra).toBeGreaterThan(0);
      // the wall is further out at the screw height
      expect(L.innerHalf).toBeCloseTo(
        bootDimensions(p).inner.x / 2 + p.screwSideHeight * tan(p.legTaper),
        6,
      );
      const mesh = generateBoot(p);
      expect(isManifold(mesh)).toBe(true);
      expect(mesh.bbox.min[0]).toBeCloseTo(-L.face, 2);
      expect(steepOverhangCount(p)).toBe(0);
    }
  });
});

describe('exact wall and cavity (regression: hull must not bridge concave corners)', () => {
  /** cross-section area of the boot at height z vs. outer − inner profile area */
  function checkSlices(p: BootParams) {
    const m = getManifold();
    const solid = buildBootManifold(p, m);
    const area = (pr: Parameters<typeof profilePoints>[0]) => {
      const cs = new m.CrossSection([profilePoints(pr)]);
      const a = cs.area();
      cs.delete();
      return a;
    };
    const top = p.lift + p.sleeveHeight;
    for (const z of [p.lift + 0.5, p.lift + p.sleeveHeight / 2, top - p.topChamfer - 0.3]) {
      const cs = solid.slice(z);
      const t = taperOffset(p, z);
      const expected =
        area(growProfile(outerProfile(p), t)) - area(growProfile(innerProfile(p), t));
      expect(cs.area(), `z=${z}`).toBeCloseTo(expected, 0);
      cs.delete();
    }
    // below the floor the body is straight (not widened by the taper)
    const floor = solid.slice(p.lift - 0.5);
    expect(floor.bounds().max[0]).toBeCloseTo(profileSize(outerProfile(p)).x / 2, 3);
    floor.delete();
    solid.delete();
  }

  for (const taper of [0, 5, 10]) {
    for (const shape of ['rectangle', 'round'] as const) {
      it(`${shape}, taper ${taper}°: constant wall, cavity follows the leg incl. lead-in`, () => {
        checkSlices(P({ legShape: shape, legTaper: taper, sleeveHeight: 40, topChamfer: 0.8 }));
      });
    }
  }

  it('screw holes go all the way through for any taper, shape and wall', () => {
    const m = getManifold();
    for (const taper of [0, 3, 5, 8, 10])
      for (const shape of ['rectangle', 'round'] as const)
        for (const pos of ['bottom', 'side'] as const)
          for (const wall of [3, 1.6])
            for (const sleeve of [20, 80]) {
              const p = P({
                legShape: shape,
                legTaper: taper,
                screwEnabled: true,
                screwPosition: pos,
                wallThickness: wall,
                bottomChamfer: 0.4,
                sleeveHeight: sleeve,
              });
              expect(validateParams(p).errors).toEqual([]);
              const solid = buildBootManifold(p, m);
              const r = (p.screwHoleDiameter / 2) * 0.6;
              let probe;
              if (pos === 'bottom') {
                probe = m.Manifold.cylinder(p.lift + 2, r, r, 16).translate([0, 0, -1]);
              } else {
                const L = sideScrewLayout(p);
                const start = L.innerHalf * 0.9;
                probe = m.Manifold.cylinder(L.face + 2 - start, r, r, 16)
                  .rotate([0, -90, 0])
                  .translate([-start, 0, L.zc]);
              }
              const hit = solid.intersect(probe);
              expect(
                hit.getProperties().volume,
                JSON.stringify({ taper, shape, pos, wall, sleeve }),
              ).toBeLessThan(1e-3);
              solid.delete();
              probe.delete();
              hit.delete();
            }
  });
});

describe('top outer chamfer', () => {
  for (const [name, over] of Object.entries({
    straight: {},
    round: { legShape: 'round', legWidth: 35 },
    pyramid: { legTaper: 5 },
    cone: { legShape: 'round', legWidth: 35, legTaper: 5 },
    sideScrewThin: {
      wallThickness: 2,
      bottomChamfer: 0.4,
      topChamfer: 0.4,
      topOuterChamfer: 0.6,
      screwEnabled: true,
      screwPosition: 'side',
      sleeveHeight: 14,
      screwSideHeight: 7,
    },
  } as Record<string, Partial<BootParams>>)) {
    it(`${name}: 45° chamfer on the outer top edge, manifold, same height`, () => {
      const p = P({ topOuterChamfer: 1, ...over });
      expect(validateParams(p).errors).toEqual([]);
      const mesh = generateBoot(p);
      expect(isManifold(mesh)).toBe(true);
      const top = p.lift + p.sleeveHeight;
      expect(mesh.bbox.max[2]).toBeCloseTo(top, 4);
      const m = getManifold();
      const solid = buildBootManifold(p, m);
      const outerTop = profileSize(growProfile(outerProfile(p), taperOffset(p, top))).y / 2;
      // on +Y (no side screw there) the top rim is pulled in by the chamfer
      for (const dz of [0.01, p.topOuterChamfer / 2]) {
        const cs = solid.slice(top - dz);
        const expected =
          outerTop - taperOffset(p, top) + taperOffset(p, top - dz) - (p.topOuterChamfer - dz);
        expect(cs.bounds().max[1], `dz=${dz}`).toBeCloseTo(expected, 2);
        cs.delete();
      }
      solid.delete();
      expect(steepOverhangCount(p)).toBe(0);
    });
  }
});

describe('export', () => {
  it('STL round-trips with expected triangle count', () => {
    const mesh = generateBoot(DEFAULT_PARAMS);
    const stl = meshToStl(mesh);
    const parsed = parseStl(stl);
    expect(parsed.triangles).toBe(mesh.indices.length / 3);
    expect(parsed.triangles).toBeGreaterThan(0);
  });

  it('3MF is a zip archive', () => {
    const mesh = generateBoot(DEFAULT_PARAMS);
    const data = meshTo3mf(mesh, 'boot');
    expect(data[0]).toBe(0x50); // 'P'
    expect(data[1]).toBe(0x4b); // 'K'
  });

  it('multiple copies stay manifold and do not overlap', () => {
    const mesh = generateBoot(DEFAULT_PARAMS);
    const plate = arrangeCopies(mesh, 4);
    expect(plate.indices.length).toBe(mesh.indices.length * 4);
    expect(isManifold(plate)).toBe(true);
    expect(plate.bbox.max[0] - plate.bbox.min[0]).toBeCloseTo(57 * 2 + 5, 3);
    expect(signedVolume(plate)).toBeCloseTo(mesh.volume * 4, -1);
  });
});
