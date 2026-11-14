import type { Material } from '../../core/defaults';
import { loadAdvice, sanitizeLoad, type LoadAdvice, type LoadInput } from '../../core/load';
import type { BootParams } from '../../core/params';
import type { ValidationResult } from '../../core/validate';
import { useI18n } from '../../i18n';
import { NumberField } from './NumberField';

interface Props {
  params: BootParams;
  onChange: (p: BootParams) => void;
  validation: ValidationResult;
  load: LoadInput;
  onLoad: (l: LoadInput) => void;
  material: Material;
  onMaterial: (m: Material) => void;
}

function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="relative inline-flex min-h-[44px] cursor-pointer items-center">
      <input
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-label={label}
      />
      <span className="h-6 w-10 rounded-full border border-line-input bg-bg transition-colors peer-checked:border-accent peer-checked:bg-accent peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--accent)]" />
      <span className="pointer-events-none absolute left-1 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-surface shadow-sm ring-1 ring-line-input transition-transform peer-checked:translate-x-4 peer-checked:ring-0" />
    </label>
  );
}

function Badge({ children }: { children: string }) {
  return (
    <span className="rounded bg-accent-soft px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-accent-soft-text">
      {children}
    </span>
  );
}

/** What "apply recommendation" would change (empty = nothing to do). */
function pendingChanges(a: LoadAdvice, p: BootParams, material: Material) {
  return {
    reinforce: a.recommendReinforce && !p.reinforce,
    flare: a.recommendFlare > p.baseFlare + 1e-9,
    material: a.print.material === 'PETG' && material !== 'PETG',
  };
}

export function LoadCard({
  params,
  onChange,
  validation,
  load,
  onLoad,
  material,
  onMaterial,
}: Props) {
  const { t, fmt } = useI18n();
  const a = loadAdvice(sanitizeLoad(load), params); // inputs may be mid-edit (NaN)
  const pending = pendingChanges(a, params, material);
  const anyPending = pending.reinforce || pending.flare || pending.material;
  const maxFlare = Math.max(0, params.lift - params.bottomChamfer - 0.5);
  const err = (k: 'baseFlare') => validation.errors.find((e) => e.key === k);
  const pillarWarn = validation.warnings.find((w) => w.key === 'reinforce');

  const loadField = (k: keyof LoadInput, unit: string) => (
    <NumberField
      k={k}
      unit={unit}
      slider
      value={load[k]}
      onChange={(v) => onLoad({ ...load, [k]: v })}
    />
  );

  return (
    <section className="card px-4 py-3">
      <header className="flex items-center justify-between gap-2 pb-1">
        <h2 className="text-[15px] font-semibold text-ink">{t('section.load')}</h2>
        <span className="font-mono text-[11px] text-muted">04</span>
      </header>
      <p className="pb-1 text-[12px] leading-snug text-muted">{t('load.intro')}</p>
      {loadField('weightKg', 'kg')}
      {loadField('legs', t('load.unitPcs'))}
      {loadField('furnitureHeight', 'mm')}

      <dl className="mt-2 grid grid-cols-3 gap-px overflow-hidden rounded-md border border-line bg-line text-center">
        {[
          [t('load.perLeg'), `${fmt(a.perLegKg, 1)} kg`],
          [t('load.legPressure'), `${fmt(a.legPressure, 2)} MPa`],
          [t('load.floorPressure'), `${fmt(a.floorPressure, 2)} MPa`],
        ].map(([label, value]) => (
          <div key={label} className="bg-surface px-1 py-2">
            <dt className="label-caps text-[10px]">{label}</dt>
            <dd className="mt-0.5 font-mono text-[13px] font-semibold text-ink">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-1 text-[11px] text-muted">{t('load.safetyNote')}</p>

      <div className="mt-3 rounded-md border border-[1.5px] border-accent bg-accent-soft px-3 py-2">
        <div className="label-caps text-accent-soft-text">
          {t('load.recommended')} · {t(`load.tier.${a.tier}`)}
        </div>
        <p className="mt-1 font-mono text-[13px] font-medium text-ink">
          {t('load.printLine', {
            infill: a.print.infill,
            perimeters: a.print.perimeters,
            layers: a.print.solidLayers,
            material: a.print.material,
          })}
        </p>
        <p className="mt-1 text-[11px] leading-snug text-ink-2">{t('load.in3mf')}</p>
      </div>

      {a.warnings.map((w) => (
        <p
          key={w.code}
          className="mt-2 rounded-md border border-warn bg-warn-soft px-2 py-1.5 text-[12px] leading-snug text-warn"
        >
          {t(w.code, w.vars)}
        </p>
      ))}

      {/* geometry measures */}
      <div className="mt-3 border-t border-line pt-2">
        <div className="flex items-center gap-2">
          <span className="flex-1 text-ink-2">{t('field.reinforce')}</span>
          {a.recommendReinforce && !params.reinforce && <Badge>{t('load.recommendedBadge')}</Badge>}
          <Switch
            checked={params.reinforce}
            onChange={(v) => onChange({ ...params, reinforce: v })}
            label={t('field.reinforce')}
          />
        </div>
        <p className={`text-[12px] leading-snug ${pillarWarn ? 'text-warn' : 'text-muted'}`}>
          {pillarWarn ? t(pillarWarn.code, pillarWarn.vars) : t('help.reinforce')}
        </p>
        <NumberField
          k="baseFlare"
          slider
          sliderMax={Math.max(0.5, maxFlare)}
          value={params.baseFlare}
          onChange={(v) => onChange({ ...params, baseFlare: v })}
          error={err('baseFlare')}
          hintKey={a.recommendFlare > 0 ? undefined : 'hint.baseFlare'}
        />
        {a.recommendFlare > 0 && (
          <p className="-mt-1 text-[12px] text-muted">
            {t('load.flareRecommended', { flare: a.recommendFlare })}
          </p>
        )}
      </div>

      {anyPending && (
        <button
          type="button"
          className="btn-primary mt-3 w-full"
          onClick={() => {
            onChange({
              ...params,
              reinforce: params.reinforce || pending.reinforce,
              baseFlare: pending.flare ? a.recommendFlare : params.baseFlare,
            });
            if (pending.material) onMaterial('PETG');
          }}
        >
          {t('load.apply')}
        </button>
      )}
    </section>
  );
}
