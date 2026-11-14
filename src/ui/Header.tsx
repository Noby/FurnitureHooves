import type { Lang } from '../i18n';
import { useI18n } from '../i18n';

export const PRINTABLES_URL =
  'https://www.printables.com/model/1409520-practical-furniture-riser-boot-50x50';

export type Page = 'generator' | 'measure';

interface Props {
  page: Page;
  onPage: (p: Page) => void;
  onLang: (l: Lang) => void;
  dark: boolean;
  onDark: (d: boolean) => void;
}

export function Logo() {
  return (
    <svg width="34" height="34" viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="7" fill="var(--accent)" />
      <path d="M8 9v13h16V9h-3v10H11V9z" fill="#fff" />
      <rect x="8" y="23.5" width="16" height="2" fill="#FFD3B8" />
    </svg>
  );
}

export function Header({ page, onPage, onLang, dark, onDark }: Props) {
  const { t, lang } = useI18n();
  const navBtn = (p: Page, label: string) => (
    <button
      type="button"
      aria-current={page === p ? 'page' : undefined}
      onClick={() => onPage(p)}
      className={[
        'min-h-[44px] px-2 text-[14px] transition-colors',
        page === p
          ? 'font-semibold text-ink underline decoration-accent decoration-2 underline-offset-8'
          : 'text-ink-2 hover:text-ink',
      ].join(' ')}
    >
      {label}
    </button>
  );

  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-x-6 gap-y-1 px-4 py-2 lg:px-6">
        <a
          href="./"
          className="flex items-center gap-3"
          onClick={(e) => {
            e.preventDefault();
            onPage('generator');
          }}
        >
          <Logo />
          <span className="flex flex-col leading-tight">
            <span className="text-[17px] font-bold text-ink">{t('app.title')}</span>
            <span className="label-caps text-[10px]">{t('app.subtitle')}</span>
          </span>
        </a>
        <nav
          aria-label={t('nav.main')}
          className="order-3 flex w-full items-center gap-3 sm:order-none sm:w-auto"
        >
          {navBtn('generator', t('nav.generator'))}
          {navBtn('measure', t('nav.measure'))}
          <a
            href={PRINTABLES_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[44px] items-center px-2 text-[14px] text-ink-2 hover:text-ink"
          >
            {t('nav.printables')} ↗
          </a>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <div
            role="group"
            aria-label={t('lang.switch')}
            className="flex overflow-hidden rounded-md border border-line-input"
          >
            {(['cs', 'en'] as const).map((l) => (
              <button
                key={l}
                type="button"
                aria-pressed={lang === l}
                onClick={() => onLang(l)}
                className={[
                  'min-h-[36px] min-w-[40px] font-mono text-[12px] uppercase',
                  lang === l ? 'bg-ink text-surface' : 'bg-surface text-ink-2 hover:bg-bg',
                ].join(' ')}
              >
                {l}
              </button>
            ))}
          </div>
          <button
            type="button"
            aria-pressed={dark}
            aria-label={dark ? t('theme.light') : t('theme.dark')}
            title={dark ? t('theme.light') : t('theme.dark')}
            onClick={() => onDark(!dark)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-line-input text-ink-2 hover:border-ink-2"
          >
            {dark ? (
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                aria-hidden="true"
              >
                <circle cx="8" cy="8" r="3" />
                <path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1 1M11.6 11.6l1 1M3.4 12.6l1-1M11.6 4.4l1-1" />
              </svg>
            ) : (
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                aria-hidden="true"
              >
                <path d="M13.5 9.5A5.5 5.5 0 0 1 6.5 2.5a5.5 5.5 0 1 0 7 7z" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
