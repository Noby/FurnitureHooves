import { MATERIALS, type Material } from '../core/defaults';
import type { BootMesh } from '../core/generateBoot';
import type { BootParams } from '../core/params';
import { bootDimensions, massGrams } from '../core/stats';
import { useI18n } from '../i18n';

interface Props {
  params: BootParams;
  mesh: BootMesh | null;
  material: Material;
  onMaterial: (m: Material) => void;
}

export function StatsStrip({ params, mesh, material, onMaterial }: Props) {
  const { t, fmt } = useI18n();
  const d = bootDimensions(params);
  const size = (s: { x: number; y: number }) =>
    d.round ? `Ø ${fmt(s.x)}` : `${fmt(s.x)} × ${fmt(s.y)}`;
  const volCm3 = mesh ? mesh.volume / 1000 : null;

  const items: { label: string; value: string; sub?: string }[] = [
    {
      label: t('stats.outer'),
      value: size(d.outer),
      sub: [
        'mm',
        d.tapered ? `${t('stats.top')} ${size(d.outerTop)}` : '',
        params.baseFlare > 0 ? `${t('stats.base')} ${size(d.base)}` : '',
      ]
        .filter(Boolean)
        .join(' · '),
    },
    {
      label: t('stats.inner'),
      value: size(d.inner),
      sub: d.tapered ? `mm · ${t('stats.top')} ${size(d.innerTop)}` : 'mm',
    },
    {
      label: t('stats.height'),
      value: fmt(d.totalHeight),
      sub: `mm · ${t('dim.lift')} ${fmt(d.lift)}`,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-card border border-line bg-line lg:grid-cols-4">
      {items.map((it) => (
        <div key={it.label} className="bg-surface px-3 py-2.5">
          <div className="label-caps">{it.label}</div>
          <div className="mt-0.5 font-mono text-[17px] font-semibold text-ink">
            {it.value} <span className="text-[11px] font-normal text-muted">{it.sub}</span>
          </div>
        </div>
      ))}
      <div className="bg-surface px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="label-caps">{t('stats.volumeMass')}</span>
          <label className="sr-only" htmlFor="material">
            {t('stats.material')}
          </label>
          <select
            id="material"
            value={material}
            onChange={(e) => onMaterial(e.target.value as Material)}
            className="h-7 rounded border border-line-input bg-surface px-1 font-mono text-[11px] text-ink-2"
          >
            {(Object.keys(MATERIALS) as Material[]).map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div
          className="mt-0.5 font-mono text-[17px] font-semibold text-ink"
          title={t('stats.solidNote')}
        >
          {volCm3 === null ? '–' : `${fmt(volCm3, 1)}`}
          <span className="text-[11px] font-normal text-muted"> cm³ · </span>
          {mesh ? fmt(massGrams(mesh.volume, material), 1) : '–'}
          <span className="text-[11px] font-normal text-muted"> g</span>
        </div>
        <div className="text-[11px] text-muted">{t('stats.solidNote')}</div>
      </div>
    </div>
  );
}
