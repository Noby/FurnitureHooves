import { LARGE_LIFT_WARNING, MIN_WALL, THIN_WALL_WARNING } from './defaults';
import { bootParamsSchema, type BootParams, type ParamKey } from './params';
import { innerProfile, minCornerWall, outerProfile, profileSize } from './profile';
import { screwOuterRadius, screwRecessDepth, sideScrewLayout } from './screw';

export { screwRecessDepth };

export interface Issue {
  /** Parameter the issue belongs to */
  key: ParamKey;
  /** i18n message code, e.g. "err.min" */
  code: string;
  /** values to interpolate into the message */
  vars?: Record<string, number | string>;
}

export interface ValidationResult {
  ok: boolean;
  errors: Issue[];
  warnings: Issue[];
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Validate params: zod ranges + derived geometric rules (errors) + soft warnings. */
export function validateParams(params: BootParams): ValidationResult {
  const errors: Issue[] = [];
  const warnings: Issue[] = [];

  const parsed = bootParamsSchema.safeParse(params);
  if (!parsed.success) {
    for (const iss of parsed.error.issues) {
      const key = iss.path[0] as ParamKey;
      if (iss.code === 'too_small') {
        errors.push({ key, code: 'err.min', vars: { min: Number(iss.minimum) } });
      } else if (iss.code === 'too_big') {
        errors.push({ key, code: 'err.max', vars: { max: Number(iss.maximum) } });
      } else {
        errors.push({ key, code: 'err.invalid' });
      }
    }
    return { ok: false, errors, warnings };
  }

  const p = parsed.data;
  const isRect = p.legShape === 'rectangle';

  if (isRect) {
    // leg corner radius
    const maxLegR = Math.min(p.legWidth, p.legDepth) / 2;
    if (p.legCornerRadius > maxLegR) {
      errors.push({ key: 'legCornerRadius', code: 'err.max', vars: { max: r2(maxLegR) } });
    }
    // outer corner radius: ≤ half the outer size, wall must stay ≥ MIN_WALL
    const o = profileSize(outerProfile(p));
    const maxR = Math.min(o.x, o.y) / 2;
    if (p.outerCornerRadius > maxR) {
      errors.push({ key: 'outerCornerRadius', code: 'err.max', vars: { max: r2(maxR) } });
    } else if (minCornerWall(p) < MIN_WALL) {
      errors.push({
        key: 'outerCornerRadius',
        code: 'err.cornerWall',
        vars: { wall: r2(minCornerWall(p)), min: MIN_WALL },
      });
    }
  }

  if (p.bottomChamfer >= p.lift) {
    errors.push({ key: 'bottomChamfer', code: 'err.belowLift', vars: { max: p.lift } });
  }
  if (p.bottomChamfer >= p.wallThickness) {
    errors.push({ key: 'bottomChamfer', code: 'err.belowWall', vars: { max: p.wallThickness } });
  }
  const maxTop = r2(Math.max(0, p.wallThickness - MIN_WALL));
  if (p.topChamfer > 0 && p.topChamfer > maxTop) {
    errors.push({ key: 'topChamfer', code: 'err.max', vars: { max: maxTop } });
  } else if (p.topOuterChamfer > 0 && p.topChamfer + p.topOuterChamfer > maxTop + 1e-9) {
    errors.push({
      key: 'topOuterChamfer',
      code: 'err.topRim',
      vars: { max: r2(Math.max(0, maxTop - p.topChamfer)), min: MIN_WALL },
    });
  }
  if (p.topOuterChamfer >= p.sleeveHeight) {
    errors.push({
      key: 'topOuterChamfer',
      code: 'err.belowSleeve',
      vars: { max: p.sleeveHeight },
    });
  }
  if (p.topChamfer >= p.sleeveHeight) {
    errors.push({ key: 'topChamfer', code: 'err.belowSleeve', vars: { max: p.sleeveHeight } });
  }

  // screw
  if (p.screwEnabled) {
    const headed = p.screwHead !== 'none';
    if (headed && p.screwHeadDiameter <= p.screwHoleDiameter) {
      errors.push({
        key: 'screwHeadDiameter',
        code: 'err.headVsHole',
        vars: { min: p.screwHoleDiameter },
      });
    }
    const fitKey: ParamKey = headed ? 'screwHeadDiameter' : 'screwHoleDiameter';
    const needed = 2 * screwOuterRadius(p);
    const recess = screwRecessDepth(p);

    if (p.screwPosition === 'bottom') {
      const inner = profileSize(innerProfile(p));
      const innerMin = Math.min(inner.x, inner.y);
      if (needed > innerMin - 2) {
        errors.push({ key: fitKey, code: 'err.screwFit', vars: { max: r2(innerMin - 2) } });
      }
      if (recess > p.lift - 1) {
        errors.push({
          key: 'screwHeadDiameter',
          code: 'err.recessDepth',
          vars: { depth: r2(recess), max: r2(p.lift - 1) },
        });
      }
    } else {
      const L = sideScrewLayout(p);
      if (needed > L.faceWidth - 2) {
        errors.push({ key: fitKey, code: 'err.screwFit', vars: { max: r2(L.faceWidth - 2) } });
      }
      const r = p.screwHoleDiameter / 2;
      const minH = r + 1;
      const maxH = p.sleeveHeight - p.topChamfer - 0.5 - screwOuterRadius(p);
      if (p.screwSideHeight < minH) {
        errors.push({ key: 'screwSideHeight', code: 'err.min', vars: { min: r2(minH) } });
      } else if (p.screwSideHeight > maxH) {
        errors.push({
          key: 'screwSideHeight',
          code: maxH < minH ? 'err.sleeveTooLow' : 'err.max',
          vars: { max: r2(Math.max(0, maxH)) },
        });
      }
      if (L.extra > 0) {
        warnings.push({
          key: 'screwPosition',
          code: 'warn.sideBoss',
          vars: { extra: r2(L.extra), required: r2(L.required) },
        });
      }
    }
  }

  // soft warnings
  if (p.wallThickness < THIN_WALL_WARNING) {
    warnings.push({
      key: 'wallThickness',
      code: 'warn.thinWall',
      vars: { min: THIN_WALL_WARNING },
    });
  }
  if (p.lift > LARGE_LIFT_WARNING) {
    warnings.push({ key: 'lift', code: 'warn.largeLift', vars: { max: LARGE_LIFT_WARNING } });
  }
  if (p.tolerance === 0) {
    warnings.push({ key: 'tolerance', code: 'warn.zeroTolerance' });
  }

  return { ok: errors.length === 0, errors, warnings };
}
