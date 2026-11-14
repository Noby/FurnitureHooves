import { useEffect, useState } from 'react';
import { meshTo3mf, type SlicerSettings } from '../core/export/3mf';
import { meshToStl } from '../core/export/stl';
import type { BootMesh } from '../core/generateBoot';
import { arrangeCopies } from '../core/layout';
import { bootParamsSchema, type BootParams } from '../core/params';
import { fileBaseName } from '../core/stats';
import { shareUrl } from '../hooks/useUrlParams';
import { useI18n } from '../i18n';

interface Props {
  mesh: BootMesh | null;
  meshParams: BootParams | null;
  params: BootParams;
  valid: boolean;
  count: number;
  onCount: (n: number) => void;
  /** recommended slicer settings embedded in the 3MF */
  slicer?: SlicerSettings;
}

function download(data: BlobPart, fileName: string, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

const DownloadIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    aria-hidden="true"
  >
    <path d="M8 2v8M4.5 7 8 10.5 11.5 7M2.5 13.5h11" />
  </svg>
);

export function ExportBar({ mesh, meshParams, params, valid, count, onCount, slicer }: Props) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(id);
  }, [copied]);

  // export only when the shown mesh corresponds to the current (valid) params
  const ready = valid && !!mesh && meshParams === params;
  const exportMesh = () => (mesh ? arrangeCopies(mesh, count) : null);
  const base = fileBaseName(params, count);
  const disabledTitle = !valid ? t('export.invalid') : !ready ? t('export.notReady') : undefined;

  return (
    <div className="card flex flex-wrap items-center gap-2 px-3 py-2">
      <label className="flex items-center gap-2">
        <span className="label-caps">{t('export.count')}</span>
        <select
          value={count}
          onChange={(e) => onCount(Number(e.target.value))}
          className="input h-11 w-[72px] font-mono"
        >
          {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        className="btn-ghost"
        onClick={async () => setCopied(await copyText(shareUrl(params)))}
        aria-live="polite"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          aria-hidden="true"
        >
          <path d="M6.5 9.5a3 3 0 0 0 4.2 0l2.3-2.3a3 3 0 0 0-4.2-4.2L7.6 4.1M9.5 6.5a3 3 0 0 0-4.2 0L3 8.8a3 3 0 0 0 4.2 4.2l1.1-1.1" />
        </svg>
        {copied ? t('export.copied') : t('export.copyLink')}
      </button>
      <button
        type="button"
        className="btn-ghost"
        title={t('export.jsonTitle')}
        disabled={!valid}
        onClick={() => {
          const data = {
            $schema: './params.schema.json',
            generator: 'furniture-hooves',
            version: 1,
            params: bootParamsSchema.parse(params),
          };
          download(
            JSON.stringify(data, null, 2),
            `${fileBaseName(params)}.json`,
            'application/json',
          );
        }}
      >
        {t('export.json')}
      </button>
      <div className="ml-auto flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-outline"
          disabled={!ready}
          title={disabledTitle}
          onClick={() => {
            const m = exportMesh();
            if (m) download(meshTo3mf(m, base, slicer), `${base}.3mf`, 'model/3mf');
          }}
        >
          <DownloadIcon />
          {t('export.3mf')}
        </button>
        <button
          type="button"
          className="btn-primary"
          disabled={!ready}
          title={disabledTitle}
          onClick={() => {
            const m = exportMesh();
            if (m) download(meshToStl(m, `Furniture Hooves ${base}`), `${base}.stl`, 'model/stl');
          }}
        >
          <DownloadIcon />
          {t('export.stl')}
        </button>
      </div>
    </div>
  );
}
