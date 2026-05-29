import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        'apple-black': '#000000',
        'apple-white': '#f5f5f7',
        'apple-gray': '#86868b',
        'apple-green': '#34c759',
        'apple-amber': '#ff9f0a',
        'apple-red': '#ff3b30',
        'apple-blue': '#007aff',
        'glass-border': 'rgba(255,255,255,0.12)',
        'glass-bg': 'rgba(255,255,255,0.05)',
        'glass-bg-hover': 'rgba(255,255,255,0.08)',
      },
      fontFamily: {
        sans: [
          'SF Pro Display',
          'SF Pro Text',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'sans-serif',
        ],
        mono: ['SF Mono', 'Menlo', 'Monaco', 'monospace'],
      },
      fontSize: {
        'display-lg': ['4rem', { lineHeight: '1.1', fontWeight: '600' }],
        'display': ['3rem', { lineHeight: '1.15', fontWeight: '600' }],
        'title': ['1.75rem', { lineHeight: '1.3', fontWeight: '500' }],
      },
      borderRadius: {
        'apple': '16px',
      },
      backdropBlur: {
        'glass': '40px',
      },
    },
  },
  plugins: [],
};

export default config;
