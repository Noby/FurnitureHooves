import { useEffect, useMemo, useState } from 'react';
import type { Material } from '../core/defaults';
import { fileBaseName } from '../core/stats';
import { loadAdvice, sanitizeLoad, type LoadInput } from '../core/load';
import { validateParams } from '../core/validate';
import { useBootGeometry } from '../hooks/useBootGeometry';
import { storageGet, storageSet, useUrlParams } from '../hooks/useUrlParams';
import { I18nProvider, detectLang, useI18n, type Lang } from '../i18n';
import { ExportBar } from './ExportBar';
import { Header, PRINTABLES_URL, type Page } from './Header';
import { MeasureGuide } from './MeasureGuide';
import { LoadCard } from './ParamPanel/LoadCard';
import { ParamPanel } from './ParamPanel/ParamPanel';
import { StatsStrip } from './StatsStrip';
import { Viewer } from './Viewer/Viewer';

const LANG_KEY = 'furniture-hooves:lang';
const THEME_KEY = 'furniture-hooves:theme';
const MATERIAL_KEY = 'furniture-hooves:material';
const LOAD_KEY = 'furniture-hooves:load:v1';

function initialLoad(): LoadInput {
  try {
    return sanitizeLoad(JSON.parse(storageGet(LOAD_KEY) ?? 'null'));
  } catch {
    return sanitizeLoad(null);
  }
}

/** Light 'Blueprint' is the approved default; dark only when chosen explicitly. */
function initialDark(): boolean {
  return storageGet(THEME_KEY) === 'dark';
}

const pageFromHash = (): Page => (window.location.hash === '#measure' ? 'measure' : 'generator');

export function App() {
  const [lang, setLang] = useState<Lang>(() => {
    const s = storageGet(LANG_KEY);
    return s === 'cs' || s === 'en' ? s : detectLang();
  });
  const [dark, setDark] = useState(initialDark);
  const [page, setPage] = useState<Page>(pageFromHash);

  useEffect(() => {
    document.documentElement.lang = lang;
    storageSet(LANG_KEY, lang);
  }, [lang]);

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    storageSet(THEME_KEY, dark ? 'dark' : 'light');
  }, [dark]);

  useEffect(() => {
    const onHash = () => setPage(pageFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const goto = (p: Page) => {
    const url = new URL(window.location.href);
    url.hash = p === 'measure' ? 'measure' : '';
    window.history.pushState(null, '', url);
    setPage(p);
    window.scrollTo({ top: 0 });
  };

  return (
    <I18nProvider lang={lang}>
      <div className="flex min-h-screen flex-col">
        <Header page={page} onPage={goto} onLang={setLang} dark={dark} onDark={setDark} />
        <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-4 lg:px-6 lg:py-5">
          {/* generator stays mounted so the worker and the 3D scene are not recreated */}
          <div hidden={page !== 'generator'}>
            <Generator dark={dark} />
          </div>
          {page === 'measure' && <MeasureGuide onBack={() => goto('generator')} />}
        </main>
        <Footer />
      </div>
    </I18nProvider>
  );
}

function Generator({ dark }: { dark: boolean }) {
  const [params, setParams] = useUrlParams();
  const [squareLock, setSquareLock] = useState(
    () => params.legShape === 'rectangle' && params.legWidth === params.legDepth,
  );
  const [count, setCount] = useState(1);
  const [material, setMaterial] = useState<Material>(() =>
    storageGet(MATERIAL_KEY) === 'PETG' ? 'PETG' : 'PLA',
  );
  useEffect(() => storageSet(MATERIAL_KEY, material), [material]);
  const [load, setLoad] = useState<LoadInput>(initialLoad);
  useEffect(() => storageSet(LOAD_KEY, JSON.stringify(load)), [load]);

  const validation = useMemo(() => validateParams(params), [params]);
  const geo = useBootGeometry(params, validation.ok);
  const { t } = useI18n();
  // advice only from sane numbers (inputs may be mid-edit)
  const advice = useMemo(() => loadAdvice(sanitizeLoad(load), params), [load, params]);
  const tip = t('viewer.tipDynamic', {
    infill: advice.print.infill,
    perimeters: advice.print.perimeters,
    material: advice.print.material,
  });

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(320px,360px)_minmax(0,1fr)] xl:grid-cols-[380px_minmax(0,1fr)]">
      <div className="order-2 lg:order-1">
        <ParamPanel
          params={params}
          onChange={setParams}
          validation={validation}
          squareLock={squareLock}
          onSquareLock={setSquareLock}
          beforeAdvanced={
            <LoadCard
              params={params}
              onChange={setParams}
              validation={validation}
              load={load}
              onLoad={setLoad}
              material={material}
              onMaterial={setMaterial}
            />
          }
        />
      </div>
      <div className="order-1 flex min-w-0 flex-col gap-3 lg:sticky lg:top-4 lg:order-2 lg:h-[calc(100vh-110px)] lg:min-h-[640px]">
        <Viewer
          mesh={geo.mesh}
          meshParams={geo.meshParams}
          busy={geo.busy}
          error={geo.error}
          invalid={!validation.ok}
          fileName={`${fileBaseName(params, count)}.stl`}
          tip={tip}
          dark={dark}
        />
        <StatsStrip params={params} mesh={geo.mesh} material={material} onMaterial={setMaterial} />
        <ExportBar
          mesh={geo.mesh}
          meshParams={geo.meshParams}
          params={params}
          valid={validation.ok}
          count={count}
          onCount={setCount}
          slicer={advice.print}
        />
      </div>
    </div>
  );
}

function Footer() {
  const { t } = useI18n();
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-2 px-4 py-3 text-[12px] text-muted lg:px-6">
        <span>
          <a
            href={PRINTABLES_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent-text underline underline-offset-2"
          >
            {t('footer.original')} ↗
          </a>
          <span className="mx-2">·</span>
          {t('footer.note')}
        </span>
        <span className="font-mono">Furniture Hooves · Petr Václavík</span>
      </div>
    </footer>
  );
}
