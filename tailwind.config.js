/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        line: 'var(--border)',
        'line-input': 'var(--border-input)',
        ink: 'var(--text)',
        'ink-2': 'var(--text-2)',
        muted: 'var(--text-muted)',
        accent: 'var(--accent)',
        'accent-text': 'var(--accent-text)',
        'accent-soft': 'var(--accent-soft)',
        'accent-soft-text': 'var(--accent-soft-text)',
        danger: 'var(--danger)',
        'danger-soft': 'var(--danger-soft)',
        warn: 'var(--warn)',
        'warn-soft': 'var(--warn-soft)',
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'Consolas', 'monospace'],
      },
      borderRadius: { card: '10px' },
    },
  },
  plugins: [],
};
